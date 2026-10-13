import type { CSSProperties, ReactNode } from "react";
import styles from "./Bloc.module.css";

export type Largeur = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** Les fonds du prototype, pour les pages de contrôle : un pastel (titre dans son ton foncé) ou l'Encre (titre citron). */
export type Teinte = "menthe" | "sable" | "lilas" | "ciel" | "rose" | "sarcelle" | "peche" | "citron" | "encre";

type BlocProps = {
  /** Le titre du panneau, facultatif : une petite étiquette de cuivre en capitales (« RÉCAPITULATIF »). */
  titre?: ReactNode;
  /** Le titre en Marcellus, plus grand, pour un panneau qui porte le nom de l'écran (« Habitants »). */
  serif?: boolean;
  /** À droite du titre, sur sa rangée : un lien ou un petit bouton (« Historique »). */
  action?: ReactNode;
  /** Le verre : posé sur une peinture (le Foyer, la carte), il la laisse deviner dessous. */
  verre?: boolean;
  /** Le contenu touche les bords, pour une illustration. */
  plein?: boolean;
  /** Dans une Grille : le nombre de colonnes occupées sur ordinateur, sur 12 (toutes par défaut). */
  largeur?: Largeur;
  /** Un fond de couleur, pour les pages de contrôle. */
  teinte?: Teinte;
  className?: string;
  children: ReactNode;
};

/**
 * Le panneau orné, la brique de chaque écran : un filet de cuivre, les quatre petits coins de cuivre, une lumière à
 * peine visible en haut ; son titre en petite étiquette de cuivre, ou en Marcellus (serif), avec à sa droite une action.
 * Il prend les couleurs de l'écran où il est posé : la sarcelle dans le jeu, le papier hors du jeu (globals.css).
 */
export function Bloc({ titre, serif = false, action, verre = false, plein = false, largeur, teinte, className, children }: BlocProps) {
  const classes = [styles.bloc, verre && styles.verre, plein && styles.plein, teinte && styles[teinte], className].filter(Boolean).join(" ");
  const place = largeur ? ({ "--largeur": largeur } as CSSProperties) : undefined;
  const enTete = titre ? <h2 className={serif ? styles.titreServif : styles.titre}>{titre}</h2> : null;
  return (
    <section className={classes} style={place} data-etroit={largeur && largeur <= 6 ? "" : undefined}>
      {action ? (
        <div className={styles.enTete}>
          {enTete}
          {action}
        </div>
      ) : (
        enTete
      )}
      {children}
    </section>
  );
}
