// US-0962 : chaque Expédition présente voit la Bête. Quand une Bête sauvage se montre sur une Case où séjournent les
// Expéditions de plusieurs joueurs, toutes la voient, et son Espèce entre au Bestiaire de chacun ; une seule l'emmène
// (US-0934, en attendant les chances proportionnelles à la force de US-0963). Les Expéditions de joueurs différents ne se
// combattent jamais, et chaque joueur n'apprend la présence des autres que par son récit de retour (décidé le
// 2026-10-10). Comme US-0922, les mêmes Expéditions sont vécues page ouverte, d'un bloc au retour des joueurs, dans un
// ordre puis dans l'autre, ou par la seule tâche planifiée, et tout ce qu'elles laissent se compare.
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bestiaireDuTerritoire, type EspeceAuBestiaire } from "@/bestiaire/bestiaire";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { type BeteSauvage, betesSauvagesDesCases } from "@/monde/betes-sauvages";
import { type Recit, recitsDuTerritoire } from "@/monde/recits";
import { PRESENCE_D_UNE_BETE_HEURES, RATTRAPER_APRES_MINUTES } from "@/reglages";
import { rattraperLesAbsents } from "@/temps/absents";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDansLaTransaction, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { expeditionsEnCours } from "./en-cours";
import { forceDUneBete } from "./force";
import { type HorairesDUneExpedition, retourDUneExpedition, sejourDUneExpedition } from "./phase";
import { rencontresDUneExpedition } from "./rencontres";
import { programmerLeRetour } from "./retour";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;
/** Le temps, en minutes, où aucune autre Bête n'apparaît avant ou après celle de l'essai : sa présence et 6 heures de marge. */
const CALME = PRESENCE_D_UNE_BETE_HEURES * HEURE + 6 * HEURE;
/** L'aller et le retour des Expéditions de l'essai, posées sur la Case sans souci de la distance à leur Foyer. */
const TRAJET = 30;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai d'une Case partagée (US-0962)";
/** Le titre des Récits de retour, pour les trier parmi ceux du Territoire (un Voyageur reparti en écrit aussi). */
const RETOUR = "Retour d'Expédition";
/** La ligne du récit de retour qui dit que d'autres joueurs séjournaient sur la Case, sans les nommer. */
const AUTRES = "D'autres Expéditions séjournaient sur la Case.";

/** Les manières de vivre les mêmes Expéditions des deux joueurs, A et B. */
const MANIERES = ["page ouverte", "d'un bloc, A d'abord", "d'un bloc, B d'abord", "par la tâche planifiée"] as const;
type Maniere = (typeof MANIERES)[number];
type Joueur = "A" | "B";

/** Une Espèce telle que l'essai la choisit pour une escorte : sa Rareté et la force d'une de ses Bêtes (US-0905). */
type Espece = { id: string; rareteId: string; force: number };

/** Ce que les Expéditions d'un joueur lui laissent, une fois rentrées, tel qu'il le voit. */
type Bilan = {
  /** Ses récits de retour, tels que la page Récits les liste, du plus récent au plus ancien. */
  recits: Pick<Recit, "texte" | "survenuLe" | "rencontres">[];
  bestiaire: EspeceAuBestiaire[];
  effectif: { especeId: string; sexe: string; nombre: number }[];
  /** L'escorte de chacune de ses Expéditions, et l'heure où elle est rentrée. */
  expeditions: { escorte: { especeId: string; nombre: number }[]; rentreeLe: Date | null }[];
  enCours: number;
};

describe.skipIf(!URL_TEST)("chaque Expédition présente voit la Bête (US-0962, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `case-partagee-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** L'Espèce la plus forte du jeu, qui escorte A, et la commune la plus faible, qui escorte B. */
  let [forte, faible]: Espece[] = [];
  /** Les Territoires des deux joueurs et l'instant de la naissance du dernier. */
  const territoires = {} as Record<Joueur, number>;
  let ne: Date;
  /** La Case partagée, et la Bête commune qui s'y montre seule pendant les deux séjours. */
  let caseId: number;
  let bete: BeteSauvage;
  /** Les horaires des Expéditions de A et de B sur la Case. */
  const horaires = {} as Record<Joueur, HorairesDUneExpedition>;
  /** L'instant du jeu où tout est vécu : les deux Expéditions sont rentrées, et la tâche planifiée vient de passer. */
  let fin: Date;
  let instantsDeLaPage: Date[];
  let passagesDeLaTache: Date[];
  const bilans = {} as Record<Maniere, Record<Joueur, Bilan>>;
  const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);
  /** Les horaires d'une Expédition qui arrive sur sa Case à `arrivee` et y séjourne `sejourMinutes`. */
  const arriveeA = (arrivee: Date, sejourMinutes: number): HorairesDUneExpedition => ({ partLe: apres(arrivee, -TRAJET), trajetMinutes: TRAJET, sejourMinutes });

  /** Un chef qui vient de naître dans le Monde d'essai : son Territoire et l'instant de sa naissance. */
  const naitre = async () => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Part", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /**
   * Une Expédition du Territoire sur la Case `ici`, posée en base comme un départ l'aurait fait, avec ses horaires, une
   * Bête de l'Espèce `escorte` s'il en a une, et son retour au Foyer programmé (US-0916) ; sans souci de la portée ni des
   * explorateurs : pour mettre sur une même Case les Expéditions de Territoires éloignés.
   */
  const poser = async (client: PoolClient, territoireId: number, ici: number, h: HorairesDUneExpedition, escorte?: Espece) => {
    const { rows } = await client.query<{ id: number }>(
      "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, $4, $5) returning id",
      [territoireId, ici, h.partLe, h.trajetMinutes, h.sejourMinutes],
    );
    if (escorte) await client.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, 1)", [rows[0].id, escorte.id]);
    await programmerLeRetour(client, territoireId, rows[0].id, h);
    return rows[0].id;
  };
  /**
   * Un essai dans une transaction annulée ensuite, où chaque transaction du jeu (un rattrapage) devient un point de reprise
   * (poolDansLaTransaction) : le suivant repart des mêmes Territoires, devant les mêmes Bêtes sauvages.
   */
  const enEssai = async <T,>(essai: (client: PoolClient, jeu: Pool) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      return await essai(client, poolDansLaTransaction(client));
    } finally {
      await client.query("rollback");
      client.release();
    }
  };
  /** Les récits de retour du Territoire, tels que la page Récits les liste. */
  const recitsDeRetour = async (jeu: Pool, territoireId: number) =>
    (await recitsDuTerritoire(jeu, territoireId)).filter((r) => r.titre === RETOUR).map(({ texte, survenuLe, rencontres }) => ({ texte, survenuLe, rencontres }));
  /** Ce que les Expéditions `ids` laissent au Territoire, lu avec `jeu` à l'instant `fin`. */
  const bilan = async (jeu: Pool, territoireId: number, ids: number[]): Promise<Bilan> => {
    const expeditions = [];
    for (const id of ids) {
      const { rows: escorte } = await jeu.query<{ especeId: string; nombre: number }>('select espece_id as "especeId", nombre from expedition_escorte where expedition_id = $1', [id]);
      const { rows } = await jeu.query<{ rentreeLe: Date | null }>('select rentree_le as "rentreeLe" from expedition where id = $1', [id]);
      expeditions.push({ escorte, rentreeLe: rows[0].rentreeLe });
    }
    const { rows: effectif } = await jeu.query<{ especeId: string; sexe: string; nombre: number }>(
      'select espece_id as "especeId", sexe, nombre from effectif where territoire_id = $1 order by espece_id, sexe',
      [territoireId],
    );
    return {
      recits: await recitsDeRetour(jeu, territoireId),
      bestiaire: await bestiaireDuTerritoire(jeu, territoireId),
      effectif,
      expeditions,
      enCours: (await expeditionsEnCours(jeu, territoireId, fin)).length,
    };
  };

  /**
   * Les Expéditions de A et de B vécues de la manière `maniere` : A, posée la première, puis B ; ce qu'elles ont laissé à
   * chacun à l'instant `fin`. Page ouverte, les deux joueurs sont mis à l'heure ensemble, tantôt A d'abord, tantôt B.
   */
  const vivre = (maniere: Maniere) =>
    enEssai(async (client, jeu) => {
      const ids = { A: await poser(client, territoires.A, caseId, horaires.A, forte), B: await poser(client, territoires.B, caseId, horaires.B, faible) };
      const aLHeure = (joueur: Joueur, instant: Date) => rattraper("territoire", territoires[joueur], { pool: jeu, jusqua: instant });
      if (maniere === "page ouverte") {
        for (const [i, instant] of instantsDeLaPage.entries()) for (const joueur of i % 2 ? (["B", "A"] as const) : (["A", "B"] as const)) await aLHeure(joueur, instant);
      } else if (maniere === "par la tâche planifiée") {
        for (const instant of passagesDeLaTache) {
          expect(await rattraperLesAbsents({ pool: jeu, maintenant: instant, parmi: { territoire: [territoires.A, territoires.B] } })).toMatchObject({ rattrapes: 2, echecs: 0 });
        }
      } else {
        for (const joueur of maniere === "d'un bloc, A d'abord" ? (["A", "B"] as const) : (["B", "A"] as const)) await aLHeure(joueur, fin);
      }
      for (const joueur of ["A", "B"] as const) expect(await lireMarquePage(jeu, "territoire", territoires[joueur])).toEqual(fin);
      return { A: await bilan(jeu, territoires.A, [ids.A]), B: await bilan(jeu, territoires.B, [ids.B]) };
    });

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    const { rows: especes } = await pool.query<{ id: string; rareteId: string; attaque: number; vie: number }>(
      'select id, rarete_id as "rareteId", attaque, vie from espece order by id',
    );
    const parForce = especes.map(({ attaque, vie, ...e }) => ({ ...e, force: forceDUneBete({ attaque, vie }) })).sort((x, y) => x.force - y.force);
    forte = parForce.at(-1)!;
    faible = parForce.find((e) => e.rareteId === "commune")!;

    const [a, b] = [await naitre(), await naitre()];
    [territoires.A, territoires.B] = [a.territoireId, b.territoireId];
    ne = b.ne;
    // A a une Bête de l'Espèce la plus forte du jeu, B une de la commune la plus faible : chacun l'emmène en escorte.
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 1), ($3, $4, 'male', 1)", [
      territoires.A,
      forte.id,
      territoires.B,
      faible.id,
    ]);
    // Une Bête commune, à portée des deux escortes, seule sur une Case libre à 2 à 6 Cases du Foyer de A, hors des Cases des
    // Bêtes de naissance des deux joueurs : aucune autre Bête n'y apparaît de CALME heures avant elle à CALME heures après.
    const { rows: cases } = await pool.query<{ id: number }>(
      `select c.id from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) between 2 and 6
         and not exists (select 1 from bete_de_naissance n where n.case_id = c.id and n.territoire_id = any($2::int[]))
       order by c.id`,
      [territoires.A, [territoires.A, territoires.B]],
    );
    const [de, a30] = [apres(ne, 3 * JOUR), apres(ne, 33 * JOUR)];
    const parCase = await betesSauvagesDesCases(pool, cases.map((c) => c.id), de, a30);
    const seule = [...parCase].flatMap(([id, betes]) =>
      betes
        .filter(
          (x, i) =>
            x.rareteId === "commune" &&
            x.arrivee >= apres(de, CALME) &&
            x.arrivee <= apres(a30, -CALME) &&
            (i === 0 || betes[i - 1].arrivee <= apres(x.arrivee, -CALME)) &&
            (i === betes.length - 1 || betes[i + 1].arrivee >= apres(x.arrivee, CALME)),
        )
        .map((x) => ({ id, x })),
    )[0];
    if (!seule) throw new Error("Aucune Bête commune seule autour du Foyer de A.");
    [caseId, bete] = [seule.id, seule.x];
    // A arrive une heure avant la Bête et séjourne quatre heures ; B, arrivé deux heures avant elle, en séjourne six : la
    // Bête apparaît pendant leurs deux séjours.
    horaires.A = arriveeA(apres(bete.arrivee, -HEURE), 4 * HEURE);
    horaires.B = arriveeA(apres(bete.arrivee, -2 * HEURE), 6 * HEURE);
    const retours = (["A", "B"] as const).map((j) => retourDUneExpedition(horaires[j])!);
    const premierDepart = horaires.B.partLe;

    // La tâche planifiée passe toutes les heures, sept minutes après le premier départ, jusqu'à son premier passage qui
    // rattrape le dernier retour : c'est la fin de l'essai, pour toutes les manières.
    passagesDeLaTache = [apres(premierDepart, 7)];
    while (passagesDeLaTache.at(-1)! <= apres(retours[1], RATTRAPER_APRES_MINUTES)) passagesDeLaTache.push(apres(passagesDeLaTache.at(-1)!, HEURE));
    fin = passagesDeLaTache.at(-1)!;
    // Page ouverte : relue toutes les 10 minutes du jeu, et à chaque instant qui compte, une milliseconde avant, pile et une
    // après : chaque arrivée, fin de séjour et retour, l'apparition de la Bête et son départ.
    const instants = new Set([fin.getTime()]);
    for (let t = premierDepart.getTime(); t <= fin.getTime(); t += 10 * MINUTE_MS) instants.add(t);
    const sejours = (["A", "B"] as const).map((j) => sejourDUneExpedition(horaires[j])!);
    for (const instant of [...sejours.flatMap((s) => [s.debut, s.fin]), ...retours, bete.arrivee, bete.depart]) [-1, 0, 1].forEach((ms) => instants.add(instant.getTime() + ms));
    instantsDeLaPage = [...instants].filter((t) => t >= premierDepart.getTime() && t <= fin.getTime()).sort((x, y) => x - y).map((t) => new Date(t));

    for (const maniere of MANIERES) bilans[maniere] = await vivre(maniere);
    // Près de 150 rattrapages à la suite, page ouverte : sous la charge de la suite complète, bien plus que les 30 s par défaut.
  }, 240_000);

  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  const [ouverte, ...autres] = MANIERES;

  it("quand une Bête apparaît sur une Case où séjournent les Expéditions de deux joueurs, toutes deux la voient à son apparition, et son Espèce entre au Bestiaire de chacun", () => {
    const { A, B } = bilans[ouverte];
    // Chaque récit de retour la montre, vue à l'heure de son apparition, nouvelle au Bestiaire de son joueur.
    const vue = { especeId: bete.especeId, vueLe: bete.arrivee, nouvelleEspece: true };
    expect(A.recits).toHaveLength(1);
    expect(B.recits).toHaveLength(1);
    expect(A.recits[0].rencontres).toEqual([expect.objectContaining({ ...vue, issue: "apprivoisee" })]);
    // Une seule l'emmène : A, posée la première, à égalité d'instant (US-0934) ; ce que le récit de B en dit est US-0964.
    expect(B.recits[0].rencontres).toEqual([expect.objectContaining({ ...vue, sexe: null })]);
    expect(B.recits[0].rencontres![0].issue).not.toBe("apprivoisee");
    // Le texte de chaque retour le dit : A la ramène au Foyer ; B l'a vue, et rien ne lui manquait pour l'emmener.
    expect(A.recits[0].texte).toMatch(/^Une Bête s'est montrée\.\nBête ramenée au Foyer : .+\.$/m);
    expect(B.recits[0].texte.split("\n").at(-1)).toBe("Une Bête s'est montrée.");
    expect(B.recits[0].texte).not.toMatch(/ramenée|trop forte|aucune Bête ne les a suivis/);
    expect(A.bestiaire).toEqual([{ especeId: bete.especeId, etat: "apprivoisee", croiseeLe: bete.arrivee }]);
    expect(B.bestiaire).toEqual([{ especeId: bete.especeId, etat: "croisee", croiseeLe: bete.arrivee }]);
    for (const maniere of autres) {
      for (const joueur of ["A", "B"] as const) {
        const { recits, bestiaire } = bilans[maniere][joueur];
        expect({ rencontres: recits.map((r) => r.rencontres), bestiaire }, `${joueur}, ${maniere}`).toEqual({
          rencontres: bilans[ouverte][joueur].recits.map((r) => r.rencontres),
          bestiaire: bilans[ouverte][joueur].bestiaire,
        });
      }
    }
  });

  it("les Expéditions des deux joueurs ne se combattent pas : chacune finit son séjour et rentre à son heure, avec toute son escorte", () => {
    const sexe = bilans[ouverte].A.recits[0].rencontres![0].sexe!;
    for (const maniere of MANIERES) {
      const { A, B } = bilans[maniere];
      expect(A.expeditions, maniere).toEqual([{ escorte: [{ especeId: forte.id, nombre: 1 }], rentreeLe: retourDUneExpedition(horaires.A) }]);
      expect(B.expeditions, maniere).toEqual([{ escorte: [{ especeId: faible.id, nombre: 1 }], rentreeLe: retourDUneExpedition(horaires.B) }]);
      // Rien de l'escorte n'est perdu : A garde sa Bête et gagne celle qui l'a suivie, B garde la sienne.
      const ramenee = { especeId: bete.especeId, sexe, nombre: 1 };
      expect(A.effectif, maniere).toEqual(expect.arrayContaining([{ especeId: forte.id, sexe: "male", nombre: 1 }, ramenee]));
      expect(A.effectif, maniere).toHaveLength(2);
      expect(B.effectif, maniere).toEqual([{ especeId: faible.id, sexe: "male", nombre: 1 }]);
      expect({ A: A.enCours, B: B.enCours }, maniere).toEqual({ A: 0, B: 0 });
    }
  });

  it("chaque joueur apprend par son récit de retour que d'autres Expéditions séjournaient sur la Case, sans qu'elles soient nommées", () => {
    for (const joueur of ["A", "B"] as const) {
      const [recit] = bilans[ouverte][joueur].recits;
      expect(recit.texte.split("\n"), joueur).toContain(AUTRES);
      expect(recit.survenuLe, joueur).toEqual(retourDUneExpedition(horaires[joueur]));
      for (const maniere of autres) expect(bilans[maniere][joueur].recits, `${joueur}, ${maniere}`).toEqual(bilans[ouverte][joueur].recits);
    }
  });

  it("le récit n'en dit rien sans un instant de séjour en commun avec l'Expédition d'un autre joueur, ni pour une autre du même joueur ; un seul instant suffit", async () => {
    // Peu après la naissance des chefs : leurs Territoires se rattrapent vite.
    const t0 = apres(ne, 2 * HEURE);
    /**
     * Deux Expéditions de A sur la Case, l'une de deux heures, l'autre arrivée une heure après elle et partie en même
     * temps ; une de B, arrivée `decalage` minutes avant leur départ : ce que dit le récit de chacune.
     */
    const recits = (decalage: number) =>
      enEssai(async (client, jeu) => {
        await poser(client, territoires.A, caseId, arriveeA(t0, 2 * HEURE));
        await poser(client, territoires.A, caseId, arriveeA(apres(t0, HEURE), HEURE));
        await poser(client, territoires.B, caseId, arriveeA(apres(t0, 2 * HEURE - decalage), HEURE));
        for (const t of [territoires.A, territoires.B]) await rattraper("territoire", t, { pool: jeu, jusqua: apres(t0, 4 * HEURE) });
        const [a, b] = [await recitsDeRetour(jeu, territoires.A), await recitsDeRetour(jeu, territoires.B)];
        expect([a.length, b.length]).toEqual([2, 1]);
        return [...a, ...b].map((r) => r.texte.split("\n").includes(AUTRES));
      });
    // B arrive à l'instant où celles de A s'en vont : aucun séjour en commun.
    expect(await recits(0)).toEqual([false, false, false]);
    // B arrive une minute avant leur départ.
    expect(await recits(1)).toEqual([true, true, true]);
  }, 60_000);

  it("à l'instant où une Bête suit une Expédition, celles présentes à cet instant la voient aussi, même du même joueur et sur la Case d'une Bête de naissance ; une seule la ramène", async () => {
    // La première Bête de naissance de A, sur une Case restée libre : deux Expéditions de A y arrivent au même instant.
    const { rows } = await pool.query<{ id: number; caseId: number; especeId: string; arrivee: Date }>(
      `select b.id, b.case_id as "caseId", b.espece_id as "especeId", b.arrivee from bete_de_naissance b
       join case_du_monde c on c.id = b.case_id where b.territoire_id = $1 and c.chef_id is null order by b.id limit 1`,
      [territoires.A],
    );
    const bn = rows[0];
    const arrivee = apres(bn.arrivee, HEURE);
    const { vues, recits } = await enEssai(async (client, jeu) => {
      const ids = [await poser(client, territoires.A, bn.caseId, arriveeA(arrivee, HEURE)), await poser(client, territoires.A, bn.caseId, arriveeA(arrivee, 2 * HEURE))];
      await rattraper("territoire", territoires.A, { pool: jeu, jusqua: apres(arrivee, 3 * HEURE) });
      const lues = [];
      for (const id of ids) lues.push((await rencontresDUneExpedition(jeu, id)).findIndex((r) => r.beteDeNaissanceId === bn.id));
      // Les récits de la première, rentrée la première, puis de la seconde.
      return { vues: lues, recits: (await recitsDeRetour(jeu, territoires.A)).reverse() };
    });
    expect(vues.every((i) => i >= 0)).toBe(true);
    const [premiere, seconde] = vues.map((i, k) => recits[k].rencontres![i]);
    expect(premiere).toMatchObject({ especeId: bn.especeId, vueLe: arrivee, issue: "apprivoisee" });
    // La seconde la voit au même instant ; partie avec l'autre, elle n'est pas « restée sur sa Case ». US-0950 : repartie à
    // cet instant même.
    expect(seconde).toMatchObject({ especeId: bn.especeId, vueLe: arrivee, issue: "repartie", repartieLe: arrivee, sexe: null });
  });
});
