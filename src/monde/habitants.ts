// Les Habitants d'un Territoire tels que le jeu les montre. Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { DatabaseError } from "pg";
import { ENTRETIEN_HABITANT_PAR_HEURE, PLACES_DU_FOYER } from "@/reglages";
import { aLElevage, EN_EXPEDITION, type EtatHabitant, LIBRE, LIBRE_EN_SQL } from "./etat-habitant";
import { ENTRETIEN_DU_TERRITOIRE } from "./production";
import { ecrireUnRecit, type NouveauRecit } from "./recits";

export type { EtatHabitant };

/**
 * Un Habitant (US-0301) : son prénom (US-0303), le nom de son Métier (« Bûcheron », US-0308), null tant
 * qu'il n'en a pas, son heure d'arrivée et son état.
 */
export type Habitant = { id: number; prenom: string; metier: string | null; arriveLe: Date; etat: EtatHabitant };

/**
 * Les Habitants d'un Territoire, rangés par Métier, ceux sans Métier en premier, puis par prénom (US-0303).
 * US-0308 : les Métiers dans leur ordre de donnees/metiers.yaml, chacun sous son nom. US-0911 : chacun libre, ou en
 * Expédition jusqu'à son retour. US-0843 : ou à l'Élevage, avec le nom de l'Espèce qu'il élève, jusqu'à la fin.
 */
export async function habitantsDuTerritoire(pool: Pool, territoireId: number): Promise<Habitant[]> {
  const { rows } = await pool.query<Omit<Habitant, "etat"> & { parti: boolean; especeElevee: string | null }>(
    `select h.id, h.prenom, m.nom as metier, h.arrive_le as "arriveLe", h.expedition_id is not null as parti, e.nom as "especeElevee"
     from habitant h left join metier m on m.id = h.metier left join espece e on e.id = h.espece_elevee
     where h.territoire_id = $1
     order by m.ordre nulls first, h.prenom, h.id`,
    [territoireId],
  );
  return rows.map(({ parti, especeElevee, ...h }) => ({ ...h, etat: parti ? EN_EXPEDITION : especeElevee !== null ? aLElevage(especeElevee) : LIBRE }));
}

/**
 * US-0308 : donne le Métier `metierId` à l'Habitant `habitantId` du Territoire ; US-0310 : ou le change, s'il
 * en a déjà un, enregistré de la même façon ; US-0311 : ou le lui retire (null), sur la même règle. Gratuit et
 * immédiat, sans temps d'apprentissage : aucune Ressource n'est touchée. Rend false sans rien changer pour un
 * Habitant d'un autre Territoire, ou un Métier inconnu, que la clé étrangère vers `metier` refuse. US-0911 : de même
 * pour un explorateur parti en Expédition, jusqu'à son retour, même quand le départ et le changement arrivent au même
 * instant : l'un attend l'autre sur la ligne de l'Habitant, puis la relit. US-0843 : et pour un éleveur à l'Élevage,
 * jusqu'à la fin.
 */
export async function enregistrerLeMetier(base: Pool | PoolClient, territoireId: number, habitantId: number, metierId: string | null): Promise<boolean> {
  try {
    const { rowCount } = await base.query(`update habitant set metier = $3 where id = $2 and territoire_id = $1 and ${LIBRE_EN_SQL}`, [
      territoireId,
      habitantId,
      metierId,
    ]);
    return rowCount === 1;
  } catch (refus) {
    if (refus instanceof DatabaseError && refus.code === "23503") return false;
    throw refus;
  }
}

/**
 * US-0312 : « + » d'un Métier : le donne au premier Habitant sans Métier du Territoire dans l'ordre de la liste
 * (par prénom, puis le premier arrivé), choisi dans la base et changé d'une seule requête, gratuitement. Rend
 * son identifiant ; null quand il ne reste aucun Habitant sans Métier, ou pour un Métier inconnu.
 *
 * US-0315 : des « + » simultanés, depuis deux onglets ou deux appareils, ne prennent jamais le même Habitant :
 * chacun verrouille celui qu'il choisit, et passe ceux déjà pris par un autre (skip locked). Aucun ne donne plus
 * de Métiers qu'il n'y a d'Habitants sans Métier, et chacun trouve le sien tant qu'il en reste.
 */
export async function ajouterUnHabitantAuMetier(base: Pool | PoolClient, territoireId: number, metierId: string): Promise<number | null> {
  try {
    const { rows } = await base.query<{ id: number }>(
      `update habitant set metier = $2
       where id = (select id from habitant where territoire_id = $1 and metier is null order by prenom, id limit 1 for update skip locked)
         and metier is null
       returning id`,
      [territoireId, metierId],
    );
    return rows[0]?.id ?? null;
  } catch (refus) {
    if (refus instanceof DatabaseError && refus.code === "23503") return null;
    throw refus;
  }
}

/**
 * US-0312 : « − » d'un Métier : remet sans Métier le dernier arrivé au Territoire de ceux qui l'exercent (le plus
 * grand identifiant : les Habitants sont numérotés à leur arrivée), choisi dans la base et changé d'une seule
 * requête, gratuitement. Rend son identifiant ; null quand personne n'exerce ce Métier.
 *
 * US-0315 : comme pour « + », des « − » simultanés verrouillent chacun le sien et passent ceux déjà pris : jamais
 * plus d'Habitants remis sans Métier qu'il n'en exerçait le Métier, et aucun « − » perdu tant qu'il en reste.
 * US-0911 : un explorateur parti en Expédition n'est jamais choisi : son Métier ne change pas avant son retour. US-0843 :
 * un éleveur à l'Élevage non plus, avant la fin.
 */
export async function retirerUnHabitantDuMetier(base: Pool | PoolClient, territoireId: number, metierId: string): Promise<number | null> {
  const { rows } = await base.query<{ id: number }>(
    `update habitant set metier = null
     where id = (select id from habitant where territoire_id = $1 and metier = $2 and ${LIBRE_EN_SQL} order by id desc limit 1 for update skip locked)
       and metier = $2 and ${LIBRE_EN_SQL}
     returning id`,
    [territoireId, metierId],
  );
  return rows[0]?.id ?? null;
}

/**
 * US-0334 : un nouvel Habitant au Territoire, sans Métier, du prénom donné, arrivé à `arriveLe`, l'heure du
 * jeu ; rend son identifiant. Il compte aussitôt dans le nombre d'Habitants et dans l'Entretien. Appelée avec
 * le client d'une transaction, elle tient dedans. US-0335 : ou avec le Métier `metierId` (null : sans Métier),
 * qu'il exerce dès son arrivée ; la clé étrangère vers `metier` refuse un Métier inconnu.
 */
export async function ajouterUnHabitant(
  base: Pool | PoolClient,
  territoireId: number,
  prenom: string,
  arriveLe: Date,
  metierId: string | null = null,
): Promise<number> {
  const { rows } = await base.query<{ id: number }>("insert into habitant (territoire_id, prenom, arrive_le, metier) values ($1, $2, $3, $4) returning id", [
    territoireId,
    prenom,
    arriveLe,
    metierId,
  ]);
  return rows[0].id;
}

/**
 * US-0330 : efface l'Habitant $2 du Territoire $1, et rend son prénom et le nom de son Métier (null sans Métier).
 * US-0911 : un explorateur parti en Expédition ne se renvoie pas avant son retour. US-0843 : un éleveur à l'Élevage non
 * plus, avant la fin.
 */
const RENVOYER = `
  with parti as (delete from habitant where id = $2 and territoire_id = $1 and ${LIBRE_EN_SQL} returning prenom, metier)
  select parti.prenom, m.nom as metier from parti left join metier m on m.id = parti.metier`;

/**
 * US-0330 : le Récit d'un Habitant renvoyé par le chef, daté du renvoi : « Brune a quitté le Territoire », puis son
 * Métier (« sans Métier » s'il n'en a pas) et que le chef l'a voulu. Comme pour l'accueil, la phrase ne donne de genre
 * à personne. Rien ne le rattache aux départs de Famine (US-0327) : leur Récit ne le reprend jamais, et le retour du
 * joueur ne le compte pas parmi eux.
 */
export function recitDeRenvoi(prenom: string, metier: string | null, instant: Date): NouveauRecit {
  return {
    titre: `${prenom} a quitté le Territoire`,
    texte: `${prenom}, ${metier ?? "sans Métier"}, a quitté le Territoire à la demande du chef.`,
    survenuLe: instant,
  };
}

/**
 * US-0330 : le chef renvoie l'Habitant `habitantId` du Territoire, à l'instant `instant` (l'heure du jeu) : il le quitte
 * pour de bon, et un Récit le dit ; le tout en une transaction. Le nombre d'Habitants, les effectifs par Métier et
 * l'Entretien baissent aussitôt ; le dernier Habitant peut partir aussi, et le Territoire reste alors sans Habitant
 * (US-0329). Rend false sans rien changer pour un Habitant d'un autre Territoire, ou déjà parti : renvoyé plusieurs
 * fois en même temps, il ne part qu'une fois, d'un seul Récit. US-0911 : de même pour un explorateur en Expédition,
 * jusqu'à son retour : le départ et le renvoi tiennent tous deux le Territoire, et se suivent.
 *
 * Comme pour l'accueil (US-0338), le Territoire est tenu d'abord, comme le temps qui avance le tient : un renvoi et le
 * calcul du temps (un départ de Famine) se suivent, et le calcul compte les Habitants d'avant ou d'après le renvoi,
 * jamais un mélange des deux.
 */
export async function renvoyerLHabitant(pool: Pool, territoireId: number, habitantId: number, instant: Date): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select 1 from territoire where id = $1 for no key update", [territoireId]);
    const { rows } = await client.query<{ prenom: string; metier: string | null }>(RENVOYER, [territoireId, habitantId]);
    if (rows[0]) await ecrireUnRecit(client, territoireId, recitDeRenvoi(rows[0].prenom, rows[0].metier, instant));
    await client.query("commit");
    return rows.length > 0;
  } catch (erreur) {
    await client.query("rollback").catch(() => {});
    throw erreur;
  } finally {
    client.release();
  }
}

/** Le nombre d'Habitants d'un Territoire, pour le compteur de la barre du haut (US-0304). */
export async function nombreDHabitants(pool: Pool, territoireId: number): Promise<number> {
  const { rows } = await pool.query<{ nombre: number }>(`select count(*)::int as nombre from habitant where territoire_id = $1`, [territoireId]);
  return rows[0].nombre;
}

/** US-0313 : le nombre d'Habitants sans Métier d'un Territoire, pour le repère de l'entrée « Habitants » de la navigation. */
export async function nombreSansMetier(pool: Pool, territoireId: number): Promise<number> {
  const { rows } = await pool.query<{ nombre: number }>(`select count(*)::int as nombre from habitant where territoire_id = $1 and metier is null`, [territoireId]);
  return rows[0].nombre;
}

/**
 * US-0305 : chaque source de place du Territoire $1, une ligne par source, avec les places qu'elle offre.
 * Pour l'instant, le seul Foyer ; les huttes s'y ajouteront à l'étape 25, d'un « union all » de plus.
 */
const SOURCES_DE_PLACE = `
  select ${PLACES_DU_FOYER} as places from territoire where id = $1`;

/** US-0305 : la place totale du Territoire, en Habitants : la somme de toutes ses sources ; 0 s'il n'existe pas. */
export async function placesDuTerritoire(pool: Pool, territoireId: number): Promise<number> {
  const { rows } = await pool.query<{ places: number }>(`select coalesce(sum(places), 0)::int as places from (${SOURCES_DE_PLACE}) source`, [territoireId]);
  return rows[0].places;
}

/**
 * US-0338 : vrai quand toute la place du Territoire est prise : au moins autant d'Habitants que de places. Appelée
 * avec le client d'une transaction qui tient le Territoire, elle compte juste jusqu'à la fin de la transaction.
 */
export async function plusDePlace(base: Pool | PoolClient, territoireId: number): Promise<boolean> {
  const { rows } = await base.query<{ plein: boolean }>(
    `select (select count(*) from habitant where territoire_id = $1) >= (select coalesce(sum(places), 0) from (${SOURCES_DE_PLACE}) source) as plein`,
    [territoireId],
  );
  return rows[0].plein;
}

/**
 * US-0318 : l'Entretien des Habitants tel que la page le détaille : leur nombre, l'Entretien de chacun
 * et le total, en Nourriture par heure (numeric de Postgres, en texte).
 */
export type EntretienDesHabitants = { habitants: number; parHabitant: number; parHeure: string };

/**
 * US-0318 : l'Entretien des Habitants du Territoire, lu à chaque affichage. Le total vient de
 * ENTRETIEN_DU_TERRITOIRE, la requête même d'où le calcul du jeu le prélève (US-0316) : la page montre
 * exactement ce que le calcul prend.
 */
export async function entretienDesHabitants(pool: Pool, territoireId: number): Promise<EntretienDesHabitants> {
  const { rows } = await pool.query<{ habitants: number; parHeure: string }>(
    `select (select count(*)::int from habitant where territoire_id = $1) as habitants, entretien.par_heure::text as "parHeure"
     from (${ENTRETIEN_DU_TERRITOIRE}) entretien`,
    [territoireId],
  );
  return { habitants: rows[0].habitants, parHabitant: ENTRETIEN_HABITANT_PAR_HEURE, parHeure: rows[0].parHeure };
}
