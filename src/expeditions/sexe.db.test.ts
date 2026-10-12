import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { sexeDUneBeteDeNaissance } from "@/monde/betes-de-naissance";
import { type BeteSauvage, betesSauvagesDUneCase, type Sexe, sexeTire } from "@/monde/betes-sauvages";
import type { Coordonnees } from "@/monde/hex";
import { PRESENCE_D_UNE_BETE_HEURES } from "@/reglages";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { forceDUneBete } from "./force";
import { betesQuiSuivent } from "./sexe";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;
/** Le temps, en minutes, où aucune autre Bête n'apparaît avant ou après celle d'un essai : sa présence et 6 heures de marge. */
const CALME = PRESENCE_D_UNE_BETE_HEURES * HEURE + 6 * HEURE;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du sexe tiré au hasard (US-0937)";

describe.skipIf(!URL_TEST)("le sexe tiré au hasard (US-0937, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  /** La graine du Monde d'essai, d'où se tirent les sexes de ses Bêtes. */
  let graine: number;
  /** L'Espèce la plus forte du jeu, d'une escorte qui a toute Bête à portée, et la commune la plus faible. */
  let [forte, faible] = ["", ""];
  let forceDeLaFaible = 0;
  const forces = new Map<string, number>();
  const lancement = `sexe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les Cases déjà prises par un essai de ce fichier : chacun a la sienne, sans Expédition d'un autre. */
  const prises = new Set<number>();
  /** Une heure du jeu, `minutes` après `instant`. */
  const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);

  /** Un chef qui vient de naître dans le Monde d'essai : son Territoire et l'instant de sa naissance, d'où part son temps. */
  const naitre = async () => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Hasard", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /**
   * Une Bête sauvage seule, telle que `accepte` la veut, sur une Case libre à 2 à 6 Cases du Foyer du Territoire qu'aucun
   * autre essai n'a prise, apparue après `apresLe` : aucune autre n'apparaît sur sa Case de CALME heures avant elle à CALME
   * heures après. Sa Case, sa place et la Bête.
   */
  const uneBeteSeule = async (territoireId: number, apresLe: Date, accepte: (b: BeteSauvage, place: Coordonnees) => boolean) => {
    const fin = apres(apresLe, 30 * JOUR);
    const { rows: cases } = await pool.query<Coordonnees & { id: number }>(
      `select c.id, c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) between 2 and 6
       order by c.q, c.r`,
      [territoireId],
    );
    for (const ici of cases.filter((c) => !prises.has(c.id))) {
      const betes = await betesSauvagesDUneCase(pool, ici.id, apresLe, fin);
      const bete = betes.find(
        (b, i) =>
          accepte(b, ici) &&
          b.arrivee >= apres(apresLe, CALME) &&
          b.arrivee <= apres(fin, -CALME) &&
          (i === 0 || betes[i - 1].arrivee <= apres(b.arrivee, -CALME)) &&
          (i === betes.length - 1 || betes[i + 1].arrivee >= apres(b.arrivee, CALME)),
      );
      if (bete) {
        prises.add(ici.id);
        return { caseId: ici.id, place: { q: ici.q, r: ici.r }, bete };
      }
    }
    throw new Error("Aucune Bête seule telle que l'essai la veut.");
  };
  /** Une Bête plus rare que commune, du sexe `sexe` à son Apprivoisement. */
  const rareDuSexe = (sexe: Sexe) => (b: BeteSauvage, place: Coordonnees) => b.rareteId !== "commune" && sexeTire({ graine, ...place }, b.numero) === sexe;
  /** Une Expédition du Territoire sur la Case `caseId`, telle qu'un départ la poserait, avec une escorte d'une Bête de l'Espèce `especeId`. */
  const poser = async (territoireId: number, caseId: number, arrivee: Date, sejourMinutes: number, especeId: string) => {
    const { rows } = await pool.query<{ id: number }>(
      "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, 30, $4) returning id",
      [territoireId, caseId, apres(arrivee, -30), sejourMinutes],
    );
    await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, 1)", [rows[0].id, especeId]);
    return rows[0].id;
  };
  /** Le Territoire mis à l'heure du jeu `instant`, comme à l'ouverture d'une page : le mécanisme unique du temps. */
  const rattraperA = (territoireId: number, instant: Date) => rattraper("territoire", territoireId, { pool, jusqua: instant });
  /** Le sexe retenu par chaque Rencontre de l'Expédition, dans l'ordre des apparitions, et si sa Bête la suit. */
  const sexesRetenus = async (expeditionId: number) =>
    (await pool.query<{ apprivoisee: boolean; sexe: Sexe | null }>("select apprivoisee, sexe from rencontre where expedition_id = $1 order by apparue_le, id", [expeditionId]))
      .rows;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    graine = Number((await pool.query<{ graine: string }>("select graine from monde where id = $1", [mondeId])).rows[0].graine);
    // Les Bêtes emmenées lors d'un lancement précédent de ce fichier sont revenues sur leur Case.
    await pool.query("delete from bete_partie p using case_du_monde c where c.id = p.case_id and c.monde_id = $1", [mondeId]);
    const { rows } = await pool.query<{ id: string; rareteId: string; attaque: number; vie: number }>(`select id, rarete_id as "rareteId", attaque, vie from espece order by id`);
    for (const e of rows) forces.set(e.id, forceDUneBete(e));
    forte = [...forces].sort((x, y) => y[1] - x[1])[0][0];
    [faible, forceDeLaFaible] = rows
      .filter((e) => e.rareteId === "commune")
      .map((e) => [e.id, forces.get(e.id)!] as const)
      .sort((x, y) => x[1] - y[1])[0];
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.query("delete from bete_partie p using case_du_monde c where c.id = p.case_id and c.monde_id = $1", [mondeId]);
    await pool.end();
  });

  it("à l'Apprivoisement, la Bête qui suit l'Expédition est mâle ou femelle, tiré au hasard, et ne change plus jusqu'au retour", async () => {
    const { territoireId, ne } = await naitre();
    const male = await uneBeteSeule(territoireId, apres(ne, 3 * JOUR), rareDuSexe("male"));
    const femelle = await uneBeteSeule(territoireId, apres(ne, 3 * JOUR), rareDuSexe("femelle"));
    // Chaque escorte arrive une heure après sa Bête et reste quatre heures.
    const versLeMale = await poser(territoireId, male.caseId, apres(male.bete.arrivee, HEURE), 4 * HEURE, forte);
    const versLaFemelle = await poser(territoireId, femelle.caseId, apres(femelle.bete.arrivee, HEURE), 4 * HEURE, forte);
    const fin = new Date(Math.max(male.bete.arrivee.getTime(), femelle.bete.arrivee.getTime()));

    await rattraperA(territoireId, apres(fin, 2 * HEURE));
    expect(await betesQuiSuivent(pool, versLeMale)).toEqual([{ especeId: male.bete.especeId, sexe: "male", depuis: apres(male.bete.arrivee, HEURE) }]);
    expect(await betesQuiSuivent(pool, versLaFemelle)).toEqual([{ especeId: femelle.bete.especeId, sexe: "femelle", depuis: apres(femelle.bete.arrivee, HEURE) }]);
    // Rentrées au Foyer (US-0916), puis des jours plus tard : chacune garde le sien.
    await rattraperA(territoireId, apres(fin, 3 * JOUR));
    expect(await sexesRetenus(versLeMale)).toEqual([{ apprivoisee: true, sexe: "male" }]);
    expect(await sexesRetenus(versLaFemelle)).toEqual([{ apprivoisee: true, sexe: "femelle" }]);
  });

  it("une Bête vue sans être à portée reste sur sa Case : elle n'a pas de sexe", async () => {
    const { territoireId, ne } = await naitre();
    const { caseId, bete } = await uneBeteSeule(territoireId, apres(ne, 3 * JOUR), (b) => b.rareteId !== "commune" && forces.get(b.especeId)! > forceDeLaFaible);
    // Une escorte de la commune la plus faible, trop faible pour elle, arrive une heure après elle.
    const id = await poser(territoireId, caseId, apres(bete.arrivee, HEURE), 4 * HEURE, faible);

    await rattraperA(territoireId, apres(bete.depart, JOUR));
    expect(await sexesRetenus(id)).toEqual([{ apprivoisee: false, sexe: null }]);
    expect(await betesQuiSuivent(pool, id)).toEqual([]);
  });

  it("par tranches comme d'un bloc, à toute heure, chaque Bête a le sexe de son tirage", async () => {
    const [a, b] = [await naitre(), await naitre()];
    /** Un mâle et une femelle sur des Cases du Territoire, chacun suivi par une escorte arrivée une heure avant lui. */
    const unMaleEtUneFemelle = async (t: { territoireId: number; ne: Date }) => {
      const betes = [await uneBeteSeule(t.territoireId, apres(t.ne, 3 * JOUR), rareDuSexe("male")), await uneBeteSeule(t.territoireId, apres(t.ne, 3 * JOUR), rareDuSexe("femelle"))];
      const ids = [];
      for (const { caseId, bete } of betes) ids.push(await poser(t.territoireId, caseId, apres(bete.arrivee, -HEURE), 4 * HEURE, forte));
      return { ids, fin: apres(new Date(Math.max(...betes.map(({ bete }) => bete.arrivee.getTime()))), JOUR), arrivees: betes.map(({ bete }) => bete.arrivee) };
    };
    const [dUnBloc, parTranches] = [await unMaleEtUneFemelle(a), await unMaleEtUneFemelle(b)];
    const sexes = async (ids: number[]) => Promise.all(ids.map(async (id) => (await betesQuiSuivent(pool, id)).map((bete) => bete.sexe)));

    await rattraperA(a.territoireId, dUnBloc.fin);
    // Des tranches de 25 minutes autour de chaque Apprivoisement : il tombe au milieu de l'une d'elles.
    for (const arrivee of [...parTranches.arrivees].sort((x, y) => x.getTime() - y.getTime())) {
      for (let k = -6; k <= 12; k++) await rattraperA(b.territoireId, apres(arrivee, 25 * k + 7));
    }
    await rattraperA(b.territoireId, parTranches.fin);
    expect(await sexes(dUnBloc.ids)).toEqual([["male"], ["femelle"]]);
    expect(await sexes(parTranches.ids)).toEqual([["male"], ["femelle"]]);
  });

  it("une Bête de naissance apprivoisée a son sexe, tiré de même", async () => {
    const { territoireId, ne } = await naitre();
    const { rows } = await pool.query<{ id: number; caseId: number }>(
      `select b.id, b.case_id as "caseId" from bete_de_naissance b
       join case_du_monde c on c.id = b.case_id where b.territoire_id = $1 and c.chef_id is null order by b.id limit 1`,
      [territoireId],
    );
    const bn = rows[0];
    const id = await poser(territoireId, bn.caseId, apres(ne, HEURE), HEURE, faible);

    await rattraperA(territoireId, apres(ne, 10 * HEURE));
    const { rows: retenue } = await pool.query("select apprivoisee, sexe from rencontre where expedition_id = $1 and bete_de_naissance_id = $2", [id, bn.id]);
    expect(retenue).toEqual([{ apprivoisee: true, sexe: sexeDUneBeteDeNaissance(graine, bn.id) }]);
  });

  it("la base refuse une Bête apprivoisée sans sexe, et un sexe à une Bête restée sur sa Case", async () => {
    const { territoireId, ne } = await naitre();
    const { caseId, bete } = await uneBeteSeule(territoireId, apres(ne, 3 * JOUR), () => true);
    const id = await poser(territoireId, caseId, apres(bete.arrivee, HEURE), HEURE, faible);
    const inserer = (apprivoisee: boolean, sexe: Sexe | null) =>
      pool.query(
        "insert into rencontre (expedition_id, numero, espece_id, apparue_le, vue_le, apprivoisee, sexe) values ($1, $2, $3, $4, $4, $5, $6)",
        [id, bete.numero, bete.especeId, bete.arrivee, apprivoisee, sexe],
      );
    await expect(inserer(true, null)).rejects.toThrow(/rencontre_sexe_de_l_apprivoisee/);
    await expect(inserer(false, "male")).rejects.toThrow(/rencontre_sexe_de_l_apprivoisee/);
  });
});
