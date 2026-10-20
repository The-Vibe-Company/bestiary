// Ce qu'apportent les Éclaireurs d'une Expédition (US-0976), d'après leur nombre, toutes Espèces ensemble, fixé au départ :
// le brouillard levé plus loin (US-0969, src/expeditions/brouillard.ts) et les Bêtes gardées en vue plus longtemps
// (US-0970, src/expeditions/vue-des-eclaireurs.ts). Des règles pures, sans base : côté serveur comme dans le navigateur,
// où le récapitulatif de l'écran d'Expédition les annonce avant le départ (US-0971).
import {
  BROUILLARD_LEVE_PAR_ECLAIREUR_CASES,
  BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES,
  MINUTES_DE_VUE_AU_PLUS,
  MINUTES_DE_VUE_PAR_ECLAIREUR,
} from "@/reglages";

/**
 * US-0969 : de combien de Cases `eclaireurs` Éclaireurs agrandissent le rayon du brouillard qu'une Expédition lève, sur
 * son chemin comme autour de sa destination : BROUILLARD_LEVE_PAR_ECLAIREUR_CASES par Éclaireur, jusqu'à
 * BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES. Aucune sans Éclaireur.
 */
export function rayonDesEclaireurs(eclaireurs: number): number {
  return Math.min(Math.max(0, eclaireurs) * BROUILLARD_LEVE_PAR_ECLAIREUR_CASES, BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES);
}

/**
 * US-0970 : combien de millisecondes du jeu `eclaireurs` Éclaireurs gardent en vue une Bête après la fin de sa durée :
 * MINUTES_DE_VUE_PAR_ECLAIREUR chacun, jusqu'à MINUTES_DE_VUE_AU_PLUS ; aucune sans Éclaireur.
 */
export function vueProlongee(eclaireurs: number): number {
  return Math.min(Math.max(eclaireurs, 0) * MINUTES_DE_VUE_PAR_ECLAIREUR, MINUTES_DE_VUE_AU_PLUS) * 60_000;
}
