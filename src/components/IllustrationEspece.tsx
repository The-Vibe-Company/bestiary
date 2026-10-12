import { Illustration } from "./Illustration";

/**
 * Les formats d'une illustration d'Espèce : en grand sur sa fiche, en vignette dans une
 * liste ; US-0958 : en moyen dans l'annonce d'un Couple réuni, de toute la largeur d'un
 * téléphone en portrait, 220 px au plus ailleurs. L'optimiseur de Next sert à chaque format
 * la taille qu'il affiche.
 */
export const FORMATS_ESPECE = {
  grand: "(max-width: 820px) 100vw, 480px",
  moyen: "(max-width: 540px) and (orientation: portrait) 100vw, 220px",
  vignette: "96px",
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
