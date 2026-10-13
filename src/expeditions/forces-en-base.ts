// La force des escortes et des Espèces telle que la base la dit (US-0905, US-0934) : pour savoir quelle Bête une
// Expédition a à portée, dans les Rencontres (src/expeditions/rencontres.ts), leurs fuites (src/expeditions/fuites-des-cases.ts)
// et les récits. Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { forceDeLEscorte, forceDUneBete } from "./force";

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
