import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef, naitreSurLaCouronne } from "@/chefs/chef";
import { cleDuNom } from "@/chefs/nom";
import { creerCompte } from "@/comptes/compte";
import { MIGRATIONS_FOLDER } from "@/db/migrations";
import { lireJeu } from "@/donnees/charger";
import { PRENOMS } from "@/donnees/jeux";
import { ENTRETIEN_HABITANT_PAR_HEURE, HISTORIQUE_VOYAGEURS_JOURS, PLACES_DU_FOYER, VOYAGEUR_ATTEND_HEURES, VOYAGEURS_EN_ATTENTE_MAX } from "@/reglages";
import { rattraperLesAbsents } from "@/temps/absents";
import { programmerEvenement } from "@/temps/avancer";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { entretienDesHabitants, habitantsDuTerritoire, nombreDHabitants } from "./habitants";
import { marquerUnRecitLu, recitsDuTerritoire } from "./recits";
import { stocksDuTerritoire } from "./stocks";
import {
  accueillirLeVoyageur,
  DEPART_VOYAGEUR,
  departDuVoyageur,
  ecartAvantVoyageur,
  nombreDeVoyageurs,
  recitDeDepart,
  refuserLeVoyageur,
  voyageursAuxPortes,
  voyageursPasses,
} from "./voyageurs";

const HEURE = 3_600_000;
const MINUTE = 60_000;
/** US-0337 : l'attente d'un Voyageur aux portes avant qu'il reparte, en millisecondes de jeu. */
const ATTENTE = VOYAGEUR_ATTEND_HEURES * HEURE;

/**
 * Le déroulement attendu, sans base : les arrivées d'un Territoire de sa naissance `ne` jusqu'à `jusqua` compris,
 * chacune à l'écart tiré pour son numéro après la précédente, et la suivante, encore à venir.
 */
function prevues(territoireId: number, ne: Date, jusqua: Date) {
  const arrivees: { numero: number; instant: number }[] = [];
  let instant = ne.getTime();
  for (let numero = 1; ; numero++) {
    instant += ecartAvantVoyageur(territoireId, numero);
    if (instant > jusqua.getTime()) return { arrivees, suivante: { numero, instant } };
    arrivees.push({ numero, instant });
  }
}

/**
 * Ce que la base doit tenir à `jusqua` : chaque arrivée traitée à son instant, la suivante programmée ; un
 * Voyageur venu à chaque arrivée qui trouve moins de VOYAGEURS_EN_ATTENTE_MAX Voyageurs aux portes, son départ
 * programmé dès son arrivée ATTENTE plus tard, et traité à son instant (US-0337) ; ceux qui attendent encore aux
 * portes, et ceux repartis, avec l'instant de leur arrivée et celui de leur départ. `sansDepart` : les arrivées de
 * Voyageurs déjà aux portes, venus sans passer par le temps, qui ne repartent pas. US-0341 : `famine`, la Famine du
 * Territoire, de son début compris à sa fin exclue : une arrivée qui y tombe est perdue, comme aux portes pleines.
 */
function attendu(territoireId: number, ne: Date, jusqua: Date, sansDepart: number[] = [], famine?: { debut: number; fin: number }) {
  const { arrivees, suivante } = prevues(territoireId, ne, jusqua);
  const [portes, venus, repartis]: number[][] = [[], [], []];
  // Ceux dont l'attente s'achève à `instant` repartent, dans l'ordre de leurs départs, avant une arrivée du même instant.
  const partir = (instant: number) => {
    while (portes.length > 0 && portes[0] + ATTENTE <= instant) repartis.push(portes.shift()!);
  };
  const enFamine = (instant: number) => famine !== undefined && instant >= famine.debut && instant < famine.fin;
  for (const a of arrivees) {
    partir(a.instant);
    if (!enFamine(a.instant) && sansDepart.length + portes.length < VOYAGEURS_EN_ATTENTE_MAX) {
      portes.push(a.instant);
      venus.push(a.instant);
    }
  }
  partir(jusqua.getTime());
  return {
    arrivees: [...arrivees.map((a) => [a.numero, a.instant, a.instant]), [suivante.numero, suivante.instant, null]],
    voyageurs: [...sansDepart, ...portes].sort((a, b) => a - b),
    departs: venus.map((v) => [v + ATTENTE, v + ATTENTE <= jusqua.getTime() ? v + ATTENTE : null]),
    repartis: repartis.map((v) => [v, v + ATTENTE]),
  };
}

/** L'instruction de la migration US-0331 qui programme la première arrivée des Territoires déjà nés. */
function premiereArriveeDesTerritoiresDejaNes(): string {
  const instructions = readdirSync(MIGRATIONS_FOLDER)
    .filter((f) => f.endsWith(".sql"))
    .flatMap((f) => readFileSync(join(MIGRATIONS_FOLDER, f), "utf8").split("--> statement-breakpoint"));
  return instructions.find((i) => /^INSERT INTO "evenement"/m.test(i) && i.includes('FROM "territoire"'))!;
}

/** L'instruction de la migration US-0337 qui programme le départ des Voyageurs déjà aux portes. */
function departDesVoyageursDejaAuxPortes(): string {
  const instructions = readdirSync(MIGRATIONS_FOLDER)
    .filter((f) => f.endsWith(".sql"))
    .flatMap((f) => readFileSync(join(MIGRATIONS_FOLDER, f), "utf8").split("--> statement-breakpoint"));
  return instructions.find((i) => /^INSERT INTO "evenement"/m.test(i) && i.includes('FROM "voyageur"'))!;
}

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai des Voyageurs (US-0331)";

describe.skipIf(!URL_TEST)("l'arrivée des Voyageurs (US-0331, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `voyageurs-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  const nouveauCompte = async () => (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
  const nomUnique = () => nomDEssai("Voy", suffixe, numero);

  /** Un Territoire tout neuf, et l'instant de sa naissance. */
  const naitre = async () => {
    const compte = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /** Les arrivées du Territoire en base : numéro, instant prévu, instant où elle a été traitée (null si à venir). */
  const arrivees = async (territoireId: number) =>
    (
      await pool.query<{ numero: number; survient_le: Date; traite_le: Date | null }>(
        `select (donnees->>'numero')::int as numero, survient_le, traite_le from evenement
         where element = 'territoire' and element_id = $1 and type = 'arrivee_voyageur' order by survient_le, id`,
        [territoireId],
      )
    ).rows.map((e) => [e.numero, e.survient_le.getTime(), e.traite_le?.getTime() ?? null]);
  /** Les Voyageurs qui attendent aux portes du Territoire, du premier arrivé au dernier. */
  const voyageurs = async (territoireId: number) =>
    (
      await pool.query<{ id: number; prenom: string; arrive_le: Date }>(
        "select id, prenom, arrive_le from voyageur where territoire_id = $1 and sort is null order by arrive_le, id",
        [territoireId],
      )
    ).rows;
  /** US-0337 : les départs programmés du Territoire : instant prévu, instant où il a été traité (null si à venir). */
  const departs = async (territoireId: number) =>
    (
      await pool.query<{ survient_le: Date; traite_le: Date | null }>(
        `select survient_le, traite_le from evenement where element = 'territoire' and element_id = $1 and type = 'depart_voyageur' order by survient_le, id`,
        [territoireId],
      )
    ).rows.map((e) => [e.survient_le.getTime(), e.traite_le?.getTime() ?? null]);
  /** US-0337 : les Voyageurs repartis d'eux-mêmes, dans l'ordre de leurs départs : prénom, instant d'arrivée et de départ. */
  const repartis = async (territoireId: number) =>
    (
      await pool.query<{ prenom: string; arrive_le: Date; sort_le: Date }>(
        "select prenom, arrive_le, sort_le from voyageur where territoire_id = $1 and sort = 'reparti' order by sort_le, id",
        [territoireId],
      )
    ).rows;
  const etat = async (territoireId: number) => ({
    arrivees: await arrivees(territoireId),
    voyageurs: (await voyageurs(territoireId)).map((v) => v.arrive_le.getTime()),
    departs: await departs(territoireId),
    repartis: (await repartis(territoireId)).map((v) => [v.arrive_le.getTime(), v.sort_le.getTime()]),
  });
  /** US-0337 : les Récits du Territoire, du plus ancien au plus récent : titre, texte, et l'heure du jeu où il est survenu. */
  const recits = async (territoireId: number) => (await recitsDuTerritoire(pool, territoireId)).reverse().map((r) => [r.titre, r.texte, r.survenuLe.getTime()]);
  /** US-0337 : le Récit attendu de chaque groupe de départs (arrivée, départ), avec les prénoms lus en base, daté du dernier. */
  const recitsDeDepart = async (territoireId: number, groupes: number[][][]) => {
    const prenoms = new Map((await repartis(territoireId)).map((v) => [v.arrive_le.getTime(), v.prenom]));
    return groupes.map((groupe) => {
      const { titre, texte, survenuLe } = recitDeDepart(
        groupe.map(([arrive]) => prenoms.get(arrive)!),
        new Date(groupe.at(-1)![1]),
      );
      return [titre, texte, survenuLe.getTime()];
    });
  };
  const apres = (ne: Date, ms: number) => new Date(ne.getTime() + ms);
  /** Fait se présenter un Voyageur au Territoire, à l'instant donné, sans passer par le temps : il ne repart pas. */
  const presenter = async (territoireId: number, prenom: string, arriveLe: Date) =>
    (await pool.query<{ id: number }>("insert into voyageur (territoire_id, prenom, arrive_le) values ($1, $2, $3) returning id", [territoireId, prenom, arriveLe])).rows[0].id;
  /** US-0337 : fait se présenter un Voyageur comme le temps le fait venir, son départ programmé au bout de son attente. */
  const presenterQuiRepart = async (territoireId: number, prenom: string, arriveLe: Date) => {
    const id = await presenter(territoireId, prenom, arriveLe);
    await programmerEvenement(pool, "territoire", territoireId, departDuVoyageur(arriveLe), DEPART_VOYAGEUR, { voyageur: id });
    return id;
  };
  /** Le sort d'un Voyageur, et son heure. */
  const sort = async (voyageurId: number) =>
    (await pool.query<{ sort: string | null; sort_le: Date | null }>("select sort, sort_le from voyageur where id = $1", [voyageurId])).rows.map((v) => [v.sort, v.sort_le])[0];

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  describe("la première arrivée", () => {
    it("est programmée à la naissance, à l'écart tiré pour le numéro 1", async () => {
      const { territoireId, ne } = await naitre();
      expect(await arrivees(territoireId)).toEqual([[1, ne.getTime() + ecartAvantVoyageur(territoireId, 1), null]]);
      expect(await voyageurs(territoireId)).toEqual([]);
    });

    it("l'est aussi pour le chef né avant la Couronne, quand il reçoit son Foyer", async () => {
      const compte = await nouveauCompte();
      const nom = nomUnique();
      await pool.query("insert into chef (compte_id, monde_id, nom, cle_nom) values ($1, (select id from monde order by id limit 1), $2, $3)", [compte.id, nom, cleDuNom(nom)]);
      const territoireId = (await naitreSurLaCouronne(pool, compte.id))!;
      const ne = await lireMarquePage(pool, "territoire", territoireId);
      expect(await arrivees(territoireId)).toEqual([[1, ne.getTime() + ecartAvantVoyageur(territoireId, 1), null]]);
    });

    it("est tirée par la base exactement comme par le jeu", async () => {
      const { rows } = await pool.query<{ territoire: number; numero: number; ms: string }>(
        `select t as territoire, n as numero, (extract(epoch from ecart_avant_voyageur(t, n)) * 1000)::bigint::text as ms
         from generate_series(1, 60) t cross join generate_series(1, 40) n`,
      );
      expect(rows).toHaveLength(2400);
      for (const { territoire, numero: n, ms } of rows) expect(Number(ms), `${territoire}:${n}`).toBe(ecartAvantVoyageur(territoire, n));
    });

    it("est programmée, à la migration, pour chaque Territoire déjà né, depuis la mise en ligne et non depuis sa naissance", async () => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        // Des Territoires déjà nés, sans arrivée, dans des tables temporaires qui masquent les vraies.
        await client.query("create temp table territoire (id integer, calcule_jusqu_a timestamptz) on commit drop");
        await client.query("create temp table evenement (element text, element_id integer, survient_le timestamptz, type text, donnees jsonb) on commit drop");
        await client.query(
          `insert into territoire values (1, now() - interval '40 days'), (2, now()), (3, now() + interval '3 days')`,
        );
        await client.query(premiereArriveeDesTerritoiresDejaNes());
        const miseEnLigne = (await client.query<{ maintenant: Date }>("select now() as maintenant")).rows[0].maintenant.getTime();
        const { rows } = await client.query<{ element: string; element_id: number; survient_le: Date; type: string; donnees: unknown }>(
          "select * from evenement order by element_id",
        );
        const depuis = { 1: miseEnLigne, 2: miseEnLigne, 3: miseEnLigne + 3 * 24 * HEURE } as Record<number, number>;
        expect(rows).toEqual(
          [1, 2, 3].map((id) => ({
            element: "territoire",
            element_id: id,
            // La base garde l'instant à la microseconde, le jeu à la milliseconde : l'arrivée tombe sur une milliseconde.
            survient_le: new Date(Math.floor(depuis[id]) + ecartAvantVoyageur(id, 1)),
            type: "arrivee_voyageur",
            donnees: { numero: 1 },
          })),
        );
      } finally {
        await client.query("rollback");
        client.release();
      }
    });
  });

  it("fait entrer un Voyageur à l'instant exact de son arrivée, puis programme la suivante", async () => {
    const { territoireId, ne } = await naitre();
    const premiere = ne.getTime() + ecartAvantVoyageur(territoireId, 1);
    await rattraper("territoire", territoireId, { pool, jusqua: new Date(premiere - 1) });
    expect(await voyageurs(territoireId)).toEqual([]);

    await rattraper("territoire", territoireId, { pool, jusqua: new Date(premiere) });
    const venus = await voyageurs(territoireId);
    expect(venus.map((v) => v.arrive_le)).toEqual([new Date(premiere)]);
    expect(lireJeu(PRENOMS).map((p) => p.nom)).toContain(venus[0].prenom);
    const deuxieme = premiere + ecartAvantVoyageur(territoireId, 2);
    expect(await arrivees(territoireId)).toEqual([
      [1, premiere, premiere],
      [2, deuxieme, null],
    ]);
  });

  it("n'en fait pas attendre plus de trois : au-delà, personne ne se présente, et l'arrivée est perdue", async () => {
    const { territoireId, ne } = await naitre();
    const { arrivees: prevu } = prevues(territoireId, ne, apres(ne, 1000 * HEURE));
    // US-0337 : les Voyageurs venus du temps repartent au bout de leur attente, plus longue que trois écarts : deux
    // Voyageurs qui ne repartent pas attendent déjà, sous des prénoms qu'aucun Habitant ne porte. La première arrivée
    // en fait entrer un troisième ; la deuxième, moins d'une attente après, trouve les portes pleines.
    const habitants = (await pool.query<{ prenom: string }>("select prenom from habitant where territoire_id = $1", [territoireId])).rows.map((h) => h.prenom);
    const [un, deux] = lireJeu(PRENOMS)
      .map((p) => p.nom)
      .filter((nom) => !habitants.includes(nom));
    const deja = apres(ne, 1).getTime();
    const premier = await presenter(territoireId, un, new Date(deja));
    await presenter(territoireId, deux, new Date(deja));
    const deuxieme = new Date(prevu[1].instant);
    await rattraper("territoire", territoireId, { pool, jusqua: deuxieme });
    expect(await etat(territoireId)).toEqual(attendu(territoireId, ne, deuxieme, [deja, deja]));
    const venus = await voyageurs(territoireId);
    expect(venus.map((v) => v.arrive_le.getTime())).toEqual([deja, deja, prevu[0].instant]);
    expect(venus).toHaveLength(VOYAGEURS_EN_ATTENTE_MAX);
    // Trois prénoms différents, qu'aucun Habitant ne porte.
    expect(new Set(venus.map((v) => v.prenom)).size).toBe(3);
    for (const v of venus) expect(habitants).not.toContain(v.prenom);

    // Une place se libère : personne ne vient avant la troisième arrivée, la deuxième, perdue, n'est pas reportée ; à la
    // troisième, un Voyageur se présente de nouveau. Celui de la première est encore là, sauf s'il est reparti entre-temps.
    expect(await refuserLeVoyageur(pool, territoireId, premier, apres(deuxieme, 1))).toBe(true);
    const restent = (instant: number) => [deja, ...(prevu[0].instant + ATTENTE > instant ? [prevu[0].instant] : [])];
    const troisieme = prevu[2].instant;
    await rattraper("territoire", territoireId, { pool, jusqua: new Date(troisieme - 1) });
    expect((await voyageurs(territoireId)).map((v) => v.arrive_le.getTime())).toEqual(restent(troisieme - 1));
    await rattraper("territoire", territoireId, { pool, jusqua: new Date(troisieme) });
    expect((await voyageurs(territoireId)).map((v) => v.arrive_le.getTime())).toEqual([...restent(troisieme), troisieme]);
  });

  it("tire un prénom qu'aucun Habitant ni Voyageur présent ne porte, et un prénom déjà porté quand tous le sont", async () => {
    const { territoireId, ne } = await naitre();
    const liste = lireJeu(PRENOMS).map((p) => p.nom);
    // Les Habitants portent tous les prénoms de la liste sauf un.
    await pool.query(
      "with partis as (delete from habitant where territoire_id = $1) insert into habitant (territoire_id, prenom) select $1, nom from prenom where nom <> $2",
      [territoireId, liste[7]],
    );
    // US-0326 : de quoi nourrir tout ce monde, pour qu'aucune Famine n'en fasse partir et ne libère de prénom entre-temps.
    await pool.query("update stock set quantite = 10000 where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')", [territoireId]);
    const { arrivees: prevu } = prevues(territoireId, ne, apres(ne, 1000 * HEURE));
    await rattraper("territoire", territoireId, { pool, jusqua: new Date(prevu[1].instant) });
    const [premier, second] = await voyageurs(territoireId);
    expect(premier.prenom).toBe(liste[7]);
    expect(liste).toContain(second.prenom);
  });

  describe.each([
    { nom: "une absence de 30 heures", heures: 30, page: 37 * MINUTE + 7_919, tache: [3.5, 11, 22.25] },
    { nom: "une absence de 4 jours", heures: 96, page: 3 * HEURE + 7 * MINUTE + 1_237, tache: [9, 40.5, 77] },
  ])("$nom : rien ne se perd ni ne s'invente au rattrapage", ({ heures, page, tache }) => {
    // US-0337 : chaque Voyageur repart au bout de son attente, au bon moment, et tant que le joueur n'a rien lu, tous
    // les départs se disent dans un seul Récit, daté du dernier, quel que soit le découpage du rattrapage.
    /** Le seul Récit attendu pour les départs `repartis`, aucun s'il n'y en a pas. */
    const unSeulRecit = async (territoireId: number, repartis: number[][]) => recitsDeDepart(territoireId, repartis.length > 0 ? [repartis] : []);

    it("page fermée : au retour, un seul rattrapage donne exactement les arrivées et les départs prévus, en un seul Récit", async () => {
      const { territoireId, ne } = await naitre();
      const fin = apres(ne, heures * HEURE);
      await rattraper("territoire", territoireId, { pool, jusqua: fin });
      const prevu = attendu(territoireId, ne, fin);
      expect(await etat(territoireId)).toEqual(prevu);
      expect(prevu.voyageurs.length + prevu.repartis.length).toBeGreaterThan(0);
      // Trente heures voient au moins un départ ; quatre jours, au moins six, d'au plus douze heures d'écart.
      expect(prevu.repartis.length).toBeGreaterThanOrEqual(heures > 48 ? 6 : 1);
      expect(await recits(territoireId)).toEqual(await unSeulRecit(territoireId, prevu.repartis));
    });

    it("page ouverte : à chaque rattrapage, les arrivées et les départs prévus jusque-là, tous dans le même Récit, et la même fin", async () => {
      const { territoireId, ne } = await naitre();
      for (let ms = page; ms < heures * HEURE; ms += page) {
        await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, ms) });
        const prevu = attendu(territoireId, ne, apres(ne, ms));
        expect(await etat(territoireId), `${(ms / HEURE).toFixed(2)} h`).toEqual(prevu);
        expect(await recits(territoireId), `${(ms / HEURE).toFixed(2)} h`).toEqual(await unSeulRecit(territoireId, prevu.repartis));
      }
      await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, heures * HEURE) });
      const prevu = attendu(territoireId, ne, apres(ne, heures * HEURE));
      expect(await etat(territoireId)).toEqual(prevu);
      expect(await recits(territoireId)).toEqual(await unSeulRecit(territoireId, prevu.repartis));
    }, 120_000);

    it("tâche planifiée passée au milieu : même fin qu'à la page fermée, et le même Récit", async () => {
      const { territoireId, ne } = await naitre();
      for (const h of tache) {
        const passage = await rattraperLesAbsents({ pool, maintenant: apres(ne, h * HEURE), parmi: { territoire: [territoireId] } });
        expect(passage, `passage à ${h} h`).toMatchObject({ rattrapes: 1, echecs: 0 });
      }
      await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, heures * HEURE) });
      const prevu = attendu(territoireId, ne, apres(ne, heures * HEURE));
      expect(await etat(territoireId)).toEqual(prevu);
      expect(await recits(territoireId)).toEqual(await unSeulRecit(territoireId, prevu.repartis));
    }, 60_000);
  });

  describe("le départ d'un Voyageur ignoré (US-0337)", () => {
    it("est programmé dès son arrivée, au bout de son attente ; il repart seul à cet instant exact, pas avant, et un Récit le dit", async () => {
      const { territoireId, ne } = await naitre();
      const [premiere] = prevues(territoireId, ne, apres(ne, 1000 * HEURE)).arrivees;
      await rattraper("territoire", territoireId, { pool, jusqua: new Date(premiere.instant) });
      const [venu] = await voyageursAuxPortes(pool, territoireId);
      const depart = departDuVoyageur(venu.arriveLe);
      expect(depart.getTime()).toBe(premiere.instant + ATTENTE);
      const { rows } = await pool.query("select survient_le, donnees, traite_le from evenement where element = 'territoire' and element_id = $1 and type = 'depart_voyageur'", [
        territoireId,
      ]);
      expect(rows).toEqual([{ survient_le: depart, donnees: { voyageur: venu.id }, traite_le: null }]);

      await rattraper("territoire", territoireId, { pool, jusqua: new Date(depart.getTime() - 1) });
      expect((await voyageursAuxPortes(pool, territoireId)).map((v) => v.id)).toContain(venu.id);
      expect(await sort(venu.id)).toEqual([null, null]);
      expect(await recits(territoireId)).toEqual([]);

      await rattraper("territoire", territoireId, { pool, jusqua: depart });
      expect((await voyageursAuxPortes(pool, territoireId)).map((v) => v.id)).not.toContain(venu.id);
      expect(await sort(venu.id)).toEqual(["reparti", depart]);
      expect(await recits(territoireId)).toEqual([[`${venu.prenom} a repris la route`, `${venu.prenom} a attendu aux portes sans qu'on l'accueille.`, depart.getTime()]]);
    });

    describe("les départs dits ensemble tant que le joueur n'a pas lu leur Récit", () => {
      /**
       * Ines et Joran attendent, et repartent à 13 h et 17 h ; Ilda, venue sans passer par le temps, ne repart pas.
       * Les portes sont pleines dès le départ : aucun Voyageur venu du temps ne repart avant 25 h, après ces essais.
       */
      const deuxDeparts = async (territoireId: number, ne: Date) => {
        await presenter(territoireId, "Ilda", ne);
        await presenterQuiRepart(territoireId, "Ines", apres(ne, HEURE));
        await presenterQuiRepart(territoireId, "Joran", apres(ne, 5 * HEURE));
      };
      const SEUL = (prenom: string, h: number, ne: Date) => [`${prenom} a repris la route`, `${prenom} a attendu aux portes sans qu'on l'accueille.`, apres(ne, h * HEURE).getTime()];
      const ENSEMBLE = (ne: Date) => ["2 Voyageurs ont repris la route", "Ines et Joran ont attendu aux portes sans qu'on les accueille.", apres(ne, 17 * HEURE).getTime()];

      it("deux départs d'une absence découpée par la tâche planifiée : un seul Récit, daté du dernier", async () => {
        const { territoireId, ne } = await naitre();
        await deuxDeparts(territoireId, ne);
        // La tâche passe à 14 h, après le premier départ, puis à 18 h ; le joueur revient à 19 h.
        for (const h of [14, 18]) {
          expect(await rattraperLesAbsents({ pool, maintenant: apres(ne, h * HEURE), parmi: { territoire: [territoireId] } })).toMatchObject({ rattrapes: 1, echecs: 0 });
        }
        await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 19 * HEURE) });
        expect(await recits(territoireId)).toEqual([ENSEMBLE(ne)]);
      });

      it("page ouverte, deux départs à 4 h d'écart sans lecture entre : le Récit du premier, repris pour les deux", async () => {
        const { territoireId, ne } = await naitre();
        await deuxDeparts(territoireId, ne);
        let ms = 37 * MINUTE + 7_919;
        for (; ms <= 14 * HEURE; ms += 37 * MINUTE) await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, ms) });
        const [premier] = await recitsDuTerritoire(pool, territoireId);
        expect(await recits(territoireId)).toEqual([SEUL("Ines", 13, ne)]);

        for (; ms <= 18 * HEURE; ms += 37 * MINUTE) await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, ms) });
        expect(await recits(territoireId)).toEqual([ENSEMBLE(ne)]);
        // Le même Récit, toujours à lire.
        expect((await recitsDuTerritoire(pool, territoireId)).map((r) => [r.id, r.luLe])).toEqual([[premier.id, null]]);
      });

      it("un Récit de départ lu, puis un nouveau départ : un nouveau Récit, et le premier reste tel qu'il a été lu", async () => {
        const { territoireId, ne } = await naitre();
        await deuxDeparts(territoireId, ne);
        await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 14 * HEURE) });
        const [lu] = await recitsDuTerritoire(pool, territoireId);
        expect(await marquerUnRecitLu(pool, territoireId, lu.id, apres(ne, 14 * HEURE))).toBe(true);

        await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 18 * HEURE) });
        expect(await recits(territoireId)).toEqual([SEUL("Ines", 13, ne), SEUL("Joran", 17, ne)]);
        expect((await recitsDuTerritoire(pool, territoireId)).map((r) => r.luLe === null)).toEqual([true, false]);
      });

      it("ne reprend qu'un Récit de départ du Territoire : ni un autre Récit à lire, ni le Récit de départ d'un voisin", async () => {
        const [joueur, voisin] = [await naitre(), await naitre()];
        // Le voisin a un Récit de départ à lire.
        await presenter(voisin.territoireId, "Ilda", voisin.ne);
        await presenterQuiRepart(voisin.territoireId, "Brune", apres(voisin.ne, HEURE));
        await rattraper("territoire", voisin.territoireId, { pool, jusqua: apres(voisin.ne, 14 * HEURE) });
        // Le joueur, un Récit d'accueil à lire, avant le départ d'Ines.
        await presenter(joueur.territoireId, "Ilda", joueur.ne);
        await presenterQuiRepart(joueur.territoireId, "Ines", apres(joueur.ne, HEURE));
        const joran = await presenter(joueur.territoireId, "Joran", apres(joueur.ne, HEURE));
        expect(await accueillirLeVoyageur(pool, joueur.territoireId, joran, apres(joueur.ne, 2 * HEURE))).toBe("accueilli");

        await rattraper("territoire", joueur.territoireId, { pool, jusqua: apres(joueur.ne, 14 * HEURE) });
        expect((await recits(joueur.territoireId)).map(([titre]) => titre)).toEqual(["Joran a rejoint le Territoire", "Ines a repris la route"]);
        expect(await recits(voisin.territoireId)).toEqual([SEUL("Brune", 13, voisin.ne)]);
      });
    });

    it("laisse en paix un Voyageur accueilli ou refusé avant la fin de son attente : son sort reste le sien, et aucun Récit de départ", async () => {
      const { territoireId, ne } = await naitre();
      const ines = await presenterQuiRepart(territoireId, "Ines", apres(ne, HEURE));
      const joran = await presenterQuiRepart(territoireId, "Joran", apres(ne, 2 * HEURE));
      expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 3 * HEURE))).toBe("accueilli");
      expect(await refuserLeVoyageur(pool, territoireId, joran, apres(ne, 4 * HEURE))).toBe(true);

      // Jusqu'à 15 h : leurs départs, à 13 h et 14 h, et pas encore celui d'un Voyageur venu du temps, au plus tôt à 16 h.
      await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 15 * HEURE) });
      expect([await sort(ines), await sort(joran)]).toEqual([
        ["accueilli", apres(ne, 3 * HEURE)],
        ["refuse", apres(ne, 4 * HEURE)],
      ]);
      expect((await recits(territoireId)).map(([titre]) => titre)).toEqual(["Ines a rejoint le Territoire"]);
      // Leurs départs ont bien eu lieu, à leur instant, sans rien changer.
      expect(await departs(territoireId)).toContainEqual([apres(ne, 13 * HEURE).getTime(), apres(ne, 13 * HEURE).getTime()]);
      expect(await departs(territoireId)).toContainEqual([apres(ne, 14 * HEURE).getTime(), apres(ne, 14 * HEURE).getTime()]);
    });

    it("ne touche jamais au Voyageur d'un autre Territoire, quel que soit l'identifiant du départ", async () => {
      const [joueur, voisin] = [await naitre(), await naitre()];
      const brune = await presenter(voisin.territoireId, "Brune", apres(voisin.ne, HEURE));
      await programmerEvenement(pool, "territoire", joueur.territoireId, apres(joueur.ne, 2 * HEURE), DEPART_VOYAGEUR, { voyageur: brune });

      await rattraper("territoire", joueur.territoireId, { pool, jusqua: apres(joueur.ne, 3 * HEURE) });
      expect(await sort(brune)).toEqual([null, null]);
      expect(await recits(joueur.territoireId)).toEqual([]);
    });

    it("refuse l'accueil d'un Voyageur déjà reparti : rien ne change, et l'accueil le dit", async () => {
      const { territoireId, ne } = await naitre();
      const ines = await presenterQuiRepart(territoireId, "Ines", apres(ne, HEURE));
      await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 14 * HEURE) });
      const [nombre, avant] = [await nombreDHabitants(pool, territoireId), await recits(territoireId)];

      expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 14 * HEURE))).toBe("reparti");
      expect(await nombreDHabitants(pool, territoireId)).toBe(nombre);
      expect(await recits(territoireId)).toEqual(avant);
      expect(await sort(ines)).toEqual(["reparti", apres(ne, 13 * HEURE)]);
    });

    it("programme, à la migration, le départ de chaque Voyageur qui attend déjà aux portes, au bout de son attente, et de lui seul", async () => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        // Des Voyageurs déjà venus, dans des tables temporaires qui masquent les vraies.
        await client.query("create temp table voyageur (id integer, territoire_id integer, arrive_le timestamptz, sort text) on commit drop");
        await client.query("create temp table evenement (element text, element_id integer, survient_le timestamptz, type text, donnees jsonb) on commit drop");
        await client.query(
          `insert into voyageur values (1, 7, '2026-10-07T08:00:00.123Z', null), (2, 7, '2026-10-06T20:00:00Z', null), (3, 8, '2026-10-07T09:30:00Z', null),
           (4, 7, '2026-10-07T07:00:00Z', 'accueilli')`,
        );
        await client.query(departDesVoyageursDejaAuxPortes());
        const { rows } = await client.query("select * from evenement order by donnees->>'voyageur'");
        expect(rows).toEqual(
          [
            [1, 7, "2026-10-07T08:00:00.123Z"],
            [2, 7, "2026-10-06T20:00:00Z"],
            [3, 8, "2026-10-07T09:30:00Z"],
          ].map(([id, territoire, arrive]) => ({
            element: "territoire",
            element_id: territoire,
            survient_le: departDuVoyageur(new Date(arrive)),
            type: "depart_voyageur",
            donnees: { voyageur: id },
          })),
        );
      } finally {
        await client.query("rollback");
        client.release();
      }
    });

    it("ne donne à un Voyageur qu'un sort connu, et toujours avec son heure", async () => {
      const { territoireId, ne } = await naitre();
      const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
      for (const [valeur, heure] of [["parti", apres(ne, 2 * HEURE)], ["reparti", null], [null, apres(ne, 2 * HEURE)]] as const) {
        await expect(pool.query("update voyageur set sort = $2, sort_le = $3 where id = $1", [ines, valeur, heure]), `${valeur}`).rejects.toMatchObject({ code: "23514" });
      }
      expect(await sort(ines)).toEqual([null, null]);
    });
  });

  describe("les Voyageurs aux portes (US-0332)", () => {
    it("lit ceux qui attendent aux portes du Territoire, du premier arrivé au dernier, et eux seuls", async () => {
      const { territoireId, ne } = await naitre();
      const voisin = await naitre();
      const cael = await presenter(territoireId, "Cael", apres(ne, 5 * HEURE));
      const arno = await presenter(territoireId, "Arno", apres(ne, HEURE));
      await presenter(voisin.territoireId, "Brune", apres(ne, 2 * HEURE));
      // Deux arrivées au même instant : la première enregistrée d'abord.
      const dara = await presenter(territoireId, "Dara", apres(ne, 5 * HEURE));
      // US-0333 : chacun avec l'instant de son départ, s'il n'est pas accueilli d'ici là.
      expect(await voyageursAuxPortes(pool, territoireId)).toEqual([
        { id: arno, prenom: "Arno", arriveLe: apres(ne, HEURE), departLe: departDuVoyageur(apres(ne, HEURE)) },
        { id: cael, prenom: "Cael", arriveLe: apres(ne, 5 * HEURE), departLe: departDuVoyageur(apres(ne, 5 * HEURE)) },
        { id: dara, prenom: "Dara", arriveLe: apres(ne, 5 * HEURE), departLe: departDuVoyageur(apres(ne, 5 * HEURE)) },
      ]);
      expect(await nombreDeVoyageurs(pool, territoireId)).toBe(3);
      expect(await nombreDeVoyageurs(pool, voisin.territoireId)).toBe(1);
    });

    it("ne lit personne quand personne n'attend", async () => {
      const { territoireId } = await naitre();
      expect(await voyageursAuxPortes(pool, territoireId)).toEqual([]);
      expect(await nombreDeVoyageurs(pool, territoireId)).toBe(0);
    });

    it("lit ceux que le temps a fait venir, à l'heure de leur arrivée", async () => {
      const { territoireId, ne } = await naitre();
      const { arrivees: prevu } = prevues(territoireId, ne, apres(ne, 1000 * HEURE));
      await rattraper("territoire", territoireId, { pool, jusqua: new Date(prevu[1].instant) });
      expect((await voyageursAuxPortes(pool, territoireId)).map((v) => v.arriveLe.getTime())).toEqual([prevu[0].instant, prevu[1].instant]);
      expect(await nombreDeVoyageurs(pool, territoireId)).toBe(2);
    });
  });

  describe("accueillir un Voyageur (US-0334)", () => {
    /** Les Habitants du Territoire, du premier arrivé au dernier : prénom, Métier, heure d'arrivée. */
    const habitants = async (territoireId: number) =>
      (await habitantsDuTerritoire(pool, territoireId)).sort((a, b) => a.id - b.id).map((h) => [h.prenom, h.metier, h.arriveLe]);
    /** Les quantités des Stocks du Territoire. */
    const stocks = async (territoireId: number) => (await stocksDuTerritoire(pool, territoireId)).map((s) => [s.id, s.quantite]);
    /** Tout ce qu'un accueil peut changer au Territoire : ses Voyageurs, ses Habitants, ses Récits et ses Stocks. */
    const tout = async (territoireId: number) => ({
      voyageurs: await voyageursAuxPortes(pool, territoireId),
      habitants: await habitants(territoireId),
      recits: await recitsDuTerritoire(pool, territoireId),
      stocks: await stocks(territoireId),
    });

    it("fait du Voyageur un Habitant sans Métier, du même prénom, arrivé à l'heure de l'accueil, et le retire des portes", async () => {
      const { territoireId, ne } = await naitre();
      const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
      const joran = await presenter(territoireId, "Joran", apres(ne, 2 * HEURE));
      const avant = await habitants(territoireId);

      expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE))).toBe("accueilli");
      expect((await voyageursAuxPortes(pool, territoireId)).map((v) => v.id)).toEqual([joran]);
      expect(await habitants(territoireId)).toEqual([...avant, ["Ines", null, apres(ne, 4 * HEURE)]]);
      // US-0337 : le Voyageur reste connu, avec son sort et son heure.
      expect(await sort(ines)).toEqual(["accueilli", apres(ne, 4 * HEURE)]);
    });

    it("fait monter aussitôt le nombre d'Habitants et l'Entretien, sans rien coûter", async () => {
      const { territoireId, ne } = await naitre();
      const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
      const [nombre, entretien, quantites] = [await nombreDHabitants(pool, territoireId), await entretienDesHabitants(pool, territoireId), await stocks(territoireId)];

      await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE));
      expect(await nombreDHabitants(pool, territoireId)).toBe(nombre + 1);
      const { habitants: compte, parHeure } = await entretienDesHabitants(pool, territoireId);
      expect([compte, Number(parHeure)]).toEqual([nombre + 1, Number(entretien.parHeure) + ENTRETIEN_HABITANT_PAR_HEURE]);
      expect(await stocks(territoireId)).toEqual(quantites);
    });

    it("écrit un Récit court de l'arrivée du nouvel Habitant, non lu, daté de l'accueil", async () => {
      const { territoireId, ne } = await naitre();
      const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
      await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE + 20 * MINUTE));
      expect((await recitsDuTerritoire(pool, territoireId)).map(({ titre, texte, survenuLe, luLe }) => ({ titre, texte, survenuLe, luLe }))).toEqual([
        {
          titre: "Ines a rejoint le Territoire",
          texte: "Ines, qui attendait aux portes depuis 3 h, vit désormais au Foyer.",
          survenuLe: apres(ne, 4 * HEURE + 20 * MINUTE),
          luLe: null,
        },
      ]);
    });

    it("ne touche jamais au Voyageur d'un autre Territoire, quel que soit l'identifiant envoyé", async () => {
      const [joueur, voisin] = [await naitre(), await naitre()];
      await presenter(joueur.territoireId, "Ines", apres(joueur.ne, HEURE));
      const brune = await presenter(voisin.territoireId, "Brune", apres(voisin.ne, HEURE));
      const [siens, autres] = [await tout(joueur.territoireId), await tout(voisin.territoireId)];

      expect(await accueillirLeVoyageur(pool, joueur.territoireId, brune, apres(joueur.ne, 4 * HEURE))).toBe("absent");
      expect(await tout(joueur.territoireId)).toEqual(siens);
      expect(await tout(voisin.territoireId)).toEqual(autres);
    });

    it("ne fait rien pour un Voyageur qui n'attend plus aux portes", async () => {
      const { territoireId, ne } = await naitre();
      const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
      expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE))).toBe("accueilli");
      const accueillie = await tout(territoireId);

      expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 5 * HEURE))).toBe("absent");
      expect(await tout(territoireId)).toEqual(accueillie);
    });

    it("accueilli plusieurs fois en même temps, il ne devient qu'un seul Habitant, d'un seul Récit", async () => {
      const { territoireId, ne } = await naitre();
      const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
      const nombre = await nombreDHabitants(pool, territoireId);

      const accueils = await Promise.all(Array.from({ length: 5 }, () => accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE))));
      expect(accueils.filter((a) => a === "accueilli")).toHaveLength(1);
      expect(await nombreDHabitants(pool, territoireId)).toBe(nombre + 1);
      expect(await recitsDuTerritoire(pool, territoireId)).toHaveLength(1);
      expect(await voyageursAuxPortes(pool, territoireId)).toEqual([]);
    });

    describe("avec un Métier choisi à l'accueil (US-0335)", () => {
      /** Le nombre d'Habitants du Territoire par Métier, sous son nom (« sans » : sans Métier), comme les compteurs de la page. */
      const effectifs = async (territoireId: number) => {
        const compte = new Map<string, number>();
        for (const h of await habitantsDuTerritoire(pool, territoireId)) compte.set(h.metier ?? "sans", (compte.get(h.metier ?? "sans") ?? 0) + 1);
        return Object.fromEntries(compte);
      };

      it("fait du Voyageur un Habitant qui exerce aussitôt le Métier choisi, et le compte parmi les siens", async () => {
        const { territoireId, ne } = await naitre();
        const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
        const avant = await habitants(territoireId);
        const sans = (await effectifs(territoireId)).sans;

        expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE), "chasseur")).toBe("accueilli");
        expect(await habitants(territoireId)).toEqual([...avant, ["Ines", "Chasseur", apres(ne, 4 * HEURE)]]);
        expect(await effectifs(territoireId)).toEqual({ sans, Chasseur: 1 });
        expect(await sort(ines)).toEqual(["accueilli", apres(ne, 4 * HEURE)]);
      });

      it("le fait arriver sans Métier quand aucun n'est choisi", async () => {
        const { territoireId, ne } = await naitre();
        const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
        const sans = (await effectifs(territoireId)).sans;

        expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE), null)).toBe("accueilli");
        expect((await habitants(territoireId)).at(-1)).toEqual(["Ines", null, apres(ne, 4 * HEURE)]);
        expect(await effectifs(territoireId)).toEqual({ sans: sans + 1 });
      });

      it("refuse un Métier inconnu, et le dit : rien ne change, et le Voyageur attend toujours", async () => {
        const { territoireId, ne } = await naitre();
        const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
        const avant = await tout(territoireId);

        for (const inconnu of ["dresseur", "Chasseur", ""]) {
          expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE), inconnu), inconnu).toBe("metier-inconnu");
        }
        expect(await tout(territoireId)).toEqual(avant);
        expect(await sort(ines)).toEqual([null, null]);
        // Il peut toujours être accueilli, avec un vrai Métier.
        expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE), "eleveur")).toBe("accueilli");
        expect((await habitants(territoireId)).at(-1)).toEqual(["Ines", "Éleveur", apres(ne, 4 * HEURE)]);
      });

      it("garde les autres refus de l'accueil : un Voyageur d'un autre Territoire, ou faute de place, ne devient rien, Métier choisi ou non", async () => {
        const [joueur, voisin] = [await naitre(), await naitre()];
        const brune = await presenter(voisin.territoireId, "Brune", apres(voisin.ne, HEURE));
        const autres = await tout(voisin.territoireId);
        expect(await accueillirLeVoyageur(pool, joueur.territoireId, brune, apres(joueur.ne, 4 * HEURE), "mineur")).toBe("absent");
        expect(await tout(voisin.territoireId)).toEqual(autres);

        const ines = await presenter(joueur.territoireId, "Ines", apres(joueur.ne, HEURE));
        await pool.query("insert into habitant (territoire_id, prenom) select $1, 'Arno' from generate_series(1, $2)", [joueur.territoireId, PLACES_DU_FOYER]);
        const siens = await tout(joueur.territoireId);
        expect(await accueillirLeVoyageur(pool, joueur.territoireId, ines, apres(joueur.ne, 4 * HEURE), "mineur")).toBe("plus-de-place");
        expect(await tout(joueur.territoireId)).toEqual(siens);
      });
    });

    /** US-0338 : fait venir au Territoire des Habitants, sans passer par les portes, jusqu'à en compter `nombre`. */
    const remplir = async (territoireId: number, nombre: number) =>
      pool.query(
        "insert into habitant (territoire_id, prenom) select $1, 'Arno' from generate_series(1, $2 - (select count(*)::int from habitant where territoire_id = $1))",
        [territoireId, nombre],
      );
    /** Retire au Territoire son dernier Habitant venu : sa place se libère. */
    const liberer = async (territoireId: number) => pool.query("delete from habitant where id = (select max(id) from habitant where territoire_id = $1)", [territoireId]);

    describe("quand la place manque (US-0338)", () => {
      it("refuse l'accueil quand toute la place est prise, et le dit : rien ne change, et le Voyageur attend toujours", async () => {
        const { territoireId, ne } = await naitre();
        const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
        await remplir(territoireId, PLACES_DU_FOYER);
        const avant = await tout(territoireId);

        expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE))).toBe("plus-de-place");
        expect(await tout(territoireId)).toEqual(avant);
        expect(await sort(ines)).toEqual([null, null]);
        // Plus d'Habitants que de places, de même.
        await remplir(territoireId, PLACES_DU_FOYER + 1);
        expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE))).toBe("plus-de-place");
        expect((await voyageursAuxPortes(pool, territoireId)).map((v) => v.id)).toEqual([ines]);
      });

      it("accueille jusqu'à la dernière place, et pas au-delà", async () => {
        const { territoireId, ne } = await naitre();
        const [ines, joran] = [await presenter(territoireId, "Ines", apres(ne, HEURE)), await presenter(territoireId, "Joran", apres(ne, HEURE))];
        await remplir(territoireId, PLACES_DU_FOYER - 1);

        expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE))).toBe("accueilli");
        expect(await nombreDHabitants(pool, territoireId)).toBe(PLACES_DU_FOYER);
        expect(await accueillirLeVoyageur(pool, territoireId, joran, apres(ne, 4 * HEURE))).toBe("plus-de-place");
        expect(await nombreDHabitants(pool, territoireId)).toBe(PLACES_DU_FOYER);
        expect((await voyageursAuxPortes(pool, territoireId)).map((v) => v.id)).toEqual([joran]);
      });

      it("l'accueille dès que de la place se libère avant la fin de son attente", async () => {
        const { territoireId, ne } = await naitre();
        const ines = await presenterQuiRepart(territoireId, "Ines", apres(ne, HEURE));
        await remplir(territoireId, PLACES_DU_FOYER);
        expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 2 * HEURE))).toBe("plus-de-place");

        // Le temps passe sans qu'elle reparte, puis un Habitant laisse sa place.
        await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 12 * HEURE) });
        await liberer(territoireId);
        expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 12 * HEURE))).toBe("accueilli");
        expect(await sort(ines)).toEqual(["accueilli", apres(ne, 12 * HEURE)]);
        expect(await nombreDHabitants(pool, territoireId)).toBe(PLACES_DU_FOYER);
      });

      it("dit d'abord qu'un Voyageur est déjà reparti, même quand la place manque", async () => {
        const { territoireId, ne } = await naitre();
        const ines = await presenterQuiRepart(territoireId, "Ines", apres(ne, HEURE));
        await remplir(territoireId, PLACES_DU_FOYER);
        await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 14 * HEURE) });
        expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 14 * HEURE))).toBe("reparti");
      });
    });

    describe("jamais deux fois (US-0339, en concurrence réelle)", () => {
      // Un second pool, comme un second appareil : ses demandes passent par d'autres connexions que le premier.
      let autre: Pool;
      beforeAll(() => {
        autre = poolDeTest();
      });
      afterAll(async () => {
        await autre.end();
      });
      const ESSAIS = 8;

      it("un double clic, ou deux appareils : le même Voyageur accueilli quatre fois en même temps ne devient qu'un seul Habitant, d'un seul Récit", async () => {
        const { territoireId, ne } = await naitre();
        const nombre = await nombreDHabitants(pool, territoireId);
        for (let essai = 0; essai < ESSAIS; essai++) {
          const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
          const accueils = await Promise.all([pool, autre, pool, autre].map((base) => accueillirLeVoyageur(base, territoireId, ines, apres(ne, 2 * HEURE))));
          expect(accueils.sort(), `essai ${essai}`).toEqual(["absent", "absent", "absent", "accueilli"]);
          expect(await nombreDHabitants(pool, territoireId), `essai ${essai}`).toBe(nombre + 1);
          expect(await sort(ines)).toEqual(["accueilli", apres(ne, 2 * HEURE)]);
          // Sa place rendue pour l'essai suivant.
          await liberer(territoireId);
        }
        expect(await recitsDuTerritoire(pool, territoireId)).toHaveLength(ESSAIS);
      });

      it("un Voyageur refusé sur un appareil ne peut plus être accueilli sur un autre, ensuite comme en même temps", async () => {
        const { territoireId, ne } = await naitre();
        const nombre = await nombreDHabitants(pool, territoireId);
        const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
        expect(await refuserLeVoyageur(autre, territoireId, ines, apres(ne, 2 * HEURE))).toBe(true);
        expect(await accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 3 * HEURE))).toBe("absent");
        expect(await sort(ines)).toEqual(["refuse", apres(ne, 2 * HEURE)]);
        expect(await nombreDHabitants(pool, territoireId)).toBe(nombre);

        let accueillis = 0;
        for (let essai = 0; essai < ESSAIS; essai++) {
          const joran = await presenter(territoireId, "Joran", apres(ne, HEURE));
          const [refuse, accueil] = await Promise.all([
            refuserLeVoyageur(autre, territoireId, joran, apres(ne, 2 * HEURE)),
            accueillirLeVoyageur(pool, territoireId, joran, apres(ne, 2 * HEURE)),
          ]);
          // L'un ou l'autre, jamais les deux : un Voyageur refusé n'est jamais devenu Habitant.
          expect([refuse, accueil === "accueilli"].filter(Boolean), `essai ${essai}`).toHaveLength(1);
          expect((await sort(joran))[0]).toBe(refuse ? "refuse" : "accueilli");
          expect(await nombreDHabitants(pool, territoireId)).toBe(nombre + (refuse ? 0 : 1));
          if (!refuse) {
            accueillis += 1;
            await liberer(territoireId);
          }
        }
        expect(await recitsDuTerritoire(pool, territoireId)).toHaveLength(accueillis);
      });

      it("quatre Voyageurs accueillis en même temps pour une seule place libre : un seul entre, les autres restent aux portes, faute de place", async () => {
        const { territoireId, ne } = await naitre();
        await remplir(territoireId, PLACES_DU_FOYER - 1);
        for (let essai = 0; essai < ESSAIS; essai++) {
          const venus: number[] = [];
          for (const prenom of ["Ines", "Joran", "Ilda", "Arno"]) venus.push(await presenter(territoireId, prenom, apres(ne, HEURE)));
          const accueils = await Promise.all(venus.map((id, i) => accueillirLeVoyageur(i % 2 ? autre : pool, territoireId, id, apres(ne, 2 * HEURE))));
          expect([...accueils].sort(), `essai ${essai}`).toEqual(["accueilli", "plus-de-place", "plus-de-place", "plus-de-place"]);
          expect(await nombreDHabitants(pool, territoireId), `essai ${essai}`).toBe(PLACES_DU_FOYER);
          const restent = venus.filter((_, i) => accueils[i] === "plus-de-place");
          expect((await voyageursAuxPortes(pool, territoireId)).map((v) => v.id)).toEqual(restent);
          // Pour l'essai suivant : ceux qui attendent renvoyés, et la place rendue.
          for (const id of restent) await refuserLeVoyageur(pool, territoireId, id, apres(ne, 3 * HEURE));
          await liberer(territoireId);
        }
      });
    });
  });

  describe("refuser un Voyageur (US-0336)", () => {
    /** Tout ce qu'un refus pourrait changer au Territoire : ses Habitants, ses Récits et ses Stocks. */
    const reste = async (territoireId: number) => ({
      habitants: await habitantsDuTerritoire(pool, territoireId),
      recits: await recitsDuTerritoire(pool, territoireId),
      stocks: (await stocksDuTerritoire(pool, territoireId)).map((s) => [s.id, s.quantite]),
    });

    it("le fait repartir aussitôt : il disparaît des portes, sans devenir Habitant ni laisser de Récit", async () => {
      const { territoireId, ne } = await naitre();
      const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
      const joran = await presenter(territoireId, "Joran", apres(ne, 2 * HEURE));
      const avant = await reste(territoireId);

      expect(await refuserLeVoyageur(pool, territoireId, ines, apres(ne, 3 * HEURE))).toBe(true);
      expect((await voyageursAuxPortes(pool, territoireId)).map((v) => v.id)).toEqual([joran]);
      expect(await reste(territoireId)).toEqual(avant);
      // US-0337 : le Voyageur reste connu, avec son sort et son heure.
      expect(await sort(ines)).toEqual(["refuse", apres(ne, 3 * HEURE)]);
    });

    it("libère sa place aux portes : avec trois Voyageurs qui attendent, la prochaine arrivée en fait entrer un de nouveau", async () => {
      const { territoireId, ne } = await naitre();
      const [premiere] = prevues(territoireId, ne, apres(ne, 1000 * HEURE)).arrivees;
      // Une heure avant la première arrivée, les portes sont pleines : elle serait perdue.
      const [ines, joran, ilda] = [
        await presenter(territoireId, "Ines", new Date(premiere.instant - HEURE)),
        await presenter(territoireId, "Joran", new Date(premiere.instant - HEURE)),
        await presenter(territoireId, "Ilda", new Date(premiere.instant - HEURE)),
      ];
      expect(await nombreDeVoyageurs(pool, territoireId)).toBe(VOYAGEURS_EN_ATTENTE_MAX);

      expect(await refuserLeVoyageur(pool, territoireId, joran, new Date(premiere.instant - HEURE))).toBe(true);
      await rattraper("territoire", territoireId, { pool, jusqua: new Date(premiere.instant) });
      const venus = await voyageursAuxPortes(pool, territoireId);
      expect(venus.map((v) => v.id).slice(0, 2)).toEqual([ines, ilda]);
      expect(venus.map((v) => v.arriveLe.getTime())).toEqual([premiere.instant - HEURE, premiere.instant - HEURE, premiere.instant]);
    });

    it("ne le fait jamais revenir, même quand le temps avance et que d'autres se présentent", async () => {
      const { territoireId, ne } = await naitre();
      const [premiere, deuxieme] = prevues(territoireId, ne, apres(ne, 1000 * HEURE)).arrivees;
      const ines = await presenter(territoireId, "Ines", new Date(premiere.instant - HEURE));

      expect(await refuserLeVoyageur(pool, territoireId, ines, new Date(premiere.instant - HEURE))).toBe(true);
      await rattraper("territoire", territoireId, { pool, jusqua: new Date(deuxieme.instant) });
      const venus = await voyageursAuxPortes(pool, territoireId);
      expect(venus.map((v) => v.arriveLe.getTime())).toEqual([premiere.instant, deuxieme.instant]);
      expect(venus.map((v) => v.id)).not.toContain(ines);
      // Refusé une seconde fois, il n'y a plus personne à faire repartir.
      expect(await refuserLeVoyageur(pool, territoireId, ines, new Date(deuxieme.instant))).toBe(false);
    });

    it("ne touche jamais au Voyageur d'un autre Territoire, quel que soit l'identifiant envoyé", async () => {
      const [joueur, voisin] = [await naitre(), await naitre()];
      await presenter(joueur.territoireId, "Ines", apres(joueur.ne, HEURE));
      const brune = await presenter(voisin.territoireId, "Brune", apres(voisin.ne, HEURE));
      const [siens, autres] = [await voyageursAuxPortes(pool, joueur.territoireId), await voyageursAuxPortes(pool, voisin.territoireId)];

      expect(await refuserLeVoyageur(pool, joueur.territoireId, brune, apres(joueur.ne, 2 * HEURE))).toBe(false);
      expect(await voyageursAuxPortes(pool, joueur.territoireId)).toEqual(siens);
      expect(await voyageursAuxPortes(pool, voisin.territoireId)).toEqual(autres);
    });

    it("accueilli et refusé en même temps, un seul des deux l'emporte : jamais un Habitant en double, ni un Habitant refusé", async () => {
      const { territoireId, ne } = await naitre();
      const nombre = await nombreDHabitants(pool, territoireId);
      for (let essai = 0; essai < 4; essai++) {
        const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
        const [accueilli, refuse, accueilliAussi, refuseAussi] = await Promise.all([
          accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE)),
          refuserLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE)),
          accueillirLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE)),
          refuserLeVoyageur(pool, territoireId, ines, apres(ne, 4 * HEURE)),
        ]);
        expect([accueilli === "accueilli", refuse, accueilliAussi === "accueilli", refuseAussi].filter(Boolean), `essai ${essai}`).toHaveLength(1);
      }
      // Chaque accueil qui l'a emporté a donné un Habitant et un Récit, et rien de plus.
      const accueils = (await recitsDuTerritoire(pool, territoireId)).length;
      expect(await nombreDHabitants(pool, territoireId)).toBe(nombre + accueils);
      expect(await voyageursAuxPortes(pool, territoireId)).toEqual([]);
    });
  });

  describe("l'historique des Voyageurs (US-0342)", () => {
    const JOUR = 24 * HEURE;
    /** Donne au Voyageur son sort à l'heure du jeu `instant`, comme un accueil, un refus ou son départ le feraient. */
    const donnerUnSort = (voyageurId: number, valeur: string, instant: Date) =>
      pool.query("update voyageur set sort = $2, sort_le = $3 where id = $1", [voyageurId, valeur, instant]);

    it("lit les Voyageurs passés du Territoire, accueillis, refusés ou repartis, chacun avec son arrivée et son sort, du plus récent sort au plus ancien", async () => {
      const { territoireId, ne } = await naitre();
      const voisin = await naitre();
      const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
      const joran = await presenter(territoireId, "Joran", apres(ne, 2 * HEURE));
      const ilda = await presenter(territoireId, "Ilda", apres(ne, 3 * HEURE));
      // Maëlle attend toujours aux portes ; Brune est passée chez le voisin.
      await presenter(territoireId, "Maëlle", apres(ne, 4 * HEURE));
      const brune = await presenter(voisin.territoireId, "Brune", apres(ne, HEURE));
      expect(await accueillirLeVoyageur(pool, territoireId, joran, apres(ne, 5 * HEURE))).toBe("accueilli");
      expect(await refuserLeVoyageur(pool, territoireId, ilda, apres(ne, 4 * HEURE))).toBe(true);
      expect(await refuserLeVoyageur(pool, voisin.territoireId, brune, apres(ne, 2 * HEURE))).toBe(true);
      await donnerUnSort(ines, "reparti", apres(ne, 13 * HEURE));

      expect(await voyageursPasses(pool, territoireId, apres(ne, 20 * HEURE))).toEqual([
        { id: ines, prenom: "Ines", arriveLe: apres(ne, HEURE), sort: "reparti", sortLe: apres(ne, 13 * HEURE) },
        { id: joran, prenom: "Joran", arriveLe: apres(ne, 2 * HEURE), sort: "accueilli", sortLe: apres(ne, 5 * HEURE) },
        { id: ilda, prenom: "Ilda", arriveLe: apres(ne, 3 * HEURE), sort: "refuse", sortLe: apres(ne, 4 * HEURE) },
      ]);
    });

    it("met d'abord, de deux sorts tombés au même instant, celui du dernier arrivé", async () => {
      const { territoireId, ne } = await naitre();
      const ines = await presenter(territoireId, "Ines", apres(ne, HEURE));
      const joran = await presenter(territoireId, "Joran", apres(ne, HEURE));
      await donnerUnSort(ines, "reparti", apres(ne, 13 * HEURE));
      await donnerUnSort(joran, "reparti", apres(ne, 13 * HEURE));
      expect((await voyageursPasses(pool, territoireId, apres(ne, 14 * HEURE))).map((v) => v.prenom)).toEqual(["Joran", "Ines"]);
    });

    it(`ne garde que ceux dont le sort est tombé dans les ${HISTORIQUE_VOYAGEURS_JOURS} derniers jours de jeu`, async () => {
      const { territoireId, ne } = await naitre();
      const instant = apres(ne, 30 * JOUR);
      const limite = new Date(instant.getTime() - HISTORIQUE_VOYAGEURS_JOURS * JOUR);
      const [ines, joran, ilda] = [
        await presenter(territoireId, "Ines", new Date(limite.getTime() - 2 * HEURE)),
        await presenter(territoireId, "Joran", new Date(limite.getTime() - 2 * HEURE)),
        await presenter(territoireId, "Ilda", new Date(instant.getTime() - HEURE)),
      ];
      // Ines est repartie juste avant la limite ; Joran a été refusé à la limite même ; Ilda vient d'être accueillie.
      await donnerUnSort(ines, "reparti", new Date(limite.getTime() - 1));
      await donnerUnSort(joran, "refuse", limite);
      await donnerUnSort(ilda, "accueilli", instant);
      expect((await voyageursPasses(pool, territoireId, instant)).map((v) => v.prenom)).toEqual(["Ilda", "Joran"]);
    });

    it("ne lit personne quand aucun Voyageur n'est encore passé, même quand un Voyageur attend aux portes", async () => {
      const { territoireId, ne } = await naitre();
      await presenter(territoireId, "Ines", apres(ne, HEURE));
      expect(await voyageursPasses(pool, territoireId, apres(ne, 2 * HEURE))).toEqual([]);
    });
  });

  describe("les portes fermées pendant une Famine (US-0341)", () => {
    /** La Famine d'un Territoire affamé (affamer), de son début à sa fin, et la fin de l'absence, après sa naissance. */
    const [DEBUT, FIN, ABSENCE] = [13 * HEURE, 42 * HEURE, 60 * HEURE];
    /**
     * Un Territoire tout neuf que la Famine prend 13 h après sa naissance et quitte 29 h plus tard, au milieu d'une
     * absence de 60 h. Quarante Habitants mangent 80 par heure ; la Viande, vide, ne donne que ses 8 de production, et
     * les Végétaux, 754, paient les 72 qui restent en en produisant 14 : 58 par heure, 13 h tout juste. Un Habitant part
     * ensuite à chaque heure pleine ; au 29e départ, à 42 h, les onze qui restent mangent 22 par heure, ce que la prairie
     * produit. La première arrivée, de 4 à 12 h après la naissance, tombe avant la Famine ; au moins deux tombent pendant,
     * dont les écarts ne dépassent pas 12 h, et au moins une après.
     */
    const affamer = async () => {
      const t = await naitre();
      await pool.query(
        "with partis as (delete from habitant where territoire_id = $1) insert into habitant (territoire_id, prenom) select $1, 'Essai' from generate_series(1, 40)",
        [t.territoireId],
      );
      await pool.query(
        `update stock set quantite = case ressource_id when 'viande' then 0 else 754 end, reste = 0, plein_depuis = null
         where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')`,
        [t.territoireId],
      );
      return t;
    };
    /** Ce que la base doit tenir à `jusqua` : les arrivées tombées pendant la Famine sont perdues. */
    const prevu = ({ territoireId, ne }: { territoireId: number; ne: Date }, jusqua = apres(ne, ABSENCE)) =>
      attendu(territoireId, ne, jusqua, [], { debut: ne.getTime() + DEBUT, fin: ne.getTime() + FIN });
    /**
     * Au retour : la Famine a bien duré de 13 à 42 h ; aucun Voyageur ne s'est présenté pendant, alors que des arrivées y
     * sont tombées, chacune perdue et la suivante programmée ; celui qui attendait déjà est resté jusqu'au bout de son
     * attente ; et les arrivées ont repris après.
     */
    const auRetour = async (t: { territoireId: number; ne: Date }) => {
      const fin = (await recitsDuTerritoire(pool, t.territoireId)).filter((r) => r.titre === "Fin de la Famine");
      expect(fin.map((r) => [r.survenuLe.getTime() - t.ne.getTime(), r.texte])).toEqual([
        [FIN, "La Nourriture paie de nouveau l'Entretien. La Famine a duré 29 h ; 29 Habitants ont quitté le Territoire."],
      ]);
      const lu = await etat(t.territoireId);
      expect(lu).toEqual(prevu(t));
      const pendant = (instant: number) => instant >= t.ne.getTime() + DEBUT && instant < t.ne.getTime() + FIN;
      expect(lu.arrivees.filter(([, instant]) => pendant(instant!)).length).toBeGreaterThanOrEqual(2);
      const venus = [...lu.voyageurs, ...lu.repartis.map(([arrive]) => arrive)];
      expect(venus.filter(pendant)).toEqual([]);
      const [premier] = lu.repartis;
      expect(premier[0]).toBeLessThan(t.ne.getTime() + DEBUT);
      expect(premier[1]).toBe(premier[0] + ATTENTE);
      expect(premier[1]).toBeGreaterThan(t.ne.getTime() + DEBUT);
      expect(venus.some((instant) => instant >= t.ne.getTime() + FIN)).toBe(true);
    };

    it("page fermée : au retour, un seul rattrapage ne fait venir personne pendant la Famine, et les arrivées reprennent après", async () => {
      const t = await affamer();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, ABSENCE) });
      await auRetour(t);
    });

    it("page ouverte : à chaque rattrapage, les arrivées prévues jusque-là, celles de la Famine perdues, et la même fin", async () => {
      const t = await affamer();
      for (let ms = 37 * MINUTE + 7_919; ms < ABSENCE; ms += 37 * MINUTE + 7_919) {
        await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, ms) });
        expect(await etat(t.territoireId), `${(ms / HEURE).toFixed(2)} h`).toEqual(prevu(t, apres(t.ne, ms)));
      }
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, ABSENCE) });
      await auRetour(t);
    }, 120_000);

    it("tâche planifiée passée au milieu, dont deux fois pendant la Famine : même fin qu'à la page fermée", async () => {
      const t = await affamer();
      for (const h of [5, 13.5, 27.25, 41.99, 50]) {
        const passage = await rattraperLesAbsents({ pool, maintenant: apres(t.ne, h * HEURE), parmi: { territoire: [t.territoireId] } });
        expect(passage, `passage à ${h} h`).toMatchObject({ rattrapes: 1, echecs: 0 });
      }
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, ABSENCE) });
      await auRetour(t);
    }, 60_000);
  });
});
