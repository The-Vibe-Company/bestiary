"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { BeteReperee } from "@/expeditions/betes-reperees";
import type { Coordonnees } from "@/monde/hex";
import { jusquAEnviron } from "@/temps/affichage";
import { useHeureDuJeu } from "@/temps/heure-du-jeu";
import styles from "./BetesRepereesSurLaCarte.module.css";
import { aLEcran, type Cadre, type Vue } from "./dessin";
import { poserUnRepere, type RepereSurLaCarte } from "./ExpeditionsSurLaCarte";
import { PanneauSurLaCarte } from "./FicheDeLaCase";

/** Le fuseau des joueurs, pour l'heure jusqu'à laquelle une Bête devrait rester. */
const FUSEAU = "Europe/Paris";

/** US-0948 : le repère d'une Bête repérée, tel que la carte le pose à chaque dessin : son bouton et sa Case, puis là où il est posé. */
export type RepereDeBete = RepereSurLaCarte<number> & { laCase: Coordonnees };

/**
 * US-0948 : pose chaque repère de Bête sur la carte montrée par `vue`, au centre de sa Case, caché quand elle sort de
 * l'écran : la carte l'appelle à chaque dessin, comme pour les repères des Expéditions (placerLesReperes).
 */
export function placerLesBetes(reperes: readonly RepereDeBete[], vue: Vue): void {
  for (const repere of reperes) poserUnRepere(repere, aLEcran(repere.laCase, vue), vue);
}

/**
 * US-0948 : les Bêtes repérées du joueur sur la carte, les siennes seulement (la page ne lui donne qu'elles) : l'heure du
 * jeu, partie de `maintenant` à l'affichage de la page, qui avance au rythme du jeu (`vitesse`, useHeureDuJeu) ; le
 * repère « Bête repérée » de chacune encore sur sa Case, un bouton par-dessus la carte, qui dit son Espèce et jusqu'à
 * quand elle devrait rester, à l'heure près, et que la carte pose au centre de sa Case (`poser`) ; et la fiche de la Bête
 * regardée (`regardee`). Toucher un repère, ou l'appuyer au clavier, la regarde (`regarder`) ; sa fiche se ferme
 * (`fermer`) comme celle d'une Case, et la carte glisse pour qu'elle ne cache pas sa Case (`montrer`). À la fin de sa
 * durée, le repère s'en va, sa fiche avec lui, sans recharger la page ni rien dire de plus (décidé le 2026-10-09).
 */
export function BetesRepereesSurLaCarte({
  betes,
  maintenant,
  vitesse,
  poser,
  regardee,
  regarder,
  fermer,
  carte,
  montrer,
}: {
  betes: readonly BeteReperee[];
  maintenant: Date;
  vitesse: number;
  poser: (reperes: RepereDeBete[]) => void;
  regardee: number | null;
  regarder: (id: number) => void;
  fermer: () => void;
  carte: RefObject<HTMLCanvasElement | null>;
  montrer: (c: Coordonnees, cache: Cadre) => void;
}) {
  const instant = useHeureDuJeu(maintenant, vitesse);
  // Celles encore sur leur Case à l'heure du jeu.
  const encoreLa = betes.filter((b) => b.jusquA > instant);
  // Les boutons des repères, par Bête.
  const boutons = useRef(new Map<number, HTMLButtonElement>());
  // À chaque seconde du jeu : les Bêtes encore là, pour la carte, qui pose aussitôt leurs repères.
  useEffect(() => {
    poser(encoreLa.map(({ id, laCase }) => ({ id, bouton: boutons.current.get(id) ?? null, laCase, ici: null })));
  });
  // Plus aucun repère sur la carte une fois les Bêtes parties de la page.
  useEffect(
    () => () => {
      poser([]);
    },
    [poser],
  );
  const ouverte = encoreLa.find((b) => b.id === regardee);
  const jusqua = ouverte && jusquAEnviron(ouverte.jusquA, instant, FUSEAU);
  return (
    <>
      {encoreLa.map((bete) => (
        <button
          key={bete.id}
          ref={(bouton) => {
            if (bouton) boutons.current.set(bete.id, bouton);
            else boutons.current.delete(bete.id);
          }}
          type="button"
          className={styles.repere}
          hidden
          aria-label={`Bête repérée : ${bete.espece}, ${jusquAEnviron(bete.jusquA, instant, FUSEAU)}`}
          aria-expanded={bete.id === regardee}
          onClick={() => regarder(bete.id)}
        >
          <svg viewBox="0 0 32 32" focusable="false" aria-hidden="true">
            <circle className={styles.halo} cx="16" cy="16" r="14" />
            <circle className={styles.pastille} cx="16" cy="16" r="9.5" />
            {/* Une empreinte : quatre doigts au-dessus d'un coussinet. */}
            <g className={styles.empreinte}>
              <ellipse cx="16" cy="18.6" rx="3.3" ry="2.7" />
              <circle cx="11.9" cy="14.9" r="1.35" />
              <circle cx="14.4" cy="12.6" r="1.35" />
              <circle cx="17.6" cy="12.6" r="1.35" />
              <circle cx="20.1" cy="14.9" r="1.35" />
            </g>
          </svg>
        </button>
      ))}
      {ouverte && jusqua ? (
        <PanneauSurLaCarte nom="Fiche de la Bête repérée" laCase={ouverte.laCase} carte={carte} montrer={montrer} fermer={fermer}>
          <h2 className={styles.titre}>Bête repérée</h2>
          <p className={styles.espece}>{ouverte.espece}</p>
          <p className={styles.jusqua}>{jusqua[0].toUpperCase() + jusqua.slice(1)}</p>
        </PanneauSurLaCarte>
      ) : null}
    </>
  );
}
