"use client";

import { useOptimistic, useTransition } from "react";
import kit from "@/components/kit.module.css";
import { affecterAuRole, retirerDuRole } from "./actions";
import styles from "./page.module.css";

/**
 * US-0837 : au pied de la carte d'une Espèce dont le Rôle sert au Foyer, sur la page Bêtes : le Rôle en petite étiquette,
 * puis le pas du kit, comme le « − N + » d'un Métier sur la page Habitants : « − » et « + » autour du compte « affectées /
 * effectif ». « + » affecte une Bête de plus (affecterAuRole), éteint quand toutes les Bêtes valides au Foyer le sont
 * (`valides` : ni sorties ni Blessées) ; « − » en retire une (retirerDuRole), éteint à zéro. Le compte change aussitôt,
 * le temps que l'action l'enregistre ; la page relue fait foi ensuite.
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
  const changer = (pas: 1 | -1) =>
    demarrer(async () => {
      montrer(pas);
      await (pas > 0 ? affecterAuRole(especeId) : retirerDuRole(especeId));
    });
  return (
    <div role="group" aria-label={`${nom}, ${role.nom}`} className={styles.role}>
      <span className={kit.etiquette}>{role.nom}</span>
      <span className={kit.pas}>
        <button type="button" className={kit.pasBouton} aria-label={`Une Bête de moins au Rôle de ${role.nom}`} disabled={montrees <= 0} onClick={() => changer(-1)}>
          −
        </button>
        <output className={kit.pasValeur}>{`${montrees} / ${effectif}`}</output>
        <button
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
