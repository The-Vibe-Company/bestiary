// Le suivi d'un Élevage en cours (US-0818) : où il en est à une heure du jeu, lu de son lancement, de sa quantité et de
// la durée d'Élevage d'une Bête, comme ses naissances (src/monde/naissances.ts) : rien d'autre ne se retient. US-0819 :
// et la file d'un éleveur, les Élevages qui suivront celui en cours, chacun lancé à la fin du précédent (laFile). Côté
// serveur comme dans le navigateur, où l'heure du jeu avance (useHeureDuJeu).
import { ELEVAGES_PAR_FILE_AU_PLUS } from "@/reglages";
import { formaterMinutes } from "@/temps/affichage";

const MINUTE_MS = 60_000;

/**
 * US-0819 : ce que dit le jeu quand on ajoute un Élevage à une file qui en a déjà ELEVAGES_PAR_FILE_AU_PLUS : le bloc
 * « Élever » sous son bouton grisé, le lancement à toute demande.
 */
export const FILE_PLEINE = `File pleine : ${ELEVAGES_PAR_FILE_AU_PLUS} Élevages au plus.`;

/**
 * US-0818 : un Élevage en cours du Territoire, tel que le bloc « Élever » et l'accueil le suivent (elevagesEnCours) :
 * son Espèce (son nom et son illustration, null : aucune), le prénom de son éleveur (null : il n'est plus là), la
 * quantité demandée, l'instant de son lancement et la durée d'Élevage d'une Bête, fixée au lancement.
 */
export type ElevageEnCours = {
  especeId: string;
  espece: string;
  illustration: string | null;
  eleveur: string | null;
  quantite: number;
  lanceLe: Date;
  dureeMinutes: number;
};

type Naissances = Pick<ElevageEnCours, "quantite" | "lanceLe" | "dureeMinutes">;

/**
 * US-0818 : où en est un Élevage à l'heure du jeu `instant` : ses Bêtes déjà nées (la k-ième naît au lancement plus k
 * fois la durée d'une Bête, jamais plus que la quantité), l'instant de la prochaine naissance (null : toutes sont nées)
 * et celui de la dernière.
 */
export function ouEnEstLElevage({ quantite, lanceLe, dureeMinutes }: Naissances, instant: Date): { nees: number; prochaine: Date | null; derniere: Date } {
  const duree = dureeMinutes * MINUTE_MS;
  const lance = lanceLe.getTime();
  const nees = Math.min(quantite, Math.max(0, Math.floor((instant.getTime() - lance) / duree)));
  return { nees, prochaine: nees < quantite ? new Date(lance + (nees + 1) * duree) : null, derniere: new Date(lance + quantite * duree) };
}

/** US-0818 : l'instant de la prochaine naissance des Élevages `elevages` à l'heure du jeu `instant` ; null sans aucune. */
export function prochaineNaissance(elevages: Naissances[], instant: Date): Date | null {
  const prochaines = elevages.map((elevage) => ouEnEstLElevage(elevage, instant).prochaine?.getTime() ?? Infinity);
  const premiere = Math.min(Infinity, ...prochaines);
  return Number.isFinite(premiere) ? new Date(premiere) : null;
}

/**
 * US-0818 : le temps du jeu avant l'instant `prochaine`, à l'heure du jeu `instant`, arrondi à la minute supérieure comme
 * le temps restant d'une Expédition : « 15 min », « 8 h 20 », jamais « 0 min ».
 */
export const tempsAvant = (prochaine: Date, instant: Date) => formaterMinutes(Math.max(1, Math.ceil((prochaine.getTime() - instant.getTime()) / MINUTE_MS)));

/** US-0819 : l'instant de la fin d'un Élevage, la naissance de sa dernière Bête. */
export const finDeLElevage = ({ quantite, lanceLe, dureeMinutes }: Naissances) => new Date(lanceLe.getTime() + quantite * dureeMinutes * MINUTE_MS);

/**
 * US-0819 : la file des Élevages `elevages` d'une Espèce, tels qu'elevagesEnCours les donne, dans l'ordre : celui en
 * cours (`enCours`, le premier ; null sans aucun), ceux qui le suivront (`suite`), l'instant où la file finit (`fin`,
 * null sans aucun), d'où partira un Élevage ajouté, et si elle est pleine (`pleine`, ELEVAGES_PAR_FILE_AU_PLUS).
 */
export function laFile<E extends Naissances>(elevages: readonly E[]): { enCours: E | null; suite: E[]; fin: Date | null; pleine: boolean } {
  const [enCours = null, ...suite] = elevages;
  const fin = elevages.length > 0 ? new Date(Math.max(...elevages.map((e) => finDeLElevage(e).getTime()))) : null;
  return { enCours, suite, fin, pleine: elevages.length >= ELEVAGES_PAR_FILE_AU_PLUS };
}
