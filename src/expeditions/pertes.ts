// Les pertes du combat (US-0944) : à l'instant où une Bête trop forte attaque une Expédition (US-0943), le combat se
// livre (src/expeditions/combat.ts) et l'escorte perd ses Bêtes : retenues sur l'escorte (expedition_escorte.perdues), elles
// quittent aussitôt l'effectif du Territoire. Jamais les explorateurs, ni les Bêtes restées au Foyer, ni les Couples, en
// Réserve hors de l'effectif (US-0956). Appliquées par le mécanisme du temps, dans la transaction du rattrapage, à
// l'instant de chaque attaque : les mêmes pertes en direct, au rattrapage ou par la tâche planifiée. Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { pertesDuCombat, sexesDesPertes } from "./combat";
import { forceDUneBete } from "./force";

/**
 * US-0944 : un combat à livrer : l'Expédition attaquée, l'Espèce de la Bête qui l'attaque et l'instant de l'attaque ; et
 * la Bête, par son numéro sur la Case (une Bête sauvage ordinaire) ou sa ligne (une Bête de naissance), l'autre null.
 */
export type Combat = { expeditionId: number; especeId: string; le: Date; numero: number | null; beteDeNaissanceId: number | null };

/**
 * US-0944 : livre les combats `combats`, dans l'ordre du temps : l'escorte de chaque Expédition attaquée, telle qu'il en
 * reste à cet instant, combat la Bête, et ses pertes s'appliquent avant le combat suivant. Au même instant, l'ordre des
 * Expéditions, puis celui des Bêtes, les sauvages ordinaires par leur numéro avant les Bêtes de naissance par leur ligne :
 * le même quel que soit le découpage du temps. Une Expédition sans escorte n'en perd aucune. Dans la transaction de
 * retenirLesRencontres (src/expeditions/rencontres.ts).
 */
export async function subirLesCombats(base: Pool | PoolClient, combats: readonly Combat[]): Promise<void> {
  // Un nombre absent passe après tous les autres.
  const avant = (a: number | null, b: number | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a - b);
  const dansLOrdre = [...combats].sort(
    (a, b) =>
      a.le.getTime() - b.le.getTime() || a.expeditionId - b.expeditionId || avant(a.numero, b.numero) || avant(a.beteDeNaissanceId, b.beteDeNaissanceId),
  );
  // L'un après l'autre : sur le client d'une transaction, deux requêtes ne partent pas à la fois.
  for (const combat of dansLOrdre) await subirLeCombat(base, combat);
}

/**
 * US-0944 : le combat de la Bête de l'Espèce `especeId` contre l'escorte de l'Expédition `expeditionId` : ses pertes,
 * Espèce par Espèce (pertesDuCombat), s'ajoutent à celles de l'escorte et quittent l'effectif du Territoire, chacune au
 * sexe que dit sexesDesPertes.
 */
async function subirLeCombat(base: Pool | PoolClient, { expeditionId, especeId }: Combat): Promise<void> {
  const { rows: escorte } = await base.query<{ especeId: string; attaque: number; vie: number; nombre: number; territoireId: number }>(
    `select s.espece_id as "especeId", e.attaque, e.vie, s.nombre - s.perdues as nombre, x.territoire_id as "territoireId"
     from expedition_escorte s join espece e on e.id = s.espece_id join expedition x on x.id = s.expedition_id
     where s.expedition_id = $1
     order by s.espece_id`,
    [expeditionId],
  );
  if (escorte.length === 0) return;
  const { rows: bete } = await base.query<{ attaque: number; vie: number }>("select attaque, vie from espece where id = $1", [especeId]);
  const pertes = pertesDuCombat(
    forceDUneBete(bete[0]),
    escorte.map(({ especeId, nombre, ...espece }) => ({ especeId, nombre, force: forceDUneBete(espece) })),
  );
  if (pertes.length === 0) return;
  const { territoireId } = escorte[0];
  await base.query(
    `update expedition_escorte s set perdues = s.perdues + v.nombre from unnest($2::text[], $3::int[]) as v(espece_id, nombre)
     where s.expedition_id = $1 and s.espece_id = v.espece_id`,
    [expeditionId, pertes.map((p) => p.especeId), pertes.map((p) => p.nombre)],
  );
  const { rows: effectif } = await base.query<{ especeId: string; males: number; femelles: number }>(
    `select espece_id as "especeId", coalesce(sum(nombre) filter (where sexe = 'male'), 0)::int as males,
       coalesce(sum(nombre) filter (where sexe = 'femelle'), 0)::int as femelles
     from effectif where territoire_id = $1 and espece_id = any($2::text[]) group by espece_id`,
    [territoireId, pertes.map((p) => p.especeId)],
  );
  const parEspece = new Map(effectif.map(({ especeId, ...sexes }) => [especeId, sexes]));
  const sorties = pertes.flatMap(({ especeId, nombre }) => {
    const { males, femelles } = sexesDesPertes(parEspece.get(especeId) ?? { males: 0, femelles: 0 }, nombre);
    return [
      { especeId, sexe: "male", nombre: males },
      { especeId, sexe: "femelle", nombre: femelles },
    ].filter((s) => s.nombre > 0);
  });
  if (sorties.length === 0) return;
  await base.query(
    `update effectif e set nombre = e.nombre - v.nombre from unnest($2::text[], $3::sexe[], $4::int[]) as v(espece_id, sexe, nombre)
     where e.territoire_id = $1 and e.espece_id = v.espece_id and e.sexe = v.sexe`,
    [territoireId, sorties.map((s) => s.especeId), sorties.map((s) => s.sexe), sorties.map((s) => s.nombre)],
  );
}
