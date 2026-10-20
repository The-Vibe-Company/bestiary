// L'Entretien des Bêtes (US-0826) : chaque heure, chaque Bête de l'effectif, au Foyer ou en sortie, mange l'Entretien de
// son Espèce, selon son régime : un carnivore de la Viande, un herbivore des Végétaux, un omnivore l'une ou l'autre, comme
// les Habitants (la moitié de chaque tant que les deux paient, puis tout sur celle qui reste ; décidé le 2026-10-19). Les
// Bêtes du Couple, en Réserve hors de l'effectif, ne mangent pas (décidé le 2026-10-19), comme elles ne prennent pas de
// Place (US-0822). Le calcul du temps le prélève (PRODUIRE, src/monde/production.ts). Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import type { EntretienDesBetesLu } from "./nourriture";

/** US-0826 : aucune Bête à nourrir. */
export const SANS_BETES: EntretienDesBetesLu = { viande: "0", vegetaux: "0", omnivores: "0" };

/**
 * US-0826 : l'Entretien des Bêtes de l'effectif du Territoire, par heure, en Nourriture (numeric de Postgres, en texte) :
 * celui des carnivores, que seule la Viande paie, celui des herbivores, que seuls les Végétaux paient, et celui des
 * omnivores, que l'une ou l'autre paie, écrits comme les Stocks (six décimales). Toutes les Bêtes de l'effectif, mâles et femelles, sorties en escorte et Blessés
 * compris ; jamais celles d'un Couple, parties en Réserve.
 */
export async function entretienDesBetes(base: Pool | PoolClient, territoireId: number): Promise<EntretienDesBetesLu> {
  const { rows } = await base.query<EntretienDesBetesLu>(
    `select coalesce(sum(e.nombre * es.entretien_par_heure) filter (where es.regime = 'carnivore'), 0)::numeric(24, 6)::text as viande,
       coalesce(sum(e.nombre * es.entretien_par_heure) filter (where es.regime = 'herbivore'), 0)::numeric(24, 6)::text as vegetaux,
       coalesce(sum(e.nombre * es.entretien_par_heure) filter (where es.regime = 'omnivore'), 0)::numeric(24, 6)::text as omnivores
     from effectif e join espece es on es.id = e.espece_id
     where e.territoire_id = $1`,
    [territoireId],
  );
  return rows[0];
}
