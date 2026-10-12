// Le combat (US-0944) : quand une Bête trop forte attaque une Expédition (US-0943, src/expeditions/attaque.ts), le combat
// se règle par la simple somme des forces (US-0905), sans règle de taille ni hasard : la Bête, plus forte que l'escorte,
// l'emporte toujours, et l'escorte perd une part de ses Bêtes qui grandit avec l'écart des forces. Seules les Bêtes de
// l'escorte subissent des pertes ; la Bête sauvage n'en subit aucune et reste sur sa Case. Le combat s'applique en base
// à l'instant de l'attaque (src/expeditions/pertes.ts). US-0951 : parmi les pertes, une part ne sont que des Blessés.
// Côté serveur comme dans le navigateur.
import { PART_DES_BLESSES, PERTES_PAR_ECART_DES_FORCES } from "@/reglages";
import { forceDeLEscorte } from "./force";

/** US-0944 : les Bêtes d'une Espèce de l'escorte au moment du combat : la force d'une d'elles (US-0905) et leur nombre. */
export type EspeceAuCombat = { especeId: string; force: number; nombre: number };

/** US-0944 : les Bêtes qu'une Espèce de l'escorte perd au combat. */
export type Perte = { especeId: string; nombre: number };

/**
 * US-0944 : la part de l'escorte, de 0 à 1, que perd au combat une escorte de force `escorte` face à une Bête de force
 * `bete` : l'écart des forces rapporté à la force de la Bête, multiplié par PERTES_PAR_ECART_DES_FORCES, jusqu'à toute
 * l'escorte ; rien pour une escorte au moins aussi forte qu'elle.
 */
export function partPerdue(bete: number, escorte: number): number {
  if (escorte >= bete) return 0;
  return Math.min(1, (PERTES_PAR_ECART_DES_FORCES * (bete - escorte)) / bete);
}

/**
 * US-0944 : les Bêtes que perd au combat l'escorte `escorte` face à une Bête de force `bete`, Espèce par Espèce, dans
 * l'ordre des Espèces, sans celles qui ne perdent rien. La part perdue (partPerdue) de toute l'escorte, arrondie au-dessus :
 * plus forte, la Bête l'emporte toujours, et l'escorte y perd au moins une Bête. Chaque Espèce en perd au prorata de son
 * nombre ; les Bêtes qui restent à répartir vont aux plus grands restes, et à égalité à l'Espèce la plus faible, puis
 * dans l'ordre des Espèces (décidé pour US-0944). Rien sans escorte.
 */
export function pertesDuCombat(bete: number, escorte: readonly EspeceAuCombat[]): Perte[] {
  const especes = escorte.filter((e) => e.nombre > 0);
  const total = especes.reduce((n, e) => n + e.nombre, 0);
  const part = partPerdue(bete, forceDeLEscorte(especes));
  if (total === 0 || part === 0) return [];
  // Un millionième de Bête de tolérance : 0,1 × 10 Bêtes en font une, pas deux.
  const perdues = Math.min(total, Math.ceil(part * total - 1e-6));
  // Les parts et leurs restes en entiers, rapportés au total : deux restes égaux le restent, sans bruit de virgule.
  const parts = especes.map((e) => ({ ...e, entieres: Math.floor((perdues * e.nombre) / total), reste: (perdues * e.nombre) % total }));
  const pertes = new Map(parts.map((e) => [e.especeId, e.entieres]));
  const restantes = perdues - parts.reduce((n, e) => n + e.entieres, 0);
  const ordre = [...parts].sort((a, b) => b.reste - a.reste || a.force - b.force || (a.especeId < b.especeId ? -1 : 1));
  for (const e of ordre.slice(0, restantes)) pertes.set(e.especeId, pertes.get(e.especeId)! + 1);
  return [...pertes]
    .filter(([, nombre]) => nombre > 0)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([especeId, nombre]) => ({ especeId, nombre }));
}

/**
 * US-0951 : combien des `nombre` Bêtes qu'une Espèce de l'escorte perd au combat ne sont que blessées : la part
 * PART_DES_BLESSES, arrondie au plus proche, la demie revenant aux Blessés, sans tirage au sort (décidé pour US-0951) : une
 * seule Bête perdue n'est que blessée. Les autres meurent.
 */
export function blessesParmi(nombre: number): number {
  // Un millionième de Bête de tolérance, comme pour les pertes : 0,5 × 1 Bête fait bien une demie.
  return Math.min(nombre, Math.floor(PART_DES_BLESSES * nombre + 0.5 + 1e-6));
}

/**
 * US-0944 : combien de mâles et de femelles quittent l'effectif d'une Espèce (`effectif`, ses mâles et ses femelles)
 * quand l'escorte en perd `nombre` : l'escorte ne choisit pas le sexe (US-0937), chaque Bête perdue est donc prise au sexe
 * le plus nombreux, un mâle à égalité (décidé pour US-0944) ; jamais plus que l'effectif n'en compte.
 */
export function sexesDesPertes(effectif: { males: number; femelles: number }, nombre: number): { males: number; femelles: number } {
  const reste = { ...effectif };
  const perdues = { males: 0, femelles: 0 };
  for (let i = 0; i < nombre && reste.males + reste.femelles > 0; i++) {
    const cle = reste.males >= reste.femelles ? "males" : "femelles";
    reste[cle]--;
    perdues[cle]++;
  }
  return perdues;
}
