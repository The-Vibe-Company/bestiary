"use client";

import { Fragment, useId, useState, useTransition } from "react";
import { FIN_DE_LA_PHASE, PHASES } from "@/components/DetailDeLExpedition";
import { Frise } from "@/components/Frise";
import { Illustration } from "@/components/Illustration";
import kit from "@/components/kit.module.css";
import { Medaillon } from "@/components/Medaillon";
import { Paysage } from "@/components/Paysage";
import { casesDuFoyer } from "@/expeditions/choix-de-destination";
import type { ExpeditionEnCours } from "@/expeditions/en-cours";
import { demiTourDUneExpedition, finDeLaPhase, type Phase, phaseDUneExpedition, retourDUneExpedition, sejourDUneExpedition } from "@/expeditions/phase";
import { formaterJourEtHeure, formaterMinutes } from "@/temps/affichage";
import { rappeler } from "./actions";
import styles from "./PanneauDeLExpedition.module.css";

/** Le fuseau des joueurs, pour l'heure de retour prévue. */
const FUSEAU = "Europe/Paris";

/** Ce que le panneau dit d'une durée ou d'une heure qu'il ne peut pas encore chiffrer. */
const AUCUNE = "—";

/** Le médaillon d'un explorateur parti : un Habitant. */
const ICONE_EXPLORATEUR = "/illustrations/icones/habitants.webp";

/**
 * Le portrait d'une Espèce de l'escorte, sous public/illustrations : celui que le jeu range sous le nom de l'Espèce
 * (especes/souris.webp). Une Espèce qui n'en a pas encore montre la tête de loup, comme au bloc Escorte (Illustration).
 */
const portraitDeLEspece = (id: string) => `especes/${id}.webp`;

/** L'instant du jeu où a commencé la phase `phase` d'une Expédition ; aucun tant que son trajet n'est pas chiffré. */
function debutDeLaPhase(expedition: ExpeditionEnCours, phase: Phase): Date | null {
  if (phase === "aller") return expedition.partLe;
  if (phase === "sejour") return sejourDUneExpedition(expedition)?.debut ?? null;
  return demiTourDUneExpedition(expedition)?.le ?? null;
}

/**
 * US-0918 : une Expédition en cours, dans la liste des Expéditions : un grand panneau illustré. En tête, le paysage de sa
 * destination (Paysage : la peinture de son Biome, ou la brume d'une « Case inconnue ») et, posés dessus, sa destination,
 * sa distance au Foyer, sa phase et son temps restant ; sous lui, la frise de l'aller, du séjour et du retour, remplie
 * jusqu'où elle en est ; puis son détail : ses explorateurs, chacun son médaillon, son escorte, chaque Espèce son portrait
 * et ses Bêtes parties, ou « Sans escorte », et l'heure de son retour prévu. Sa phase et son temps restant se lisent à
 * l'heure du jeu `instant`, que la liste fait avancer (useHeureDuJeu) : le temps restant est celui de la phase en cours,
 * à la minute supérieure, dit par ce que sa fin annonce : « arrive dans 42 min » à l'aller, « repart dans 3 h 20 » en
 * séjour (US-0915), « rentre dans 35 min » au retour, puis « de retour » ; la phase change d'elle-même. Tant que le trajet
 * d'une escorte n'est pas chiffré (US-0912), ni le temps restant ni le retour : « — ». Aucune zone annoncée : un lecteur
 * d'écran lit le compte quand on y passe. Un explorateur parti qui n'est plus là ne laisse pas la ligne vide : « Aucun ».
 *
 * Serré (`serre`), quand la liste en a plus qu'une rangée, son paysage est moins haut : on en voit plus d'un coup d'œil.
 *
 * Sur un téléphone, le panneau tient replié sur son paysage et sa frise ; un toucher n'importe où sur le paysage déplie
 * son détail, et le replie de même ; un lecteur d'écran entend avec le bouton de quelle Expédition il s'agit. Sur
 * ordinateur, tout se lit.
 *
 * US-0920 : au pied de son détail, « Rappeler », à l'aller comme en séjour : elle fait demi-tour, et la page relue la
 * montre au retour, d'où le bouton disparaît. Il attend la réponse du serveur, grisé : un double clic ne la rappelle
 * qu'une fois. Sans trajet chiffré (US-0912), aucun retour, donc rien à rappeler.
 *
 * US-0945 : en fuite après un combat, elle est au retour avec la mention « en fuite », comme sur la carte.
 */
export function PanneauDeLExpedition({ expedition, instant, serre = false }: { expedition: ExpeditionEnCours; instant: Date; serre?: boolean }) {
  const [deplie, setDeplie] = useState(false);
  const [rappelEnCours, demarrer] = useTransition();
  const prefixe = useId();
  const id = (morceau: string) => `${prefixe}-${morceau}`;
  const { destination, explorateurs, escorte, eclaireurs = [] } = expedition;
  const inconnue = "inconnue" in destination;
  const phase = phaseDUneExpedition(expedition, instant);
  const fin = finDeLaPhase(expedition, instant);
  const debut = debutDeLaPhase(expedition, phase);
  const retour = retourDUneExpedition(expedition);
  const reste = fin === null ? null : fin.getTime() - instant.getTime();
  // La part de la phase déjà faite, pour la frise ; rien tant que le trajet n'est pas chiffré.
  const duree = fin && debut ? fin.getTime() - debut.getTime() : 0;
  const part = duree > 0 ? (instant.getTime() - debut!.getTime()) / duree : 0;

  return (
    <article className={[kit.panneau, styles.panneau, serre && styles.serre, deplie && styles.deplie].filter(Boolean).join(" ")} aria-labelledby={id("destination")}>
      <div className={styles.tableau}>
        <Paysage biome={inconnue ? undefined : destination.biome} brume={inconnue} sizes="(max-width: 760px) 100vw, 50vw" className={styles.paysage} />
        <div className={styles.ligne} data-ligne="">
          <strong id={id("destination")} className={styles.destination}>
            {inconnue ? "Case inconnue" : destination.biome}
          </strong>
          <span className={styles.distance}>{casesDuFoyer(destination.distance)}</span>
          <span className={styles.puce}>
            <span id={id("phase")} className={styles.phase}>
              {PHASES[phase]}
              {phase === "retour" && expedition.enFuite ? " · en fuite" : null}
            </span>
            <span id={id("reste")} className={styles.reste}>
              {reste === null ? (
                AUCUNE
              ) : reste > 0 ? (
                <>
                  {`${FIN_DE_LA_PHASE[phase]} `}
                  {/* À la minute supérieure, comptée en minutes entières (US-0906) : jamais une de trop par un arrondi. */}
                  {formaterMinutes(Math.max(1, Math.ceil(reste / 60_000)))}
                </>
              ) : (
                "de retour"
              )}
            </span>
          </span>
        </div>
        {/* Sur un téléphone, tout le paysage déplie le détail : le bouton le couvre, son chevron dans le coin. */}
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
      </div>
      <Frise phase={phase} part={part} className={styles.frise} />
      <div id={id("detail")} className={styles.detail}>
        <dl className={styles.cles}>
          <div>
            <dt>Explorateurs</dt>
            <dd>
              {/* Une espace entre deux prénoms, que la ligne ne montre pas : un lecteur d'écran les lit l'un après l'autre. */}
              {explorateurs.length === 0
                ? "Aucun"
                : explorateurs.map((prenom, i) => (
                    <Fragment key={i}>
                      {i > 0 ? " " : null}
                      <span className={styles.qui}>
                        <Medaillon src={ICONE_EXPLORATEUR} taille="sm" />
                        {prenom}
                      </span>
                    </Fragment>
                  ))}
            </dd>
          </div>
          <div>
            <dt>Escorte</dt>
            <dd>
              {escorte.length === 0 ? (
                <span className={styles.sans}>Sans escorte</span>
              ) : (
                escorte.map((espece, i) => (
                  <Fragment key={espece.id}>
                    {i > 0 ? " " : null}
                    <span className={styles.bete}>
                      <span className={styles.portrait} aria-hidden="true">
                        <Illustration chemin={portraitDeLEspece(espece.id)} alt="" sizes="32px" className={styles.peinture} />
                      </span>
                      {`${espece.nom} `}
                      {/* Le nombre ne quitte jamais son signe : une espace insécable, comme au récapitulatif (US-0910). */}
                      <em>{`× ${espece.nombre}`}</em>
                    </span>
                  </Fragment>
                ))
              )}
            </dd>
          </div>
          {/* US-0976 : ses Éclaireurs, partis à côté de l'escorte, chaque Espèce son portrait. */}
          {eclaireurs.length > 0 ? (
            <div>
              <dt>Éclaireurs</dt>
              <dd>
                {eclaireurs.map((espece, i) => (
                  <Fragment key={espece.id}>
                    {i > 0 ? " " : null}
                    <span className={styles.bete}>
                      <span className={styles.portrait} aria-hidden="true">
                        <Illustration chemin={portraitDeLEspece(espece.id)} alt="" sizes="32px" className={styles.peinture} />
                      </span>
                      {`${espece.nom} `}
                      <em>{`× ${espece.nombre}`}</em>
                    </span>
                  </Fragment>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
        <div className={styles.pied}>
          <dl className={styles.retour}>
            <div>
              <dt>Retour prévu</dt>
              <dd>{retour ? <time dateTime={retour.toISOString()}>{formaterJourEtHeure(retour, FUSEAU)}</time> : AUCUNE}</dd>
            </div>
          </dl>
          {phase !== "retour" && retour ? (
            <button
              type="button"
              className={`${kit.bouton} ${kit.secondaire} ${styles.rappeler}`}
              disabled={rappelEnCours}
              aria-describedby={id("destination")}
              onClick={() => demarrer(() => rappeler(expedition.id))}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true" className={styles.trait}>
                <path d="M10 6H2.5M5.5 3l-3 3 3 3" />
              </svg>
              Rappeler
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
