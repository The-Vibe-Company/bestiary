// Le Récit d'un Élevage fini (US-0817) : une note courte sur la page Récits, datée de la dernière naissance, qui dit
// combien de Bêtes de l'Espèce ont rejoint l'effectif. Côté serveur comme dans le navigateur, qui le reconnaît à son titre.
import type { NouveauRecit } from "./recits";

/**
 * « de Poule », « d'Aigle » : l'élision devant une voyelle. Pas devant un h, aspiré dans la plupart des noms de Bêtes
 * (« de Hibou », « de Héron »).
 */
const de = (nom: string) => (/^[aeiouyàâäéèêëîïôöùûüœæ]/i.test(nom) ? `d'${nom}` : `de ${nom}`);

/** US-0817 : le titre d'un Récit de fin d'Élevage, à quoi la page Récits le reconnaît (son médaillon : l'éleveur). */
export const FIN_D_ELEVAGE = "Élevage terminé";

/**
 * US-0817 : le Récit de la fin d'un Élevage de `nombre` Bêtes de l'Espèce `espece` (son nom), à l'instant du jeu
 * `instant`, celui de sa dernière naissance : « 3 Bêtes de Poule ont rejoint votre effectif. » ; une seule :
 * « 1 Bête de Poule a rejoint votre effectif. ».
 */
export function recitDElevage(nombre: number, espece: string, instant: Date): NouveauRecit {
  const combien = new Intl.NumberFormat("fr-FR").format(nombre).replace(/\s/g, " ");
  const texte = nombre > 1 ? `${combien} Bêtes ${de(espece)} ont rejoint votre effectif.` : `${combien} Bête ${de(espece)} a rejoint votre effectif.`;
  return { titre: FIN_D_ELEVAGE, texte, survenuLe: instant };
}
