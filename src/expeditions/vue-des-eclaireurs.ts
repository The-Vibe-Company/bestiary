// La vue des Éclaireurs (US-0970) : les Éclaireurs d'une Expédition (US-0976) lui gardent en vue les Bêtes de sa Case
// un temps après la fin de leur durée, d'autant plus longtemps qu'ils sont nombreux, jusqu'à un plafond : l'Expédition peut
// encore les rencontrer, et les emmener, même arrivée peu après leur départ (src/expeditions/apprivoisement.ts, finDeVue).
// L'effet ne vaut que pour l'Expédition qui a les Éclaireurs : il se lit de ses seuls Éclaireurs, fixés au départ, le même
// pour tous les Territoires qui la calculent (vueProlongee, src/expeditions/eclaireurs.ts). Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { vueProlongee } from "./eclaireurs";

/**
 * US-0970 : la vue prolongée (vueProlongee) de chaque Expédition `ids` qui a des Éclaireurs, de toutes leurs Espèces ;
 * absente pour une Expédition sans Éclaireur.
 */
export async function vuesProlongees(base: Pool | PoolClient, ids: readonly number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const { rows } = await base.query<{ id: number; eclaireurs: number }>(
    "select expedition_id as id, sum(nombre)::int as eclaireurs from expedition_eclaireur where expedition_id = any($1::int[]) group by expedition_id",
    [[...ids]],
  );
  return new Map(rows.map((r) => [r.id, vueProlongee(r.eclaireurs)]));
}
