"use client";

import { useState } from "react";
import type { RecapitulatifDAbsence } from "@/monde/absence";
import kit from "@/components/kit.module.css";
import { quantiteAffichee } from "@/monde/quantite";
import styles from "./page.module.css";

/**
 * US-0216 : ce que le Foyer a produit pendant l'absence, posé sur l'illustration à l'arrivée, un écriteau de verre ;
 * US-0228 : avec les Stocks qui se sont remplis, et depuis quand, en braise. Un toucher le ferme ; il ne revient pas,
 * la présence du joueur étant notée (Presence).
 */
export function RecapAbsence({ recap }: { recap: RecapitulatifDAbsence }) {
  const [ferme, setFerme] = useState(false);
  if (ferme || (recap.gains.length === 0 && recap.pleins.length === 0)) return null;
  return (
    <button type="button" className={`${kit.panneau} ${kit.verre} ${styles.recap}`} onClick={() => setFerme(true)}>
      <span>
        Pendant votre absence
        {recap.gains.length > 0 ? ` : ${recap.gains.map((g) => `+${quantiteAffichee(g.gain)} ${g.nom}`).join(", ")}` : ""}
      </span>
      {recap.pleins.map((p) => (
        <span key={p.id} className={styles.recapPlein}>
          {" "}
          {p.nom} : stock plein depuis {p.depuis}
        </span>
      ))}
    </button>
  );
}
