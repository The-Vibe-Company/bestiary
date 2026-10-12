// L'Élevage d'une Espèce (US-0957) : acquis dès que son Couple est réuni (US-0956, src/monde/couple.ts), et pour
// toujours. Il ne se lit que dans le Couple, qui ne se défait jamais et ne quitte pas la Réserve : ni dans l'effectif, dont
// toutes les Bêtes de l'Espèce peuvent mourir, ni dans le sexe de ses Bêtes, qui ne compte plus. La seule façon, pour le
// reste du code, de demander si l'Élevage d'une Espèce est acquis ; on s'en servira, avec un Habitant éleveur, à l'étape
// 34 (le bloc « Élever », US-0812, qui refusera l'Élevage d'une Espèce sans Couple). Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";

/**
 * US-0957 : vrai quand l'Élevage de l'Espèce est acquis au Territoire, dès son Couple réuni et à jamais (expression sur
 * `e`, une ligne qui porte `territoire_id` et `espece_id`, comme BETES_SORTIES dans src/monde/effectif.ts).
 */
export const ELEVAGE_ACQUIS = `exists (select 1 from couple c where c.territoire_id = e.territoire_id and c.espece_id = e.espece_id)`;

/** US-0957 : l'Élevage de l'Espèce `especeId` est-il acquis au Territoire ? */
export async function elevageAcquis(base: Pool | PoolClient, territoireId: number, especeId: string): Promise<boolean> {
  const { rows } = await base.query<{ acquis: boolean }>(
    `select ${ELEVAGE_ACQUIS} as acquis from (select $1::int as territoire_id, $2::text as espece_id) e`,
    [territoireId, especeId],
  );
  return rows[0].acquis;
}
