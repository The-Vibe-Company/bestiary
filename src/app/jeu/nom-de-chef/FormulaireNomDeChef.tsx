"use client";

import { startTransition, useActionState, useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  couperNom,
  longueurDuNom,
  NOM_DEJA_PRIS,
  NOM_VIENT_D_ETRE_PRIS,
  nettoyerNom,
  nettoyerSaisie,
  verifierCaracteresDuNom,
  verifierNomDeChef,
} from "@/chefs/nom";
import { BOUTON_ENTREE } from "@/components/PageEntree";
import { NOM_DE_CHEF_MAX, NOM_DE_CHEF_PAUSE_MS } from "@/reglages";
import styles from "../../entree.module.css";
import { validerNomDeChef, verifierNomLibre } from "./actions";
import { ETAT_VALIDATION_INITIAL, NOM_DEFINITIF } from "./etat";

/**
 * Le champ du nom de chef. US-0132 : le compteur paraît dès qu'on écrit, le champ ne prend pas
 * plus de 16 caractères, et un nom trop court se signale quand on quitte le champ, jamais pendant
 * la frappe. US-0133 : un caractère refusé se signale dès qu'il est tapé, pour qu'on voie lequel
 * retirer. US-0134 : le champ montre le nom tel qu'il sera enregistré ; un espace en tête ou un
 * deuxième espace de suite ne s'écrivent pas, l'espace de fin disparaît quand on quitte le champ.
 * US-0135, US-0136 : un nom par ailleurs correct est cherché parmi ceux du Monde dès que le joueur
 * s'arrête de taper (ou quitte le champ) ; libre, une coche le dit, sans rien réserver. US-0138 :
 * la même recherche refuse un nom interdit. US-0139 : « Valider » s'active dès que le nom respecte
 * les règles du champ et n'est pas connu pris ou interdit ; le serveur tranche à l'enregistrement.
 */
export function FormulaireNomDeChef() {
  const [nom, setNom] = useState("");
  const [erreurEnQuittant, setErreurEnQuittant] = useState<string | null>(null);
  // Les réponses du jeu, par nom nettoyé : le message (pris, interdit), ou null si le nom est libre.
  // Un nom déjà demandé (ou en cours de demande) ne repart pas au serveur.
  const [verdicts, setVerdicts] = useState<Record<string, string | null>>({});
  const demandes = useRef(new Set<string>());
  const [validation, envoyer, enAttente] = useActionState(validerNomDeChef, ETAT_VALIDATION_INITIAL);

  const propre = nettoyerNom(nom);
  const valable = propre !== "" && !verifierNomDeChef(propre);
  const verdict = valable ? verdicts[propre] : undefined;
  // US-0137 : pris au moment de valider. Si la coche l'avait dit libre, il vient d'être pris.
  const refusValidation =
    validation.nom !== "" && validation.nom === propre
      ? validation.pris
        ? verdict === null
          ? NOM_VIENT_D_ETRE_PRIS
          : NOM_DEJA_PRIS
        : (validation.erreur ?? null)
      : null;
  const erreur = verifierCaracteresDuNom(nom) ?? erreurEnQuittant ?? refusValidation ?? verdict ?? null;
  const libre = verdict === null && !erreur;
  const peutValider = valable && !erreur && !enAttente;
  const decrit = [erreur ? "nom-erreur" : null, nom ? "nom-compteur" : null].filter(Boolean).join(" ");

  const chercher = useCallback(async (candidat: string) => {
    if (demandes.current.has(candidat)) return;
    demandes.current.add(candidat);
    try {
      const refus = await verifierNomLibre(candidat);
      setVerdicts((precedents) => ({ ...precedents, [candidat]: refus }));
    } catch {
      // Sans réponse du jeu, rien n'est affiché ; une prochaine pause redemandera.
      demandes.current.delete(candidat);
    }
  }, []);

  // US-0136 : la recherche part quand le joueur s'arrête de taper, pas à chaque lettre.
  useEffect(() => {
    if (!valable || demandes.current.has(propre)) return;
    const minuterie = setTimeout(() => void chercher(propre), NOM_DE_CHEF_PAUSE_MS);
    return () => clearTimeout(minuterie);
  }, [propre, valable, chercher]);

  function saisir(e: ChangeEvent<HTMLInputElement>) {
    const champ = e.target;
    const nettoye = couperNom(nettoyerSaisie(champ.value));
    // Un espace retiré ne doit pas renvoyer le curseur en fin de champ : le champ est corrigé sur
    // place, et le curseur reste où l'on tapait, avant que la lettre suivante n'arrive.
    if (nettoye !== champ.value && champ.selectionStart !== null) {
      const curseur = Math.min(nettoyerSaisie(champ.value.slice(0, champ.selectionStart)).length, nettoye.length);
      champ.value = nettoye;
      champ.setSelectionRange(curseur, curseur);
    }
    setNom(nettoye);
    setErreurEnQuittant(null);
  }

  function quitter() {
    setNom(propre);
    const refus = propre ? verifierNomDeChef(propre) : null;
    setErreurEnQuittant(refus);
    // Parti avant la fin de la pause : la recherche part tout de suite.
    if (propre && !refus) void chercher(propre);
  }

  function valider(evenement: FormEvent<HTMLFormElement>) {
    // Envoyé à la main, pas par l'action du formulaire : React viderait le champ après l'envoi,
    // alors qu'un nom refusé doit rester sous les yeux du joueur.
    evenement.preventDefault();
    if (!peutValider) return;
    const donnees = new FormData();
    donnees.set("nom", propre);
    startTransition(() => envoyer(donnees));
  }

  return (
    <form className={styles.formulaire} onSubmit={valider} noValidate>
      <div className={styles.champ}>
        <div className={styles.saisie}>
          <input
            id="nom-de-chef"
            type="text"
            name="nom"
            aria-label="Nom de chef"
            autoComplete="off"
            spellCheck={false}
            value={nom}
            onChange={saisir}
            onBlur={quitter}
            aria-invalid={erreur ? true : undefined}
            aria-describedby={decrit || undefined}
          />
          {libre ? (
            <span className={styles.coche} aria-hidden="true">
              <svg viewBox="0 0 52 52">
                <path d="M15 27.5 22.5 35 37.5 18.5" />
              </svg>
            </span>
          ) : null}
        </div>
        {/* La coche se voit ; ceci la dit aux lecteurs d'écran. */}
        <span className={styles.annonce} role="status">
          {libre ? "Disponible" : ""}
        </span>
        {erreur || nom ? (
          <div className={styles.sousLeChamp}>
            {erreur ? (
              <p id="nom-erreur" className={styles.erreur} role="alert">
                {erreur}
              </p>
            ) : null}
            {nom ? (
              <span id="nom-compteur" className={styles.compteur}>
                {longueurDuNom(nom)}/{NOM_DE_CHEF_MAX}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <button type="submit" className={`${BOUTON_ENTREE} ${styles.envoyer}`} disabled={!peutValider}>
        {enAttente ? (
          <>
            <span className={styles.roue} aria-hidden="true" />
            Validation…
          </>
        ) : (
          "Valider"
        )}
      </button>
      <p className={styles.definitif}>{NOM_DEFINITIF}</p>
    </form>
  );
}
