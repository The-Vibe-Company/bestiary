"use client";

import { useId, useState, useTransition } from "react";
import { rappeler } from "@/app/jeu/expeditions/actions";
import { casesDuFoyer } from "@/expeditions/choix-de-destination";
import type { ExpeditionEnCours } from "@/expeditions/en-cours";
import { finDeLaPhase, type Phase, phaseDUneExpedition, retourDUneExpedition } from "@/expeditions/phase";
import { formaterJourEtHeure, formaterMinutes } from "@/temps/affichage";
import styles from "./DetailDeLExpedition.module.css";
import kit from "./kit.module.css";

/** Le fuseau des joueurs, pour l'heure de retour prévue. */
const FUSEAU = "Europe/Paris";

/** Ce que le détail dit d'une durée ou d'une heure qu'il ne peut pas encore chiffrer. */
const AUCUNE = "—";

/** US-0911 : la phase d'une Expédition, telle que la liste la dit. */
export const PHASES: Record<Phase, string> = { aller: "Aller", sejour: "Séjour", retour: "Retour" };

/** US-0918 : ce qu'annonce la fin de chaque phase : l'arrivée sur la Case, le départ de la Case, la rentrée au Foyer. */
export const FIN_DE_LA_PHASE: Record<Phase, string> = { aller: "arrive dans", sejour: "repart dans", retour: "rentre dans" };

/**
 * « Souris grise × 3 » : une Espèce de l'escorte et ses Bêtes parties, comme le récapitulatif l'écrit (US-0910), que le
 * nombre ne quitte jamais (espaces insécables).
 */
const uneEspece = (nom: string, nombre: number) => `${nom} × ${nombre}`;

/**
 * US-0918 : une Expédition en cours, dans la liste des Expéditions et, avec US-0913, sur la carte : sa ligne, avec sa
 * destination (son Biome, ou « Case inconnue » sous le brouillard) et sa distance au Foyer, sa phase et son temps
 * restant ; puis son détail : les prénoms de ses explorateurs, son escorte Espèce par Espèce, ou « Sans escorte », et
 * l'heure de son retour prévu, pour savoir quand elle revient. Sa phase et son temps restant se lisent à l'heure du jeu
 * `instant`, que celui qui l'affiche fait avancer (useHeureDuJeu) : le temps restant est celui de la phase en cours,
 * à la minute supérieure, dit par ce que sa fin annonce : « arrive dans 42 min » à l'aller, « repart dans 3 h 20 » en
 * séjour (le compte à rebours de la durée choisie, US-0915), « rentre dans 35 min » au retour, puis « de retour » ; la
 * phase change d'elle-même. Tant que le trajet d'une escorte n'est pas chiffré (US-0912), ni le temps restant ni le
 * retour : « — ». Aucune zone annoncée : un lecteur d'écran lit le compte quand on y passe, comme celui des Voyageurs.
 * Un explorateur parti qui n'est plus là (une Famine fait partir des Habitants) ne laisse pas la ligne vide : « Aucun ».
 *
 * Repliable (`repliable`), sur un téléphone, elle tient sur une ligne, la sienne : la destination, la phase et le temps
 * restant, sans son annonce, qui n'y tiendrait pas à 320 px. Un toucher n'importe où sur cette ligne la déplie pour
 * montrer sa distance et son détail, et la replie de même (DetailDeLExpedition.module.css) ; un lecteur d'écran entend
 * avec le bouton de quelle Expédition il s'agit. Sur ordinateur, tout se lit.
 *
 * US-0920 : sous son détail, « Rappeler », à l'aller comme en séjour (décidé le 2026-10-08) : elle fait demi-tour, et la
 * page relue la montre au retour, d'où le bouton disparaît. Il attend la réponse du serveur, grisé : un double clic ne la
 * rappelle qu'une fois. Sans trajet chiffré (US-0912), aucun retour, donc rien à rappeler.
 *
 * US-0945 : en fuite après un combat, elle est au retour avec la mention « en fuite » : « Retour · en fuite », sur la carte
 * comme dans le panneau de la liste (src/app/jeu/expeditions/PanneauDeLExpedition.tsx).
 */
export function DetailDeLExpedition({ expedition, instant, repliable = false }: { expedition: ExpeditionEnCours; instant: Date; repliable?: boolean }) {
  const [deplie, setDeplie] = useState(false);
  const [rappelEnCours, demarrer] = useTransition();
  const prefixe = useId();
  const id = (morceau: string) => `${prefixe}-${morceau}`;
  const { destination, explorateurs, escorte } = expedition;
  const phase = phaseDUneExpedition(expedition, instant);
  const fin = finDeLaPhase(expedition, instant);
  const retour = retourDUneExpedition(expedition);
  const reste = fin === null ? null : fin.getTime() - instant.getTime();
  const classes = [styles.expedition, repliable && styles.repliable, repliable && deplie && styles.deplie].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <div className={styles.ligne} data-ligne="">
        <strong id={id("destination")} className={styles.destination}>
          {"inconnue" in destination ? "Case inconnue" : destination.biome}
        </strong>
        <span className={styles.distance}>{casesDuFoyer(destination.distance)}</span>
        <span id={id("phase")} className={`${kit.puce} ${styles.phase}`}>
          {PHASES[phase]}
          {phase === "retour" && expedition.enFuite ? " · en fuite" : null}
        </span>
        <span id={id("reste")} className={styles.reste}>
          {reste === null ? (
            AUCUNE
          ) : reste > 0 ? (
            <>
              <span className={styles.annonce}>{`${FIN_DE_LA_PHASE[phase]} `}</span>
              {/* À la minute supérieure, comptée en minutes entières (US-0906) : jamais une de trop par un arrondi. */}
              {formaterMinutes(Math.max(1, Math.ceil(reste / 60_000)))}
            </>
          ) : (
            "de retour"
          )}
        </span>
        {repliable ? (
          <button
            type="button"
            className={styles.deplier}
            aria-label="Détail"
            aria-describedby={`${id("destination")} ${id("phase")} ${id("reste")}`}
            aria-expanded={deplie}
            aria-controls={id("detail")}
            onClick={() => setDeplie(!deplie)}
          >
            <svg viewBox="0 0 12 12" className={styles.fleche} aria-hidden="true">
              <path d="M2.5 4.5 6 8l3.5-3.5" />
            </svg>
          </button>
        ) : null}
      </div>
      <dl id={id("detail")} className={styles.detail}>
        <div>
          <dt>Explorateurs</dt>
          <dd>{explorateurs.length === 0 ? "Aucun" : explorateurs.join(", ")}</dd>
        </div>
        <div>
          <dt>Escorte</dt>
          <dd>{escorte.length === 0 ? "Sans escorte" : escorte.map((e) => uneEspece(e.nom, e.nombre)).join(", ")}</dd>
        </div>
        <div>
          <dt>Retour prévu</dt>
          <dd>{retour ? <time dateTime={retour.toISOString()}>{formaterJourEtHeure(retour, FUSEAU)}</time> : AUCUNE}</dd>
        </div>
      </dl>
      {phase !== "retour" && retour ? (
        <button
          type="button"
          className={styles.rappeler}
          disabled={rappelEnCours}
          aria-describedby={id("destination")}
          onClick={() => demarrer(() => rappeler(expedition.id))}
        >
          Rappeler
        </button>
      ) : null}
    </div>
  );
}
