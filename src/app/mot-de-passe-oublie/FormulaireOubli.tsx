"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { JEU_INJOIGNABLE } from "@/app/inscription/etat";
import { lireAdresseRetenue, retenirAdresse } from "@/comptes/adresse-retenue";
import { normaliserEmail, verifierEmail } from "@/comptes/email";
import { BOUTON_ENTREE } from "@/components/PageEntree";
import { LIEN_REINITIALISATION_MINUTES } from "@/reglages";
import styles from "../entree.module.css";
import { demanderLien } from "./actions";
import { ETAT_OUBLI_INITIAL, LIEN_PEUT_ETRE_PARTI, type EtatOubli } from "./etat";

/** Envoie la demande ; si le jeu ne répond pas, le dit sans détail technique (comme l'inscription). */
async function envoyer(precedent: EtatOubli, donnees: FormData): Promise<EtatOubli> {
  try {
    return await demanderLien(precedent, donnees);
  } catch {
    return { erreur: JEU_INJOIGNABLE, email: String(donnees.get("email") ?? "") };
  }
}

/**
 * « Mot de passe oublié » (US-0126) : l'adresse, et un lien qui part si elle a un compte. La
 * réponse ne dit jamais si l'adresse a un compte. L'adresse tapée à la connexion est reprise.
 */
export function FormulaireOubli() {
  const [etat, demander, enAttente] = useActionState(envoyer, ETAT_OUBLI_INITIAL);
  const [email, setEmail] = useState("");
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);

  useEffect(() => {
    const retenue = lireAdresseRetenue();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique d'un état extérieur (sessionStorage)
    if (retenue) setEmail((saisie) => saisie || retenue);
  }, []);

  if (etat.envoye) {
    return (
      <div className={styles.confirmation} role="status">
        <p className={styles.texte}>{LIEN_PEUT_ETRE_PARTI}</p>
        <p className={styles.aide}>
          Le lien reste valable {LIEN_REINITIALISATION_MINUTES} minutes. Pensez à regarder aussi dans les indésirables.
        </p>
        <Link href="/connexion" className={`${BOUTON_ENTREE} ${styles.envoyer}`} onClick={() => retenirAdresse(normaliserEmail(email))}>
          Revenir à la connexion
        </Link>
      </div>
    );
  }

  const erreur = erreurLocale ?? (etat.erreur && etat.email === email ? etat.erreur : null);
  return (
    <form
      action={demander}
      onSubmit={(e) => {
        const message = verifierEmail(email);
        if (message) {
          e.preventDefault();
          setErreurLocale(message);
        }
      }}
      className={styles.formulaire}
      noValidate
    >
      <p className={styles.texte}>Indiquez l&apos;adresse de votre compte : un lien vous permettra d&apos;en choisir un nouveau.</p>
      <div className={styles.champ}>
        <label htmlFor="email">Adresse e-mail</label>
        <input
          id="email"
          type="email"
          name="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErreurLocale(null);
          }}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? "email-erreur" : undefined}
        />
        {erreur ? (
          <p id="email-erreur" className={styles.erreur} role="alert">
            {erreur}
          </p>
        ) : null}
      </div>
      <button type="submit" className={`${BOUTON_ENTREE} ${styles.envoyer}`} disabled={enAttente}>
        {enAttente ? (
          <>
            <span className={styles.roue} aria-hidden="true" />
            Envoi…
          </>
        ) : (
          "Recevoir un lien"
        )}
      </button>
      <p className={styles.autre}>
        <Link href="/connexion" className={styles.lien}>
          Revenir à la connexion
        </Link>
      </p>
    </form>
  );
}
