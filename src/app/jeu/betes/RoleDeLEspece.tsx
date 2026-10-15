"use client";

import { useEffect, useOptimistic, useRef, useTransition } from "react";
import kit from "@/components/kit.module.css";
import { affecterAuRole, retirerDuRole } from "./actions";
import styles from "./page.module.css";

/**
 * US-0837 : au pied de la carte d'une Espèce dont le Rôle sert au Foyer, sur la page Bêtes : le Rôle en petite étiquette,
 * puis le pas du kit, comme le « − N + » d'un Métier sur la page Habitants : « − » et « + » autour du compte « affectées /
 * effectif ». « + » affecte une Bête de plus (affecterAuRole), éteint quand toutes les Bêtes valides au Foyer le sont
 * (`valides` : ni sorties ni Blessées) ; « − » en retire une (retirerDuRole), éteint à zéro. Le compte change aussitôt,
 * le temps que l'action l'enregistre ; la page relue fait foi ensuite. US-0841 : affecter et retirer s'enchaînent autant
 * qu'on veut ; le bouton qui s'éteint à sa borne passe la main à l'autre, pour continuer au clavier sans la perdre.
 */
export function RoleDeLEspece({
  especeId,
  nom,
  role,
  affectees,
  valides,
  effectif,
}: {
  especeId: string;
  nom: string;
  role: { id: string; nom: string };
  affectees: number;
  valides: number;
  effectif: number;
}) {
  const [montrees, montrer] = useOptimistic(affectees, (n: number, pas: number) => n + pas);
  const [, demarrer] = useTransition();
  const boutonMoins = useRef<HTMLButtonElement>(null);
  const boutonPlus = useRef<HTMLButtonElement>(null);
  // US-0841 : le bouton qui recevra la main, une fois le compte rendu : l'autre ne s'allume qu'à ce rendu (une seule Bête
  // valide : « + » est éteint tant qu'elle est affectée).
  const mainA = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!mainA.current || mainA.current.disabled) return;
    mainA.current.focus();
    mainA.current = null;
  }, [montrees]);
  const changer = (pas: 1 | -1) => {
    // US-0841 : à sa borne, le bouton touché s'éteint ; la main passe à l'autre.
    if (pas < 0 && montrees + pas <= 0) mainA.current = boutonPlus.current;
    if (pas > 0 && montrees + pas >= valides) mainA.current = boutonMoins.current;
    demarrer(async () => {
      montrer(pas);
      await (pas > 0 ? affecterAuRole(especeId) : retirerDuRole(especeId));
    });
  };
  return (
    <div role="group" aria-label={`${nom}, ${role.nom}`} className={styles.role}>
      <span className={kit.etiquette}>{role.nom}</span>
      <span className={kit.pas}>
        <button
          ref={boutonMoins}
          type="button"
          className={kit.pasBouton}
          aria-label={`Une Bête de moins au Rôle de ${role.nom}`}
          disabled={montrees <= 0}
          onClick={() => changer(-1)}
        >
          −
        </button>
        <output className={kit.pasValeur}>{`${montrees} / ${effectif}`}</output>
        <button
          ref={boutonPlus}
          type="button"
          className={kit.pasBouton}
          aria-label={`Une Bête de plus au Rôle de ${role.nom}`}
          disabled={montrees >= valides}
          onClick={() => changer(1)}
        >
          +
        </button>
      </span>
    </div>
  );
}
