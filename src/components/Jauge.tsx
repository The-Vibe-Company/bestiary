import type { CSSProperties } from "react";
import styles from "./Jauge.module.css";

type JaugeProps = {
  /** Où en est la jauge. */
  valeur: number;
  /** Ce qui la remplit toute (une limite, des places). */
  max: number;
  /** Fine (4 px) sous une ligne, au lieu de la barre épaisse (12 px) d'un panneau. */
  fine?: boolean;
  /** Une case par unité (« 24 Habitants sur 26 places »), tant qu'elles tiennent : 40 au plus. */
  cases?: boolean;
  /** Remplie de droite à gauche : ce qui reste (le temps avant le départ d'un Voyageur). */
  inverse?: boolean;
  className?: string;
};

/** Au-delà, les cases deviennent trop fines : la jauge redevient une barre. */
const CASES_AU_PLUS = 40;

/**
 * La jauge de cuivre : un creux au filet de cuivre, rempli d'un cuivre plus clair en haut. Pleine au-delà de son max,
 * elle se raye de braise (une place prise de trop, un Stock qui déborde). En cases, une par unité, la dernière prise
 * marquée. Elle ne sert qu'aux yeux : la page dit le nombre en texte à côté.
 */
export function Jauge({ valeur, max, fine = false, cases = false, inverse = false, className }: JaugeProps) {
  const trop = valeur > max;
  const part = max > 0 ? Math.max(0, Math.min(1, valeur / max)) : 0;
  if (cases && max > 0 && max <= CASES_AU_PLUS) {
    const total = Math.max(max, Math.min(valeur, CASES_AU_PLUS));
    return (
      <span className={[styles.cases, className].filter(Boolean).join(" ")} style={{ "--cases": total } as CSSProperties} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < valeur ? (i >= max ? styles.caseDeTrop : styles.casePrise) : undefined} />
        ))}
      </span>
    );
  }
  const classes = [styles.jauge, fine && styles.fine, trop && styles.trop, inverse && styles.inverse, className].filter(Boolean).join(" ");
  return (
    <span className={classes} aria-hidden="true">
      <i className={styles.remplissage} style={{ "--part": `${(trop ? 1 : part) * 100}%` } as CSSProperties} />
    </span>
  );
}
