"use client";

import Image from "next/image";
import Link from "next/link";
import { type MouseEvent, useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { Bloc } from "@/components/Bloc";
import { iconeDeRessource } from "@/components/icone-de-ressource";
import { Jauge } from "@/components/Jauge";
import kit from "@/components/kit.module.css";
import { Medaillon } from "@/components/Medaillon";
import { quantiteExacte } from "@/monde/quantite";
import { ENTRETIEN_HABITANT_PAR_HEURE, VOYAGEUR_ALERTE_MINUTES } from "@/reglages";
import { formaterDuree } from "@/temps/affichage";
import { accueillirUnVoyageur, refuserUnVoyageur } from "./actions-aux-portes";
import styles from "./AuxPortes.module.css";
import { BoutonDuMetier, type MetierAuChoix, MetiersAuChoix } from "./MetiersAuChoix";

/** US-0340 : ce que mangera un Habitant de plus, en Nourriture par heure, à la française : « 2 ». */
const ENTRETIEN_EN_PLUS = quantiteExacte(String(ENTRETIEN_HABITANT_PAR_HEURE));

/** Le portrait d'un Voyageur, peint en bandeau en tête de sa carte : un voyageur et son chameau. */
const PORTRAIT = "/illustrations/prototype/misc/merchant.webp";

/** La Nourriture qu'il mangera, devant ce qu'il en coûtera : la Viande et les Végétaux. */
const NOURRITURE = [iconeDeRessource("viande"), iconeDeRessource("vegetaux")];

/** US-0340 : « de Joran », « d'Ines ». */
const de = (prenom: string) => (/^[aeiouyhàâäéèêëîïôöùûüœæ]/i.test(prenom) ? `d'${prenom}` : `de ${prenom}`);

/**
 * Un Voyageur tel que la partie « Aux portes » le montre : son prénom, l'heure du jeu de son arrivée et,
 * US-0333, celle de son départ.
 */
export type VoyageurAffiche = { id: number; prenom: string; arriveLe: Date; departLe: Date };

/** US-0338 : un choix sur un Voyageur dont l'action n'a pas encore répondu : l'accueillir, ou le refuser. */
type Choix = { id: number; accueil: boolean };

/** US-0332 : depuis quand un Voyageur attend, en temps du jeu : « arrivé à l'instant », « arrivé il y a 12 min », « arrivé il y a 2 h ». */
function depuisQuand(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "arrivé à l'instant";
  if (minutes < 60) return `arrivé il y a ${minutes} min`;
  return `arrivé il y a ${Math.floor(minutes / 60)} h`;
}

/**
 * US-0332 : la partie « Aux portes » de la page Habitants : une carte par Voyageur qui attend, dans l'ordre
 * de la lecture, du premier arrivé au dernier, avec son prénom posé sur son portrait et depuis quand il attend, à
 * l'heure du jeu `maintenant` ; « Personne aux portes pour l'instant. » quand personne n'attend. En tête de la colonne
 * de contexte, à droite du registre sur ordinateur, au-dessus de lui sur une tablette et un téléphone, car un Voyageur
 * n'attend pas toujours.
 *
 * US-0333 : en face de son arrivée, le temps qui lui reste avant son départ, à la minute supérieure (« repart dans
 * 11 h 42 »), et dessous sa jauge, qui diminuent en direct au rythme du jeu (`vitesse`, donnée par le serveur), sur
 * l'horloge du navigateur comme la barre des ressources ; sous VOYAGEUR_ALERTE_MINUTES minutes, dans la couleur d'alerte,
 * et « sur le départ » une fois le compte à zéro. Aucune zone annoncée : un lecteur d'écran lit le compte quand on y
 * passe, sans qu'il soit répété à chaque minute. Quand la page est relue, tout repart de la nouvelle heure.
 *
 * US-0334 : sous chaque ligne, « Accueillir » : la ligne disparaît aussitôt, le temps que l'action serveur fasse
 * du Voyageur un Habitant et relise la page, qui fait alors foi. US-0336 : à côté, « Refuser », qui le fait
 * repartir de même. US-0337 : un Voyageur déjà reparti de lui-même n'est pas accueilli ; la partie le dit, en
 * tête, jusqu'au choix suivant.
 *
 * US-0338 : quand les `placesLibres` du Territoire sont toutes prises, comptée d'avance celle de chaque accueil en
 * cours, « Accueillir » est grisé, et une phrase, une seule fois en tête de la partie, dit pourquoi ; un lecteur
 * d'écran l'entend avec chaque bouton grisé. Les Voyageurs attendent toujours, et « Refuser » reste possible.
 *
 * US-0342 : en tête de la partie, « Historique » mène aux Voyageurs passés, que quelqu'un attende ou non.
 *
 * US-0340 : l'Entretien qu'un Habitant de plus coûtera, devant la Viande et les Végétaux (« Mangera 2 Nourriture par
 * heure » : pas « +2 », que la barre emploie pour une production) : le dernier de la carte pour un lecteur d'écran, juste
 * au-dessus des boutons pour les yeux (AuxPortes.module.css). Quand
 * l'avertissement « famine imminente » est actif (`famineImminente`, compté par le serveur), l'accueil se confirme
 * sur place : le premier toucher sur « Accueillir » ne fait que changer sa ligne, le bouton devient « Confirmer
 * l'accueil », dans la couleur d'alerte, et une phrase, annoncée, dit ce que l'Habitant mangera ; le second toucher
 * accueille. « Refuser », un toucher ailleurs, le focus ailleurs ou Échap annulent ; le second clic d'un double clic
 * ne confirme pas. Pendant une Famine, l'avertissement reste actif : l'accueil reste possible, confirmé de même.
 *
 * US-0341 : pendant une Famine (`famine`, lue par le serveur), aucun Voyageur ne se présente ; une phrase, une seule
 * fois en tête de la partie, dit que les Voyageurs évitent un Territoire en Famine, à la place de « Personne aux
 * portes pour l'instant. » quand personne n'attend. Ceux qui attendaient déjà restent jusqu'au bout de leur attente.
 *
 * US-0335 : au-dessus des boutons, le Métier qu'aura le Voyageur une fois accueilli, « Sans Métier » d'abord : le même
 * bouton que sur la ligne d'un Habitant, qui déplie dessous les `metiers` au choix, un seul dépliant à la fois ; Échap
 * ou un second toucher le referment. Toucher un Métier le choisit, sans accueillir personne, et la main revient au
 * bouton ; « Sans Métier », en dernier, le retire. « Accueillir » accueille avec le Métier choisi, confirmé de même
 * quand la famine est imminente. Sans Métiers à proposer, rien à choisir : il arrive sans Métier.
 */
export function AuxPortes({
  voyageurs,
  maintenant,
  vitesse = 1,
  placesLibres,
  famineImminente = false,
  famine = false,
  metiers = [],
}: {
  voyageurs: VoyageurAffiche[];
  maintenant: Date;
  vitesse?: number;
  placesLibres: number;
  famineImminente?: boolean;
  famine?: boolean;
  metiers?: MetierAuChoix[];
}) {
  // Les choix dont l'action n'a pas encore répondu : leurs lignes sont retirées d'avance ; un accueil prend déjà sa place.
  const [enCours, choisir] = useOptimistic<Choix[], Choix>([], (actuels, choix) => [...actuels, choix]);
  const affiches = voyageurs.filter((v) => !enCours.some((c) => c.id === v.id));
  const plein = placesLibres - enCours.filter((c) => c.accueil).length <= 0;
  const phrasePlace = useId();
  // US-0339 : les Voyageurs dont un choix attend encore la réponse du serveur.
  const enVol = useRef(new Set<number>());
  const [, demarrer] = useTransition();
  const [annonce, setAnnonce] = useState<string | null>(null);
  const base = maintenant.getTime();
  // Le temps écoulé depuis l'affichage, mesuré pour cette heure du jeu-là : celui d'une heure déjà dépassée ne compte plus.
  const [ecoule, setEcoule] = useState<{ base: number; ms: number } | null>(null);

  // US-0340 : le Voyageur dont l'accueil attend sa confirmation, et le bouton qui la donne.
  const [aConfirmer, setAConfirmer] = useState<number | null>(null);
  const boutonDeConfirmation = useRef<HTMLButtonElement>(null);

  // US-0335 : le Métier choisi pour chaque Voyageur (aucun tant qu'il n'y en a pas), et le Voyageur dont les Métiers sont dépliés.
  const [choisis, setChoisis] = useState<ReadonlyMap<number, MetierAuChoix>>(new Map());
  const [deplie, setDeplie] = useState<number | null>(null);
  const prefixe = useId();
  const idBouton = (id: number) => `${prefixe}-metier-${id}`;
  const idDepliant = (id: number) => `${prefixe}-metiers-${id}`;

  // US-0335 : Échap referme le dépliant ouvert sans rien changer, et rend la main à son bouton.
  useEffect(() => {
    if (deplie === null) return;
    function fermer(evenement: KeyboardEvent) {
      if (evenement.key !== "Escape") return;
      setDeplie(null);
      document.getElementById(`${prefixe}-metier-${deplie}`)?.focus();
    }
    document.addEventListener("keydown", fermer);
    return () => document.removeEventListener("keydown", fermer);
  }, [deplie, prefixe]);

  useEffect(() => {
    const depart = performance.now();
    const battement = setInterval(() => setEcoule({ base, ms: performance.now() - depart }), 1000);
    return () => clearInterval(battement);
  }, [base]);

  // US-0340 : un toucher ou le focus ailleurs que sur « Confirmer l'accueil », ou Échap, annulent la confirmation.
  useEffect(() => {
    if (aConfirmer === null) return;
    const ailleurs = (evenement: Event) => {
      if (!boutonDeConfirmation.current?.contains(evenement.target as Node)) setAConfirmer(null);
    };
    const echap = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") setAConfirmer(null);
    };
    document.addEventListener("pointerdown", ailleurs);
    document.addEventListener("focusin", ailleurs);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("pointerdown", ailleurs);
      document.removeEventListener("focusin", ailleurs);
      document.removeEventListener("keydown", echap);
    };
  }, [aConfirmer]);

  /**
   * US-0340 : le toucher sur « Accueillir » ; quand l'avertissement « famine imminente » est actif, le premier
   * demande la confirmation, le second accueille, sauf s'il n'est que le second clic d'un double clic.
   */
  function accueillir(voyageur: VoyageurAffiche, evenement: MouseEvent) {
    if (famineImminente && aConfirmer !== voyageur.id) return setAConfirmer(voyageur.id);
    if (famineImminente && evenement.detail > 1) return;
    decider(voyageur, true);
  }

  /** US-0335 : choisit le Métier qu'aura le Voyageur une fois accueilli, ou le retire (null), et referme le dépliant. */
  function choisirLeMetier(voyageur: VoyageurAffiche, metier: MetierAuChoix | null) {
    setDeplie(null);
    // Le Métier touché s'en va avec le dépliant : la main revient au bouton de la ligne.
    document.getElementById(idBouton(voyageur.id))?.focus();
    setChoisis((actuels) => {
      const suivants = new Map(actuels);
      if (metier) suivants.set(voyageur.id, metier);
      else suivants.delete(voyageur.id);
      return suivants;
    });
  }

  /**
   * Accueille ou refuse le Voyageur : sa ligne disparaît aussitôt, le temps que l'action réponde. US-0339 : un
   * second toucher avant la réponse (un double clic, plus rapide que la ligne) ne relance rien pour ce Voyageur.
   */
  function decider(voyageur: VoyageurAffiche, accueil: boolean) {
    setAConfirmer(null);
    if (enVol.current.has(voyageur.id)) return;
    enVol.current.add(voyageur.id);
    setAnnonce(null);
    demarrer(async () => {
      try {
        choisir({ id: voyageur.id, accueil });
        // US-0335 : avec le Métier choisi sur sa ligne, ou sans Métier.
        const rendu = accueil ? await accueillirUnVoyageur(voyageur.id, choisis.get(voyageur.id)?.id ?? null) : await refuserUnVoyageur(voyageur.id);
        if (rendu === "reparti") setAnnonce("Ce Voyageur est déjà reparti.");
      } finally {
        enVol.current.delete(voyageur.id);
      }
    });
  }

  const instant = base + (ecoule?.base === base ? vitesse * ecoule.ms : 0);
  return (
    <Bloc
      titre={
        <>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 10.5V4.5a3.5 3.5 0 0 1 7 0v6M1.5 10.5h9" />
          </svg>
          Aux portes
        </>
      }
      className={affiches.length > 0 ? `${styles.auxPortes} ${styles.attendent}` : styles.auxPortes}
    >
      {/* US-0342 : les Voyageurs passés, à droite du titre. */}
      <Link href="/jeu/habitants/voyageurs" className={`${kit.lien} ${styles.historique}`}>
        Historique
      </Link>
      {annonce ? (
        <p className={styles.annonce} role="alert">
          {annonce}
        </p>
      ) : null}
      {plein && affiches.length > 0 ? (
        <p id={phrasePlace} className={styles.plusDePlace}>
          <svg viewBox="0 0 12 12" className={styles.signe} aria-hidden="true">
            <path d="M6 1.4 11 10.4H1z" />
            <path d="M6 4.6v2.8" />
            <circle cx="6" cy="8.9" r=".75" />
          </svg>
          Plus de place au Foyer. Des huttes en ajouteront quand les constructions seront là.
        </p>
      ) : null}
      {famine ? <p className={styles.famine}>Les Voyageurs évitent un Territoire en Famine.</p> : null}
      {affiches.length > 0 ? (
        <ul className={styles.voyageurs}>
          {affiches.map((v) => {
            const reste = v.departLe.getTime() - instant;
            // L'alerte vient avec le premier compte affiché sous le seuil (« 59 min »), à la minute supérieure comme lui.
            const alerte = Math.ceil(reste / 60_000) < VOYAGEUR_ALERTE_MINUTES;
            // US-0340 : sans place, rien à confirmer ; une page relue sans l'avertissement n'en demande plus.
            const confirmer = famineImminente && !plein && aConfirmer === v.id;
            // US-0335 : le Métier choisi pour lui, et si les Métiers sont dépliés sous sa ligne.
            const metier = choisis.get(v.id);
            const ouvert = metiers.length > 0 && deplie === v.id;
            // La part de son attente qui lui reste, pour la jauge.
            const attente = v.departLe.getTime() - v.arriveLe.getTime();
            return (
              <li key={v.id} className={styles.voyageur}>
                {/* Son portrait, peint, et son prénom posé dessus : le prénom suffit à un lecteur d'écran. */}
                <div className={`${kit.vignette} ${styles.portrait}`} aria-hidden="true">
                  <Image src={PORTRAIT} alt="" fill sizes="(max-width: 1023px) 180px, 270px" className={styles.peinture} />
                  <span className={styles.surtitre}>Voyageur</span>
                </div>
                <span className={styles.prenom}>{v.prenom}</span>
                <span className={styles.arrivee}>{depuisQuand(instant - v.arriveLe.getTime())}</span>
                <span className={styles.depart} data-alerte={alerte ? "" : undefined}>
                  <svg viewBox="0 0 12 12" className={styles.sablier} aria-hidden="true">
                    <path d="M3 1.5h6M3 10.5h6M3.6 1.5c0 2.6 4.8 2.6 4.8 4.5S3.6 7.9 3.6 10.5M8.4 1.5c0 2.6-4.8 2.6-4.8 4.5s4.8 1.9 4.8 4.5" />
                  </svg>
                  {reste > 0 ? `repart dans ${formaterDuree(reste / 3_600_000)}` : "sur le départ"}
                </span>
                <div className={styles.temps}>
                  <Jauge valeur={Math.max(0, reste)} max={attente} fine inverse />
                </div>
                {/* US-0335 : le Métier qu'il aura, au choix ; un lecteur d'écran entend aussi de qui il s'agit. */}
                {metiers.length > 0 ? (
                  <BoutonDuMetier
                    id={idBouton(v.id)}
                    texte={metier?.nom ?? "Sans Métier"}
                    etiquette={`Métier ${de(v.prenom)} : ${metier?.nom ?? "Sans Métier"}`}
                    icone={metier?.icone ?? null}
                    deplie={ouvert}
                    depliant={idDepliant(v.id)}
                    className={styles.metier}
                    onClick={() => setDeplie(ouvert ? null : v.id)}
                  />
                ) : null}
                {ouvert ? (
                  <MetiersAuChoix
                    id={idDepliant(v.id)}
                    etiquette={`Métier ${de(v.prenom)}`}
                    metiers={metiers}
                    actuel={metier?.nom ?? null}
                    className={styles.metiers}
                    choisir={(m) => choisirLeMetier(v, m)}
                  />
                ) : null}
                <div className={styles.choix}>
                  {/* Deux boutons par ligne : un lecteur d'écran entend aussi qui il accueille, ou refuse. */}
                  <button
                    ref={confirmer ? boutonDeConfirmation : undefined}
                    type="button"
                    className={`${kit.bouton} ${kit.principal} ${styles.accueillir}`}
                    aria-label={confirmer ? `Confirmer l'accueil ${de(v.prenom)}` : `Accueillir ${v.prenom}`}
                    data-confirmer={confirmer ? "" : undefined}
                    disabled={plein}
                    aria-describedby={plein ? phrasePlace : undefined}
                    onClick={(evenement) => accueillir(v, evenement)}
                  >
                    {confirmer ? "Confirmer l'accueil" : "Accueillir"}
                  </button>
                  <button type="button" className={`${kit.bouton} ${kit.secondaire} ${styles.refuser}`} aria-label={`Refuser ${v.prenom}`} onClick={() => decider(v, false)}>
                    Refuser
                  </button>
                </div>
                {confirmer ? (
                  <p className={styles.confirmation} role="alert">
                    {`Famine imminente : un Habitant de plus mangera ${ENTRETIEN_EN_PLUS} Nourriture par heure.`}
                  </p>
                ) : (
                  <p className={styles.entretien}>
                    <span className={styles.duo} aria-hidden="true">
                      {NOURRITURE.map((icone) => (
                        <Medaillon key={icone} src={icone} taille="xs" />
                      ))}
                    </span>
                    {`Mangera ${ENTRETIEN_EN_PLUS} Nourriture par heure`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : famine ? null : (
        <p className={styles.personne}>Personne aux portes pour l&apos;instant.</p>
      )}
    </Bloc>
  );
}
