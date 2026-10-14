// Les Bêtes d'un Territoire telles que l'écran d'Expédition les propose pour l'escorte. US-0938 : et l'entrée d'une Bête
// apprivoisée dans l'effectif, à son arrivée au Foyer. US-0810 : et l'effectif tel que la page Bêtes et la fiche d'une
// Espèce le montrent. Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import type { regime } from "@/db/schema";
import { forceDUneBete } from "@/expeditions/force";
import { maintenant } from "@/temps/horloge";
import type { Sexe } from "./betes-sauvages";
import { dureesDeGuerison, gueriLe } from "./blesses";
import { ELEVAGE_ACQUIS } from "./elevage";

/**
 * US-0904 : une Espèce de l'effectif, avec son illustration (null : aucune) et ses Bêtes disponibles pour l'escorte, aucune
 * quand toutes ses Bêtes au Foyer sont des Blessés (US-0953).
 * US-0905 : avec la force d'une de ses Bêtes, la même pour toutes. US-0912 : et leur vitesse réelle, en km/h, qui règle
 * l'allure d'une escorte. US-0937 : et combien de mâles et de femelles le joueur en possède, Bêtes sorties comprises.
 * US-0956 : et si son Couple est réuni : le sexe ne compte plus. US-0953 : et ses Blessés au Foyer, qui guérissent sans être
 * disponibles (absent : aucun). US-0842 : et ses Bêtes affectées à leur Rôle, qui ne combattent plus (absent : aucune).
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
  affectees?: number;
};

/**
 * US-0904 : les Bêtes déjà sorties : combien l'Espèce en a hors du Foyer (expression sur `e`, les lignes de l'effectif
 * regroupées par Territoire et Espèce). US-0911 : celles des escortes de ses Expéditions en cours, jusqu'à leur retour.
 * US-0916 : rentrées, elles n'en sont plus. US-0956 : sorties, elles ne sont pas au Foyer pour réunir un Couple ;
 * US-0960 : le Couple les compte sexe par sexe (MALES_SORTIS, FEMELLES_SORTIES, dont la somme est celle-ci pour les
 * escortes au sexe retenu). US-0944 : sans celles que l'escorte a perdues au combat, sorties de l'effectif. US-0951 : sauf
 * ses Blessés, restés dans l'effectif, qui rentrent au Foyer avec l'Expédition.
 */
export const BETES_SORTIES = `select coalesce(sum(s.nombre - s.perdues + s.blessees), 0)::int from expedition_escorte s join expedition x on x.id = s.expedition_id
  where x.territoire_id = e.territoire_id and s.espece_id = e.espece_id and x.rentree_le is null`;

/**
 * US-0960 : combien de mâles prend la règle de sexesDesPertes (src/expeditions/combat.ts), une Bête après l'autre au sexe
 * le plus nombreux, un mâle à égalité, quand `k` Bêtes sont prises à `m` mâles et `f` femelles (expressions SQL entières,
 * `k` au plus `m` + `f`) : d'abord l'écart, au sexe le plus nombreux, puis autant de l'un que de l'autre, un mâle d'abord.
 */
export const malesPris = (m: string, f: string, k: string) =>
  `((case when (${m}) > (${f}) then least(${k}, (${m}) - (${f})) else 0 end) + (case when (${k}) > abs((${m}) - (${f})) then ((${k}) - abs((${m}) - (${f})) + 1) / 2 else 0 end))`;

/**
 * US-0960 : parmi les Bêtes d'une ligne d'escorte `s` (expedition_escorte), les mâles perdus au combat, puis les mâles morts :
 * les perdues, puis les mortes (les perdues moins les Blessés), sont prises à l'escorte partie, `s.males` mâles et le reste
 * de femelles, par la règle de sexesDesPertes ; ses mâles Blessés sont la différence. Prises d'un coup ou combat après
 * combat, la règle donne les mêmes.
 */
const MALES_PERDUS = malesPris("s.males", "s.nombre - s.males", "s.perdues");
const MALES_MORTS = malesPris("s.males", "s.nombre - s.males", "s.perdues - s.blessees");
const MALES_BLESSES = `(${MALES_PERDUS} - ${MALES_MORTS})`;

/** Les lignes d'escorte des Expéditions en cours de l'Espèce (sur `e`, comme BETES_SORTIES). */
const ESCORTES_DEHORS = `from expedition_escorte s join expedition x on x.id = s.expedition_id
  where x.territoire_id = e.territoire_id and s.espece_id = e.espece_id and x.rentree_le is null`;

/**
 * US-0960 : les mâles et les femelles sortis de l'Espèce (expressions sur `e`, comme BETES_SORTIES) : ceux des escortes de
 * ses Expéditions en cours, vivants, Blessés compris. Le départ retient le sexe de son escorte (expedition_escorte.males) ;
 * une escorte sans sexe retenu (null : partie avant US-0960) compte pour l'un et pour l'autre, chacune de ses Bêtes
 * pouvant être de l'un comme de l'autre : un Couple ne se forme alors que si un mâle et une femelle sont sûrement au
 * Foyer, comme avant.
 */
const SORTIS_DU_SEXE = (vivants: string) =>
  `select coalesce(sum(case when s.males is null then s.nombre - s.perdues + s.blessees else ${vivants} end), 0)::int ${ESCORTES_DEHORS}`;
export const MALES_SORTIS = SORTIS_DU_SEXE(`s.males - ${MALES_MORTS}`);
export const FEMELLES_SORTIES = SORTIS_DU_SEXE(`(s.nombre - s.males) - ((s.perdues - s.blessees) - ${MALES_MORTS})`);
/** US-0960 : les escortes en cours de l'Espèce sans sexe retenu (sur `e`). */
const SORTIES_SANS_SEXE = `select count(*)::int ${ESCORTES_DEHORS} and s.males is null`;

/**
 * US-0953 : les Blessés au Foyer de l'Espèce (expression sur `e`, comme BETES_SORTIES) à l'instant du jeu $3 : ceux des
 * Expéditions rentrées, pas encore guéris $2 heures après leur retour, selon la règle même de blessesAuFoyer (gueriLe) ;
 * US-0955 : $4 heures, s'ils ont été soignés à leur retour. US-0960 : mâles et femelles à part, d'après le sexe de leur
 * escorte (MALES_BLESSES) ; ceux d'une escorte sans sexe retenu à part aussi.
 */
const BLESSES_DU_SEXE = (blessees: string) => `select coalesce(sum(${blessees}), 0)::int from expedition_escorte s join expedition x on x.id = s.expedition_id
  where x.territoire_id = e.territoire_id and s.espece_id = e.espece_id and x.rentree_le is not null and ${gueriLe("$2", "$4")} > $3`;
const BLESSES_MALES = BLESSES_DU_SEXE(`case when s.males is null then 0 else ${MALES_BLESSES} end`);
const BLESSES_FEMELLES = BLESSES_DU_SEXE(`case when s.males is null then 0 else s.blessees - ${MALES_BLESSES} end`);
const BLESSES_SANS_SEXE = BLESSES_DU_SEXE("case when s.males is null then s.blessees else 0 end");

/**
 * US-0960 : les Blessés au Foyer d'une Espèce, jamais plus que de Bêtes au Foyer (`auFoyer`), et sexe par sexe quand tous
 * les sexes se savent (aucune escorte sans sexe dehors, `sansSexeDehors`) : jamais plus de Blessés d'un sexe que de Bêtes de
 * ce sexe au Foyer (`males`, `femelles`). Un Blessé parti en Réserve avec le Couple (src/monde/couple.ts) n'en est plus un
 * au Foyer, et le Couple prend d'abord des Bêtes valides. Les arguments sont des expressions SQL.
 */
const blessesPlafonnes = (b: { auFoyer: string; males: string; femelles: string; blessesMales: string; blessesFemelles: string; blessesSansSexe: string; sansSexeDehors: string }) =>
  `least(${b.auFoyer}, case when ${b.sansSexeDehors} > 0 then ${b.blessesMales} + ${b.blessesFemelles} + ${b.blessesSansSexe}
    else least(greatest(${b.males}, 0), ${b.blessesMales}) + least(greatest(${b.femelles}, 0), ${b.blessesFemelles}) + ${b.blessesSansSexe} end)`;

/**
 * Les Bêtes au Foyer de chaque Espèce de l'effectif du Territoire $1, à l'instant du jeu $3 ($2 et $4 : les durées de
 * guérison, dureesDeGuerison) : mâles et femelles possédés, au Foyer, et ses Blessés (blessesPlafonnes), Espèce par Espèce ;
 * US-0842 : et ses Bêtes retenues à leur Rôle (affectation, `retenues`).
 */
const AU_FOYER = `select y.*, ${blessesPlafonnes({
  auFoyer: "y.au_foyer",
  males: "y.males_au_foyer",
  femelles: "y.femelles_au_foyer",
  blessesMales: "y.blesses_males",
  blessesFemelles: "y.blesses_femelles",
  blessesSansSexe: "y.blesses_sans_sexe",
  sansSexeDehors: "y.sorties_sans_sexe",
})} as blesses
  from (
    select e.espece_id, sum(e.nombre)::int - (${BETES_SORTIES}) as au_foyer,
      coalesce(sum(e.nombre) filter (where e.sexe = 'male'), 0)::int as males,
      coalesce(sum(e.nombre) filter (where e.sexe = 'femelle'), 0)::int as femelles,
      coalesce(sum(e.nombre) filter (where e.sexe = 'male'), 0)::int - (${MALES_SORTIS}) as males_au_foyer,
      coalesce(sum(e.nombre) filter (where e.sexe = 'femelle'), 0)::int - (${FEMELLES_SORTIES}) as femelles_au_foyer,
      (${BLESSES_MALES}) as blesses_males, (${BLESSES_FEMELLES}) as blesses_femelles, (${BLESSES_SANS_SEXE}) as blesses_sans_sexe,
      (${SORTIES_SANS_SEXE}) as sorties_sans_sexe,
      (select a.nombre from affectation a where a.territoire_id = e.territoire_id and a.espece_id = e.espece_id) as retenues,
      ${ELEVAGE_ACQUIS} as "coupleReuni"
    from effectif e
    where e.territoire_id = $1
    group by e.territoire_id, e.espece_id
  ) y`;

/** Les Bêtes de l'Espèce (sur `e`) dans l'effectif, d'un sexe, ou des deux. */
const EFFECTIF_DE = (sexe?: "male" | "femelle") =>
  `(select coalesce(sum(f.nombre), 0)::int from effectif f where f.territoire_id = e.territoire_id and f.espece_id = e.espece_id${sexe ? ` and f.sexe = '${sexe}'` : ""})`;

/**
 * US-0837 : les Blessés au Foyer de l'Espèce (expression sur `e`, une ligne qui porte `territoire_id` et `espece_id`), à
 * l'instant du jeu $3 ($2 et $4 : les durées de guérison) : les Bêtes valides au Foyer, que le joueur peut affecter à leur
 * Rôle, s'en déduisent (src/monde/roles.ts), comme les disponibles de l'escorte. US-0960 : plafonnés sexe par sexe, comme
 * betesDisponibles les compte (blessesPlafonnes).
 */
export const BLESSES_EN_GUERISON = `select ${blessesPlafonnes({
  auFoyer: `greatest(0, ${EFFECTIF_DE()} - (${BETES_SORTIES}))`,
  males: `(${EFFECTIF_DE("male")} - (${MALES_SORTIS}))`,
  femelles: `(${EFFECTIF_DE("femelle")} - (${FEMELLES_SORTIES}))`,
  blessesMales: `(${BLESSES_MALES})`,
  blessesFemelles: `(${BLESSES_FEMELLES})`,
  blessesSansSexe: `(${BLESSES_SANS_SEXE})`,
  sansSexeDehors: `(${SORTIES_SANS_SEXE})`,
})}`;

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
 * US-0842 : les Bêtes affectées à leur Rôle (affectation, jamais plus que les Bêtes valides, src/monde/roles.ts) ne
 * combattent plus : elles ne sont pas disponibles, et le départ les refuse de même ; une Espèce dont toutes les Bêtes
 * valides sont affectées reste proposée, sans aucune disponible. Les disponibles sont les Bêtes qui peuvent combattre :
 * l'Attaque (étape 57) partira d'elles comme l'escorte, et la défense du Foyer contre une Incursion (étape 54) ne comptera
 * qu'elles, sans perte pour les affectées.
 */
export async function betesDisponibles(base: Pool | PoolClient, territoireId: number, instant: Date = maintenant()): Promise<EspeceDisponible[]> {
  const [normale, soignee] = dureesDeGuerison();
  const { rows } = await base.query<Omit<EspeceDisponible, "force"> & { attaque: number; vie: number }>(
    `select es.id, es.nom, es.illustration, v.valides - v.affectees as disponibles, x.blesses, v.affectees,
       es.attaque, es.vie, es.vitesse, x.males, x.femelles, x."coupleReuni"
     from (${AU_FOYER}) x
     cross join lateral (select x.au_foyer - x.blesses as valides) w
     cross join lateral (select w.valides, least(coalesce(x.retenues, 0), w.valides) as affectees) v
     join espece es on es.id = x.espece_id
     join rarete r on r.id = es.rarete_id
     where x.au_foyer > 0
     order by r.rang, es.nom`,
    [territoireId, normale, instant, soignee],
  );
  return rows.map(({ attaque, vie, blesses, affectees, ...espece }) => ({
    ...espece,
    ...(blesses ? { blesses } : {}),
    ...(affectees ? { affectees } : {}),
    force: forceDUneBete({ attaque, vie }),
  }));
}

/**
 * US-0960 : les Blessés au Foyer de chaque Espèce du Territoire à l'instant du jeu `instant`, comme betesDisponibles les
 * compte : jamais plus que de Bêtes au Foyer, sexe par sexe ; un Blessé parti en Réserve avec son Couple n'y est plus. Les
 * pages qui montrent les groupes de Blessés (blessesAuFoyer, US-0952) n'en montrent jamais plus. Seules les Espèces qui en
 * ont.
 */
export async function blessesParEspece(base: Pool | PoolClient, territoireId: number, instant: Date): Promise<Map<string, number>> {
  const [normale, soignee] = dureesDeGuerison();
  const { rows } = await base.query<{ especeId: string; blesses: number }>(
    `select x.espece_id as "especeId", x.blesses from (${AU_FOYER}) x where x.blesses > 0`,
    [territoireId, normale, instant, soignee],
  );
  return new Map(rows.map((r) => [r.especeId, r.blesses]));
}

/** US-0960 : les Bêtes valides au Foyer d'une Espèce, mâles et femelles à part. */
export type ValidesParSexe = { males: number; femelles: number };

/**
 * US-0960 : les Bêtes valides au Foyer, sexe par sexe, de chaque Espèce `especes` de l'effectif du Territoire, à l'instant
 * du jeu `instant` : celles dont le départ tire le sexe de son escorte. Les Bêtes affectées à leur Rôle (US-0842) en font
 * partie, leur sexe n'étant pas retenu à part : le total que le départ peut emmener est celui de betesDisponibles, sans
 * elles. Null pour une Espèce dont un sexe ne se sait pas : une escorte encore dehors ou des Blessés au Foyer partis avant
 * que le départ ne retienne le sexe de son escorte ; absente pour une Espèce sans Bête au Foyer.
 */
export async function validesParSexe(base: Pool | PoolClient, territoireId: number, especes: readonly string[], instant: Date): Promise<Map<string, ValidesParSexe | null>> {
  const [normale, soignee] = dureesDeGuerison();
  const { rows } = await base.query<{ especeId: string; males: number; femelles: number; connus: boolean }>(
    `select x.espece_id as "especeId", x.sorties_sans_sexe = 0 and x.blesses_sans_sexe = 0 as connus,
       greatest(x.males_au_foyer, 0) - least(greatest(x.males_au_foyer, 0), x.blesses_males) as males,
       greatest(x.femelles_au_foyer, 0) - least(greatest(x.femelles_au_foyer, 0), x.blesses_femelles) as femelles
     from (${AU_FOYER}) x
     where x.espece_id = any($5::text[]) and x.au_foyer > 0`,
    [territoireId, normale, instant, soignee, especes],
  );
  return new Map(rows.map(({ especeId, connus, males, femelles }) => [especeId, connus ? { males, femelles } : null]));
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
