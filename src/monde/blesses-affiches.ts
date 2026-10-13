// Les Blessés au Foyer tels que les pages les montrent (US-0952) : la page Bêtes, et le bloc Escorte de l'écran
// d'Expédition. Côté serveur comme dans le navigateur.
import { formaterMinutes } from "@/temps/affichage";
import type { GroupeDeBlesses } from "./blesses";

/**
 * US-0952 : un groupe de Blessés d'une Espèce au Foyer : combien, et dans combien de minutes du jeu ils seront guéris.
 * US-0955 : `soignes`, soignés à leur retour ; absent sinon.
 */
export type BlessesAffiches = { nombre: number; dansMinutes: number; soignes?: true };

/**
 * US-0952 : les groupes de Blessés d'une Espèce (blessesAuFoyer), dans le même ordre, tels qu'une page les montre à l'heure
 * du jeu `instant` : le temps avant guérison à la minute supérieure, et jamais plus de `plafond` Blessés en tout, les
 * derniers à guérir retranchés les premiers ; aucun groupe vide.
 */
export function blessesAffiches(groupes: readonly GroupeDeBlesses[], instant: Date, plafond: number): BlessesAffiches[] {
  let reste = plafond;
  return groupes.flatMap(({ nombre, gueriLe, soignes }) => {
    const montres = Math.min(nombre, reste);
    reste -= montres;
    const dansMinutes = Math.ceil((gueriLe.getTime() - instant.getTime()) / 60_000);
    return montres > 0 ? [{ nombre: montres, dansMinutes, ...(soignes && { soignes }) }] : [];
  });
}

/**
 * US-0952 : « 3 Blessés, guéris dans 5 h », « 1 Blessé, guéri dans 45 min » ; US-0955 : « 2 Blessés soignés, guéris dans
 * 11 h ».
 */
export const blessesDans = ({ nombre, dansMinutes, soignes }: BlessesAffiches) => {
  const s = nombre > 1 ? "s" : "";
  return `${nombre} Blessé${s}${soignes ? ` soigné${s}` : ""}, guéri${s} dans ${formaterMinutes(dansMinutes)}`;
};
