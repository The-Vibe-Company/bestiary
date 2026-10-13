// Les Blessés au Foyer (US-0952) : les Bêtes de l'escorte blessées au combat (US-0951) restent dans l'effectif et rentrent
// au Foyer avec leur Expédition ; de ce retour, elles guérissent en GUERISON_DES_BLESSES_HEURES. Un groupe de Blessés, ce
// sont les Blessés d'une Espèce rentrés au même instant, qui guérissent ensemble. Rien ne s'écrit : tout se relit de
// l'escorte (expedition_escorte.blessees) et du retour de chaque Expédition (expedition.rentree_le). US-0955 : soignés à
// leur retour (expedition.blesses_soignes), ils guérissent en GUERISON_DES_BLESSES_SOIGNES_HEURES. Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { GUERISON_DES_BLESSES_HEURES, GUERISON_DES_BLESSES_SOIGNES_HEURES } from "@/reglages";

/**
 * US-0952 : l'instant du jeu où guérissent les Blessés rentrés avec l'Expédition `x` (expression SQL), la même règle
 * partout où se lisent les Blessés : son retour, plus la durée de guérison en heures ; US-0955 : `soignee` (paramètre
 * SQL) s'ils ont été soignés à leur retour, `normale` sinon.
 */
export const gueriLe = (normale: string, soignee: string) =>
  `x.rentree_le + (case when x.blesses_soignes then ${soignee}::float8 else ${normale}::float8 end) * interval '1 hour'`;

/** US-0955 : les durées de guérison, en heures, dans l'ordre où gueriLe les attend : normale, puis soignée. */
export const dureesDeGuerison = () => [GUERISON_DES_BLESSES_HEURES, GUERISON_DES_BLESSES_SOIGNES_HEURES];

/**
 * US-0952 : un groupe de Blessés d'une Espèce, au Foyer : combien, et l'instant du jeu où ils seront guéris. US-0955 :
 * `soignes`, ils ont été soignés à leur retour ; absent sinon.
 */
export type GroupeDeBlesses = { nombre: number; gueriLe: Date; soignes?: true };

/**
 * US-0952 : les Blessés du Territoire au Foyer à l'instant du jeu `instant`, Espèce par Espèce, groupe par groupe, du
 * premier guéri au dernier : ceux des Expéditions rentrées, pas encore guéris. Ceux d'une Expédition encore dehors ne sont
 * pas au Foyer ; guéris, ce ne sont plus des Blessés. Aucune Espèce sans Blessé. US-0955 : soignés ou non, deux groupes ;
 * des soignés rentrés plus tard peuvent guérir les premiers.
 */
export async function blessesAuFoyer(base: Pool | PoolClient, territoireId: number, instant: Date): Promise<Map<string, GroupeDeBlesses[]>> {
  const { rows } = await base.query<{ especeId: string; nombre: number; gueriLe: Date; soignes: boolean }>(
    `select s.espece_id as "especeId", sum(s.blessees)::int as nombre, ${gueriLe("$3", "$4")} as "gueriLe", x.blesses_soignes as soignes
     from expedition_escorte s join expedition x on x.id = s.expedition_id
     where x.territoire_id = $1 and x.rentree_le is not null and s.blessees > 0 and ${gueriLe("$3", "$4")} > $2
     group by s.espece_id, x.rentree_le, x.blesses_soignes
     order by s.espece_id, "gueriLe", x.rentree_le`,
    [territoireId, instant, ...dureesDeGuerison()],
  );
  const parEspece = new Map<string, GroupeDeBlesses[]>();
  for (const { especeId, soignes, ...groupe } of rows) {
    parEspece.set(especeId, [...(parEspece.get(especeId) ?? []), { ...groupe, ...(soignes && { soignes: true as const }) }]);
  }
  return parEspece;
}
