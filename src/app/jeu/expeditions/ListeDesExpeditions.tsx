"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ExpeditionEnCours } from "@/expeditions/en-cours";
import { retourDUneExpedition } from "@/expeditions/phase";
import { useHeureDuJeu } from "@/temps/heure-du-jeu";
import styles from "./page.module.css";
import { PanneauDeLExpedition } from "./PanneauDeLExpedition";

/** Le plus long délai qu'un minuteur du navigateur sache attendre : au-delà, il partirait aussitôt. */
const DELAI_MAX_MS = 2_147_483_647;
/** US-0916 : le temps réel laissé au serveur après un retour avant de relire la page. */
const RELIRE_APRES_MS = 1_000;

/**
 * US-0918 : la liste des Expéditions en cours, de la première partie à la dernière, chacune son grand panneau illustré
 * (PanneauDeLExpedition), rangés en grille, autant par rangée que la largeur en tient : leurs phases et leurs comptes à
 * rebours avancent ensemble, sans recharger la page, à l'heure du jeu partie de `maintenant` et au rythme du jeu
 * (`vitesse`). Au-delà de deux, les panneaux se serrent : plus d'Expéditions tiennent à l'écran. Sur un téléphone, une
 * par rangée, chacune repliée sur son paysage, qu'on déplie pour voir le détail.
 *
 * US-0916 : la page se relit juste après le prochain retour, une seconde réelle plus tard, le temps que le serveur ait
 * fait rentrer l'Expédition : elle quitte la liste, et la suivante prend le relais. Une Expédition déjà de retour à
 * l'affichage, ou dont le retour n'est pas chiffré, ne fait rien relire.
 */
export function ListeDesExpeditions({ expeditions, maintenant, vitesse = 1 }: { expeditions: ExpeditionEnCours[]; maintenant: Date; vitesse?: number }) {
  const instant = useHeureDuJeu(maintenant, vitesse);
  const routeur = useRouter();
  const lecture = maintenant.getTime();
  // Le prochain retour, en heure du jeu ; Infinity sans retour à venir.
  const prochainRetour = Math.min(...expeditions.map((x) => retourDUneExpedition(x)?.getTime() ?? Infinity).filter((retour) => retour > lecture));

  useEffect(() => {
    if (!Number.isFinite(prochainRetour)) return;
    const releve = (prochainRetour - lecture) / vitesse + RELIRE_APRES_MS;
    if (releve > DELAI_MAX_MS) return;
    const minuteur = setTimeout(() => routeur.refresh(), Math.ceil(releve));
    return () => clearTimeout(minuteur);
  }, [prochainRetour, lecture, vitesse, routeur]);

  return (
    <ul className={styles.expeditions}>
      {expeditions.map((expedition) => (
        <li key={expedition.id}>
          <PanneauDeLExpedition expedition={expedition} instant={instant} serre={expeditions.length > 2} />
        </li>
      ))}
    </ul>
  );
}
