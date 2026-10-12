import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { ajouterUnHabitantAuMetier, enregistrerLeMetier, habitantsDuTerritoire, nombreSansMetier, retirerUnHabitantDuMetier } from "./habitants";

// US-0315 : un joueur répartit ses Habitants sur deux appareils à la fois. Chaque appareil a ses propres
// connexions à la base, et leurs changements se croisent pour de bon : rien n'est mis en file d'attente ici.
/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai des deux appareils (US-0315)";

describe.skipIf(!URL_TEST)("des effectifs justes sur deux appareils (US-0315, sur base)", () => {
  let appareilA: Pool;
  let appareilB: Pool;
  let mondeId: number;
  const lancement = `deux-appareils-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  const nomUnique = () => nomDEssai("Duo", suffixe, numero);

  /** Un Territoire neuf, avec `dePlus` Habitants sans Métier de plus que les trois du départ ; rend aussi leurs identifiants. */
  async function naitre(dePlus = 0): Promise<{ t: number; ids: number[] }> {
    const compte = (await creerCompte(appareilA, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(appareilA, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const t = (await territoireDuCompte(appareilA, compte.id))!;
    for (let i = 0; i < dePlus; i++) await appareilA.query("insert into habitant (territoire_id, prenom) values ($1, $2)", [t, ["Arno", "Dara", "Elio"][i % 3]]);
    const { rows } = await appareilA.query<{ id: number }>("select id from habitant where territoire_id = $1 order by id", [t]);
    return { t, ids: rows.map((h) => h.id) };
  }
  /** Le Métier de chaque Habitant du Territoire, par identifiant, lu d'un appareil : une ligne par Habitant, jamais deux. */
  const metiers = async (pool: Pool, t: number) =>
    (await pool.query<{ id: number; metier: string | null }>("select id, metier from habitant where territoire_id = $1 order by id", [t])).rows;
  /** Des connexions déjà ouvertes des deux côtés : sinon leur ouverture, une à une, étalerait la rafale. */
  const chauffer = () => Promise.all([appareilA, appareilB].flatMap((pool) => Array.from({ length: 6 }, () => pool.query("select pg_sleep(0.2)"))));
  /** L'appareil de la `i`-ième demande d'une rafale : l'un, puis l'autre. */
  const appareil = (i: number) => (i % 2 ? appareilB : appareilA);
  const attendre = (ms: number) => new Promise((fin) => setTimeout(fin, ms));

  beforeAll(async () => {
    appareilA = poolDeTest({ max: 6 });
    appareilB = poolDeTest({ max: 6 });
    await preparerMondeDeTest(appareilA);
    mondeId = await mondeDEssai(appareilA, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await appareilA.query("delete from compte where email like $1", [`${lancement}-%`]);
    await Promise.all([appareilA.end(), appareilB.end()]);
  });

  it("deux changements en même temps sur le même Habitant : le dernier enregistré l'emporte, sans doublon, qu'on donne, change ou retire", async () => {
    const { t, ids } = await naitre();
    const [h] = ids;
    for (const [premier, second] of [
      ["chasseur", "mineur"],
      [null, "bucheron"],
      ["eleveur", null],
    ] as const) {
      const transaction = await appareilA.connect();
      try {
        await transaction.query("begin");
        expect(await enregistrerLeMetier(transaction, t, h, premier)).toBe(true);
        // L'autre appareil change le même Habitant pendant que le premier enregistre : il attend son tour.
        const ensuite = enregistrerLeMetier(appareilB, t, h, second);
        expect(await Promise.race([ensuite.then(() => "enregistré"), attendre(300).then(() => "en attente")])).toBe("en attente");
        await transaction.query("commit");
        expect(await ensuite).toBe(true);
      } finally {
        transaction.release();
      }
      const lus = await metiers(appareilB, t);
      expect(lus.filter((x) => x.id === h)).toEqual([{ id: h, metier: second }]);
      expect(lus).toHaveLength(3);
    }
  });

  it("des changements en rafale sur le même Habitant, depuis les deux appareils : il garde un seul Métier, l'un de ceux demandés", async () => {
    const { t, ids } = await naitre();
    const [h] = ids;
    const demandes = ["chasseur", "mineur", null, "bucheron", "eleveur", null, "cueilleur", "chasseur"];
    await chauffer();
    for (let manche = 0; manche < 4; manche++) {
      const faits = await Promise.all(demandes.map((metier, i) => enregistrerLeMetier(appareil(i + manche), t, h, metier)));
      expect(faits.every(Boolean), `manche ${manche}`).toBe(true);
      const lus = await metiers(appareilA, t);
      expect(lus.map((x) => x.id)).toEqual(ids);
      expect(demandes).toContain(lus.find((x) => x.id === h)!.metier);
    }
  });

  it("des « + » répétés très vite, depuis les deux appareils, ne donnent jamais un Métier à plus d'Habitants qu'il n'y en a sans Métier, et chacun trouve le sien tant qu'il en reste", async () => {
    const { t, ids } = await naitre(2);
    expect(ids).toHaveLength(5);
    await chauffer();
    for (let manche = 0; manche < 5; manche++) {
      await appareilA.query("update habitant set metier = null where territoire_id = $1", [t]);
      const metiersDemandes = ["bucheron", "mineur", "chasseur"];
      const donnes = await Promise.all(Array.from({ length: 12 }, (_, i) => ajouterUnHabitantAuMetier(appareil(i), t, metiersDemandes[i % 3])));
      const servis = donnes.filter((id) => id !== null);
      // Cinq sans Métier : cinq « + » servis, chacun à un Habitant différent, et les sept autres sans effet.
      expect([...servis].sort((a, b) => a - b), `manche ${manche}`).toEqual(ids);
      expect(donnes.filter((id) => id === null)).toHaveLength(7);
      expect((await metiers(appareilB, t)).filter((x) => x.metier === null)).toEqual([]);
    }
  });

  it("des « − » répétés très vite, depuis les deux appareils, ne remettent jamais sans Métier plus d'Habitants qu'il n'en exerce le Métier", async () => {
    const { t, ids } = await naitre(2);
    await chauffer();
    for (let manche = 0; manche < 5; manche++) {
      await appareilA.query("update habitant set metier = case when id = $2 then 'chasseur' else 'mineur' end where territoire_id = $1", [t, ids[2]]);
      const retires = await Promise.all(Array.from({ length: 9 }, (_, i) => retirerUnHabitantDuMetier(appareil(i), t, "mineur")));
      const servis = retires.filter((id) => id !== null);
      expect([...servis].sort((a, b) => a - b), `manche ${manche}`).toEqual(ids.filter((id) => id !== ids[2]));
      expect((await metiers(appareilB, t)).map((x) => x.metier)).toEqual([null, null, "chasseur", null, null]);
    }
  });

  it("« + », « − » et changements mêlés, depuis les deux appareils : les effectifs tombent juste, et les deux appareils relisent les mêmes", async () => {
    const { t, ids } = await naitre(3);
    await chauffer();
    for (let manche = 0; manche < 4; manche++) {
      await Promise.all([
        ajouterUnHabitantAuMetier(appareilA, t, "bucheron"),
        ajouterUnHabitantAuMetier(appareilB, t, "bucheron"),
        retirerUnHabitantDuMetier(appareilB, t, "bucheron"),
        ajouterUnHabitantAuMetier(appareilA, t, "mineur"),
        enregistrerLeMetier(appareilB, t, ids[manche], "chasseur"),
        enregistrerLeMetier(appareilA, t, ids[manche + 1], null),
        retirerUnHabitantDuMetier(appareilA, t, "chasseur"),
        ajouterUnHabitantAuMetier(appareilB, t, "eleveur"),
      ]);
      // Après rechargement, l'un et l'autre appareil lisent la même page.
      const [surA, surB] = await Promise.all([habitantsDuTerritoire(appareilA, t), habitantsDuTerritoire(appareilB, t)]);
      expect(surB, `manche ${manche}`).toEqual(surA);
      // Chaque Habitant compte une fois : la somme des effectifs est leur nombre, et les sans Métier sont bien comptés.
      expect(surA.map((h) => h.id).sort((a, b) => a - b)).toEqual(ids);
      const effectifs = Object.groupBy(surA, (h) => h.metier ?? "sans");
      expect(Object.values(effectifs).reduce((somme, groupe) => somme + groupe!.length, 0)).toBe(ids.length);
      expect(await nombreSansMetier(appareilB, t)).toBe(effectifs.sans?.length ?? 0);
    }
  });
});
