"use client";

import kit from "@/components/kit.module.css";
import etats from "./etats.module.css";
import styles from "./page.module.css";

/**
 * US-0434 : si la carte n'a pas pu s'afficher (sa lecture a échoué), un panneau de verre au milieu de sa place, sur la
 * mer du soir, le dit, avec de quoi réessayer : la page relit alors la carte, sans recharger le reste.
 */
export default function ErreurDeLaCarte({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className={styles.page} data-carte="">
      <h1 className={styles.annonce}>Carte</h1>
      <div className={etats.erreur}>
        <section className={`${kit.panneau} ${kit.verre} ${etats.etat}`}>
          <p role="alert" className={etats.texte}>
            La carte n&apos;a pas pu s&apos;afficher.
          </p>
          <button type="button" className={`${kit.bouton} ${kit.principal} ${kit.grand}`} onClick={() => retry()}>
            Réessayer
          </button>
        </section>
      </div>
    </main>
  );
}
