"use client";

import { useActionState } from "react";
import { JEU_INJOIGNABLE } from "@/app/inscription/etat";
import { BOUTON_ENTREE } from "@/components/PageEntree";
import styles from "../../entree.module.css";

type Etat = "pret" | "parti" | "injoignable";

/** Le bouton « Recevoir un nouveau lien » d'un lien expiré (US-0114). */
export function NouveauLien({ demander }: { demander: () => Promise<void> }) {
  const [etat, envoyer, enAttente] = useActionState<Etat>(async () => {
    try {
      await demander();
      return "parti";
    } catch {
      return "injoignable";
    }
  }, "pret");

  if (etat === "parti") {
    return (
      <p className={styles.texte} role="status">
        Un nouveau lien vient de partir. Pensez à regarder aussi dans les indésirables.
      </p>
    );
  }
  return (
    <form action={envoyer} className={styles.formulaire}>
      {etat === "injoignable" ? (
        <p className={styles.erreurGenerale} role="alert">
          {JEU_INJOIGNABLE}
        </p>
      ) : null}
      <button type="submit" className={`${BOUTON_ENTREE} ${styles.envoyer}`} disabled={enAttente}>
        {enAttente ? (
          <>
            <span className={styles.roue} aria-hidden="true" />
            Envoi…
          </>
        ) : (
          "Recevoir un nouveau lien"
        )}
      </button>
    </form>
  );
}
