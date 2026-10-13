// Les Blessés au Foyer (US-0952) : les Bêtes de l'escorte blessées au combat (US-0951) restent dans l'effectif et rentrent
// au Foyer avec leur Expédition ; de ce retour, elles guérissent en GUERISON_DES_BLESSES_HEURES. Un groupe de Blessés, ce
// sont les Blessés d'une Espèce rentrés au même instant, qui guérissent ensemble. Rien ne s'écrit : tout se relit de
// l'escorte (expedition_escorte.blessees) et du retour de chaque Expédition (expedition.rentree_le). Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { GUERISON_DES_BLESSES_HEURES } from "@/reglages";

/**
 * US-0952 : l'instant du jeu où guérissent les Blessés rentrés avec l'Expédition `x` (expression SQL), la durée de
 * guérison en heures étant le paramètre `heures` (« $3 ») : la même règle partout où se lisent les Blessés au Foyer.
 */
export const gueriLe = (heures: string) => `x.rentree_le + ${heures} * interval '1 hour'`;

/** US-0952 : un groupe de Blessés d'une Espèce, au Foyer : combien, et l'instant du jeu où ils seront guéris. */
export type GroupeDeBlesses = { nombre: number; gueriLe: Date };

/**
 * US-0952 : les Blessés du Territoire au Foyer à l'instant du jeu `instant`, Espèce par Espèce, groupe par groupe, du
 * premier guéri au dernier : ceux des Expéditions rentrées, pas encore guéris. Ceux d'une Expédition encore dehors ne sont
 * pas au Foyer ; guéris, ce ne sont plus des Blessés. Aucune Espèce sans Blessé.
 */
export async function blessesAuFoyer(base: Pool | PoolClient, territoireId: number, instant: Date): Promise<Map<string, GroupeDeBlesses[]>> {
  const { rows } = await base.query<{ especeId: string; nombre: number; gueriLe: Date }>(
    `select s.espece_id as "especeId", sum(s.blessees)::int as nombre, ${gueriLe("$3")} as "gueriLe"
     from expedition_escorte s join expedition x on x.id = s.expedition_id
     where x.territoire_id = $1 and x.rentree_le is not null and s.blessees > 0 and ${gueriLe("$3")} > $2
     group by s.espece_id, x.rentree_le
     order by s.espece_id, x.rentree_le`,
    [territoireId, instant, GUERISON_DES_BLESSES_HEURES],
  );
  const parEspece = new Map<string, GroupeDeBlesses[]>();
  for (const { especeId, ...groupe } of rows) parEspece.set(especeId, [...(parEspece.get(especeId) ?? []), groupe]);
  return parEspece;
}
