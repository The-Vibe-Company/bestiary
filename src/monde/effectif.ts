// Les Bêtes d'un Territoire telles que l'écran d'Expédition les propose pour l'escorte. US-0938 : et l'entrée d'une Bête
// apprivoisée dans l'effectif, à son arrivée au Foyer. US-0810 : et l'effectif tel que la page Bêtes et la fiche d'une
// Espèce le montrent. Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import type { regime } from "@/db/schema";
import { forceDUneBete } from "@/expeditions/force";
import { GUERISON_DES_BLESSES_HEURES } from "@/reglages";
import { maintenant } from "@/temps/horloge";
import type { Sexe } from "./betes-sauvages";
import { gueriLe } from "./blesses";
import { ELEVAGE_ACQUIS } from "./elevage";

/**
 * US-0904 : une Espèce de l'effectif, avec son illustration (null : aucune) et ses Bêtes disponibles pour l'escorte, aucune
 * quand toutes ses Bêtes au Foyer sont des Blessés (US-0953).
 * US-0905 : avec la force d'une de ses Bêtes, la même pour toutes. US-0912 : et leur vitesse réelle, en km/h, qui règle
 * l'allure d'une escorte. US-0937 : et combien de mâles et de femelles le joueur en possède, Bêtes sorties comprises.
 * US-0956 : et si son Couple est réuni : le sexe ne compte plus. US-0953 : et ses Blessés au Foyer, qui guérissent sans être
 * disponibles (absent : aucun).
 */
export type EspeceDisponible = {
  id: string;
  nom: string;
  illustration: string | null;
  disponibles: number;
  force: number;
  vitesse: number;
  males: number;
  femelles: number;
  coupleReuni: boolean;
  blesses?: number;
};

/**
 * US-0904 : les Bêtes déjà sorties : combien l'Espèce en a hors du Foyer (expression sur `e`, les lignes de l'effectif
 * regroupées par Territoire et Espèce). US-0911 : celles des escortes de ses Expéditions en cours, jusqu'à leur retour.
 * US-0916 : rentrées, elles n'en sont plus. US-0956 : sorties, elles ne sont pas au Foyer pour réunir un Couple
 * (src/monde/couple.ts). US-0944 : sans celles que l'escorte a perdues au combat, sorties de l'effectif. US-0951 : sauf ses
 * Blessés, restés dans l'effectif, qui rentrent au Foyer avec l'Expédition.
 */
export const BETES_SORTIES = `select coalesce(sum(s.nombre - s.perdues + s.blessees), 0)::int from expedition_escorte s join expedition x on x.id = s.expedition_id
  where x.territoire_id = e.territoire_id and s.espece_id = e.espece_id and x.rentree_le is null`;

/**
 * US-0953 : les Blessés au Foyer de l'Espèce (expression sur `e`, comme BETES_SORTIES) à l'instant du jeu $3 : ceux des
 * Expéditions rentrées, pas encore guéris $2 heures après leur retour, selon la règle même de blessesAuFoyer (gueriLe).
 */
const BLESSES_EN_GUERISON = `select coalesce(sum(s.blessees), 0)::int from expedition_escorte s join expedition x on x.id = s.expedition_id
  where x.territoire_id = e.territoire_id and s.espece_id = e.espece_id and x.rentree_le is not null and ${gueriLe("$2")} > $3`;

/**
 * US-0904 : les Bêtes que le joueur peut emmener en escorte, Espèce par Espèce, lues à chaque affichage de l'écran
 * d'Expédition : l'effectif du Territoire, mâles et femelles ensemble (l'escorte ne choisit pas le sexe), moins les Bêtes
 * déjà sorties. Seules les Espèces qui en ont au moins une au Foyer, de la plus commune à la plus rare, puis par nom ;
 * aucune pour un Territoire sans Bête. Lire ne retient rien : rien ne change avant le départ.
 * US-0905 : la force d'une Bête vient de l'attaque et de la vie de son Espèce, rien du Territoire : aucune Recherche.
 * US-0937 : combien de mâles et de femelles le joueur en possède, au Foyer comme en escorte, pour savoir lequel lui manque
 * tant que le Couple de l'Espèce n'est pas réuni. US-0956 : les Bêtes d'un Couple réuni ont quitté l'effectif pour la
 * Réserve, d'où elles ne sortent jamais (src/monde/couple.ts) : elles ne sont ni disponibles ni comptées ; et le
 * Couple réuni se dit, le sexe ne comptant plus. US-0957 : c'est l'Élevage acquis (src/monde/elevage.ts).
 * US-0953 : les Blessés au Foyer, à l'instant du jeu `instant`, restent dans l'effectif et y comptent parmi les mâles et
 * les femelles, mais ne sont jamais disponibles : le départ, qui relit les disponibles, les refuse (src/expeditions/depart.ts).
 * Jamais plus de Blessés que de Bêtes au Foyer. Une Espèce dont toutes les Bêtes au Foyer sont blessées reste proposée,
 * sans aucune disponible, pour que ses Blessés se lisent (US-0952).
 */
export async function betesDisponibles(base: Pool | PoolClient, territoireId: number, instant: Date = maintenant()): Promise<EspeceDisponible[]> {
  const { rows } = await base.query<Omit<EspeceDisponible, "force"> & { attaque: number; vie: number }>(
    `select es.id, es.nom, es.illustration, x.au_foyer - least(x.au_foyer, x.blesses) as disponibles, least(x.au_foyer, x.blesses) as blesses,
       es.attaque, es.vie, es.vitesse, x.males, x.femelles, x."coupleReuni"
     from (
       select e.espece_id, sum(e.nombre)::int - (${BETES_SORTIES}) as au_foyer, (${BLESSES_EN_GUERISON}) as blesses,
         coalesce(sum(e.nombre) filter (where e.sexe = 'male'), 0)::int as males,
         coalesce(sum(e.nombre) filter (where e.sexe = 'femelle'), 0)::int as femelles,
         ${ELEVAGE_ACQUIS} as "coupleReuni"
       from effectif e
       where e.territoire_id = $1
       group by e.territoire_id, e.espece_id
     ) x
     join espece es on es.id = x.espece_id
     join rarete r on r.id = es.rarete_id
     where x.au_foyer > 0
     order by r.rang, es.nom`,
    [territoireId, GUERISON_DES_BLESSES_HEURES, instant],
  );
  return rows.map(({ attaque, vie, blesses, ...espece }) => ({ ...espece, ...(blesses ? { blesses } : {}), force: forceDUneBete({ attaque, vie }) }));
}

/**
 * US-0938 : fait entrer les Bêtes `betes` dans l'effectif du Territoire, chacune à la ligne de son Espèce et de son sexe,
 * créée au besoin : elles s'ajoutent à celles qui y sont déjà, et sont disponibles pour l'escorte dès lors. Aucune limite
 * de Places : les Places arrivent au jalon 8, avec la Bête apprivoisée sans Place libre (US-0939). Aucun Biome non plus :
 * le Foyer, en prairie, loge les Bêtes de tout Biome (US-0823). Rien sans Bête.
 * US-0956 : sauf celle qui réunit un Couple au même instant (src/monde/couple.ts), partie aussitôt en Réserve.
 */
export async function faireEntrerDansLEffectif(base: Pool | PoolClient, territoireId: number, betes: readonly { especeId: string; sexe: Sexe }[]): Promise<void> {
  if (betes.length === 0) return;
  await base.query(
    `insert into effectif (territoire_id, espece_id, sexe, nombre)
     select $1, b.espece_id, b.sexe, count(*)::int from unnest($2::text[], $3::sexe[]) as b(espece_id, sexe) group by b.espece_id, b.sexe
     on conflict (territoire_id, espece_id, sexe) do update set nombre = effectif.nombre + excluded.nombre`,
    [territoireId, betes.map((b) => b.especeId), betes.map((b) => b.sexe)],
  );
}

/**
 * US-0810 : une Espèce de l'effectif telle que la page Bêtes et sa fiche la montrent : son nom, son illustration (null :
 * aucune), sa Rareté, et combien le joueur en a de Bêtes.
 */
export type EspeceDeLEffectif = { especeId: string; nom: string; illustration: string | null; rarete: { id: string; nom: string }; effectif: number };

/**
 * US-0810 : l'effectif du Territoire, Espèce par Espèce, pour la page Bêtes : toutes les Bêtes que le joueur possède,
 * mâles et femelles ensemble, celles sorties en escorte comprises (elles sont toujours à lui, US-0937) ; jamais celles d'un
 * Couple, parties en Réserve hors de l'effectif (US-0956), ni les Bêtes mortes au combat, qui l'ont quitté (US-0944) ;
 * les Blessés, eux, y restent et comptent (US-0951).
 * Seules les Espèces qui en ont au moins une, de la plus commune à la plus rare, puis par nom, comme l'escorte.
 */
export async function effectifParEspece(base: Pool | PoolClient, territoireId: number): Promise<EspeceDeLEffectif[]> {
  const { rows } = await base.query<EspeceDeLEffectif>(
    `select es.id as "especeId", es.nom, es.illustration, json_build_object('id', r.id, 'nom', r.nom) as rarete, x.effectif
     from (select espece_id, sum(nombre)::int as effectif from effectif where territoire_id = $1 group by espece_id) x
     join espece es on es.id = x.espece_id
     join rarete r on r.id = es.rarete_id
     where x.effectif > 0
     order by r.rang, es.nom`,
    [territoireId],
  );
  return rows;
}

/** US-0810 : le total des Bêtes de l'effectif du Territoire, en haut de la page Bêtes et sur le Foyer (effectifParEspece). */
export async function nombreDeBetes(base: Pool | PoolClient, territoireId: number): Promise<number> {
  const { rows } = await base.query<{ nombre: number }>("select coalesce(sum(nombre), 0)::int as nombre from effectif where territoire_id = $1", [
    territoireId,
  ]);
  return rows[0].nombre;
}

/**
 * US-0804 : la fiche d'une Espèce : ce que la page Bêtes en montre, et ses caractéristiques telles que la base les a
 * enregistrées pour elle (src/donnees/jeux.ts, par le barème) : son attaque, sa vie, sa vitesse en km/h et sa charge. Les
 * mêmes pour tous les joueurs : rien du Territoire n'y entre, aucune Recherche non plus (ADR 0005). US-0805 : et sa taille
 * en Places par Bête, son régime et son Entretien par heure et par Bête. US-0806 : et son Biome d'Habitat, et son Rôle
 * (null : aucun).
 */
export type FicheDEspece = EspeceDeLEffectif & {
  attaque: number;
  vie: number;
  vitesse: number;
  charge: number;
  taille: number;
  regime: Regime;
  entretienParHeure: number;
  biome: { id: string; nom: string };
  role: { id: string; nom: string } | null;
};

/** US-0805 : le régime d'une Espèce, qui dit la Nourriture de son Entretien : l'une des valeurs de l'énumération en base. */
export type Regime = (typeof regime.enumValues)[number];

/**
 * US-0810 : l'Espèce `especeId` telle que sa fiche la montre au joueur, avec son effectif sur le Territoire : quand il en a
 * des Bêtes, ou quand il a réuni son Couple (US-0803), son effectif fût-il vide ; null sinon, sans dire si un autre joueur
 * en a. US-0804 : avec les caractéristiques de l'Espèce (FicheDEspece).
 */
export async function especeDuTerritoire(base: Pool | PoolClient, territoireId: number, especeId: string): Promise<FicheDEspece | null> {
  const { rows } = await base.query<FicheDEspece>(
    `select es.id as "especeId", es.nom, es.illustration, json_build_object('id', r.id, 'nom', r.nom) as rarete, x.effectif,
       es.attaque, es.vie, es.vitesse, es.charge, es.taille, es.regime, es.entretien_par_heure as "entretienParHeure",
       json_build_object('id', b.id, 'nom', b.nom) as biome,
       case when ro.id is null then null else json_build_object('id', ro.id, 'nom', ro.nom) end as role
     from espece es
     join rarete r on r.id = es.rarete_id
     join biome b on b.id = es.biome_id
     left join role ro on ro.id = es.role_id
     cross join lateral (select coalesce(sum(e.nombre), 0)::int as effectif from effectif e where e.territoire_id = $1 and e.espece_id = es.id) x
     where es.id = $2
       and (x.effectif > 0 or exists (select 1 from couple c where c.territoire_id = $1 and c.espece_id = es.id))`,
    [territoireId, especeId],
  );
  return rows[0] ?? null;
}
