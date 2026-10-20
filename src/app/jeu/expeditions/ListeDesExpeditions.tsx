"use client";

import type { ExpeditionEnCours } from "@/expeditions/en-cours";
import { retourDUneExpedition } from "@/expeditions/phase";
import { useHeureDuJeu, useRelireLaPageA } from "@/temps/heure-du-jeu";
import styles from "./page.module.css";
import { PanneauDeLExpedition } from "./PanneauDeLExpedition";

/**
 * US-0918 : la liste des Expéditions en cours, de la première partie à la dernière, chacune son grand panneau illustré
 * (PanneauDeLExpedition), rangés en grille, autant par rangée que la largeur en tient : leurs phases et leurs comptes à
 * rebours avancent ensemble, sans recharger la page, à l'heure du jeu partie de `maintenant` et au rythme du jeu
 * (`vitesse`). Au-delà de deux, les panneaux se serrent : plus d'Expéditions tiennent à l'écran. Sur un téléphone, une
 * par rangée, chacune repliée sur son paysage, qu'on déplie pour voir le détail.
 *
 * US-0916 : la page se relit juste après le prochain retour, une seconde réelle plus tard, le temps que le serveur ait
 * fait rentrer l'Expédition (useRelireLaPageA) : elle quitte la liste, et la suivante prend le relais. Une Expédition
 * déjà de retour à l'affichage, ou dont le retour n'est pas chiffré, ne fait rien relire.
 */
export function ListeDesExpeditions({ expeditions, maintenant, vitesse = 1 }: { expeditions: ExpeditionEnCours[]; maintenant: Date; vitesse?: number }) {
  const instant = useHeureDuJeu(maintenant, vitesse);
  const lecture = maintenant.getTime();
  // Le prochain retour, en heure du jeu ; Infinity sans retour à venir.
  const prochainRetour = Math.min(...expeditions.map((x) => retourDUneExpedition(x)?.getTime() ?? Infinity).filter((retour) => retour > lecture));
  useRelireLaPageA(Number.isFinite(prochainRetour) ? new Date(prochainRetour) : null, maintenant, vitesse);

  return (
    <ul className={styles.expeditions}>
      {expeditions.map((expedition, i) => (
        <li key={expedition.id}>
          <PanneauDeLExpedition expedition={expedition} instant={instant} serre={expeditions.length > 2} prioritaire={i === 0} />
        </li>
      ))}
    </ul>
  );
}
