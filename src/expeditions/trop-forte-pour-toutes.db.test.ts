// US-0965 : une Bête trop forte pour toutes les Expéditions présentes sur sa Case, de plusieurs joueurs, y reste et peut
// les attaquer. Laquelle : chacune à l'instant que disent ses propres tirages (US-0943), la première dont ils tombent
// d'abord ; plusieurs : oui, chacune au plus une fois, tant qu'elles sont ensemble sur la Case (décidé le 2026-10-13).
// L'Expédition attaquée fuit (US-0945) ; les autres poursuivent leur séjour, exposées jusqu'à leur départ. Le même
// résultat, que les joueurs soient rattrapés dans un ordre ou dans l'autre, page ouverte ou par la tâche planifiée.
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { type BeteSauvage, betesSauvagesDesCases } from "@/monde/betes-sauvages";
import { recitsDuTerritoire } from "@/monde/recits";
import { PRESENCE_D_UNE_BETE_HEURES, RATTRAPER_APRES_MINUTES } from "@/reglages";
import { rattraperLesAbsents } from "@/temps/absents";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { attaqueTiree } from "@/test/attaques";
import { mondeDEssai, nomDEssai, poolDansLaTransaction, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { forceDUneBete } from "./force";
import { type HorairesDUneExpedition, retourDUneExpedition } from "./phase";
import { FUITE_DES_EXPLORATEURS } from "./recit-de-retour";
import { programmerLeRetour } from "./retour";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;
/** Le temps, en minutes, où aucune autre Bête n'apparaît avant ou après celle de l'essai : sa présence et 6 heures de marge. */
const CALME = PRESENCE_D_UNE_BETE_HEURES * HEURE + 6 * HEURE;
/** L'aller et le retour des Expéditions de l'essai, posées sur la Case sans souci de la distance à leur Foyer. */
const TRAJET = 30;
/** Au plus tant d'identifiants essayés pour trouver deux Expéditions que la Bête attaque, et une qu'elle épargne. */
const ESSAIS_AU_PLUS = 300;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai d'une Bête trop forte pour toutes (US-0965)";
/** Le titre des Récits de retour, pour les trier parmi ceux du Territoire (un Voyageur reparti en écrit aussi). */
const RETOUR = "Retour d'Expédition";
const JOUEURS = ["A", "B", "C"] as const;
type Joueur = (typeof JOUEURS)[number];

/** Les manières de vivre les mêmes Expéditions des trois joueurs. */
const MANIERES = ["d'un bloc, A, B puis C", "d'un bloc, C, B puis A", "page ouverte", "par la tâche planifiée"] as const;
type Maniere = (typeof MANIERES)[number];

/** Une Espèce telle que l'essai la choisit : sa Rareté et la force d'une de ses Bêtes (US-0905). */
type Espece = { id: string; rareteId: string; force: number };

/** Ce que l'essai relit de l'Expédition d'un joueur : sa Rencontre de la Bête, ses attaques, son demi-tour et son retour. */
type Lue = { apprivoisee: boolean[]; attaques: Date[]; rappeleeLe: Date | null; enFuite: boolean; rentreeLe: Date | null };

describe.skipIf(!URL_TEST)("une Bête trop forte pour toutes les Expéditions de sa Case (US-0965, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `pour-toutes-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms des chefs de ce lancement, qui n'y forme aucun mot interdit (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  let especes: Espece[];
  /** La commune la plus faible du jeu, qui escorte deux des trois Expéditions : bien trop faible pour la Bête. */
  let faible: Espece;
  const territoires = {} as Record<Joueur, number>;
  /** La Case, et la Bête plus rare que commune, seule sur sa Case. */
  let caseId = 0;
  let bete: BeteSauvage;
  /** L'Expédition de chaque joueur : son identifiant, le même dans toutes les manières, et l'attaque que lui promettent ses tirages. */
  const expeditions = {} as Record<Joueur, { id: number; attaque: Date | null }>;
  const lus = {} as Record<Maniere, { expeditions: Record<Joueur, Lue>; partie: boolean; recits: Record<Joueur, string[]> }>;
  const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);
  /**
   * L'arrivée sur la Case de l'Expédition du joueur `joueur` : A et C une heure avant la Bête, B une heure et demie après
   * elle, pour que ses tirages se comptent depuis sa propre Rencontre, et non depuis l'apparition de la Bête, à une heure
   * près comme à la minute.
   */
  const arrivee = (joueur: Joueur) => apres(bete.arrivee, joueur === "B" ? HEURE + 30 : -HEURE);
  /** Les horaires de l'Expédition du joueur `joueur` : de son arrivée à une heure après le départ de la Bête. */
  const horaires = (joueur: Joueur): HorairesDUneExpedition => ({
    partLe: apres(arrivee(joueur), -TRAJET),
    trajetMinutes: TRAJET,
    sejourMinutes: Math.ceil((bete.depart.getTime() - arrivee(joueur).getTime()) / MINUTE_MS) + HEURE,
  });

  /** Un chef qui vient de naître dans le Monde d'essai : son Territoire et l'instant de sa naissance. */
  const naitre = async () => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Tout", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /**
   * L'Expédition du joueur `joueur`, posée en base sous l'identifiant `id` comme un départ l'aurait fait, avec son retour
   * programmé (US-0916) : A sans escorte, B et C escortées d'une Bête de la plus faible commune.
   */
  const poser = async (client: PoolClient, joueur: Joueur, id: number) => {
    const h = horaires(joueur);
    await client.query(
      "insert into expedition (id, territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) overriding system value values ($1, $2, $3, $4, $5, $6)",
      [id, territoires[joueur], caseId, h.partLe, h.trajetMinutes, h.sejourMinutes],
    );
    if (joueur !== "A") await client.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, 1)", [id, faible.id]);
    await programmerLeRetour(client, territoires[joueur], id, h);
  };
  /** L'Expédition `id` relue avec `client`. */
  const lire = async (client: PoolClient, id: number): Promise<Lue> => {
    const { rows } = await client.query<{ rappeleeLe: Date | null; enFuite: boolean; rentreeLe: Date | null }>(
      'select rappelee_le as "rappeleeLe", en_fuite as "enFuite", rentree_le as "rentreeLe" from expedition where id = $1',
      [id],
    );
    const { rows: rencontres } = await client.query<{ apprivoisee: boolean; attaqueLe: Date | null }>(
      'select apprivoisee, attaque_le as "attaqueLe" from rencontre where expedition_id = $1 and numero = $2',
      [id, bete.numero],
    );
    return { ...rows[0], apprivoisee: rencontres.map((r) => r.apprivoisee), attaques: rencontres.flatMap((r) => (r.attaqueLe ? [r.attaqueLe] : [])) };
  };

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    const { rows } = await pool.query<{ id: string; rareteId: string; attaque: number; vie: number }>('select id, rarete_id as "rareteId", attaque, vie from espece order by id');
    especes = rows.map(({ attaque, vie, ...e }) => ({ ...e, force: forceDUneBete({ attaque, vie }) })).sort((x, y) => x.force - y.force || x.id.localeCompare(y.id));
    faible = especes.find((e) => e.rareteId === "commune" && e.force > 0)!;
    let ne = new Date();
    for (const joueur of JOUEURS) {
      const chef = await naitre();
      territoires[joueur] = chef.territoireId;
      ne = chef.ne;
    }
    const { rows: libres } = await pool.query<{ id: number }>(
      `select c.id from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) between 2 and 6
         and not exists (select 1 from bete_de_naissance n where n.case_id = c.id and n.territoire_id = any($2::int[]))
       order by c.id`,
      [territoires.A, JOUEURS.map((j) => territoires[j])],
    );
    // Une Bête plus rare que commune, bien trop forte pour une escorte de la plus faible commune, seule sur sa Case : aucune
    // autre n'y apparaît de CALME avant elle à CALME après.
    const [de, a] = [apres(ne, 3 * JOUR), apres(ne, 40 * JOUR)];
    for (const [ici, betes] of await betesSauvagesDesCases(pool, libres.map((c) => c.id), de, a)) {
      const seule = betes.find(
        (x, i) =>
          x.rareteId !== "commune" &&
          especes.find((e) => e.id === x.especeId)!.force > 2 * faible.force &&
          x.arrivee >= apres(de, CALME) &&
          x.arrivee <= apres(a, -CALME) &&
          (i === 0 || betes[i - 1].arrivee <= apres(x.arrivee, -CALME)) &&
          (i === betes.length - 1 || betes[i + 1].arrivee >= apres(x.arrivee, CALME)),
      );
      if (seule) {
        [caseId, bete] = [ici, seule];
        break;
      }
    }
    if (!caseId) throw new Error("Aucune Bête plus rare seule autour du Foyer de A.");

    // Les identifiants des trois Expéditions, tels que la Bête attaque A une fois B arrivée, puis B, plus tard, et épargne
    // C : ses tirages dépendent de l'identifiant de chacune, le même dans toutes les manières, et se comptent depuis sa
    // propre Rencontre, dès son arrivée ou celle de la Bête. A et B sont ainsi ensemble sur la Case quand A fuit.
    const promise = (joueur: Joueur, id: number) =>
      attaqueTiree(pool, { caseId, especeId: bete.especeId, numero: bete.numero }, id, {
        debut: new Date(Math.max(bete.arrivee.getTime(), arrivee(joueur).getTime())),
        fin: bete.depart,
      });
    const candidats: Record<Joueur, { id: number; attaque: Date | null }[]> = { A: [], B: [], C: [] };
    const trouves = () => {
      for (const a of candidats.A) {
        if (a.attaque! <= arrivee("B")) continue;
        const b = candidats.B.find((x) => x.id !== a.id && x.attaque! > a.attaque!);
        const c = candidats.C.find((x) => x.id !== a.id && x.id !== b?.id);
        if (b && c) return { A: a, B: b, C: c };
      }
      return null;
    };
    for (let essais = 0; !trouves(); essais++) {
      if (essais === ESSAIS_AU_PLUS) throw new Error(`${ESSAIS_AU_PLUS} identifiants essayés sans A attaquée, puis B, et C épargnée.`);
      const id = Number((await pool.query<{ id: string }>("select nextval(pg_get_serial_sequence('expedition', 'id')) as id")).rows[0].id);
      const [a, b, c] = [await promise("A", id), await promise("B", id), await promise("C", id)];
      if (a) candidats.A.push({ id, attaque: a });
      if (b) candidats.B.push({ id, attaque: b });
      if (!c) candidats.C.push({ id, attaque: null });
    }
    // A, sans escorte, attaquée la première ; B, escortée, arrivée après la Bête, attaquée ensuite ; C, escortée, épargnée.
    Object.assign(expeditions, trouves());

    const retour = (joueur: Joueur) => retourDUneExpedition(horaires(joueur))!;
    const fin = apres(retour("A"), HEURE);
    const passages = [apres(horaires("A").partLe, 7)];
    while (passages.at(-1)! <= apres(retour("A"), RATTRAPER_APRES_MINUTES)) passages.push(apres(passages.at(-1)!, HEURE));
    for (const maniere of MANIERES) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const jeu = poolDansLaTransaction(client);
        for (const joueur of JOUEURS) await poser(client, joueur, expeditions[joueur].id);
        const aLHeure = (joueur: Joueur, instant: Date) => rattraper("territoire", territoires[joueur], { pool: jeu, jusqua: instant });
        if (maniere === "d'un bloc, A, B puis C") {
          for (const joueur of JOUEURS) await aLHeure(joueur, fin);
        } else if (maniere === "d'un bloc, C, B puis A") {
          for (const joueur of [...JOUEURS].reverse()) await aLHeure(joueur, fin);
        } else if (maniere === "page ouverte") {
          // Les trois pages ouvertes ensemble, mises à l'heure toutes les vingt minutes, chaque fois dans un autre ordre.
          let k = 0;
          for (let t = horaires("A").partLe; t < fin; t = apres(t, 20), k++) for (const i of [0, 1, 2]) await aLHeure(JOUEURS[(i + k) % 3], t);
          for (const joueur of JOUEURS) await aLHeure(joueur, fin);
        } else {
          for (const instant of passages) {
            expect(await rattraperLesAbsents({ pool: jeu, maintenant: instant, parmi: { territoire: JOUEURS.map((j) => territoires[j]) } })).toMatchObject({ echecs: 0 });
          }
        }
        const recitDe = async (joueur: Joueur) =>
          (await recitsDuTerritoire(client, territoires[joueur])).filter((r) => r.titre === RETOUR).flatMap((r) => r.texte.split("\n"));
        lus[maniere] = {
          expeditions: { A: await lire(client, expeditions.A.id), B: await lire(client, expeditions.B.id), C: await lire(client, expeditions.C.id) },
          partie: ((await client.query("select 1 from bete_partie where case_id = $1 and numero = $2", [caseId, bete.numero])).rowCount ?? 0) > 0,
          recits: { A: await recitDe("A"), B: await recitDe("B"), C: await recitDe("C") },
        };
      } finally {
        await client.query("rollback");
        client.release();
      }
    }
    // Une centaine de rattrapages des trois Territoires, page ouverte : sous la charge de la suite complète, bien plus que les 30 s par défaut.
  }, 240_000);

  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it.each(MANIERES)("%s : la Bête reste sur sa Case, et chacune la voit sans qu'elle la suive", (maniere) => {
    const { expeditions: lues, partie } = lus[maniere];
    expect(partie).toBe(false);
    for (const joueur of JOUEURS) expect(lues[joueur].apprivoisee, joueur).toEqual([false]);
  });

  it.each(MANIERES)("%s : elle attaque chacune à l'instant de ses propres tirages, comptés depuis sa Rencontre, au plus une fois : A d'abord, puis B, restée après la fuite de A", (maniere) => {
    const { expeditions: lues } = lus[maniere];
    expect(lues.A.attaques).toEqual([expeditions.A.attaque]);
    expect(lues.B.attaques).toEqual([expeditions.B.attaque]);
    expect(lues.C.attaques).toEqual([]);
    // B était déjà sur la Case quand A a fui : elle y est restée, exposée, et la Bête l'a attaquée à son tour.
    expect(arrivee("B") < expeditions.A.attaque! && expeditions.A.attaque! < expeditions.B.attaque!).toBe(true);
  });

  it.each(MANIERES)("%s : chaque attaquée fuit et rentre aussitôt ; l'épargnée poursuit son séjour jusqu'au bout", (maniere) => {
    const { expeditions: lues } = lus[maniere];
    for (const joueur of ["A", "B"] as const) {
      const attaque = expeditions[joueur].attaque!;
      expect({ ...lues[joueur], apprivoisee: undefined, attaques: undefined }, joueur).toEqual({
        apprivoisee: undefined,
        attaques: undefined,
        rappeleeLe: attaque,
        enFuite: true,
        rentreeLe: apres(attaque, TRAJET),
      });
    }
    expect({ rappeleeLe: lues.C.rappeleeLe, enFuite: lues.C.enFuite, rentreeLe: lues.C.rentreeLe }).toEqual({
      rappeleeLe: null,
      enFuite: false,
      rentreeLe: retourDUneExpedition(horaires("C")),
    });
  });

  it.each(MANIERES)("%s : le récit de chaque joueur dit son combat et sa fuite, ou rien de tel ; les mêmes récits quelle que soit la manière", (maniere) => {
    const { recits } = lus[maniere];
    // A, sans escorte, est attaquée ; B, escortée, livre un combat (US-0947) ; toutes deux ont fui. C n'a rien vécu de tel.
    expect(recits.A.filter((l) => /^(Combat|Attaque) le /.test(l)).map((l) => l.split(" ")[0])).toEqual(["Attaque"]);
    expect(recits.B.filter((l) => /^(Combat|Attaque) le /.test(l)).map((l) => l.split(" ")[0])).toEqual(["Combat"]);
    for (const joueur of ["A", "B"] as const) expect(recits[joueur], joueur).toContain(FUITE_DES_EXPLORATEURS);
    expect(recits.C.some((l) => /^(Combat|Attaque) le /.test(l))).toBe(false);
    expect(recits.C).not.toContain(FUITE_DES_EXPLORATEURS);
    expect(recits).toEqual(lus[MANIERES[0]].recits);
  });
});
