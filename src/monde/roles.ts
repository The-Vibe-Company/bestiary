// Les Bêtes affectées à leur Rôle (US-0837) : comme on donne un Métier à un Habitant, le joueur affecte des Bêtes d'une
// Espèce dont le Rôle sert au Foyer, depuis la page Bêtes ; elles le remplissent aussitôt, sans Recherche ni Poste.
// Seules les Bêtes valides au Foyer le peuvent, ni sorties en escorte ni Blessées. Une Bête affectée reste dans
// l'effectif : elle mange et occupe ses Places comme les autres. Les Bêtes d'un Couple, parties en Réserve hors de
// l'effectif, ne le sont pas (décidé le 2026-10-13).
//
// Le nombre retenu (table affectation) ne dépasse jamais les Bêtes valides au Foyer : il ne change qu'à « + » et « − », et
// à la réunion d'un Couple (src/monde/couple.ts), qui le borne (bornerLesAffectations). US-0842 : une Bête affectée ne
// combat plus ; elle n'est pas disponible pour l'escorte (betesDisponibles), et le départ ne l'emmène jamais. Les Blessés
// sont des Bêtes de l'escorte, et les Bêtes tuées aussi. Tout ce qui retirera un jour des Bêtes valides du Foyer devra
// borner les affectées de même ; la défense du Foyer (étape 54) et l'Attaque (étape 57) ne compteront que les disponibles.
// Les Éclaireurs (US-0976), affectés à leur Rôle au départ d'une Expédition, suivent la même règle : seule l'escorte
// (expedition_escorte) combat. Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { dureesDeGuerison } from "./blesses";
import { BETES_SORTIES, BLESSES_EN_GUERISON } from "./effectif";

/**
 * US-0837 : les Rôles qui servent au Foyer, et s'affectent depuis la page Bêtes : le Nourricier. L'Éclaireur, lui,
 * s'affecte au départ d'une Expédition (US-0976) ; le Porteur et le Bâtisseur, aux Récoltes et aux constructions qui ne
 * sont pas encore là.
 */
export const ROLES_AU_FOYER: readonly string[] = ["nourricier"];

/**
 * US-0837 : le Rôle au Foyer d'une Espèce de l'effectif : le Rôle, combien de ses Bêtes y sont affectées, et combien
 * peuvent l'être, ses Bêtes valides au Foyer. Jamais plus d'affectées que de valides.
 */
export type RoleAuFoyer = { role: { id: string; nom: string }; affectees: number; valides: number };

/**
 * US-0837 : chaque Espèce de l'effectif du Territoire $1 dont le Rôle est l'un des Rôles $5, ligne par ligne (`e`,
 * regroupée par Territoire et Espèce, et `nombre`, son effectif, nul quand ses Bêtes sont en Réserve) : son Rôle, ses
 * Bêtes valides au Foyer à l'instant du jeu $3, et ses Bêtes affectées parmi elles. Valides : l'effectif, moins les
 * Bêtes sorties en escorte (BETES_SORTIES), moins les Blessés au Foyer pas encore guéris $2 heures après leur retour, $4
 * s'ils ont été soignés (BLESSES_EN_GUERISON, jamais plus que les Bêtes au Foyer) : les disponibles de l'escorte (betesDisponibles). Les
 * affectées ne dépassent pas les valides ; least() ne fait que le garantir à la lecture. Écrite à l'appel, comme les
 * requêtes de couple.ts : un essai qui simule effectif.ts sans ses expressions SQL peut charger ce module.
 */
const rolesDeLEffectif = () => `
  select e.espece_id, e.nombre, ro.id as role_id, ro.nom as role_nom, v.valides, least(coalesce(a.nombre, 0), v.valides) as affectees
  from (select territoire_id, espece_id, sum(nombre)::int as nombre from effectif where territoire_id = $1 group by territoire_id, espece_id) e
  join espece es on es.id = e.espece_id
  join role ro on ro.id = es.role_id and ro.id = any($5::text[])
  cross join lateral (select greatest(0, e.nombre - (${BETES_SORTIES})) as au_foyer) f
  cross join lateral (select f.au_foyer - least(f.au_foyer, (${BLESSES_EN_GUERISON})) as valides) v
  left join affectation a on a.territoire_id = e.territoire_id and a.espece_id = e.espece_id`;

/** US-0837 : les paramètres $1 à $5 de rolesDeLEffectif : le Territoire, les durées de guérison, l'instant, les Rôles. */
const parametres = (territoireId: number, instant: Date) => {
  const [normale, soignee] = dureesDeGuerison();
  return [territoireId, normale, instant, soignee, ROLES_AU_FOYER];
};

/**
 * US-0837 : les Espèces de l'effectif du Territoire dont le Rôle sert au Foyer, à l'instant du jeu `instant`, avec leur
 * Rôle, leurs Bêtes affectées et leurs Bêtes valides (RoleAuFoyer). Aucune autre Espèce, ni une Espèce dont toutes les
 * Bêtes sont en Réserve.
 */
export async function rolesAuFoyer(base: Pool | PoolClient, territoireId: number, instant: Date): Promise<Map<string, RoleAuFoyer>> {
  const { rows } = await base.query<{ espece_id: string; role_id: string; role_nom: string; valides: number; affectees: number }>(
    `${rolesDeLEffectif()} where e.nombre > 0 order by e.espece_id`,
    parametres(territoireId, instant),
  );
  return new Map(rows.map((r) => [r.espece_id, { role: { id: r.role_id, nom: r.role_nom }, affectees: r.affectees, valides: r.valides }]));
}

/**
 * US-0837 : dans une transaction qui tient le Territoire, comme le départ d'une Expédition et le temps qui avance (sa
 * ligne, « for no key update ») : « + » ou « − » attend le départ ou le retour en cours, et le départ ou le retour suivant
 * le voit. Rend ce que rend `ecrire`.
 */
async function enTenantLeTerritoire(pool: Pool, territoireId: number, ecrire: (client: PoolClient) => Promise<boolean>): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select 1 from territoire where id = $1 for no key update", [territoireId]);
    const fait = await ecrire(client);
    await client.query("commit");
    return fait;
  } catch (erreur) {
    await client.query("rollback").catch(() => {});
    throw erreur;
  } finally {
    client.release();
  }
}

/**
 * US-0837 : « + » : affecte une Bête de plus de l'Espèce `especeId` à son Rôle, gratuitement et aussitôt, à l'instant du
 * jeu `instant`, s'il lui reste une Bête valide au Foyer qui ne l'est pas ; rend false sinon, ou pour une Espèce dont le
 * Rôle ne sert pas au Foyer, ou absente de l'effectif. Des « + » envoyés au même instant passent l'un après l'autre, et
 * aucun n'affecte plus de Bêtes qu'il n'y en a de valides.
 */
export async function affecterUneBete(pool: Pool, territoireId: number, especeId: string, instant: Date): Promise<boolean> {
  return enTenantLeTerritoire(pool, territoireId, async (client) => {
    const { rowCount } = await client.query(
      `with v as (${rolesDeLEffectif()} where e.espece_id = $6)
       insert into affectation (territoire_id, espece_id, nombre)
       select $1, $6, 1 from v where v.valides > 0
       on conflict (territoire_id, espece_id) do update set nombre = (select affectees from v) + 1
         where (select affectees from v) < (select valides from v)`,
      [...parametres(territoireId, instant), especeId],
    );
    return rowCount === 1;
  });
}

/**
 * US-0837 : « − » : retire de son Rôle une Bête de l'Espèce `especeId`, gratuitement et aussitôt, à l'instant du jeu
 * `instant`, s'il en reste une d'affectée ; rend false sinon. Comme « + », des « − » envoyés au même instant passent l'un
 * après l'autre, et n'en retirent jamais plus qu'il n'y en avait.
 */
export async function retirerUneBete(pool: Pool, territoireId: number, especeId: string, instant: Date): Promise<boolean> {
  return enTenantLeTerritoire(pool, territoireId, async (client) => {
    const { rowCount } = await client.query(
      `with v as (${rolesDeLEffectif()} where e.espece_id = $6)
       update affectation a set nombre = v.affectees - 1 from v
       where a.territoire_id = $1 and a.espece_id = $6 and v.affectees > 0`,
      [...parametres(territoireId, instant), especeId],
    );
    return rowCount === 1;
  });
}

/**
 * US-0837 : borne les Bêtes affectées de chaque Espèce du Territoire à ses Bêtes valides au Foyer à l'instant du jeu
 * `instant`, aucune pour une Espèce dont toutes les Bêtes sont en Réserve. Appelée là où des Bêtes valides quittent le
 * Foyer, dans leur transaction : à la réunion d'un Couple (src/monde/couple.ts). US-0842 : le départ d'une escorte n'en a
 * plus besoin, il n'emmène jamais de Bête affectée. Ne touche jamais une Espèce qui en garde assez.
 */
export async function bornerLesAffectations(client: PoolClient, territoireId: number, instant: Date): Promise<void> {
  await client.query(
    `with v as (${rolesDeLEffectif()})
     update affectation a set nombre = coalesce((select v.valides from v where v.espece_id = a.espece_id), 0)
     where a.territoire_id = $1 and a.nombre > coalesce((select v.valides from v where v.espece_id = a.espece_id), 0)`,
    parametres(territoireId, instant),
  );
}
