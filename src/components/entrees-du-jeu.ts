/**
 * Les pages du jeu qu'on ouvre depuis la navigation, dans leur ordre ; la carte du Monde juste après le Foyer (US-0417).
 * US-0901 : puis l'écran d'Expédition, le même que depuis la fiche d'une Case, sans destination choisie. US-0911 : son
 * entrée vaut pour toutes les pages des Expéditions (`section`), la liste des Expéditions en cours comprise. US-0801 :
 * puis la Réserve, le lieu protégé où vivent les Couples.
 *
 * Chacune a son médaillon, une illustration peinte du jeu : la hutte du chef pour le Foyer (`hutte` : recadrée sur
 * elle), le Monde pour la Carte, la carte roulée et sa boussole de l'explorateur pour les Expéditions, la houlette et
 * le nid de l'éleveur pour la Réserve, un Habitant, et la tablette et sa plume pour les Récits.
 *
 * US-0810 : une page qu'on n'ouvre que depuis une autre (`aussi`) marque l'entrée de celle-ci : la page Bêtes, qu'ouvre
 * le bloc « Bêtes » du Foyer, marque le Foyer.
 */
export type EntreeDuJeu = { chemin: string; section?: string; aussi?: readonly string[]; libelle: string; icone: string; hutte?: boolean };

export const PAGE_HABITANTS = "/jeu/habitants";
export const PAGE_RECITS = "/jeu/recits";
export const PAGE_CARTE = "/jeu/carte";

export const ENTREES_DU_JEU: readonly EntreeDuJeu[] = [
  { chemin: "/jeu", aussi: ["/jeu/betes"], libelle: "Foyer", icone: "/illustrations/foyer/prairie.webp", hutte: true },
  { chemin: PAGE_CARTE, libelle: "Carte", icone: "/illustrations/prototype/misc/world.webp" },
  { chemin: "/jeu/expeditions/nouvelle", section: "/jeu/expeditions", libelle: "Expéditions", icone: "/illustrations/metiers/explorateur.webp" },
  { chemin: "/jeu/reserve", libelle: "Réserve", icone: "/illustrations/metiers/eleveur.webp" },
  { chemin: PAGE_HABITANTS, libelle: "Habitants", icone: "/illustrations/icones/habitants.webp" },
  { chemin: PAGE_RECITS, libelle: "Récits", icone: "/illustrations/metiers/chercheur.webp" },
];

/** L'entrée de la page affichée : « /jeu » pour le Foyer seul, une autre entrée pour ses pages filles aussi. */
export function estOuverte(chemin: string, page: string): boolean {
  if (chemin === "/jeu") return page === chemin;
  return page === chemin || page.startsWith(`${chemin}/`);
}

/** L'entrée `entree` est-elle celle de la page affichée : sa section, ou une des pages qu'on n'ouvre que depuis elle. */
export function entreeOuverte(entree: EntreeDuJeu, page: string): boolean {
  return estOuverte(entree.section ?? entree.chemin, page) || (entree.aussi ?? []).some((autre) => estOuverte(autre, page));
}
