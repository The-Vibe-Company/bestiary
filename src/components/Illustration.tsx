"use client";

import Image from "next/image";
import { useState } from "react";
import { LOUP_TETE, LOUP_VIEWBOX } from "./loup";
import styles from "./Illustration.module.css";

type IllustrationProps = {
  /** Chemin sous public/illustrations, par exemple « prototype/biomes/forest-1.webp ». Sans chemin, la tête de loup. */
  chemin: string | null;
  alt: string;
  /** Rapport largeur / hauteur du cadre, par exemple « 3 / 2 ». Sans rapport, le cadre prend la taille que lui donne sa classe. */
  ratio?: string;
  /** La largeur affichée selon l'écran, pour charger la bonne taille (voir next/image). */
  sizes?: string;
  /** La peinture principale de l'écran, visible sans défiler : chargée tout de suite, avant le reste. */
  prioritaire?: boolean;
  className?: string;
};

/**
 * Une illustration du jeu : servie par Next dans un format léger (AVIF ou WebP) et à la
 * taille de l'écran. Si elle manque ou ne se charge pas, la tête de loup la remplace.
 */
export function Illustration({ chemin, alt, ratio, sizes = "100vw", prioritaire, className }: IllustrationProps) {
  const [echec, setEchec] = useState(false);
  const manquante = !chemin || echec;
  const classes = [styles.cadre, manquante && styles.remplacement, className].filter(Boolean).join(" ");
  return (
    <div
      className={classes}
      style={ratio ? { aspectRatio: ratio } : undefined}
      role={manquante ? "img" : undefined}
      aria-label={manquante ? alt : undefined}
    >
      {manquante ? (
        <IllustrationManquante />
      ) : (
        <Image
          src={`/illustrations/${chemin}`}
          alt={alt}
          fill
          sizes={sizes}
          loading={prioritaire ? "eager" : "lazy"}
          fetchPriority={prioritaire ? "high" : undefined}
          className={styles.image}
          onError={() => setEchec(true)}
        />
      )}
    </div>
  );
}

export function IllustrationManquante() {
  return (
    <svg viewBox={LOUP_VIEWBOX} aria-hidden="true" focusable="false">
      <path d={LOUP_TETE} />
    </svg>
  );
}
