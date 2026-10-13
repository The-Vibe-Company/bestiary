"use client";

import kit from "@/components/kit.module.css";
import styles from "./error.module.css";

/**
 * Si une page n'a pas pu se mettre à jour, on le dit plutôt que d'afficher un état périmé : un panneau orné au milieu de
 * l'écran, le titre en Marcellus, de quoi réessayer au cuivre.
 */
export default function Erreur({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className={styles.page} data-entree="">
      <div className={`${kit.panneau} ${styles.panneau}`}>
        <h1 className={styles.titre}>Le Monde n&apos;a pas pu se mettre à jour</h1>
        <p className={styles.texte}>Rien n&apos;est perdu : réessayez dans un instant.</p>
        <button type="button" className={`${kit.bouton} ${kit.principal} ${kit.grand} ${styles.reessayer}`} onClick={() => retry()}>
          Réessayer
        </button>
      </div>
    </main>
  );
}
