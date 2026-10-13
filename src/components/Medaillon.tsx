import Image from "next/image";
import type { CSSProperties } from "react";
import styles from "./Medaillon.module.css";

/** Les tailles d'un médaillon, en pixels : xs dans un bouton ou une puce, sm dans la barre, md dans une ligne, lg sur un
 *  écriteau, xl en tête d'un panneau. */
export const TAILLES_DE_MEDAILLON = { xs: 20, sm: 28, md: 34, lg: 44, xl: 56 } as const;
export type TailleDeMedaillon = keyof typeof TAILLES_DE_MEDAILLON;

type MedaillonProps = {
  /** L'illustration, sous public/ (« /illustrations/metiers/chasseur.webp ») ; sans elle, un emplacement vide. */
  src?: string;
  /** Le texte de l'image, quand elle dit quelque chose que rien d'autre ne dit ; vide (par défaut), elle ne sert qu'aux yeux. */
  alt?: string;
  taille?: TailleDeMedaillon;
  /** Une peinture qui remplit le rond (le Monde, une Bête, un lieu), au lieu d'une icône posée sur le disque crème. */
  plein?: boolean;
  /** Le cadrage d'une peinture pleine (object-position), par exemple « 50% 30% ». */
  cadrage?: string;
  /** L'anneau de cuivre vif et sa lueur : le médaillon de ce qui est choisi, ou de l'action du jeu. */
  vif?: boolean;
  className?: string;
};

/**
 * Le médaillon peint : une icône du jeu (détourée sur blanc) posée sur son disque crème, fondue dedans, l'anneau de
 * cuivre autour. « plein » pour une peinture qui remplit le rond ; sans `src`, l'emplacement vide, un rond pointillé
 * (un Habitant sans Métier, une place d'escorte libre). Il ne sert qu'aux yeux tant qu'il n'a pas de texte (`alt`).
 */
export function Medaillon({ src, alt = "", taille = "md", plein = false, cadrage, vif = false, className }: MedaillonProps) {
  const px = TAILLES_DE_MEDAILLON[taille];
  const classes = [styles.medaillon, styles[taille], !src && styles.vide, plein && styles.plein, vif && styles.vif, className].filter(Boolean).join(" ");
  if (!src) return <span className={classes} aria-hidden="true" />;
  return (
    <span className={classes} aria-hidden={alt ? undefined : true}>
      <Image src={src} alt={alt} width={px} height={px} className={styles.image} style={cadrage ? ({ objectPosition: cadrage } as CSSProperties) : undefined} />
    </span>
  );
}
