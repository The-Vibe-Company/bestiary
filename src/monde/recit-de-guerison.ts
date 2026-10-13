// Le Récit d'une guérison de Blessés (US-0954) : une note à part sur la page Récits, datée de la guérison, qui compte les
// Blessés guéris et les nomme Espèce par Espèce. Côté serveur comme dans le navigateur, qui le reconnaît à son titre.
import type { NouveauRecit } from "./recits";

/** US-0954 : les Blessés guéris d'une Espèce : le nom de l'Espèce et leur nombre. */
export type GuerisonDUneEspece = { nom: string; nombre: number };

/** US-0954 : le titre d'un Récit de guérison, « 1 Blessé a guéri », « 3 Blessés ont guéri », et rien d'autre. */
const TITRE = /^(?:1 Blessé a|\d+ Blessés ont) guéri$/;

/** « Souris grise (2) », « Souris grise (2) et Pigeon biset (1) », « Souris grise (2), Pigeon biset (1) et Poule (4) ». */
function enumerees(guerisons: readonly GuerisonDUneEspece[]): string {
  const especes = guerisons.map(({ nom, nombre }) => `${nom} (${nombre})`);
  return especes.length > 1 ? `${especes.slice(0, -1).join(", ")} et ${especes.at(-1)}` : especes[0];
}

/**
 * US-0954 : le Récit des Blessés guéris à l'instant du jeu `instant`, Espèce par Espèce dans l'ordre donné : « 3 Blessés
 * ont guéri », « De nouveau valides : Pigeon biset (1) et Souris grise (2). » ; un seul : « 1 Blessé a guéri ».
 */
export function recitDeGuerison(guerisons: readonly GuerisonDUneEspece[], instant: Date): NouveauRecit {
  const total = guerisons.reduce((somme, { nombre }) => somme + nombre, 0);
  const plusieurs = total > 1;
  return {
    titre: plusieurs ? `${total} Blessés ont guéri` : "1 Blessé a guéri",
    texte: `De nouveau valide${plusieurs ? "s" : ""} : ${enumerees(guerisons)}.`,
    survenuLe: instant,
  };
}

/** US-0954 : un Récit de guérison se reconnaît à son titre (recitDeGuerison), pour lui donner son médaillon. */
export const estUnRecitDeGuerison = (titre: string) => TITRE.test(titre);
