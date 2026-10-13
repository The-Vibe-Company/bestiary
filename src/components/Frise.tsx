import type { CSSProperties } from "react";
import type { Phase } from "@/expeditions/phase";
import { formaterMinutes } from "@/temps/affichage";
import styles from "./Frise.module.css";

/** Les trois temps d'une Expédition, dans leur ordre, et leur nom. */
const TEMPS: readonly { phase: Phase; nom: string }[] = [
  { phase: "aller", nom: "Aller" },
  { phase: "sejour", nom: "Séjour" },
  { phase: "retour", nom: "Retour" },
];

/** Ce que la frise écrit d'une durée qu'elle ne peut pas chiffrer. */
const AUCUNE = "—";

/** Les durées d'une Expédition, en minutes : null pour une durée que le jeu ne chiffre pas encore (sans destination). */
export type DureesDUneExpedition = Record<Phase, number | null>;

type FriseProps =
  /** Les durées : chaque temps a sa durée sous son nom, et un trait à sa mesure (le récapitulatif, un Récit). */
  | { durees: DureesDUneExpedition; className?: string }
  /**
   * Où en est une Expédition en cours : sa `phase`, et la part déjà faite de cette phase, de 0 à 1 (`part`). Les temps
   * passés sont pleins, celui en cours se remplit, ceux à venir restent creux.
   */
  | { phase: Phase; part: number; className?: string };

/**
 * La frise d'une Expédition : l'aller, le séjour et le retour, un trait chacun, côte à côte. Elle a deux façons.
 *
 * Avec ses `durees` (l'écran d'Expédition, un Récit) : une liste libellé / valeur (dl), chaque temps son nom en petite
 * étiquette et sa durée dessous (« ALLER 2 h 20 ») ; chaque trait prend la place de sa durée (l'aller et le retour en
 * eau, le séjour en cuivre), assez pour son nom quand elle est courte. Une durée qui manque s'écrit « — », et les trois
 * traits se partagent alors la largeur.
 *
 * Avec la `phase` et sa `part` (une Expédition en cours) : trois traits égaux, fins ; ceux des temps passés en eau,
 * celui de la phase en cours rempli de cuivre jusqu'où elle en est, son nom en cuivre clair. Elle ne sert qu'aux yeux :
 * la page dit la phase en mots à côté.
 */
export function Frise(props: FriseProps) {
  if ("durees" in props) {
    const { durees } = props;
    // À la mesure de chaque durée, tant que les trois sont chiffrées ; à parts égales sinon.
    const chiffrees = TEMPS.every(({ phase }) => durees[phase] !== null);
    return (
      <dl className={[styles.frise, styles.durees, props.className].filter(Boolean).join(" ")}>
        {TEMPS.map(({ phase, nom }) => {
          const minutes = durees[phase];
          return (
            <div key={phase} data-temps={phase} style={{ flexGrow: chiffrees ? minutes! : 1 }}>
              <dt>{nom}</dt>
              <dd>{minutes === null ? AUCUNE : formaterMinutes(minutes)}</dd>
            </div>
          );
        })}
      </dl>
    );
  }
  const { phase, part } = props;
  const rang = TEMPS.findIndex((t) => t.phase === phase);
  return (
    <div className={[styles.frise, styles.progression, props.className].filter(Boolean).join(" ")} aria-hidden="true">
      {TEMPS.map(({ phase: temps, nom }, i) => (
        <span
          key={temps}
          data-temps={temps}
          data-etat={i < rang ? "fait" : i === rang ? "en-cours" : "a-venir"}
          style={i === rang ? ({ "--part": `${Math.round(Math.max(0, Math.min(1, part)) * 100)}%` } as CSSProperties) : undefined}
        >
          {nom}
        </span>
      ))}
    </div>
  );
}
