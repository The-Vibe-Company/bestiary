// Les Bêtes sauvages (US-0925) : le Monde en fait apparaître de temps en temps sur chaque Case hors des Territoires, une
// Bête par apparition, que les joueurs soient là ou non ; plusieurs peuvent s'y trouver en même temps. Rien n'en est
// écrit en base : les apparitions d'une Case sont une fonction de la graine de son Monde, de sa place et du temps du
// jeu, calculée à la demande, pour une Case et une période. Aucune ne se voit sur la carte : seules les Expéditions
// présentes sur sa Case la verront (étape 40) ; US-0948 : celle qu'une Expédition a vue sans qu'elle la suive y est
// ensuite repérée, pour son seul joueur (src/expeditions/betes-reperees.ts). US-0926 : chacune reste un temps sur sa Case, puis s'en va pour toujours ;
// seule une Bête partie plus tôt, en suivant une Expédition, laisse une trace en base (bete_partie). US-0927 : sa Rareté
// se tire selon l'Anneau de sa Case ; US-0928 : son Espèce, parmi celles de cette Rareté qui vivent dans le Biome de sa
// Case. US-0930 : tout se compte en temps du jeu, par tranches fixes : pour une Case et une période, les mêmes Bêtes,
// qu'on les calcule en direct ou au rattrapage, d'un bloc ou par morceaux, seule ou avec tout le Monde ; la vitesse
// accélérée du temps accélère d'autant leurs apparitions et leurs durées. US-0937 : apprivoisée, une Bête est mâle ou
// femelle, tiré de même. Côté serveur et scripts uniquement.
import type { Pool, PoolClient } from "pg";
import { type ChancesDeRarete, lireRaretesParAnneau } from "@/donnees/jeux";
import { APPARITIONS_PAR_CASE_PAR_JOUR, PRESENCE_D_UNE_BETE_HEURES } from "@/reglages";
import { anneauDUneCase, type FormeDuMonde } from "./anneaux";
import { hacher } from "./couronne";
import type { Coordonnees } from "./hex";

/** Le temps du jeu se découpe en tranches d'une heure, depuis le 1er janvier 1970 : chaque Case tire à part celles de chacune. */
const TRANCHE_MS = 3_600_000;
const JOUR_MS = 86_400_000;
/** Au plus 100 apparitions par Case et par tranche (en moyenne, bien moins d'une), pour que leurs numéros ne se mêlent jamais. */
const PAR_TRANCHE = 100;
/** Ce que chaque tranche, puis chaque apparition, tire de son côté. */
const TIRAGE = { nombre: 1, moment: 2, rarete: 3, espece: 4, sexe: 5 } as const;
/** US-0926 : combien de temps une Bête reste sur sa Case, en temps du jeu. */
const PRESENCE_MS = PRESENCE_D_UNE_BETE_HEURES * TRANCHE_MS;

/**
 * US-0925 : une Bête sauvage apparue sur une Case : son numéro, propre à sa Case, qui ne revient jamais, et l'instant du
 * jeu où elle apparaît.
 */
export type Apparition = { numero: number; arrivee: Date };

/**
 * US-0926 : une Bête sauvage sur sa Case, de son arrivée jusqu'à son départ (exclu) : PRESENCE_D_UNE_BETE_HEURES heures
 * plus tard, la même durée pour toutes, ou plus tôt si elle a suivi une Expédition. US-0928 : son Espèce, et la Rareté de
 * celle-ci (US-0927).
 */
export type BeteSauvage = Apparition & { depart: Date; especeId: string; rareteId: string };

/**
 * Une Case telle que les Bêtes sauvages la voient : sa place, la graine de son Monde, (US-0927) son Anneau, de 1, la
 * Couronne, à ANNEAUX_DU_MONDE, le Cœur sauvage, et (US-0928) son Biome : « eau » pour la côte, un lac, une rivière ou la
 * mer, variantes d'un même Biome.
 */
export type CaseSauvage = Coordonnees & { graine: number; anneau: number; biome: string };

/** US-0928 : une Espèce telle que les Bêtes sauvages la tirent : sa Rareté et le Biome de son Habitat. */
export type EspeceSauvage = { id: string; rareteId: string; biomeId: string };

/** US-0928 : les Espèces rangées par Biome, puis par Rareté, chaque liste dans l'ordre des identifiants. */
export type EspecesParBiome = ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>;

/** US-0928 : range les Espèces `especes` pour les tirages, une fois pour toutes les Cases calculées ensemble. */
export function rangerLesEspeces(especes: readonly EspeceSauvage[]): EspecesParBiome {
  const rangees = new Map<string, Map<string, string[]>>();
  for (const e of [...especes].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const parRarete = rangees.get(e.biomeId) ?? rangees.set(e.biomeId, new Map()).get(e.biomeId)!;
    parRarete.set(e.rareteId, [...(parRarete.get(e.rareteId) ?? []), e.id]);
  }
  return rangees;
}

/** US-0927 : les chances de chaque Rareté, Anneau par Anneau, lues une fois pour toutes dans les données du jeu. */
let chancesLues: ChancesDeRarete[] | undefined;
export function raretesParAnneau(): ChancesDeRarete[] {
  return (chancesLues ??= lireRaretesParAnneau());
}

/** US-0927 : la Rareté que le hasard `hasard`, de 0 à 1, tire aux chances d'un Anneau. */
export function tirerUneRarete(chances: ChancesDeRarete, hasard: number): string {
  let cumul = 0;
  for (const { rareteId, pourcent } of chances) {
    cumul += pourcent / 100;
    if (hasard < cumul) return rareteId;
  }
  // Ce que les arrondis laissent au-delà de 100 % revient à la dernière.
  return chances.at(-1)!.rareteId;
}

/**
 * US-0927 : la Rareté tirée pour l'apparition `numero` de la Case `laCase`, aux chances de son Anneau, avant le choix de
 * l'Espèce, qui peut la faire retomber (US-0928). US-0931 : la simulation des Raretés tire par elle, comme le jeu.
 */
export function rareteTiree({ graine, q, r, anneau }: Omit<CaseSauvage, "biome">, numero: number, chances = raretesParAnneau()): string {
  return tirerUneRarete(chances[anneau - 1], hacher(graine, q, r, numero, TIRAGE.rarete));
}

/**
 * US-0928 : l'Espèce que le hasard `hasard`, de 0 à 1, tire parmi celles de la Rareté `rareteId` qui vivent dans le Biome
 * `biome`, chacune avec la même chance ; s'il n'y en a aucune, parmi celles de la Rareté inférieure (dans l'ordre de
 * `chances`), et ainsi de suite jusqu'aux communes. null quand même les communes manquent : la Bête n'apparaît pas.
 */
export function tirerUneEspece(
  especes: EspecesParBiome,
  chances: ChancesDeRarete,
  biome: string,
  rareteId: string,
  hasard: number,
): { especeId: string; rareteId: string } | null {
  const duBiome = especes.get(biome);
  for (let rang = chances.findIndex((c) => c.rareteId === rareteId); rang >= 0; rang--) {
    const candidates = duBiome?.get(chances[rang].rareteId);
    if (candidates?.length) return { especeId: candidates[Math.floor(hasard * candidates.length)], rareteId: chances[rang].rareteId };
  }
  return null;
}

/** US-0937 : le sexe d'une Bête apprivoisée, comme l'effectif le compte (src/monde/effectif.ts, enum sexe). */
export type Sexe = "male" | "femelle";

/** US-0937 : le sexe que le hasard `hasard`, de 0 à 1, tire à chances égales : mâle sous la moitié, femelle au-dessus. */
export function tirerUnSexe(hasard: number): Sexe {
  return hasard < 0.5 ? "male" : "femelle";
}

/**
 * US-0937 : le sexe de l'apparition `numero` de la Case `laCase`, tiré à son Apprivoisement (src/expeditions/sexe.ts) à
 * chances égales : comme sa Rareté et son Espèce, une fonction de la graine de son Monde, de sa Case et de son numéro,
 * par un tirage qui lui est propre, jamais de l'heure qu'il est. Le même en direct, au rattrapage ou par la tâche planifiée.
 */
export function sexeTire({ graine, q, r }: Pick<CaseSauvage, "graine" | "q" | "r">, numero: number): Sexe {
  return tirerUnSexe(hacher(graine, q, r, numero, TIRAGE.sexe));
}

/** Le nombre d'apparitions d'une tranche, de moyenne `moyenne` : une loi de Poisson, celle d'apparitions indépendantes. */
function combien(moyenne: number, hasard: number): number {
  let [n, probabilite] = [0, Math.exp(-moyenne)];
  let cumul = probabilite;
  while (hasard >= cumul && n < PAR_TRANCHE - 1) {
    n++;
    probabilite *= moyenne / n;
    cumul += probabilite;
  }
  return n;
}

/**
 * US-0925 : les apparitions de la Case `c` d'un Monde de graine `graine` dont l'instant tombe dans [de, a), dans l'ordre
 * du temps : en moyenne `parJour` par jour du jeu, à des moments au hasard. Elles ne dépendent que de la graine, de la
 * Case et du temps du jeu, jamais de l'heure qu'il est : les mêmes, calculées en direct ou après coup, d'un bloc ou par
 * morceaux.
 */
export function apparitions(graine: number, c: Coordonnees, de: Date, a: Date, parJour = APPARITIONS_PAR_CASE_PAR_JOUR): Apparition[] {
  const moyenne = (parJour * TRANCHE_MS) / JOUR_MS;
  const liste: Apparition[] = [];
  for (let tranche = Math.floor(de.getTime() / TRANCHE_MS); tranche * TRANCHE_MS < a.getTime(); tranche++) {
    const nombre = combien(moyenne, hacher(graine, c.q, c.r, tranche, TIRAGE.nombre));
    const moments = Array.from({ length: nombre }, (_, i) => tranche * TRANCHE_MS + Math.floor(hacher(graine, c.q, c.r, tranche, i, TIRAGE.moment) * TRANCHE_MS));
    // Numérotées dans l'ordre où elles arrivent : les numéros d'une Case croissent avec le temps.
    moments.sort((x, y) => x - y);
    moments.forEach((arrivee, rang) => {
      if (arrivee >= de.getTime() && arrivee < a.getTime()) liste.push({ numero: tranche * PAR_TRANCHE + rang, arrivee: new Date(arrivee) });
    });
  }
  return liste;
}

/**
 * US-0926 : les Bêtes sauvages de la Case `laCase` présentes à un moment de [de, a), dans l'ordre de leur arrivée.
 * Chacune reste PRESENCE_D_UNE_BETE_HEURES heures, puis s'en va ; celle qui est partie plus tôt (`parties` : son numéro,
 * l'instant de son départ) n'est plus là dès cet instant. Aucune ne revient : son numéro ne sert qu'une fois. US-0927 : la
 * Rareté de chacune est tirée aux chances de l'Anneau de la Case (`chances`, celles des données du jeu). US-0928 : puis son
 * Espèce, parmi `especes` (rangerLesEspeces) ; une apparition sans Espèce possible, même commune, n'amène aucune Bête.
 */
export function betesSauvages(
  laCase: CaseSauvage,
  de: Date,
  a: Date,
  especes: EspecesParBiome,
  { parties = new Map(), chances = raretesParAnneau() }: { parties?: ReadonlyMap<number, Date>; chances?: ChancesDeRarete[] } = {},
): BeteSauvage[] {
  const { graine, q, r, anneau, biome } = laCase;
  return apparitions(graine, laCase, new Date(de.getTime() - PRESENCE_MS + 1), a).flatMap((x) => {
    const partie = parties.get(x.numero);
    const depart = Math.min(x.arrivee.getTime() + PRESENCE_MS, partie?.getTime() ?? Infinity);
    if (depart <= de.getTime()) return [];
    const tiree = rareteTiree(laCase, x.numero, chances);
    const espece = tirerUneEspece(especes, chances[anneau - 1], biome, tiree, hacher(graine, q, r, x.numero, TIRAGE.espece));
    return espece ? [{ ...x, depart: new Date(depart), ...espece }] : [];
  });
}

/** Une Case lue en base : sa place, son Biome, la graine et la forme de son Monde, si elle est libre, et les Bêtes qui en sont parties. */
type CaseEnBase = Coordonnees & {
  id: number;
  biome: string;
  graine: string;
  forme: FormeDuMonde;
  libre: boolean;
  parties: { numero: string; partie_le: string }[];
};

/**
 * US-0925 : les Bêtes sauvages présentes à un moment de [de, a) sur les Cases `caseIds`, Case par Case, chacune calculée
 * seule, à la demande. Aucune sur une Case qui appartient à un Territoire ; une Case inconnue n'en a pas non plus.
 * US-0926 : une Bête partie en suivant une Expédition n'y est plus dès son départ. US-0927 : l'Anneau de chaque Case se
 * tire de la forme de son Monde. US-0928 : les Espèces sont celles de la base, lues une fois pour toutes les Cases.
 */
export async function betesSauvagesDesCases(base: Pool | PoolClient, caseIds: number[], de: Date, a: Date): Promise<Map<number, BeteSauvage[]>> {
  // US-0932 : l'une après l'autre : le mécanisme du temps l'appelle avec le client de sa transaction, où deux requêtes
  // ne partent pas à la fois.
  const { rows } = await base.query<CaseEnBase>(
    `select c.id, c.q, c.r, c.biome_id as biome, m.graine, c.chef_id is null as libre,
       json_build_object('rayon', m.rayon, 'anneauxCouronne', m.anneaux_couronne, 'rayonCoeur', m.rayon_coeur) as forme,
       coalesce((select json_agg(json_build_object('numero', p.numero, 'partie_le', p.partie_le)) from bete_partie p where p.case_id = c.id), '[]') as parties
     from case_du_monde c join monde m on m.id = c.monde_id
     where c.id = any($1::int[])`,
    [caseIds],
  );
  const { rows: especes } = await base.query<EspeceSauvage>(`select id, rarete_id as "rareteId", biome_id as "biomeId" from espece`);
  const [parCase, rangees] = [new Map(rows.map((c) => [c.id, c])), rangerLesEspeces(especes)];
  return new Map(
    caseIds.map((id) => {
      const c = parCase.get(id);
      if (!c?.libre) return [id, []];
      const laCase = { q: c.q, r: c.r, graine: Number(c.graine), anneau: anneauDUneCase(c, c.forme), biome: c.biome };
      const parties = new Map(c.parties.map((p) => [Number(p.numero), new Date(p.partie_le)]));
      return [id, betesSauvages(laCase, de, a, rangees, { parties })];
    }),
  );
}

/** US-0925 : les Bêtes sauvages présentes à un moment de [de, a) sur la Case `caseId`, comme betesSauvagesDesCases. */
export async function betesSauvagesDUneCase(base: Pool | PoolClient, caseId: number, de: Date, a: Date): Promise<BeteSauvage[]> {
  return (await betesSauvagesDesCases(base, [caseId], de, a)).get(caseId)!;
}

/**
 * US-0926 : la Bête `numero` de la Case `caseId` la quitte à l'instant du jeu `instant`, pour suivre une Expédition
 * (étape 40) : elle n'y est plus dès cet instant, pour toujours, et personne d'autre ne peut plus la rencontrer. C'est la
 * seule écriture des Bêtes sauvages. Rend false, sans rien écrire, si elle n'était pas là à cet instant (pas encore
 * arrivée, déjà partie, ou emmenée par une autre Expédition, même au même moment).
 */
export async function emmenerUneBete(base: Pool | PoolClient, caseId: number, numero: number, instant: Date): Promise<boolean> {
  const presentes = await betesSauvagesDUneCase(base, caseId, instant, new Date(instant.getTime() + 1));
  if (!presentes.some((b) => b.numero === numero)) return false;
  const { rowCount } = await base.query("insert into bete_partie (case_id, numero, partie_le) values ($1, $2, $3) on conflict do nothing", [caseId, numero, instant]);
  return rowCount === 1;
}
