// Le départ d'une Expédition (US-0911) : ce qui fait passer des explorateurs et des Bêtes à l'état « en Expédition ».
// Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { betesDisponibles } from "@/monde/effectif";
import type { Coordonnees } from "@/monde/hex";
import { bornerLesAffectations } from "@/monde/roles";
import { type BetesDeLEscorte, dureeDuTrajetMinutes } from "./allure";
import { destinationDUneCase } from "./destination";
import { programmerLeRetour } from "./retour";

/**
 * US-0911 : ce que le joueur a choisi sur l'écran d'Expédition : la destination, le nombre d'explorateurs qui partent,
 * l'escorte (Espèce par Espèce, le nombre de Bêtes) et la durée du séjour, en minutes de jeu.
 */
export type ChoixDuDepart = { destination: Coordonnees; explorateurs: number; escorte: ReadonlyMap<string, number>; sejourMinutes: number };

/** US-0911 : un départ fait, et l'Expédition qu'il a lancée, ou le refus que le joueur lit à la place. */
export type Depart = { expeditionId: number } | { refus: string };

/** US-0911 : le refus d'un départ dont un explorateur choisi n'est plus libre au moment de confirmer. */
export const EXPLORATEUR_PLUS_LIBRE = "Départ refusé : un explorateur n'est plus libre.";

/** US-0911 : le refus d'un départ dont une Bête de l'escorte n'est plus disponible au moment de confirmer. */
export const BETE_PLUS_DISPONIBLE = "Départ refusé : une Bête de l'escorte n'est plus disponible.";

/** US-0911 : les refus d'un départ sans destination que le Monde du joueur connaisse, ou sans explorateur (US-0910). */
export const SANS_DESTINATION = "Il faut une destination.";
export const SANS_EXPLORATEUR = "Il faut au moins un explorateur.";

/** Un départ refusé : rien n'est retenu, et le joueur lit pourquoi. */
class Refus extends Error {}

/**
 * US-0911 : lance l'Expédition du Territoire que décrit `choix`, partie à `instant`, l'heure du jeu ; rend son
 * identifiant, ou le refus que lit le joueur. Tout se décide ici, d'où que vienne la demande : la destination (US-0907,
 * US-0908), les explorateurs libres et les Bêtes disponibles sont relus au moment de confirmer. Les explorateurs partent
 * avec elle : ils ne sont plus libres, et leur Métier ne change plus avant leur retour (habitant.expedition_id) ; les
 * Bêtes de l'escorte ne sont plus disponibles (expedition_escorte). L'aller est fixé au départ, au pas des explorateurs
 * sans escorte (US-0909), et avec une escorte au pas de sa Bête la plus lente, d'après la vitesse de son Espèce, s'il est
 * plus lent encore (US-0912) ; le retour dure autant. US-0916 : son retour au Foyer est programmé aussitôt, à son heure.
 *
 * Tout tient dans une transaction : un départ refusé ne retient rien. Le Territoire y est tenu d'abord : deux départs
 * du même Territoire envoyés au même instant passent l'un après l'autre, et le second relit ce que le premier a pris ;
 * jamais deux fois le même explorateur ni la même Bête. Les lignes de l'effectif des Espèces de l'escorte et celles des
 * explorateurs qui partent sont tenues aussi, contre tout autre changement envoyé au même instant.
 */
export async function lancerLExpedition(pool: Pool, territoireId: number, choix: ChoixDuDepart, instant: Date): Promise<Depart> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select 1 from territoire where id = $1 for no key update", [territoireId]);
    const expeditionId = await partir(client, territoireId, choix, instant);
    await client.query("commit");
    return { expeditionId };
  } catch (erreur) {
    await client.query("rollback").catch(() => {});
    if (erreur instanceof Refus) return { refus: erreur.message };
    throw erreur;
  } finally {
    client.release();
  }
}

/**
 * US-0912 : les Bêtes de l'escorte, Espèce par Espèce, avec la vitesse de leur Espèce, lue en base. Une Espèce que le jeu
 * n'a pas n'en a aucune : le départ la refuse plus loin, faute de Bête disponible.
 */
async function betesDeLEscorte(client: PoolClient, betes: [string, number][]): Promise<BetesDeLEscorte[]> {
  if (betes.length === 0) return [];
  const { rows } = await client.query<{ id: string; vitesse: number }>("select id, vitesse from espece where id = any($1)", [betes.map(([especeId]) => especeId)]);
  const vitesses = new Map(rows.map((e) => [e.id, e.vitesse]));
  return betes.flatMap(([especeId, nombre]) => (vitesses.has(especeId) ? [{ vitesse: vitesses.get(especeId)!, nombre }] : []));
}

/** US-0911 : le départ, dans la transaction de lancerLExpedition ; un Refus l'annule. */
async function partir(client: PoolClient, territoireId: number, { destination, explorateurs, escorte, sejourMinutes }: ChoixDuDepart, instant: Date): Promise<number> {
  if (explorateurs < 1) throw new Refus(SANS_EXPLORATEUR);
  const laCase = await destinationDUneCase(client, territoireId, destination);
  if (!laCase) throw new Refus(SANS_DESTINATION);
  if ("refus" in laCase) throw new Refus(laCase.refus);
  const betes = [...escorte].filter(([, nombre]) => nombre > 0);
  const trajetMinutes = dureeDuTrajetMinutes(laCase.fiche.distance, await betesDeLEscorte(client, betes));
  const { rows } = await client.query<{ id: number }>(
    `insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes)
     select t.id, c.id, $4, $5, $6
     from territoire t join case_du_monde f on f.id = t.foyer_case_id join case_du_monde c on c.monde_id = f.monde_id and c.q = $2 and c.r = $3
     where t.id = $1
     returning id`,
    [territoireId, destination.q, destination.r, instant, trajetMinutes, sejourMinutes],
  );
  const expeditionId = rows[0].id;
  // US-0916 : son retour au Foyer, à l'heure que donnent ses horaires.
  await programmerLeRetour(client, territoireId, expeditionId, { partLe: instant, trajetMinutes, sejourMinutes });

  // Les explorateurs libres, les premiers arrivés d'abord, choisis une seule fois et tenus jusqu'à la fin du départ.
  const partis = await client.query(
    `with choisis as materialized (
       select id from habitant where territoire_id = $1 and metier = 'explorateur' and expedition_id is null order by id limit $2 for update
     )
     update habitant h set expedition_id = $3 from choisis
     where h.id = choisis.id and h.metier = 'explorateur' and h.expedition_id is null`,
    [territoireId, explorateurs, expeditionId],
  );
  if (partis.rowCount !== explorateurs) throw new Refus(EXPLORATEUR_PLUS_LIBRE);

  if (betes.length === 0) return expeditionId;
  await client.query("select 1 from effectif where territoire_id = $1 and espece_id = any($2) order by espece_id, sexe for update", [
    territoireId,
    betes.map(([especeId]) => especeId),
  ]);
  // US-0953 : les Blessés au Foyer à l'instant du départ ne sont pas disponibles.
  const disponibles = new Map((await betesDisponibles(client, territoireId, instant)).map((e) => [e.id, e.disponibles]));
  if (betes.some(([especeId, nombre]) => nombre > (disponibles.get(especeId) ?? 0))) throw new Refus(BETE_PLUS_DISPONIBLE);
  await client.query(`insert into expedition_escorte (expedition_id, espece_id, nombre) select $1, e, n from unnest($2::text[], $3::int[]) as l(e, n)`, [
    expeditionId,
    betes.map(([especeId]) => especeId),
    betes.map(([, nombre]) => nombre),
  ]);
  // US-0837 : l'escorte emmène d'abord les Bêtes non affectées à leur Rôle ; au-delà, celles qui partent ne le sont plus.
  await bornerLesAffectations(client, territoireId, instant);
  return expeditionId;
}
