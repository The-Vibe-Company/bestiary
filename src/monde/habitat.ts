// Les Places de l'Habitat du Foyer (US-0822) : combien il en offre, un chiffre des réglages du jeu, et combien en
// prennent les Bêtes de l'effectif, chacune selon la taille de son Espèce (docs/adr/0007 : une souris 1, une poule 32).
// La page Bêtes et le bloc « Élever » les disent. Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { PLACES_DE_L_HABITAT_DU_FOYER } from "@/reglages";

/** US-0822 : les Places de l'Habitat du Foyer : celles que prennent les Bêtes du joueur, et toutes celles qu'il offre. */
export type PlacesDeLHabitat = { occupees: number; total: number };

/**
 * US-0822 : les Places de l'Habitat du Foyer du Territoire : PLACES_DE_L_HABITAT_DU_FOYER en tout, et prises, la somme
 * exacte, Espèce par Espèce, de son effectif fois la taille de l'Espèce (US-0824 le règlera) ; le compteur l'arrondit à
 * la Place entière supérieure (PlacesDeLHabitat). Les Bêtes sorties en escorte gardent la leur, pour rentrer ; les
 * Blessés aussi. Les Bêtes du Couple, en Réserve hors de l'effectif (US-0956), n'en prennent pas : la Réserve n'est pas
 * l'Habitat du Foyer.
 */
export async function placesDeLHabitat(base: Pool | PoolClient, territoireId: number): Promise<PlacesDeLHabitat> {
  const { rows } = await base.query<{ occupees: number }>(
    `select coalesce(sum(e.nombre * es.taille), 0)::float8 as occupees
     from effectif e join espece es on es.id = e.espece_id
     where e.territoire_id = $1`,
    [territoireId],
  );
  // Au millionième près : les tailles ont trois décimales, et une poussière de calcul (894,000…1) ne fait pas une Place.
  return { occupees: Math.round(rows[0].occupees * 1e6) / 1e6, total: PLACES_DE_L_HABITAT_DU_FOYER };
}
