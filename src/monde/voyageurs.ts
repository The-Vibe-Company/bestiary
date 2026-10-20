// Les Voyageurs (US-0331) : des humains de passage qui se présentent de temps en temps aux portes d'un
// Territoire, et y attendent. Côté serveur uniquement. US-0337 : un Voyageur ne s'efface jamais ; tant qu'il
// attend aux portes, il n'a pas de sort (sort is null), puis il est accueilli, refusé, ou reparti de lui-même.
import "server-only";
import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { FAMINE_IMMINENTE_HEURES, HISTORIQUE_VOYAGEURS_JOURS, VOYAGEUR_ATTEND_HEURES, VOYAGEUR_TOUTES_LES_HEURES, VOYAGEURS_EN_ATTENTE_MAX } from "@/reglages";
import { programmerEvenement, type Evenement } from "@/temps/avancer";
import { ajouterUnHabitant, plusDePlace } from "./habitants";
import { type EntretienDesBetesLu, famineImminenteRetenue, nourriturePourEncoreDesStocks } from "./nourriture";
import { ecrireUnRecit, type NouveauRecit } from "./recits";
import type { Stock } from "./stocks";

/** US-0331 : l'événement d'une arrivée ; ses données portent son numéro, 1 pour la première du Territoire. */
export const ARRIVEE_VOYAGEUR = "arrivee_voyageur";

/** US-0337 : l'événement du départ d'un Voyageur au bout de son attente ; ses données portent son identifiant. */
export const DEPART_VOYAGEUR = "depart_voyageur";

/** US-0331 : l'écart moyen entre deux arrivées, en millisecondes de jeu. */
const MOYENNE_MS = Math.round(VOYAGEUR_TOUTES_LES_HEURES * 3_600_000);

/**
 * US-0331 : l'écart, en millisecondes de jeu, avant l'arrivée `numero` d'un Territoire (la première comptée
 * depuis sa naissance, les suivantes depuis la précédente) : tiré uniformément de la moitié à une fois et demie
 * la moyenne, par un hachage du Territoire et du numéro plutôt qu'au hasard. Le même Territoire voit ainsi
 * toujours la même suite d'arrivées, quel que soit le découpage du rattrapage. La base fait le même tirage
 * pour la première arrivée (fonction ecart_avant_voyageur, migration 0038).
 */
export function ecartAvantVoyageur(territoireId: number, numero: number): number {
  const tirage = createHash("md5").update(`${territoireId}:${numero}`).digest().readUInt32BE(0);
  // moyenne × (2³¹ + tirage) / 2³², en entiers exacts, comme la base le calcule.
  return Number((BigInt(MOYENNE_MS) * (BigInt(2 ** 31) + BigInt(tirage))) / BigInt(2 ** 32));
}

/**
 * US-0331 : un Voyageur se présente au Territoire $1 à l'instant $2, avec un prénom tiré au hasard dans la
 * table prenom, différent de ceux de ses Habitants et des Voyageurs qui attendent (si tous sont pris, un
 * prénom déjà porté plutôt que rien) ; s'il en attend déjà $3, personne ne se présente. Rend son identifiant
 * quand il se présente. US-0337 : seuls comptent ceux qui attendent encore aux portes. US-0341 : un Territoire
 * en Famine, à cet instant, n'en voit venir aucun.
 */
const FAIRE_ENTRER = `
  insert into voyageur (territoire_id, prenom, arrive_le)
  select $1, tire.nom, $2
  from (
    select p.nom from prenom p
    order by exists (select 1 from habitant h where h.territoire_id = $1 and h.prenom = p.nom)
      or exists (select 1 from voyageur v where v.territoire_id = $1 and v.sort is null and v.prenom = p.nom), random()
    limit 1
  ) tire
  where (select count(*) from voyageur where territoire_id = $1 and sort is null) < $3
    and (select famine_depuis from territoire where id = $1) is null
  returning id`;

/**
 * US-0331 : l'arrivée d'un Voyageur, à son instant. Il se présente s'il reste de la place aux portes ; sinon
 * personne ne vient, et l'arrivée est perdue, pas reportée. Dans les deux cas, l'arrivée suivante est
 * programmée : le temps qui avance l'applique à son tour, dans la même avancée si elle tombe avant sa fin.
 * US-0337 : le Voyageur qui se présente reçoit aussitôt son départ, au bout de son attente, programmé avant
 * l'arrivée suivante : tombés au même instant, le départ passe le premier et libère sa place.
 *
 * US-0341 : pendant une Famine, personne ne vient non plus : les Voyageurs évitent un Territoire en Famine. Le
 * temps qui avance a mis le Territoire à l'heure de l'arrivée avant de l'appliquer (PRODUIRE) : la Famine qu'il
 * retient (famine_depuis) est celle de cet instant exact, quel que soit le découpage du temps ; commencée à cet
 * instant même, elle compte, finie à cet instant même, non. L'arrivée est perdue comme aux portes pleines, et la
 * suivante reste programmée ; ceux qui attendaient déjà restent jusqu'au bout de leur attente.
 */
export async function arriveeDUnVoyageur(client: PoolClient, territoireId: number, evenement: Evenement): Promise<void> {
  const numero = evenement.donnees.numero;
  if (typeof numero !== "number" || !Number.isInteger(numero) || numero < 1) {
    throw new Error(`Arrivée de Voyageur sans numéro valable pour le Territoire ${territoireId}.`);
  }
  const { rows } = await client.query<{ id: number }>(FAIRE_ENTRER, [territoireId, evenement.survientLe, VOYAGEURS_EN_ATTENTE_MAX]);
  if (rows[0]) {
    await programmerEvenement(client, "territoire", territoireId, departDuVoyageur(evenement.survientLe), DEPART_VOYAGEUR, { voyageur: rows[0].id });
  }
  const suivante = new Date(evenement.survientLe.getTime() + ecartAvantVoyageur(territoireId, numero + 1));
  await programmerEvenement(client, "territoire", territoireId, suivante, ARRIVEE_VOYAGEUR, { numero: numero + 1 });
}

/**
 * US-0333 : l'instant où un Voyageur arrivé à `arriveLe` repart s'il n'a pas été accueilli, VOYAGEUR_ATTEND_HEURES
 * heures de jeu plus tard. La seule règle de son départ : la page en tire le compte à rebours, et le départ
 * lui-même (US-0337) est programmé à cet instant. La migration 0041 programme celui des Voyageurs déjà aux portes
 * avec la même durée : la changer demande une migration qui déplace les départs à venir.
 */
export function departDuVoyageur(arriveLe: Date): Date {
  return new Date(arriveLe.getTime() + VOYAGEUR_ATTEND_HEURES * 3_600_000);
}

/** US-0337 : le Voyageur dont un événement de départ annonce le départ. */
function voyageurDuDepart(territoireId: number, evenement: Evenement): number {
  const voyageurId = evenement.donnees.voyageur;
  if (typeof voyageurId !== "number" || !Number.isInteger(voyageurId) || voyageurId < 1) {
    throw new Error(`Départ de Voyageur sans Voyageur valable pour le Territoire ${territoireId}.`);
  }
  return voyageurId;
}

/**
 * US-0337 : le Récit de départ du Territoire $1 que le joueur n'a pas encore lu, s'il y en a un. Un Récit de
 * départ se reconnaît à coup sûr : le départ ($2, le type de l'événement) d'un Voyageur du Territoire renvoie à
 * lui dans ses données. Il est tenu jusqu'à la fin de la transaction : ouvert par le joueur en même temps, il
 * l'est avant ou après sa mise à jour, jamais pendant.
 */
const RECIT_DE_DEPART_NON_LU = `
  select r.id from recit r
  where r.territoire_id = $1 and r.lu_le is null
    and exists (
      select 1 from evenement e
      where e.element = 'territoire' and e.element_id = $1 and e.type = $2 and (e.donnees->>'recit')::int = r.id
    )
  order by r.id desc
  limit 1
  for update of r`;

/**
 * US-0337 : les Voyageurs du Territoire $1 repartis d'eux-mêmes que dit le Récit $3, ceux dont le départ ($2) renvoie
 * à lui, dans l'ordre de leurs départs.
 */
const REPARTIS_DU_RECIT = `
  select v.prenom, v.sort_le as "sortLe" from evenement e
  join voyageur v on v.id = (e.donnees->>'voyageur')::int
  where e.element = 'territoire' and e.element_id = $1 and e.type = $2 and (e.donnees->>'recit')::int = $3
    and v.territoire_id = $1 and v.sort = 'reparti'
  order by v.sort_le, v.id`;

/**
 * US-0337 : le départ d'un Voyageur, à la fin de son attente : s'il attend toujours aux portes, il repart de
 * lui-même, à cet instant ; accueilli ou refusé d'ici là, il garde son sort, et rien ne se passe. Un Voyageur
 * d'un autre Territoire n'est jamais touché.
 *
 * Un Récit le dit. Si le joueur n'a pas encore lu celui d'un départ précédent, c'est lui qui est repris : il dit
 * tous les Voyageurs repartis depuis (« 2 Voyageurs ont repris la route »), et prend la date du dernier départ ;
 * sinon, un nouveau Récit. Les départs d'une absence se disent ainsi ensemble, quel que soit le découpage du
 * rattrapage (page ouverte, tâche planifiée). Le départ note dans ses données le Récit qui le dit.
 */
export async function departDUnVoyageur(client: PoolClient, territoireId: number, evenement: Evenement): Promise<void> {
  const { rows: partis } = await client.query<{ prenom: string }>(
    "update voyageur set sort = 'reparti', sort_le = $3 where id = $2 and territoire_id = $1 and sort is null returning prenom",
    [territoireId, voyageurDuDepart(territoireId, evenement), evenement.survientLe],
  );
  if (partis.length === 0) return;
  const { rows: nonLu } = await client.query<{ id: number }>(RECIT_DE_DEPART_NON_LU, [territoireId, DEPART_VOYAGEUR]);
  const recitId = nonLu[0]?.id ?? (await ecrireUnRecit(client, territoireId, recitDeDepart([partis[0].prenom], evenement.survientLe)));
  await client.query("update evenement set donnees = donnees || jsonb_build_object('recit', $2::int) where id = $1", [evenement.id, recitId]);
  if (!nonLu[0]) return;
  const { rows: repartis } = await client.query<{ prenom: string; sortLe: Date }>(REPARTIS_DU_RECIT, [territoireId, DEPART_VOYAGEUR, recitId]);
  const { titre, texte, survenuLe } = recitDeDepart(
    repartis.map((v) => v.prenom),
    repartis.at(-1)!.sortLe,
  );
  await client.query("update recit set titre = $2, texte = $3, survenu_le = $4 where id = $1", [recitId, titre, texte, survenuLe]);
}

/** US-0337 : « Ines », « Ines et Joran », « Ines, Joran et Ilda ». */
function enumerer(prenoms: string[]): string {
  return prenoms.length > 1 ? `${prenoms.slice(0, -1).join(", ")} et ${prenoms.at(-1)}` : prenoms[0];
}

/**
 * US-0337 : le Récit des Voyageurs repartis sans avoir été accueillis, dans l'ordre de leurs départs, daté de
 * `instant`, celui du dernier : « Ines a repris la route » ; à plusieurs, « 3 Voyageurs ont repris la route »,
 * leurs prénoms dans le texte. Comme pour l'accueil, la phrase ne donne de genre à personne.
 */
export function recitDeDepart(prenoms: string[], instant: Date): NouveauRecit {
  const seul = prenoms.length === 1;
  return {
    titre: seul ? `${prenoms[0]} a repris la route` : `${prenoms.length} Voyageurs ont repris la route`,
    texte: `${enumerer(prenoms)} ${seul ? "a" : "ont"} attendu aux portes sans qu'on ${seul ? "l'" : "les "}accueille.`,
    survenuLe: instant,
  };
}

/**
 * US-0332 : un Voyageur qui attend aux portes : son prénom et l'heure du jeu de son arrivée ; US-0333 : et celle
 * de son départ.
 */
export type VoyageurAuxPortes = { id: number; prenom: string; arriveLe: Date; departLe: Date };

/** US-0332 : les Voyageurs qui attendent aux portes du Territoire, du premier arrivé au dernier ; US-0337 : ceux sans sort. */
export async function voyageursAuxPortes(base: Pool | PoolClient, territoireId: number): Promise<VoyageurAuxPortes[]> {
  const { rows } = await base.query<Omit<VoyageurAuxPortes, "departLe">>(
    `select id, prenom, arrive_le as "arriveLe" from voyageur where territoire_id = $1 and sort is null order by arrive_le, id`,
    [territoireId],
  );
  return rows.map((v) => ({ ...v, departLe: departDuVoyageur(v.arriveLe) }));
}

/** US-0337 : ce qu'un Voyageur est devenu une fois parti des portes : accueilli, refusé, ou reparti de lui-même. */
export type SortDuVoyageur = "accueilli" | "refuse" | "reparti";

/** US-0342 : un Voyageur passé aux portes : son prénom, l'heure du jeu de son arrivée, son sort et l'heure de son sort. */
export type VoyageurPasse = { id: number; prenom: string; arriveLe: Date; sort: SortDuVoyageur; sortLe: Date };

/**
 * US-0342 : l'historique des Voyageurs du Territoire à l'heure du jeu `instant` : ceux dont le sort est tombé dans
 * les HISTORIQUE_VOYAGEURS_JOURS derniers jours, du plus récent sort au plus ancien ; de deux sorts du même instant,
 * celui du dernier arrivé d'abord. Ceux qui attendent encore aux portes n'y sont pas.
 */
export async function voyageursPasses(base: Pool | PoolClient, territoireId: number, instant: Date): Promise<VoyageurPasse[]> {
  const depuis = new Date(instant.getTime() - HISTORIQUE_VOYAGEURS_JOURS * 24 * 3_600_000);
  const { rows } = await base.query<VoyageurPasse>(
    `select id, prenom, arrive_le as "arriveLe", sort, sort_le as "sortLe" from voyageur
     where territoire_id = $1 and sort is not null and sort_le >= $2
     order by sort_le desc, id desc`,
    [territoireId, depuis],
  );
  return rows;
}

/** US-0334 : depuis quand un Voyageur attendait, compté comme sur sa ligne aux portes : « moins d'une minute », « 12 min », « 3 h ». */
function attente(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "moins d'une minute";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h`;
}

/**
 * US-0334 : le Récit court de l'accueil d'un Voyageur arrivé aux portes à `arriveLe`, daté de l'accueil. Les
 * prénoms n'ont pas de genre : la phrase n'en donne pas non plus.
 */
export function recitDAccueil(prenom: string, arriveLe: Date, instant: Date): NouveauRecit {
  return {
    titre: `${prenom} a rejoint le Territoire`,
    texte: `${prenom}, qui attendait aux portes depuis ${attente(instant.getTime() - arriveLe.getTime())}, vit désormais au Foyer.`,
    survenuLe: instant,
  };
}

/**
 * Ce qu'a donné un accueil (US-0334) : « accueilli » ; US-0337 : « reparti », le Voyageur est déjà reparti de
 * lui-même ; « absent », il n'attend pas aux portes de ce Territoire (déjà accueilli, refusé, ou d'un autre) ;
 * US-0338 : « plus-de-place », toute la place du Territoire est prise, et il attend toujours ; US-0335 :
 * « metier-inconnu », le Métier choisi n'est pas l'un des huit, et il attend toujours.
 */
export type Accueil = "accueilli" | "reparti" | "absent" | "plus-de-place" | "metier-inconnu";

/**
 * US-0334 : le Voyageur `voyageurId` qui attend aux portes du Territoire devient, à l'instant `instant` (l'heure
 * du jeu), un Habitant sans Métier du même prénom, gratuitement, et un Récit court le dit ; le tout en une
 * transaction. Ne change rien pour un Voyageur qui n'attend plus, ou qui attend aux portes d'un autre Territoire,
 * et le dit (US-0337). Le Voyageur prend son sort avant tout le reste : deux accueils du même Voyageur en même
 * temps, ou un accueil et un refus, se suivent sur sa ligne, et seul le premier le trouve encore aux portes. Un
 * seul Habitant, jamais deux.
 *
 * US-0338 : sans place au Territoire, rien ne change et le Voyageur continue d'attendre, d'où que vienne la
 * demande. Le Territoire est tenu d'abord, jusqu'à la fin de l'accueil (comme le temps qui avance le tient,
 * avant ses Voyageurs) : deux accueils en même temps se suivent, et le second compte l'Habitant du premier ;
 * la place n'est jamais dépassée.
 *
 * US-0335 : le nouvel Habitant exerce aussitôt le Métier `metierId`, choisi à l'accueil, ou arrive sans Métier (null).
 * Le Métier est vérifié dans la même transaction, avant tout le reste : un Métier qui n'est pas l'un des huit ne
 * change rien, et le Voyageur continue d'attendre.
 */
export async function accueillirLeVoyageur(
  pool: Pool,
  territoireId: number,
  voyageurId: number,
  instant: Date,
  metierId: string | null = null,
): Promise<Accueil> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select 1 from territoire where id = $1 for no key update", [territoireId]);
    if (metierId !== null && (await client.query("select 1 from metier where id = $1", [metierId])).rowCount === 0) {
      await client.query("rollback");
      return "metier-inconnu";
    }
    const { rows } = await client.query<{ prenom: string; arriveLe: Date }>(
      `update voyageur set sort = 'accueilli', sort_le = $3 where id = $2 and territoire_id = $1 and sort is null
       returning prenom, arrive_le as "arriveLe"`,
      [territoireId, voyageurId, instant],
    );
    const voyageur = rows[0];
    if (!voyageur) {
      // US-0337 : déjà reparti de lui-même, ou plus aux portes de ce Territoire pour une autre raison.
      const { rows: parti } = await client.query<{ sort: string }>("select sort from voyageur where id = $2 and territoire_id = $1", [territoireId, voyageurId]);
      await client.query("rollback");
      return parti[0]?.sort === "reparti" ? "reparti" : "absent";
    }
    if (await plusDePlace(client, territoireId)) {
      await client.query("rollback");
      return "plus-de-place";
    }
    await ajouterUnHabitant(client, territoireId, voyageur.prenom, instant, metierId);
    await ecrireUnRecit(client, territoireId, recitDAccueil(voyageur.prenom, voyageur.arriveLe, instant));
    await client.query("commit");
    return "accueilli";
  } catch (erreur) {
    await client.query("rollback").catch(() => {});
    throw erreur;
  } finally {
    client.release();
  }
}

/**
 * US-0336 : le Voyageur `voyageurId` qui attend aux portes du Territoire repart aussitôt, sans Récit, et ne revient
 * pas ; US-0337 : il reste connu, refusé à l'instant `instant` (l'heure du jeu). Sa place aux portes se libère pour
 * la prochaine arrivée. Rend false sans rien changer pour un Voyageur qui n'attend plus (accueilli, refusé ou
 * reparti), ou qui attend aux portes d'un autre Territoire. Refusé et accueilli en même temps, il ne l'est que par
 * le premier des deux.
 */
export async function refuserLeVoyageur(base: Pool | PoolClient, territoireId: number, voyageurId: number, instant: Date): Promise<boolean> {
  const { rowCount } = await base.query("update voyageur set sort = 'refuse', sort_le = $3 where id = $2 and territoire_id = $1 and sort is null", [
    territoireId,
    voyageurId,
    instant,
  ]);
  return rowCount === 1;
}

/**
 * US-0340 : vrai quand l'avertissement « famine imminente » est actif, et que l'accueil d'un Voyageur demande donc
 * une confirmation : compté comme la bande d'alerte de la barre du haut (US-0321), quand la Nourriture ne couvre
 * plus que FAMINE_IMMINENTE_HEURES heures d'Entretien, ou moins, sur les Stocks et l'Entretien lus une fois le
 * Territoire mis à l'heure ; US-0323 : et, entre le seuil et sa marge, tant que le Territoire le retient (`depuis`,
 * famineImminenteDepuis). Pendant une Famine (US-0325), la Nourriture ne tient plus du tout :
 * l'avertissement reste actif, et l'accueil reste possible, avec la même confirmation. US-0826 : avec l'Entretien des
 * Bêtes (`betes`), comme le calcul du jeu le compte.
 */
export function avertissementDeFamine(stocks: Stock[], entretienParHeure: string, depuis: number | null = null, betes?: EntretienDesBetesLu): boolean {
  const heures = nourriturePourEncoreDesStocks(stocks, entretienParHeure, betes);
  // US-0323 : entre le seuil et la marge, l'avertissement retenu par le Territoire (`depuis`) reste actif, comme la bande.
  return heures !== null && (heures <= FAMINE_IMMINENTE_HEURES || famineImminenteRetenue(heures, depuis) !== null);
}

/** US-0332 : le nombre de Voyageurs qui attendent aux portes, pour le repère de l'entrée « Habitants » ; US-0337 : ceux sans sort. */
export async function nombreDeVoyageurs(base: Pool | PoolClient, territoireId: number): Promise<number> {
  const { rows } = await base.query<{ nombre: number }>("select count(*)::int as nombre from voyageur where territoire_id = $1 and sort is null", [
    territoireId,
  ]);
  return rows[0].nombre;
}
