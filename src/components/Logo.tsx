import Link from "next/link";
import { LOUP_TETE, LOUP_VIEWBOX, LOUP_YEUX } from "./loup";
import styles from "./Logo.module.css";

/**
 * Le logo du loup, qui ramène à l'accueil : le blason (la tête citron sur son rond d'Encre cerclé de cuivre) et, hors du
 * jeu, « BESTIA » à côté. Dessiné en vecteur : net sur tous les écrans.
 */
export function Logo() {
  return (
    <Link href="/" className={styles.logo} aria-label="Bestia">
      <span className={styles.blason}>
        <svg viewBox={LOUP_VIEWBOX} className={styles.loup} aria-hidden="true" focusable="false">
          <path className={styles.tete} d={LOUP_TETE} />
          <path className={styles.yeux} d={LOUP_YEUX} />
        </svg>
      </span>
      <span className={styles.nom} aria-hidden="true">
        Bestia
      </span>
    </Link>
  );
}
