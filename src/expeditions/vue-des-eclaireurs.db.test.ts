// US-0970 : les pigeons gardent les Bêtes en vue. Les Éclaireurs d'une Expédition (US-0976) lui gardent en vue les Bêtes de
// sa Case un temps après la fin de leur durée (src/expeditions/vue-des-eclaireurs.ts) : arrivée peu après le départ d'une
// Bête, elle la rencontre encore, et peut l'emmener ; les autres Expéditions de la Case, sans ces Éclaireurs, ne la voient
// plus. Comme US-0962 (src/expeditions/case-partagee.db.test.ts), les mêmes Expéditions de deux joueurs sont vécues page
// ouverte, d'un bloc au retour des joueurs, dans un ordre puis dans l'autre, ou par la seule tâche planifiée, et tout ce
// qu'elles laissent se compare.
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bestiaireDuTerritoire, type EspeceAuBestiaire } from "@/bestiaire/bestiaire";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { type BeteSauvage, betesSauvagesDesCases } from "@/monde/betes-sauvages";
import { type Recit, recitsDuTerritoire } from "@/monde/recits";
import { MINUTES_DE_VUE_AU_PLUS, MINUTES_DE_VUE_PAR_ECLAIREUR, PRESENCE_D_UNE_BETE_HEURES, RATTRAPER_APRES_MINUTES } from "@/reglages";
import { rattraperLesAbsents } from "@/temps/absents";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDansLaTransaction, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { COMMUNE } from "./apprivoisement";
import { forceDUneBete } from "./force";
import { type HorairesDUneExpedition, retourDUneExpedition, sejourDUneExpedition } from "./phase";
import { programmerLeRetour } from "./retour";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;
/** Le temps, en minutes, où aucune autre Bête n'apparaît avant ou après celle de l'essai : sa présence et 6 heures de marge. */
const CALME = PRESENCE_D_UNE_BETE_HEURES * HEURE + 6 * HEURE;
/** L'aller et le retour des Expéditions de l'essai, posées sur la Case sans souci de la distance à leur Foyer. */
const TRAJET = 30;
/** Le séjour des Expéditions de l'essai sur la Case. */
const SEJOUR = 2 * HEURE;
/** Les Éclaireurs de l'essai : des pigeons. */
const PIGEON = "pigeon";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de la vue des Éclaireurs (US-0970)";
/** Le titre des Récits de retour, pour les trier parmi ceux du Territoire (un Voyageur reparti en écrit aussi). */
const RETOUR = "Retour d'Expédition";

/** Les manières de vivre les mêmes Expéditions des deux joueurs, A et B. */
const MANIERES = ["page ouverte", "d'un bloc, A d'abord", "d'un bloc, B d'abord", "par la tâche planifiée"] as const;
type Maniere = (typeof MANIERES)[number];
/** Les deux ordres de rattrapage d'un bloc, pour les essais qui ne se disputent pas la Bête. */
const D_UN_BLOC = ["d'un bloc, A d'abord", "d'un bloc, B d'abord"] as const;
type Joueur = "A" | "B";

/**
 * L'Expédition d'un joueur dans un essai : l'instant de son arrivée sur la Case, d'après la Bête de l'essai ; ses
 * Éclaireurs, des pigeons ; et si une Bête de l'Espèce la plus forte du jeu l'escorte, à portée de toute Bête.
 */
type Pose = { arrivee: (bete: BeteSauvage) => Date; pigeons: number; escorte: boolean };
/** Les Expéditions de A et de B dans un essai ; B n'en a pas toujours. */
type Essai = { A: Pose; B: Pose | null };

/** Ce que l'Expédition d'un joueur lui laisse, une fois rentrée, tel qu'il le voit. */
type Bilan = {
  /** Son récit de retour : son texte, et ses Rencontres. */
  recit: Pick<Recit, "texte" | "survenuLe" | "rencontres">;
  /** L'Espèce de la Bête de l'essai à son Bestiaire, si elle y est. */
  bestiaire: EspeceAuBestiaire | undefined;
  rentreeLe: Date | null;
};

const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);
/** Les horaires d'une Expédition qui arrive sur sa Case à `arrivee` et y séjourne SEJOUR. */
const arriveeA = (arrivee: Date): HorairesDUneExpedition => ({ partLe: apres(arrivee, -TRAJET), trajetMinutes: TRAJET, sejourMinutes: SEJOUR });

describe.skipIf(!URL_TEST)("les Éclaireurs gardent les Bêtes en vue (US-0970, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `vue-des-eclaireurs-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** L'Espèce la plus forte du jeu, qui escorte les Expéditions de l'essai qui en ont une. */
  let forte: string;
  /** Les Territoires des deux joueurs. */
  const territoires = {} as Record<Joueur, number>;
  /** La Case de l'essai, et la Bête, d'une Rareté au-dessus de commune, qui s'y montre seule pendant les séjours. */
  let caseId: number;
  let bete: BeteSauvage;

  /** Un chef qui vient de naître dans le Monde d'essai : son Territoire et l'instant de sa naissance. */
  const naitre = async () => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Vue", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /**
   * Une Expédition du Territoire sur la Case de l'essai, posée en base comme un départ l'aurait fait, avec ses horaires,
   * son escorte et ses Éclaireurs (des mâles), et son retour au Foyer programmé (US-0916) ; sans souci de la portée ni des
   * explorateurs.
   */
  const poser = async (client: PoolClient, territoireId: number, h: HorairesDUneExpedition, pose: Pose) => {
    const { rows } = await client.query<{ id: number }>(
      "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, $4, $5) returning id",
      [territoireId, caseId, h.partLe, h.trajetMinutes, h.sejourMinutes],
    );
    const id = rows[0].id;
    if (pose.escorte) await client.query("insert into expedition_escorte (expedition_id, espece_id, nombre, males) values ($1, $2, 1, 1)", [id, forte]);
    if (pose.pigeons > 0) await client.query("insert into expedition_eclaireur (expedition_id, espece_id, nombre, males) values ($1, $2, $3, $3)", [id, PIGEON, pose.pigeons]);
    await programmerLeRetour(client, territoireId, id, h);
    return id;
  };
  /**
   * Un essai dans une transaction annulée ensuite, où chaque transaction du jeu (un rattrapage) devient un point de reprise
   * (poolDansLaTransaction) : le suivant repart des mêmes Territoires, devant la même Bête.
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
  /** Ce que l'Expédition `id` laisse au Territoire, lu avec `jeu` une fois tout vécu. */
  const bilan = async (jeu: Pool, territoireId: number, id: number): Promise<Bilan> => {
    const recits = (await recitsDuTerritoire(jeu, territoireId)).filter((r) => r.titre === RETOUR);
    expect(recits).toHaveLength(1);
    const [{ texte, survenuLe, rencontres }] = recits;
    const { rows } = await jeu.query<{ rentreeLe: Date | null }>('select rentree_le as "rentreeLe" from expedition where id = $1', [id]);
    return {
      recit: { texte, survenuLe, rencontres },
      bestiaire: (await bestiaireDuTerritoire(jeu, territoireId)).find((e) => e.especeId === bete.especeId),
      rentreeLe: rows[0].rentreeLe,
    };
  };

  /**
   * Les Expéditions de l'essai `essai` vécues de la manière `maniere` : A, posée la première, puis B ; ce qu'elles ont
   * laissé à chacun. Page ouverte, les deux joueurs sont mis à l'heure ensemble, tantôt A d'abord, tantôt B, toutes les 10
   * minutes du jeu et à chaque instant qui compte ; la tâche planifiée passe toutes les heures.
   */
  const vivre = (essai: Essai, maniere: Maniere) =>
    enEssai(async (client, jeu) => {
      const joueurs = (["A", "B"] as const).filter((j) => essai[j] !== null);
      const horaires = Object.fromEntries(joueurs.map((j) => [j, arriveeA(essai[j]!.arrivee(bete))])) as Record<Joueur, HorairesDUneExpedition>;
      const ids = {} as Record<Joueur, number>;
      for (const j of joueurs) ids[j] = await poser(client, territoires[j], horaires[j], essai[j]!);
      const retours = joueurs.map((j) => retourDUneExpedition(horaires[j])!.getTime());
      const premierDepart = new Date(Math.min(...joueurs.map((j) => horaires[j].partLe.getTime())));
      // La tâche planifiée passe toutes les heures, sept minutes après le premier départ, jusqu'à son premier passage qui
      // rattrape le dernier retour : c'est la fin de l'essai, pour toutes les manières.
      const passages = [apres(premierDepart, 7)];
      while (passages.at(-1)!.getTime() <= apres(new Date(Math.max(...retours)), RATTRAPER_APRES_MINUTES).getTime()) passages.push(apres(passages.at(-1)!, HEURE));
      const fin = passages.at(-1)!;
      const aLHeure = (joueur: Joueur, instant: Date) => rattraper("territoire", territoires[joueur], { pool: jeu, jusqua: instant });
      if (maniere === "page ouverte") {
        const instants = new Set([fin.getTime()]);
        for (let t = premierDepart.getTime(); t <= fin.getTime(); t += 10 * MINUTE_MS) instants.add(t);
        const qui = joueurs.flatMap((j) => {
          const sejour = sejourDUneExpedition(horaires[j])!;
          const vue = apres(bete.depart, essai[j]!.pigeons * MINUTES_DE_VUE_PAR_ECLAIREUR);
          return [sejour.debut, sejour.fin, retourDUneExpedition(horaires[j])!, vue];
        });
        for (const instant of [...qui, bete.arrivee, bete.depart]) [-1, 0, 1].forEach((ms) => instants.add(instant.getTime() + ms));
        const tries = [...instants].filter((t) => t >= premierDepart.getTime() && t <= fin.getTime()).sort((x, y) => x - y);
        for (const [i, t] of tries.entries()) for (const joueur of i % 2 ? [...joueurs].reverse() : joueurs) await aLHeure(joueur, new Date(t));
      } else if (maniere === "par la tâche planifiée") {
        for (const instant of passages) {
          expect(await rattraperLesAbsents({ pool: jeu, maintenant: instant, parmi: { territoire: [territoires.A, territoires.B] } })).toMatchObject({ echecs: 0 });
        }
      } else {
        for (const joueur of maniere === "d'un bloc, A d'abord" ? joueurs : [...joueurs].reverse()) await aLHeure(joueur, fin);
      }
      for (const joueur of joueurs) expect(await lireMarquePage(jeu, "territoire", territoires[joueur])).toEqual(fin);
      const bilans = {} as Record<Joueur, Bilan>;
      for (const j of joueurs) bilans[j] = await bilan(jeu, territoires[j], ids[j]);
      return { horaires, bilans };
    });

  /**
   * L'essai `essai` vécu de chaque manière `manieres` : ce qu'il laisse à la première, après avoir vérifié que les autres
   * laissent exactement la même chose à chaque joueur.
   */
  const vivreDeChaqueManiere = async (essai: Essai, manieres: readonly Maniere[]) => {
    const [premiere, ...autres] = manieres;
    const vecu = await vivre(essai, premiere);
    for (const maniere of autres) expect((await vivre(essai, maniere)).bilans, maniere).toEqual(vecu.bilans);
    return vecu;
  };

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    const { rows: especes } = await pool.query<{ id: string; attaque: number; vie: number }>("select id, attaque, vie from espece order by id");
    forte = especes.map(({ id, attaque, vie }) => ({ id, force: forceDUneBete({ attaque, vie }) })).sort((x, y) => x.force - y.force).at(-1)!.id;

    const [a, b] = [await naitre(), await naitre()];
    [territoires.A, territoires.B] = [a.territoireId, b.territoireId];
    // L'escorte et les Éclaireurs des Expéditions de l'essai sont des Bêtes de leur effectif.
    for (const t of [territoires.A, territoires.B]) {
      await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 1), ($1, $3, 'male', 9)", [t, forte, PIGEON]);
    }
    // Une Bête au-dessus de commune, qu'une Expédition sans escorte ne peut emmener, d'une autre Espèce que l'escorte (avec
    // qui elle réunirait un Couple, US-0958), seule sur une Case libre à 2 à 6 Cases du Foyer de A, hors des Cases des Bêtes de naissance des deux joueurs : aucune autre Bête n'y apparaît de CALME heures
    // avant elle à CALME heures après.
    const { rows: cases } = await pool.query<{ id: number }>(
      `select c.id from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) between 2 and 6
         and not exists (select 1 from bete_de_naissance n where n.case_id = c.id and n.territoire_id = any($2::int[]))
       order by c.id`,
      [territoires.A, [territoires.A, territoires.B]],
    );
    const [de, a30] = [apres(b.ne, 3 * JOUR), apres(b.ne, 33 * JOUR)];
    const parCase = await betesSauvagesDesCases(pool, cases.map((c) => c.id), de, a30);
    const seule = [...parCase].flatMap(([id, betes]) =>
      betes
        .filter(
          (x, i) =>
            x.rareteId !== COMMUNE &&
            x.especeId !== forte &&
            x.arrivee >= apres(de, CALME) &&
            x.arrivee <= apres(a30, -CALME) &&
            (i === 0 || betes[i - 1].arrivee <= apres(x.arrivee, -CALME)) &&
            (i === betes.length - 1 || betes[i + 1].arrivee >= apres(x.arrivee, CALME)),
        )
        .map((x) => ({ id, x })),
    )[0];
    if (!seule) throw new Error("Aucune Bête seule au-dessus de commune autour du Foyer de A.");
    [caseId, bete] = [seule.id, seule.x];
  });

  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  /** Une Expédition qui rencontre la Bête de l'essai à `vueLe` et la ramène. */
  const ramenee = (vueLe: Date) => [expect.objectContaining({ especeId: bete.especeId, vueLe, issue: "apprivoisee", nouvelleEspece: true })];

  it("arrivée peu après le départ d'une Bête, une Expédition dont deux pigeons la gardent en vue la rencontre et la ramène ; celle d'un autre joueur, sans Éclaireur, arrivée avant elle, ne la voit pas", async () => {
    const { horaires, bilans } = await vivreDeChaqueManiere(
      {
        A: { arrivee: (x) => apres(x.depart, MINUTES_DE_VUE_PAR_ECLAIREUR), pigeons: 2, escorte: true },
        B: { arrivee: (x) => apres(x.depart, MINUTES_DE_VUE_PAR_ECLAIREUR / 2), pigeons: 0, escorte: true },
      },
      MANIERES,
    );
    const arriveeDeA = sejourDUneExpedition(horaires.A)!.debut;
    expect(bilans.A.recit.rencontres).toEqual(ramenee(arriveeDeA));
    // US-0973 : le récit dit qu'elle ne l'a rencontrée que grâce à ses Éclaireurs.
    expect(bilans.A.recit.texte).toMatch(/^Une Bête s'est montrée\.\nRencontrée grâce à vos Éclaireurs : .+\.\nBête ramenée au Foyer : .+\.$/m);
    expect(bilans.A.bestiaire).toEqual({ especeId: bete.especeId, etat: "apprivoisee", croiseeLe: arriveeDeA });
    // B était sur la Case quand A l'a rencontrée : sans Éclaireurs, elle n'y était déjà plus pour lui.
    expect(bilans.B.recit.rencontres ?? []).toEqual([]);
    expect(bilans.B.recit.texte).not.toMatch(/grâce à vos Éclaireurs/);
    expect(bilans.B.bestiaire).toBeUndefined();
    // Aucune attaque : toutes deux finissent leur séjour, et rentrent à leur heure.
    for (const j of ["A", "B"] as const) expect(bilans[j].rentreeLe, j).toEqual(retourDUneExpedition(horaires[j]));
  }, 240_000);

  it("entre deux joueurs dont les Éclaireurs gardent la Bête en vue, la première Expédition arrivée l'emmène, même avec moins de pigeons ; l'autre ne la voit plus", async () => {
    const { horaires, bilans } = await vivreDeChaqueManiere(
      {
        A: { arrivee: (x) => apres(x.depart, MINUTES_DE_VUE_PAR_ECLAIREUR), pigeons: 2, escorte: true },
        B: { arrivee: (x) => apres(x.depart, MINUTES_DE_VUE_PAR_ECLAIREUR / 2), pigeons: 1, escorte: true },
      },
      MANIERES,
    );
    const arriveeDeB = sejourDUneExpedition(horaires.B)!.debut;
    expect(bilans.B.recit.rencontres).toEqual(ramenee(arriveeDeB));
    expect(bilans.B.bestiaire).toEqual({ especeId: bete.especeId, etat: "apprivoisee", croiseeLe: arriveeDeB });
    expect(bilans.A.recit.rencontres ?? []).toEqual([]);
    expect(bilans.A.bestiaire).toBeUndefined();
  }, 240_000);

  it("gardée en vue mais trop forte pour l'Expédition, la Bête ne l'attaque pas : son récit la dit repartie au bout de la vue de ses Éclaireurs", async () => {
    const pigeons = 2;
    const { horaires, bilans } = await vivreDeChaqueManiere(
      {
        A: { arrivee: (x) => apres(x.depart, MINUTES_DE_VUE_PAR_ECLAIREUR), pigeons, escorte: false },
        B: { arrivee: (x) => apres(x.depart, MINUTES_DE_VUE_PAR_ECLAIREUR / 2), pigeons: 0, escorte: false },
      },
      D_UN_BLOC,
    );
    const arriveeDeA = sejourDUneExpedition(horaires.A)!.debut;
    expect(bilans.A.recit.rencontres).toEqual([
      expect.objectContaining({ especeId: bete.especeId, vueLe: arriveeDeA, issue: "repartie", repartieLe: apres(bete.depart, pigeons * MINUTES_DE_VUE_PAR_ECLAIREUR), sexe: null }),
    ]);
    expect(bilans.A.bestiaire).toEqual({ especeId: bete.especeId, etat: "croisee", croiseeLe: arriveeDeA });
    expect(bilans.A.rentreeLe).toEqual(retourDUneExpedition(horaires.A));
    expect(bilans.B.recit.rencontres ?? []).toEqual([]);
  }, 120_000);

  it("les Éclaireurs ne gardent pas une Bête en vue au-delà du plafond, si nombreux soient-ils", async () => {
    const { bilans } = await vivreDeChaqueManiere(
      {
        A: { arrivee: (x) => apres(x.depart, MINUTES_DE_VUE_AU_PLUS + 1), pigeons: Math.floor(MINUTES_DE_VUE_AU_PLUS / MINUTES_DE_VUE_PAR_ECLAIREUR) + 2, escorte: true },
        B: null,
      },
      D_UN_BLOC,
    );
    expect(bilans.A.recit.rencontres ?? []).toEqual([]);
    expect(bilans.A.bestiaire).toBeUndefined();
  }, 120_000);

  it("une Bête qu'une Expédition a emmenée pendant sa présence n'est plus en vue des Éclaireurs d'une autre, arrivée après son départ", async () => {
    const { bilans } = await vivreDeChaqueManiere(
      {
        A: { arrivee: (x) => apres(x.depart, MINUTES_DE_VUE_PAR_ECLAIREUR), pigeons: 2, escorte: true },
        B: { arrivee: (x) => apres(x.arrivee, -HEURE), pigeons: 0, escorte: true },
      },
      D_UN_BLOC,
    );
    expect(bilans.B.recit.rencontres).toEqual(ramenee(bete.arrivee));
    expect(bilans.A.recit.rencontres ?? []).toEqual([]);
    expect(bilans.A.bestiaire).toBeUndefined();
  }, 120_000);
});
