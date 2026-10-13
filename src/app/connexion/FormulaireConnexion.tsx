"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { lireAdresseRetenue, retenirAdresse } from "@/comptes/adresse-retenue";
import { normaliserEmail } from "@/comptes/email";
import { BOUTON_ENTREE } from "@/components/PageEntree";
import { ChampMotDePasse } from "../ChampMotDePasse";
import styles from "../entree.module.css";
import { seConnecter } from "./actions";
import { CONNEXION_REFUSEE, ETAT_CONNEXION_INITIAL, SESSION_EXPIREE } from "./etat";

/**
 * Le formulaire de connexion (US-0115) : l'adresse et le mot de passe, que le navigateur peut
 * remplir avec ce qu'il a enregistré. En arrivant de l'inscription, l'adresse est déjà là (US-0108).
 * Des identifiants justes mènent au jeu (US-0116) ; sinon un message s'affiche et l'adresse reste.
 */
export function FormulaireConnexion({ suite = "/jeu", sessionExpiree = false }: { suite?: string; sessionExpiree?: boolean }) {
  const [etat, envoyer, enAttente] = useActionState(seConnecter, ETAT_CONNEXION_INITIAL);
  const [email, setEmail] = useState("");
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);

  // L'adresse retenue vit dans la mémoire de l'onglet : on ne peut la lire qu'une fois dans le navigateur.
  useEffect(() => {
    const retenue = lireAdresseRetenue();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique d'un état extérieur (sessionStorage)
    if (retenue) setEmail((saisie) => saisie || retenue);
  }, []);

  const retenirLAdresse = () => {
    if (email.trim()) retenirAdresse(normaliserEmail(email));
  };

  return (
    <form action={envoyer} className={styles.formulaire}>
      {/* US-0125 : on arrive d'une page du jeu dont la session a expiré ; le message s'efface au premier refus. */}
      {sessionExpiree && !etat.erreur ? (
        <p className={styles.information} role="status">
          {SESSION_EXPIREE}
        </p>
      ) : null}
      {/* US-0121 : la page du jeu où revenir une fois connecté. */}
      <input type="hidden" name="suite" value={suite} />
      <div className={styles.champ}>
        <label htmlFor="email">Adresse e-mail</label>
        {/* « username » : le navigateur y reconnaît l'identifiant à associer au mot de passe enregistré. */}
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
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className={styles.champ}>
        <label htmlFor="mot-de-passe">Mot de passe</label>
        <ChampMotDePasse
          id="mot-de-passe"
          name="motDePasse"
          autoComplete="current-password"
          required
          visible={motDePasseVisible}
          basculer={() => setMotDePasseVisible((visible) => !visible)}
        />
        {/* US-0126 : l'adresse tapée suit vers la demande de lien. */}
        <Link href="/mot-de-passe-oublie" className={styles.lienDiscret} onClick={retenirLAdresse}>
          Mot de passe oublié ?
        </Link>
      </div>
      {etat.erreur ? (
        <p className={styles.erreurGenerale} role="alert">
          {etat.erreur}
          {etat.erreur === CONNEXION_REFUSEE ? (
            <>
              {" · "}
              <Link href="/mot-de-passe-oublie" className={styles.lienErreur} onClick={retenirLAdresse}>
                Mot de passe oublié ?
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      <button type="submit" className={`${BOUTON_ENTREE} ${styles.envoyer}`} disabled={enAttente}>
        {enAttente ? (
          <>
            <span className={styles.roue} aria-hidden="true" />
            Connexion…
          </>
        ) : (
          "Se connecter"
        )}
      </button>
      <p className={styles.autre}>
        <Link href="/inscription" className={styles.lien}>
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
