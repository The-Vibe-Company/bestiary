import type { CSSProperties, ReactNode } from "react";
import { Illustration } from "./Illustration";
import kit from "./kit.module.css";
import styles from "./PageEntree.module.css";

type PageEntreeProps = {
  /** La grande illustration, sous public/illustrations ; son cadrage (object-position), par exemple « 22% 50% ». */
  illustration: { chemin: string; alt: string; cadrage?: string };
  /** Le titre de la page ; sans titre, le contenu pose le sien avec TitreEntree (il peut alors changer). */
  titre?: string;
  children: ReactNode;
};

/** L'action d'une page d'entrée (« Se connecter », « Créer mon compte », « Entrer dans mon Foyer ») : le cuivre plein du
 *  kit, sur toute la largeur du panneau. */
export const BOUTON_ENTREE = [kit.bouton, kit.principal, kit.large].join(" ");

/** Le grand titre d'une page d'entrée, pour un contenu qui le change en cours de route. */
export function TitreEntree({ children }: { children: ReactNode }) {
  return <h1 className={styles.titre}>{children}</h1>;
}

/**
 * L'habillage des pages d'entrée du jeu (connexion, inscription et leurs suites, nom de chef, récit d'arrivée) : un
 * panneau orné posé sur la sarcelle, la peinture à gauche, fondue dans le panneau vers la droite, la devise du jeu à son
 * pied ; le titre en Marcellus et le formulaire à droite. Sur un téléphone, la peinture en tête du panneau, fondue vers
 * le bas, le titre posé sur son pied.
 */
export function PageEntree({ illustration, titre, children }: PageEntreeProps) {
  return (
    <main className={styles.page} data-entree="">
      <div className={`${kit.panneau} ${styles.panneau}`}>
        <div className={styles.image} style={illustration.cadrage ? ({ "--cadrage": illustration.cadrage } as CSSProperties) : undefined}>
          <Illustration
            chemin={illustration.chemin}
            alt={illustration.alt}
            sizes="(max-width: 820px) 100vw, 500px"
            prioritaire
            className={styles.peinture}
          />
          <p className={styles.devise} aria-hidden="true">
            Un monde sauvage, des bêtes à apprivoiser.
          </p>
        </div>
        <section className={styles.contenu}>
          {titre ? <TitreEntree>{titre}</TitreEntree> : null}
          {children}
        </section>
      </div>
    </main>
  );
}
