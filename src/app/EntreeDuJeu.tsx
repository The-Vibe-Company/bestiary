"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { temoinDeConnexion } from "@/comptes/temoin";
import kit from "@/components/kit.module.css";
import styles from "./page.module.css";

const rienAEcouter = () => () => {};

/** L'entrée au cuivre plein du kit, la seconde en contour de cuivre ; plus hautes, pour l'écran titre. */
const PRINCIPALE = [kit.bouton, kit.principal, kit.grand].join(" ");
const SECONDAIRE = [kit.bouton, kit.secondaire, kit.grand, styles.secondaire].join(" ");

/**
 * L'entrée du jeu sur la page d'accueil (US-0101) : « Créer un compte » et « Se connecter » ;
 * pour un joueur déjà connecté, « Retourner au jeu » (US-0122). La page reste statique : c'est
 * le navigateur qui lit le témoin de connexion.
 */
export function EntreeDuJeu() {
  const connecte = useSyncExternalStore(
    rienAEcouter,
    () => temoinDeConnexion(document.cookie),
    () => false,
  );
  return (
    <div className={styles.entree}>
      {connecte ? (
        <Link href="/jeu" className={PRINCIPALE}>
          Retourner au jeu
        </Link>
      ) : (
        <>
          <Link href="/inscription" className={PRINCIPALE}>
            Créer un compte
          </Link>
          <Link href="/connexion" className={SECONDAIRE}>
            Se connecter
          </Link>
        </>
      )}
    </div>
  );
}
