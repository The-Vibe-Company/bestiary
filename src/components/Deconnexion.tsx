"use client";

import posthog from "posthog-js";
import { useTransition } from "react";
import { mesureActive } from "./mesure-active";
import { seDeconnecter } from "@/comptes/deconnexion";
import styles from "./BarreHaut.module.css";
import { rechargerVers } from "./recharger";

/** Se déconnecter (US-0120) : la session est fermée côté jeu, puis la page d'accueil se recharge. */
export function useDeconnexion() {
  const [enCours, demarrer] = useTransition();
  function deconnecter() {
    demarrer(async () => {
      await seDeconnecter();
      // La mesure d'audience oublie le joueur : le prochain, sur ce navigateur, repart anonyme.
      if (mesureActive()) posthog.reset();
      // Un rechargement complet, pas une navigation interne : le navigateur oublie les pages du jeu,
      // et le bouton Précédent ne peut plus les réafficher.
      rechargerVers("/");
    });
  }
  return { enCours, deconnecter };
}

/** « Se déconnecter », seul dans la barre : pour un joueur qui n'a pas encore de nom de chef. */
export function BoutonDeconnexion() {
  const { enCours, deconnecter } = useDeconnexion();
  return (
    <button type="button" className={styles.action} onClick={deconnecter} disabled={enCours}>
      {enCours ? "Déconnexion…" : "Se déconnecter"}
    </button>
  );
}
