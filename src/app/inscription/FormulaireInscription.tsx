"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { retenirAdresse } from "@/comptes/adresse-retenue";
import { EMAIL_DEJA_UTILISEE, normaliserEmail, verifierEmail } from "@/comptes/email";
import { REGLE_MOT_DE_PASSE, verifierMotDePasse } from "@/comptes/mot-de-passe";
import { LOUP_TETE, LOUP_VIEWBOX } from "@/components/loup";
import { BOUTON_ENTREE, TitreEntree } from "@/components/PageEntree";
import { INSCRIPTION_DELAI_MAX_MS, MOT_DE_PASSE_MAX, MOT_DE_PASSE_MIN } from "@/reglages";
import { ChampMotDePasse } from "../ChampMotDePasse";
import styles from "../entree.module.css";
import { inscrire } from "./actions";
import { CHAMP_PIEGE, ETAT_INITIAL, JEU_INJOIGNABLE, type EtatInscription } from "./etat";

/**
 * Le formulaire d'inscription. Le message sous un champ apparaît quand on quitte le champ ou
 * à l'envoi, jamais pendant la frappe ; il s'efface dès qu'on recommence à écrire. Une fois le
 * compte créé, la confirmation prend la place du formulaire (US-0108).
 */
export function FormulaireInscription() {
  const [motDePasse, setMotDePasse] = useState("");
  const envoyerEtSuivre = useCallback(async (precedent: EtatInscription, donnees: FormData) => {
    const suite = await envoyerAuServeur(precedent, donnees);
    // Après une réponse du serveur, le mot de passe s'efface ; si le jeu n'a pas répondu, on le garde pour réessayer.
    if (!suite.erreurs.general) setMotDePasse("");
    return suite;
  }, []);
  const [etat, envoyer, enAttente] = useActionState(envoyerEtSuivre, ETAT_INITIAL);
  if (etat.cree) return <CompteCree email={normaliserEmail(etat.email)} />;
  return (
    <>
      <TitreEntree>Créer un compte</TitreEntree>
      <Formulaire etat={etat} envoyer={envoyer} enAttente={enAttente} motDePasse={motDePasse} setMotDePasse={setMotDePasse} />
    </>
  );
}

/**
 * US-0111 : l'envoi au serveur. Si le réseau coupe, si le jeu plante ou ne répond pas à temps,
 * le formulaire reçoit un message compréhensible, jamais le détail technique de la panne.
 */
async function envoyerAuServeur(precedent: EtatInscription, donnees: FormData): Promise<EtatInscription> {
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  const delaiDepasse = new Promise<never>((_, refus) => {
    minuterie = setTimeout(() => refus(new Error("délai dépassé")), INSCRIPTION_DELAI_MAX_MS);
  });
  try {
    return await Promise.race([inscrire(precedent, donnees), delaiDepasse]);
  } catch {
    return { erreurs: { general: JEU_INJOIGNABLE }, email: String(donnees.get("email") ?? "") };
  } finally {
    clearTimeout(minuterie);
  }
}

type FormulaireProps = {
  etat: EtatInscription;
  envoyer: (donnees: FormData) => void;
  enAttente: boolean;
  motDePasse: string;
  setMotDePasse: (valeur: string) => void;
};

function Formulaire({ etat, envoyer, enAttente, motDePasse, setMotDePasse }: FormulaireProps) {
  // L'adresse vit dans l'état de l'envoi : elle reste dans le champ quoi qu'il arrive.
  const [email, setEmail] = useState(etat.email);
  const [erreurEmail, setErreurEmail] = useState<string | null>(null);
  const [erreurMotDePasse, setErreurMotDePasse] = useState<string | null>(null);
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  // Le dernier envoi dont on a recommencé à corriger le mot de passe : son refus ne s'affiche plus.
  const [envoiCorrige, setEnvoiCorrige] = useState(ETAT_INITIAL);
  const champEmail = useRef<HTMLInputElement>(null);
  const champMotDePasse = useRef<HTMLInputElement>(null);
  // US-0110 : un envoi à la fois. Deux appuis dans le même instant passent tous deux avant que
  // React n'ait désactivé le bouton : le verrou se pose dès le premier, et se lève quand la
  // réponse du serveur arrive.
  const envoiVerrouille = useRef(false);
  useEffect(() => {
    envoiVerrouille.current = false;
  }, [etat]);

  // Un refus du serveur reste affiché tant que le champ n'a pas changé depuis l'envoi.
  const erreurE = erreurEmail ?? (etat.erreurs.email && etat.email === email ? etat.erreurs.email : null);
  const erreurM = erreurMotDePasse ?? (etat !== envoiCorrige ? (etat.erreurs.motDePasse ?? null) : null);

  function verifierAvantEnvoi(evenement: FormEvent<HTMLFormElement>) {
    if (envoiVerrouille.current) return evenement.preventDefault();
    const messageEmail = verifierEmail(email);
    const messageMotDePasse = verifierMotDePasse(motDePasse);
    // À l'envoi, le mot de passe repasse masqué : les gestionnaires de mots de passe le reconnaissent mieux.
    if (!messageEmail && !messageMotDePasse) {
      envoiVerrouille.current = true;
      return setMotDePasseVisible(false);
    }
    evenement.preventDefault();
    setErreurEmail(messageEmail);
    setErreurMotDePasse(messageMotDePasse);
    (messageEmail ? champEmail : champMotDePasse).current?.focus();
  }

  return (
    <form action={envoyer} onSubmit={verifierAvantEnvoi} className={styles.formulaire} noValidate>
      <div className={styles.champ}>
        <label htmlFor="email">Adresse e-mail</label>
        <input
          ref={champEmail}
          id="email"
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErreurEmail(null);
          }}
          onBlur={() => setErreurEmail(verifierEmail(email))}
          aria-invalid={erreurE ? true : undefined}
          aria-describedby={erreurE ? "email-erreur" : undefined}
        />
        {erreurE ? (
          <p id="email-erreur" className={styles.erreur} role="alert">
            {erreurE}
            {/* US-0109 : l'adresse a déjà un compte, on y va avec elle. */}
            {erreurE === EMAIL_DEJA_UTILISEE ? (
              <>
                {" · "}
                <Link href="/connexion" className={styles.lienErreur} onClick={() => retenirAdresse(normaliserEmail(email))}>
                  Se connecter
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      <div className={styles.champ}>
        <label htmlFor="mot-de-passe">Mot de passe</label>
        {/* « new-password » et les longueurs : le navigateur propose un mot de passe fort qui respecte la règle. */}
        <ChampMotDePasse
          refChamp={champMotDePasse}
          id="mot-de-passe"
          name="motDePasse"
          autoComplete="new-password"
          minLength={MOT_DE_PASSE_MIN}
          {...{ passwordrules: `minlength: ${MOT_DE_PASSE_MIN}; maxlength: ${MOT_DE_PASSE_MAX};` }}
          required
          value={motDePasse}
          onChange={(e) => {
            setMotDePasse(e.target.value);
            setErreurMotDePasse(null);
            setEnvoiCorrige(etat);
          }}
          onBlur={() => setErreurMotDePasse(verifierMotDePasse(motDePasse))}
          aria-invalid={erreurM ? true : undefined}
          aria-describedby="mot-de-passe-aide"
          visible={motDePasseVisible}
          basculer={() => setMotDePasseVisible((visible) => !visible)}
        />
        {/* La règle est écrite avant qu'on se trompe ; en cas d'erreur, le message prend sa place. */}
        {erreurM ? (
          <p id="mot-de-passe-aide" className={styles.erreur} role="alert">
            {erreurM}
          </p>
        ) : (
          <p id="mot-de-passe-aide" className={styles.aide}>
            {REGLE_MOT_DE_PASSE}
          </p>
        )}
      </div>
      {/* US-0112 : le champ piège, hors de l'écran et hors du parcours au clavier. Un humain ne le voit
          jamais ; un robot naïf le remplit, et son inscription est refusée. */}
      <div className={styles.piege} aria-hidden="true">
        <label htmlFor="site-web">Site web</label>
        <input id="site-web" type="text" name={CHAMP_PIEGE} tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      {etat.erreurs.general ? (
        <p className={styles.erreurGenerale} role="alert">
          {etat.erreurs.general}
        </p>
      ) : null}
      {/* US-0110 : pendant l'envoi, le bouton est désactivé et montre qu'il travaille. */}
      <button type="submit" className={`${BOUTON_ENTREE} ${styles.envoyer}`} disabled={enAttente}>
        {enAttente ? (
          <>
            <span className={styles.roue} aria-hidden="true" />
            Création…
          </>
        ) : (
          "Créer mon compte"
        )}
      </button>
      <p className={styles.autre}>
        <Link href="/connexion" className={styles.lien}>
          J&apos;ai déjà un compte
        </Link>
      </p>
    </form>
  );
}

/**
 * La confirmation : le compte existe, et le joueur est déjà connecté (US-0123). Le loup de Bestia
 * marqué d'une validation, l'accueil, et l'entrée dans le jeu d'un appui. Le mot de passe a
 * disparu avec le formulaire.
 */
function CompteCree({ email }: { email: string }) {
  const message = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    // Le regard (et le lecteur d'écran) va droit à la confirmation.
    message.current?.focus();
  }, []);
  return (
    <div className={styles.bienvenue} role="status">
      <span className={styles.validation} aria-hidden="true">
        <svg viewBox={LOUP_VIEWBOX} className={styles.loup}>
          <path d={LOUP_TETE} />
        </svg>
        <span className={styles.pastilleValidation}>
          <svg viewBox="0 0 52 52">
            <path d="M15 27.5 22.5 35 37.5 18.5" />
          </svg>
        </span>
      </span>
      <TitreEntree>Bienvenue dans Bestia</TitreEntree>
      <div>
        <p ref={message} tabIndex={-1} className={styles.compteCree}>
          Votre compte est créé
        </p>
        <p className={styles.adresse}>{email}</p>
      </div>
      <Link href="/jeu" className={`${BOUTON_ENTREE} ${styles.envoyer}`}>
        Entrer dans le jeu
      </Link>
    </div>
  );
}
