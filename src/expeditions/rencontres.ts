// La Rencontre (US-0932) : quand une Bête sauvage se montre sur la Case où une Expédition séjourne, ou y est encore quand
// elle arrive, l'Expédition la voit. Seule la Case du séjour compte (US-0915, src/expeditions/presence.ts) : les Cases
// traversées à l'aller et au retour ne montrent rien (décidé le 2026-10-09), et un joueur sans Expédition sur la Case
// n'apprend rien de la Bête. Elle voit les Bêtes sauvages ordinaires (src/monde/betes-sauvages.ts) comme les Bêtes de
// naissance de son Territoire, à lui seul réservées (src/monde/betes-de-naissance.ts). Chaque Rencontre est retenue en
// base (table rencontre), à son instant exact, par le mécanisme du temps (src/temps/regles.ts) : en direct, au rattrapage
// ou par la tâche planifiée, les mêmes Rencontres, aux mêmes instants. US-0934 : la Bête à portée suit l'Expédition, c'est
// l'Apprivoisement (src/expeditions/apprivoisement.ts), retenu avec sa Rencontre ; elle a alors quitté sa Case, et personne
// ne la rencontre plus. US-0937 : elle est alors mâle ou femelle, tiré au hasard (src/expeditions/sexe.ts), retenu avec sa
// Rencontre. US-0933 : chaque Rencontre retenue inscrit son Espèce au Bestiaire du Territoire, dans la même transaction
// (src/bestiaire/bestiaire.ts). L'arrivée au Foyer (US-0938, src/expeditions/arrivee-au-foyer.ts) les lit ici, comme le
// fera le récit (US-0940). US-0943 : la Bête trop forte, vue sans suivre l'Expédition, peut l'attaquer tant qu'elles sont
// ensemble sur la Case (src/expeditions/attaque.ts) : son attaque est retenue avec sa Rencontre, à son instant, par le
// même mécanisme, pour le combat (US-0944). US-0962 : chaque Expédition présente voit la Bête, de quelque joueur qu'elle
// soit, même à l'instant où elle en suit une autre. Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { inscrireLesEspecesCroisees } from "@/bestiaire/bestiaire";
import { betesDeNaissanceDesCases, hasardsDeLAttaqueDUneBeteDeNaissance } from "@/monde/betes-de-naissance";
import { betesSauvagesDesCases, emmenerUneBete, hasardsDeLAttaque } from "@/monde/betes-sauvages";
import { type ExpeditionSurLaCase, lExpeditionSuivie, vueLe } from "./apprivoisement";
import { chanceDAttaqueParHeure, instantDeLAttaque, type Regime } from "./attaque";
import { forceDeLEscorte, forceDUneBete } from "./force";
import { subirLesCombats } from "./pertes";
import { expeditionsPresentesDuTerritoire, expeditionsPresentesSurLesCases } from "./presence";
import { sexesALApprivoisement } from "./sexe";

/**
 * US-0932 : une Rencontre : l'instant du jeu où l'Expédition a vu la Bête (vueLe), sur sa Case (caseId), et la Bête :
 * l'instant de son apparition, son Espèce et la Rareté de celle-ci ; une Bête sauvage ordinaire par son numéro sur la Case
 * (numero), une Bête de naissance par sa ligne (beteDeNaissanceId), l'autre restant null. US-0934 : apprivoisee, la Bête
 * suit l'Expédition depuis vueLe. US-0933 : nouvelleEspece est vrai pour la Rencontre qui a inscrit son Espèce au
 * Bestiaire du Territoire, la première où le joueur l'a vue : les récits de retour (US-0917) et de Rencontre (US-0940) y
 * liront « Nouvelle Espèce au Bestiaire ».
 */
export type Rencontre = {
  id: number;
  vueLe: Date;
  caseId: number;
  apparueLe: Date;
  especeId: string;
  rareteId: string;
  numero: number | null;
  beteDeNaissanceId: number | null;
  apprivoisee: boolean;
  nouvelleEspece: boolean;
};

/** Une Rencontre à retenir : l'Expédition, la Bête et sa Case, l'instant où elle la voit, et si elle la suit. */
type AVoir = {
  expeditionId: number;
  caseId: number;
  numero: number | null;
  beteDeNaissanceId: number | null;
  especeId: string;
  apparueLe: Date;
  vueLe: Date;
  apprivoisee: boolean;
};

/**
 * US-0943 : une Bête trop forte et l'Expédition qui la voit sans qu'elle la suive, ensemble sur la Case de leur Rencontre
 * (debut) jusqu'au départ de l'une ou de l'autre (fin, exclue) : le temps où la Bête peut attaquer.
 */
type Ensemble = {
  expeditionId: number;
  caseId: number;
  numero: number | null;
  beteDeNaissanceId: number | null;
  especeId: string;
  debut: Date;
  fin: Date;
};

/**
 * US-0943 : l'attaque d'une Bête trop forte qu'a subie une Expédition : la Rencontre de la Bête, son Espèce, et l'instant
 * du jeu de l'attaque (`le`).
 */
export type AttaqueSubie = { rencontreId: number; especeId: string; le: Date };

/**
 * US-0934 : la force de l'escorte de chacune des Expéditions `ids` (US-0905), tirée des caractéristiques de ses Espèces ;
 * une Expédition sans escorte n'y figure pas.
 */
export async function forcesDesEscortes(base: Pool | PoolClient, ids: number[]): Promise<Map<number, number>> {
  const { rows } = await base.query<{ id: number; attaque: number; vie: number; nombre: number }>(
    `select s.expedition_id as id, e.attaque, e.vie, s.nombre from expedition_escorte s join espece e on e.id = s.espece_id
     where s.expedition_id = any($1::int[])`,
    [ids],
  );
  const parExpedition = new Map<number, { force: number; nombre: number }[]>();
  for (const { id, nombre, ...espece } of rows) parExpedition.set(id, [...(parExpedition.get(id) ?? []), { force: forceDUneBete(espece), nombre }]);
  return new Map([...parExpedition].map(([id, betes]) => [id, forceDeLEscorte(betes)]));
}

/** US-0934 : la force d'une Bête de chacune des Espèces `ids` (US-0905). */
export async function forcesDesEspeces(base: Pool | PoolClient, ids: string[]): Promise<Map<string, number>> {
  const { rows } = await base.query<{ id: string; attaque: number; vie: number }>("select id, attaque, vie from espece where id = any($1::text[])", [ids]);
  return new Map(rows.map(({ id, ...espece }) => [id, forceDUneBete(espece)]));
}

/**
 * US-0932 : retient les Rencontres des Expéditions du Territoire `territoireId` qui tombent dans [de, a) : chaque Bête
 * présente sur la Case d'une Expédition pendant son séjour, vue à l'instant de son apparition, ou de l'arrivée de
 * l'Expédition si elle était déjà là, tant que ni l'une ni l'autre n'est partie. Une Rencontre tombée avant `de` a été
 * retenue avec l'intervalle où elle tombait : rien ne se voit deux fois, quel que soit le découpage du temps. Appelée par
 * le mécanisme du temps, dans la transaction du rattrapage. US-0934 : la Bête suit la première Expédition qui la voit et
 * l'a à portée (lExpeditionSuivie), de ce Territoire ou d'un autre, lue parmi toutes celles présentes sur sa Case depuis
 * son apparition ; après cet instant, plus aucune autre ne la voit, même dans la même tranche. US-0962 : à cet instant,
 * toutes celles qui sont sur la Case la voient encore, de tous les joueurs, et son Espèce entre au Bestiaire de chacun.
 * Le Territoire de l'Expédition suivie retient seul son départ, à l'heure de l'Apprivoisement (emmenerUneBete) : les
 * autres le recalculent, sur les Bêtes lues jusqu'à l'instant de ce départ compris (departCompris), d'où le même
 * résultat quel que soit l'ordre des rattrapages. US-0943 : puis les attaques des Bêtes trop fortes qui tombent dans
 * [de, a) (retenirLesAttaques).
 */
export async function retenirLesRencontres(base: Pool | PoolClient, territoireId: number, de: Date, a: Date): Promise<void> {
  const expeditions = await expeditionsPresentesDuTerritoire(base, territoireId, de, a);
  if (expeditions.length === 0) return;
  const caseIds = [...new Set(expeditions.map((x) => x.caseId))];
  // L'une après l'autre : sur le client d'une transaction, deux requêtes ne partent pas à la fois.
  const sauvages = await betesSauvagesDesCases(base, caseIds, de, a, { departCompris: true });
  const deNaissance = await betesDeNaissanceDesCases(base, territoireId, caseIds, de, a);
  const betes = caseIds.flatMap((caseId) => [
    ...sauvages.get(caseId)!.map((b) => ({ ...b, caseId, beteDeNaissanceId: null })),
    ...deNaissance.get(caseId)!.map((b) => ({ ...b, caseId, numero: null, beteDeNaissanceId: b.id })),
  ]);
  if (betes.length === 0) return;
  // US-0934 : toutes les Expéditions présentes sur ces Cases depuis l'apparition de la première de ces Bêtes, de tous les
  // Territoires, avec la force de leur escorte : celles qui ont pu emmener une Bête avant celles du Territoire.
  const depuis = new Date(Math.min(...betes.map((b) => b.arrivee.getTime())));
  const presentes = await expeditionsPresentesSurLesCases(base, caseIds, depuis, a);
  const escortes = await forcesDesEscortes(base, [...new Set([...presentes.values()].flat().map((x) => x.id))]);
  const forces = await forcesDesEspeces(base, [...new Set(betes.map((b) => b.especeId))]);
  const aVoir: AVoir[] = [];
  const emmenees: Emmenee[] = [];
  const ensembles: Ensemble[] = [];
  for (const b of betes) {
    // Une Bête de naissance ne se montre qu'aux Expéditions de son Territoire (US-0975).
    const rivales: ExpeditionSurLaCase[] = presentes
      .get(b.caseId)!
      .filter((x) => b.beteDeNaissanceId === null || x.territoireId === territoireId)
      .map((x) => ({ id: x.id, arrivee: x.arrivee, depart: x.depart, escorte: escortes.get(x.id) ?? null }));
    const suivie = lExpeditionSuivie({ ...b, force: forces.get(b.especeId)! }, rivales);
    for (const x of expeditions.filter((x) => x.caseId === b.caseId)) {
      const vue = vueLe(b, x);
      if (!vue) continue;
      const apprivoisee = suivie?.expeditionId === x.id;
      // Partie avec une autre Expédition, la Bête n'est plus là pour celles qui la verraient ensuite ; celles qui la voient
      // au même instant la voient encore (US-0962).
      if (suivie && !apprivoisee && vue > suivie.le) continue;
      // US-0943 : vue sans la suivre, la Bête est trop forte pour l'escorte (US-0942) : elle peut attaquer l'Expédition
      // jusqu'à son propre départ, à la fin de sa durée ou avec une autre Expédition, ou celui de l'Expédition, à la fin de
      // son séjour ou à son rappel ; même vue dans une tranche passée, son attaque peut tomber dans celle-ci. Vue à l'instant
      // même où elle en suit une autre (US-0962), elle n'a plus le temps d'attaquer : leur ensemble est vide.
      const fin = new Date(Math.min(b.depart.getTime(), x.depart.getTime(), suivie?.le.getTime() ?? Infinity));
      if (!apprivoisee && vue < a && fin > de) {
        ensembles.push({ expeditionId: x.id, caseId: b.caseId, numero: b.numero, beteDeNaissanceId: b.beteDeNaissanceId, especeId: b.especeId, debut: vue, fin });
      }
      if (vue < de || vue >= a) continue;
      const rencontre = { expeditionId: x.id, caseId: b.caseId, numero: b.numero, beteDeNaissanceId: b.beteDeNaissanceId, especeId: b.especeId, apparueLe: b.arrivee, vueLe: vue, apprivoisee };
      aVoir.push(rencontre);
      if (apprivoisee && b.numero !== null) emmenees.push({ caseId: b.caseId, numero: b.numero, le: vue, rencontre });
    }
  }
  if (aVoir.length > 0) await retenirLesVues(base, territoireId, aVoir, emmenees);
  // US-0943 : après les Rencontres, qu'une attaque de la même tranche trouve retenues.
  if (ensembles.length > 0) await retenirLesAttaques(base, ensembles, de, a);
}

/**
 * US-0934 : une Bête sauvage ordinaire qui suit une Expédition : sa Case, son numéro, l'instant où elle la suit, et sa
 * Rencontre à retenir.
 */
type Emmenee = { caseId: number; numero: number; le: Date; rencontre: AVoir };

/**
 * US-0932 : retient les Rencontres `aVoir` du Territoire `territoireId`, et (US-0934) le départ des Bêtes sauvages
 * `emmenees` avec l'Expédition qu'elles suivent ; dans la transaction de retenirLesRencontres.
 */
async function retenirLesVues(base: Pool | PoolClient, territoireId: number, aVoir: AVoir[], emmenees: Emmenee[]): Promise<void> {
  // US-0934 : la Bête sauvage ordinaire qui suit une Expédition quitte sa Case (bete_partie) ; une Bête de naissance, par
  // sa seule Rencontre apprivoisée. Une Bête dont un autre Territoire a déjà retenu le départ à cet instant ne suit pas
  // celle-ci, même si le tirage, recalculé sur des forces qui ont changé depuis (US-0963), la désignait : vue, elle n'est
  // pas apprivoisée, et ne rejoint jamais deux Foyers.
  for (const { caseId, numero, le, rencontre } of emmenees) if (!(await emmenerUneBete(base, caseId, numero, le))) rencontre.apprivoisee = false;
  // US-0937 : la Bête qui suit l'Expédition est mâle ou femelle, tiré à son Apprivoisement ; celle qui reste n'en a pas.
  const apprivoisees = aVoir.filter((r) => r.apprivoisee);
  const sexes = new Map((await sexesALApprivoisement(base, apprivoisees)).map((sexe, i) => [apprivoisees[i], sexe]));
  // « on conflict do nothing » : une Expédition ne rencontre qu'une fois chaque Bête, et son sexe ne change plus.
  const { rowCount } = await base.query(
    `insert into rencontre (expedition_id, numero, bete_de_naissance_id, espece_id, apparue_le, vue_le, apprivoisee, sexe)
     select * from unnest($1::int[], $2::bigint[], $3::int[], $4::text[], $5::timestamptz[], $6::timestamptz[], $7::boolean[], $8::sexe[])
     on conflict do nothing`,
    [
      aVoir.map((r) => r.expeditionId),
      aVoir.map((r) => r.numero),
      aVoir.map((r) => r.beteDeNaissanceId),
      aVoir.map((r) => r.especeId),
      aVoir.map((r) => r.apparueLe),
      aVoir.map((r) => r.vueLe),
      aVoir.map((r) => r.apprivoisee),
      aVoir.map((r) => sexes.get(r) ?? null),
    ],
  );
  // US-0933 : l'Espèce de chaque Bête vue entre au Bestiaire, qu'elle suive l'Expédition ou non.
  if (rowCount) await inscrireLesEspecesCroisees(base, territoireId);
}

/**
 * US-0943 : retient, avec leur Rencontre, les attaques des Bêtes trop fortes qui tombent dans [de, a), chacune pendant
 * son `Ensemble` avec l'Expédition qui la voit, à l'instant que disent ses tirages (instantDeLAttaque), à la chance de son
 * régime : celle d'une Bête sauvage ordinaire tirée de la graine de son Monde, de sa Case et de son numéro, celle d'une
 * Bête de naissance de la graine et de sa ligne. Seule la première attaque de chaque Bête compte, même tombée dans une
 * tranche passée : au plus une par Bête et par Expédition, la même quel que soit le découpage du temps. Dans la
 * transaction de retenirLesRencontres. US-0944 : chacune livre aussitôt son combat, et l'escorte y perd des Bêtes.
 */
async function retenirLesAttaques(base: Pool | PoolClient, ensembles: Ensemble[], de: Date, a: Date): Promise<void> {
  const { rows: cases } = await base.query<{ id: number; q: number; r: number; graine: string }>(
    "select c.id, c.q, c.r, m.graine from case_du_monde c join monde m on m.id = c.monde_id where c.id = any($1::int[])",
    [[...new Set(ensembles.map((e) => e.caseId))]],
  );
  const lesCases = new Map(cases.map((c) => [c.id, { q: c.q, r: c.r, graine: Number(c.graine) }]));
  const { rows: especes } = await base.query<{ id: string; regime: Regime }>("select id, regime from espece where id = any($1::text[])", [
    [...new Set(ensembles.map((e) => e.especeId))],
  ]);
  const regimes = new Map(especes.map((e) => [e.id, e.regime]));
  const attaques: (Ensemble & { le: Date })[] = [];
  for (const e of ensembles) {
    const laCase = lesCases.get(e.caseId)!;
    const hasards = (heure: number) =>
      e.numero !== null
        ? hasardsDeLAttaque(laCase, e.numero, e.expeditionId, heure)
        : hasardsDeLAttaqueDUneBeteDeNaissance(laCase.graine, e.beteDeNaissanceId!, e.expeditionId, heure);
    const le = instantDeLAttaque(e, chanceDAttaqueParHeure(regimes.get(e.especeId)!), hasards);
    if (le && le >= de && le < a) attaques.push({ ...e, le });
  }
  if (attaques.length === 0) return;
  // « attaque_le is null » : une attaque retenue ne change plus.
  const { rows: retenues } = await base.query<{ expeditionId: number; especeId: string; le: Date; numero: string | null; beteDeNaissanceId: number | null }>(
    `update rencontre r set attaque_le = v.le
     from unnest($1::int[], $2::bigint[], $3::int[], $4::timestamptz[]) as v(expedition_id, numero, bete_de_naissance_id, le)
     where r.expedition_id = v.expedition_id and (r.numero = v.numero or r.bete_de_naissance_id = v.bete_de_naissance_id)
       and r.attaque_le is null
     returning r.expedition_id as "expeditionId", r.espece_id as "especeId", r.attaque_le as le, r.numero,
       r.bete_de_naissance_id as "beteDeNaissanceId"`,
    [attaques.map((x) => x.expeditionId), attaques.map((x) => x.numero), attaques.map((x) => x.beteDeNaissanceId), attaques.map((x) => x.le)],
  );
  // US-0944 : chaque attaque retenue livre son combat, à son instant (src/expeditions/pertes.ts).
  await subirLesCombats(
    base,
    retenues.map((r) => ({ ...r, numero: r.numero === null ? null : Number(r.numero) })),
  );
}

/**
 * US-0943 : les attaques de Bêtes trop fortes qu'a subies l'Expédition `expeditionId`, retenues jusqu'ici, dans l'ordre du
 * temps : au plus une par Bête vue. US-0944 : chacune a livré son combat à l'instant où elle a été retenue
 * (retenirLesAttaques).
 */
export async function attaquesSubies(base: Pool | PoolClient, expeditionId: number): Promise<AttaqueSubie[]> {
  const { rows } = await base.query<AttaqueSubie>(
    `select id as "rencontreId", espece_id as "especeId", attaque_le as le from rencontre
     where expedition_id = $1 and attaque_le is not null
     order by attaque_le, id`,
    [expeditionId],
  );
  return rows;
}

/**
 * US-0932 : les Rencontres de l'Expédition `expeditionId` retenues jusqu'ici, dans l'ordre des apparitions : celles des
 * Bêtes déjà là à son arrivée, puis les suivantes, chacune à son heure.
 */
export async function rencontresDUneExpedition(base: Pool | PoolClient, expeditionId: number): Promise<Rencontre[]> {
  const { rows } = await base.query<Omit<Rencontre, "numero"> & { numero: string | null }>(
    `select r.id, r.vue_le as "vueLe", x.case_id as "caseId", r.apparue_le as "apparueLe", r.espece_id as "especeId",
       e.rarete_id as "rareteId", r.numero, r.bete_de_naissance_id as "beteDeNaissanceId", r.apprivoisee,
       exists (select 1 from bestiaire b where b.rencontre_id = r.id) as "nouvelleEspece"
     from rencontre r join expedition x on x.id = r.expedition_id join espece e on e.id = r.espece_id
     where r.expedition_id = $1
     order by r.apparue_le, r.id`,
    [expeditionId],
  );
  return rows.map((r) => ({ ...r, numero: r.numero === null ? null : Number(r.numero) }));
}
