import type { ReactNode } from "react";
import styles from "./Etat.module.css";

type EtatProps = {
  /** Où en est un Habitant : libre au Foyer, ou parti en Expédition. */
  etat: "libre" | "expedition";
  /** Le mot, tel que le jeu le dit (« libre », « en Expédition ») ; à défaut, ce mot-là. */
  children?: ReactNode;
  className?: string;
};

const MOTS = { libre: "libre", expedition: "en Expédition" } as const;

/**
 * L'état d'un Habitant, un point devant son mot : « libre », un point de feuille cerclé de son halo, le mot en mousse ;
 * « en Expédition », un point de cuivre clair qui luit, le mot en cuivre. Le mot le dit toujours : jamais la couleur seule.
 */
export function Etat({ etat, children, className }: EtatProps) {
  return (
    <span className={[styles.etat, styles[etat], className].filter(Boolean).join(" ")}>
      <i className={styles.point} aria-hidden="true" />
      {children ?? MOTS[etat]}
    </span>
  );
}
