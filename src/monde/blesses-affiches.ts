// Les Blessés au Foyer tels que les pages les montrent (US-0952) : la page Bêtes, et le bloc Escorte de l'écran
// d'Expédition. Côté serveur comme dans le navigateur.
import { formaterMinutes } from "@/temps/affichage";
import type { GroupeDeBlesses } from "./blesses";

/** US-0952 : un groupe de Blessés d'une Espèce au Foyer : combien, et dans combien de minutes du jeu ils seront guéris. */
export type BlessesAffiches = { nombre: number; dansMinutes: number };

/**
 * US-0952 : les groupes de Blessés d'une Espèce (blessesAuFoyer), dans le même ordre, tels qu'une page les montre à l'heure
 * du jeu `instant` : le temps avant guérison à la minute supérieure, et jamais plus de `plafond` Blessés en tout, les
 * derniers à guérir retranchés les premiers ; aucun groupe vide.
 */
export function blessesAffiches(groupes: readonly GroupeDeBlesses[], instant: Date, plafond: number): BlessesAffiches[] {
  let reste = plafond;
  return groupes.flatMap(({ nombre, gueriLe }) => {
    const montres = Math.min(nombre, reste);
    reste -= montres;
    return montres > 0 ? [{ nombre: montres, dansMinutes: Math.ceil((gueriLe.getTime() - instant.getTime()) / 60_000) }] : [];
  });
}

/** US-0952 : « 3 Blessés, guéris dans 5 h », « 1 Blessé, guéri dans 45 min ». */
export const blessesDans = ({ nombre, dansMinutes }: BlessesAffiches) =>
  `${nombre} Blessé${nombre > 1 ? "s" : ""}, guéri${nombre > 1 ? "s" : ""} dans ${formaterMinutes(dansMinutes)}`;
