import { Illustration } from "./Illustration";

/**
 * Les formats d'une illustration d'Espèce : en grand sur sa fiche (US-0803 : moins de la moitié
 * de la hauteur d'un téléphone couché, toute la largeur d'un téléphone tenu droit, 55 % de la
 * fiche ensuite, 480 px au plus), en vignette dans une
 * liste ; US-0958 : en moyen dans l'annonce d'un Couple réuni, de toute la largeur d'un
 * téléphone en portrait, 220 px au plus ailleurs ; US-0802 : en paire, les deux Bêtes d'un
 * Couple côte à côte dans la Réserve, près de la moitié de l'écran tant qu'une carte y prend
 * toute la largeur ; US-0810 : en carte, une Espèce de l'effectif sur la page Bêtes, deux par
 * ligne sur un téléphone, 260 px au plus ailleurs. L'optimiseur de Next sert à chaque format
 * la taille qu'il affiche.
 */
export const FORMATS_ESPECE = {
  grand: "(max-height: 500px) and (orientation: landscape) 50vh, (max-width: 600px) and (orientation: portrait) 100vw, (max-width: 960px) 55vw, 480px",
  moyen: "(max-width: 540px) and (orientation: portrait) 100vw, 220px",
  vignette: "96px",
  paire: "(max-width: 440px) 45vw, 130px",
  carte: "(max-width: 820px) 50vw, 260px",
} as const;

type IllustrationEspeceProps = {
  espece: { nom: string; illustration: string | null };
  format: keyof typeof FORMATS_ESPECE;
  className?: string;
};

/** Le portrait carré d'une Espèce ; sans illustration, la tête de loup le remplace. */
export function IllustrationEspece({ espece, format, className }: IllustrationEspeceProps) {
  return <Illustration chemin={espece.illustration} alt={espece.nom} ratio="1 / 1" sizes={FORMATS_ESPECE[format]} className={className} />;
}
