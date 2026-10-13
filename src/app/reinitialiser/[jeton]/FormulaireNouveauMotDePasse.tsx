"use client";

import { useActionState, useState, type FormEvent } from "react";
import { REGLE_MOT_DE_PASSE, verifierMotDePasse } from "@/comptes/mot-de-passe";
import { BOUTON_ENTREE, TitreEntree } from "@/components/PageEntree";
import { MOT_DE_PASSE_MAX, MOT_DE_PASSE_MIN } from "@/reglages";
import { ChampMotDePasse } from "../../ChampMotDePasse";
import styles from "../../entree.module.css";
import { ETAT_NOUVEAU_INITIAL, type EtatNouveauMotDePasse } from "./etat";
import { LienHorsService } from "./LienHorsService";

type Props = {
  /** L'adresse du compte, pour que le gestionnaire de mots de passe mette à jour la bonne fiche. */
  email: string;
  choisir: (precedent: EtatNouveauMotDePasse, donnees: FormData) => Promise<EtatNouveauMotDePasse>;
};

/**
 * Le nouveau mot de passe (US-0128), avec les règles et l'œil de l'inscription. Si le lien ne sert
 * plus au moment de l'envoi, la raison prend la place du formulaire, titre compris (US-0129).
 */
export function FormulaireNouveauMotDePasse({ email, choisir }: Props) {
  const [etat, envoyer, enAttente] = useActionState(choisir, ETAT_NOUVEAU_INITIAL);
  const [motDePasse, setMotDePasse] = useState("");
  const [visible, setVisible] = useState(false);
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);

  if (etat.lien) return <LienHorsService raison={etat.lien} />;

  const erreur = erreurLocale ?? etat.erreur ?? null;
  function verifierAvantEnvoi(evenement: FormEvent<HTMLFormElement>) {
    const message = verifierMotDePasse(motDePasse);
    if (message) {
      evenement.preventDefault();
      setErreurLocale(message);
      return;
    }
    setVisible(false);
  }

  return (
    <>
      <TitreEntree>Nouveau mot de passe</TitreEntree>
      <form action={envoyer} onSubmit={verifierAvantEnvoi} className={styles.formulaire} noValidate>
        {/* Invisible : l'identifiant que le gestionnaire de mots de passe associe au nouveau mot de passe. */}
        <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
        <div className={styles.champ}>
          <label htmlFor="mot-de-passe">Mot de passe</label>
          <ChampMotDePasse
            id="mot-de-passe"
            name="motDePasse"
            autoComplete="new-password"
            minLength={MOT_DE_PASSE_MIN}
            {...{ passwordrules: `minlength: ${MOT_DE_PASSE_MIN}; maxlength: ${MOT_DE_PASSE_MAX};` }}
            required
            value={motDePasse}
            onChange={(e) => {
              setMotDePasse(e.target.value);
              setErreurLocale(null);
            }}
            onBlur={() => setErreurLocale(verifierMotDePasse(motDePasse))}
            aria-invalid={erreur ? true : undefined}
            aria-describedby="mot-de-passe-aide"
            visible={visible}
            basculer={() => setVisible((v) => !v)}
          />
          {erreur ? (
            <p id="mot-de-passe-aide" className={styles.erreur} role="alert">
              {erreur}
            </p>
          ) : (
            <p id="mot-de-passe-aide" className={styles.aide}>
              {REGLE_MOT_DE_PASSE}
            </p>
          )}
        </div>
        <button type="submit" className={`${BOUTON_ENTREE} ${styles.envoyer}`} disabled={enAttente}>
          {enAttente ? (
            <>
              <span className={styles.roue} aria-hidden="true" />
              Changement…
            </>
          ) : (
            "Changer mon mot de passe"
          )}
        </button>
      </form>
    </>
  );
}
