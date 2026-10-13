"use client";

import Link from "next/link";
import { type PointerEvent, type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import kit from "@/components/kit.module.css";
import { CASE_D_UN_TERRITOIRE, CASE_HORS_DE_PORTEE, versLEcran } from "@/expeditions/choix-de-destination";
import type { Fiche, FicheInconnue } from "@/monde/fiche";
import type { Coordonnees } from "@/monde/hex";
import { ZONE_COEUR, ZONE_COURONNE } from "@/monde/zones";
import { CARTE_FICHE_FERMETURE_PIXELS, PORTEE_D_EXPLORATION_CASES } from "@/reglages";
import { ficheDeLaCase } from "./actions";
import type { Cadre } from "./dessin";
import styles from "./FicheDeLaCase.module.css";
import { bandeDuBas, LEGENDE_MONTREE } from "./Legende";
import { bandeauDuBiome } from "./peintures";

/** US-0429 : où est la Case dans le Monde, selon sa zone. US-0923 : entre la Couronne et le Cœur sauvage, son Anneau suffit. */
const ZONES: Record<number, string> = { [ZONE_COURONNE]: "Couronne · ", [ZONE_COEUR]: "Cœur sauvage · ", 0: "" };

/** US-0429 : « À 7 Cases de votre Foyer ». */
const aDistance = (n: number) => `À ${n} Case${n > 1 ? "s" : ""} de votre Foyer`;

/**
 * La Case choisie sur la carte, et sa fiche : null tant que le serveur ne l'a pas donnée ; `echec` s'il n'a pas pu.
 * US-0438 : une Case sous le brouillard a une fiche inconnue.
 */
export type Choix = { case: Coordonnees; fiche: Fiche | FicheInconnue | null; echec: boolean };

/**
 * US-0428 : la Case que le joueur choisit sur la carte (`choisir`), et sa fiche, demandée au serveur dès qu'elle est
 * choisie : la carte la surligne aussitôt, la fiche se remplit à la réponse. La Case déjà choisie ne se redemande pas,
 * sauf après un échec. Une Case que le Monde du joueur n'a pas, pour le serveur, n'a pas de fiche. US-0430 : une autre
 * Case remplace la fiche ; toucher la carte hors de ses Cases (null), ou `fermer`, la ferme. Une réponse arrivée après
 * qu'on a choisi une autre Case ou fermé la fiche n'y vient plus.
 */
export function useFicheDeLaCase() {
  const [choix, setChoix] = useState<Choix | null>(null);
  const choisir = useCallback(
    (c: Coordonnees | null) =>
      setChoix((avant) => (!c ? null : avant && !avant.echec && avant.case.q === c.q && avant.case.r === c.r ? avant : { case: c, fiche: null, echec: false })),
    [],
  );
  const fermer = useCallback(() => setChoix(null), []);
  // La Case dont la fiche est attendue : elle se demande une fois, et seule sa réponse compte.
  const attendue = choix && !choix.fiche && !choix.echec ? choix.case : null;
  useEffect(() => {
    if (!attendue) return;
    let aJour = true;
    ficheDeLaCase(attendue.q, attendue.r).then(
      (fiche) => aJour && setChoix(fiche ? { case: attendue, fiche, echec: false } : null),
      () => aJour && setChoix({ case: attendue, fiche: null, echec: true }),
    );
    return () => {
      aJour = false;
    };
  }, [attendue]);
  return { choix, choisir, fermer };
}

/** Le cadre d'un élément de la page en pixels de la carte, depuis son coin en haut à gauche. */
function surLaCarte(element: Element, carte: Element | null): Cadre {
  const [ici, origine] = [element.getBoundingClientRect(), carte?.getBoundingClientRect() ?? { left: 0, top: 0 }];
  return { x: ici.left - origine.left, y: ici.top - origine.top, largeur: ici.width, hauteur: ici.height };
}

/** US-0431 : si la fiche est en bas de l'écran, comme sur mobile, où la feuille de style la pose en position fixe. */
function enBas(element: Element): boolean {
  return getComputedStyle(element).position === "fixed";
}

/** US-0430 : ferme la fiche, et rend la main à la carte. */
function fermerVersLaCarte(fermer: () => void, carte: RefObject<HTMLCanvasElement | null>) {
  fermer();
  carte.current?.focus();
}

/**
 * Le panneau d'une fiche posée sur la carte, celle d'une Case (US-0428) ou, avec US-0913, celle d'une Expédition : `nom`,
 * ce qu'il est pour les lecteurs d'écran, et ce qu'il montre (`children` : un bandeau peint, Bandeau, puis son corps).
 * Un panneau du kit, ses coins de cuivre, d'un seul ton. Sur ordinateur, flottant en haut à gauche de la carte (la légende est
 * à droite) : à l'ouverture, à chaque Case `laCase` et chaque fois que sa taille
 * change, il demande à la carte de montrer cette Case hors de lui (`montrer`). Rempli par le serveur (`remplie`), les
 * lecteurs d'écran l'entendent une fois rempli ; sans `remplie`, rien n'y est annoncé. Il se déclare posé sur la carte :
 * la flèche du Foyer le contourne. US-0430 : il se ferme (`fermer`) par sa croix, ou par Échap, le regard sur la carte,
 * ses boutons ou la fiche (ailleurs, Échap revient à ce qui l'a, comme le menu du chef) ; la main revient alors à la
 * carte. US-0431 : sur mobile, un panneau en bas de l'écran, comme celui de la légende, qu'on ferme en le faisant glisser
 * vers le bas au-delà de CARTE_FICHE_FERMETURE_PIXELS (en deçà, il revient) ; tant qu'il est ouvert, il publie la bande
 * du bas de la carte qu'il prend (bandeDuBas) dans --hauteur-fiche, sur la racine de la page, pour les boutons de la
 * carte et la flèche du Foyer. Un seul panneau en bas à la fois : la légende qui s'y montre le ferme. Le doigt qui
 * touche un lien ou un bouton ne le fait pas glisser.
 */
export function PanneauSurLaCarte({
  nom,
  laCase,
  carte,
  montrer,
  fermer,
  remplie,
  children,
}: {
  nom: string;
  laCase: Coordonnees;
  carte: RefObject<HTMLCanvasElement | null>;
  montrer: (c: Coordonnees, cache: Cadre) => void;
  fermer: () => void;
  remplie?: boolean;
  children: ReactNode;
}) {
  const panneau = useRef<HTMLElement>(null);
  useEffect(() => {
    const echap = (evenement: KeyboardEvent) => {
      // Le regard sur la carte, ses boutons ou la fiche, qui sont ensemble : ou nulle part.
      const regard = document.activeElement;
      const ici = !regard || regard === document.body || panneau.current?.parentElement?.contains(regard);
      if (evenement.key === "Escape" && ici) fermerVersLaCarte(fermer, carte);
    };
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [carte, fermer]);
  // US-0431 : un seul panneau en bas de l'écran à la fois : la légende qui s'y montre ferme la fiche.
  useEffect(() => {
    const ceder = () => {
      if (panneau.current && enBas(panneau.current)) fermer();
    };
    document.addEventListener(LEGENDE_MONTREE, ceder);
    return () => document.removeEventListener(LEGENDE_MONTREE, ceder);
  }, [fermer]);
  // La Case montrée, pour le suivi de taille : la dernière choisie.
  const montree = useRef(laCase);
  useEffect(() => {
    const element = panneau.current!;
    const racine = document.documentElement.style;
    const suivi = new ResizeObserver(() => {
      // US-0431 : en bas de l'écran, elle dit sa hauteur aux boutons de la carte, qui restent au-dessus d'elle.
      if (enBas(element)) racine.setProperty("--hauteur-fiche", `${bandeDuBas(element)}px`);
      else racine.removeProperty("--hauteur-fiche");
      montrer(montree.current, surLaCarte(element, carte.current));
    });
    suivi.observe(element);
    return () => {
      suivi.disconnect();
      racine.removeProperty("--hauteur-fiche");
    };
  }, [carte, montrer]);
  useEffect(() => {
    montree.current = laCase;
    montrer(laCase, surLaCarte(panneau.current!, carte.current));
  }, [laCase, carte, montrer]);

  // US-0431 : la fiche tirée vers le bas, en bas de l'écran : par quel pointeur, d'où, et de combien de pixels.
  const [tirage, setTirage] = useState<{ pointeur: number; depart: number; descente: number } | null>(null);
  const poser = (evenement: PointerEvent<HTMLElement>) => {
    if (evenement.button !== 0 || (evenement.target as Element).closest("button, a") || !enBas(evenement.currentTarget)) return;
    evenement.currentTarget.setPointerCapture(evenement.pointerId);
    setTirage({ pointeur: evenement.pointerId, depart: evenement.clientY, descente: 0 });
  };
  const tirer = (evenement: PointerEvent<HTMLElement>) => {
    if (tirage?.pointeur === evenement.pointerId) setTirage({ ...tirage, descente: Math.max(0, evenement.clientY - tirage.depart) });
  };
  const lacher = (evenement: PointerEvent<HTMLElement>) => {
    if (tirage?.pointeur !== evenement.pointerId) return;
    setTirage(null);
    if (evenement.type === "pointerup" && evenement.clientY - tirage.depart > CARTE_FICHE_FERMETURE_PIXELS) fermer();
  };

  return (
    <section
      ref={panneau}
      className={`${kit.panneau} ${styles.fiche}`}
      aria-label={nom}
      aria-live={remplie === undefined ? undefined : "polite"}
      aria-busy={remplie === undefined ? undefined : !remplie}
      // US-0431 : la légende s'efface sur mobile tant qu'elle est ouverte. US-0428 : la flèche vers le Foyer l'évite.
      data-fiche-de-la-case=""
      data-sur-la-carte=""
      style={tirage ? { transform: `translateY(${tirage.descente}px)`, transition: "none" } : undefined}
      onPointerDown={poser}
      onPointerMove={tirer}
      onPointerUp={lacher}
      onPointerCancel={lacher}
    >
      <div className={styles.poignee} aria-hidden="true" />
      <button type="button" className={styles.fermer} aria-label="Fermer la fiche" onClick={() => fermerVersLaCarte(fermer, carte)}>
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
        </svg>
      </button>
      {children}
    </section>
  );
}

/**
 * US-0428 : la fiche de la Case choisie (`choix`), dans son panneau sur la carte (PanneauSurLaCarte) : son Biome, puis
 * à qui elle est, « Libre », « Votre Foyer » ou le nom du chef. US-0429 : sa zone, sa distance au Foyer (sauf pour le
 * Foyer lui-même) et, au Cœur sauvage, ce qui y vit. Vide en attendant le serveur ; les lecteurs d'écran l'entendent une
 * fois remplie. US-0438 : d'une Case sous le brouillard, seulement « Case inconnue », sa distance au Foyer, et qu'une
 * Expédition pourra la découvrir, comme le serveur la donne. US-0901 : une fois remplie, « Envoyer une Expédition »
 * ouvre l'écran d'Expédition avec la Case pour destination, sauf sur une Case d'un Territoire, Foyer du joueur compris,
 * qui ne peut pas en être une (US-0907) ; le doigt qui le touche ne fait pas glisser le panneau. US-0907 : sur la carte
 * ouverte pour choisir la destination (`destination`), « Choisir cette destination » à sa place, ou le refus d'une Case
 * d'un Territoire. US-0908 : de même d'une Case au-delà de la portée d'exploration, découverte ou non : aucun des deux
 * liens, et son refus sur la carte ouverte pour choisir la destination.
 */
export function FicheDeLaCase({
  choix,
  carte,
  montrer,
  fermer,
  destination = null,
}: {
  choix: Choix;
  carte: RefObject<HTMLCanvasElement | null>;
  montrer: (c: Coordonnees, cache: Cadre) => void;
  fermer: () => void;
  destination?: string | null;
}) {
  const { case: laCase, fiche, echec } = choix;
  return (
    <PanneauSurLaCarte nom="Fiche de la Case" laCase={laCase} carte={carte} montrer={montrer} fermer={fermer} remplie={Boolean(fiche) || echec}>
      {fiche && "inconnue" in fiche ? (
        <>
          <Bandeau biome={null} titre="Case inconnue" />
          <div className={styles.corps}>
            <Distance cases={fiche.distance} />
            <p className={kit.note}>Une Expédition pourra la découvrir.</p>
            <VersLExpedition vers={laCase} destination={destination} refus={horsDePortee(fiche)} />
          </div>
        </>
      ) : fiche ? (
        <>
          <Bandeau biome={fiche.biome} titre={fiche.biome} />
          <div className={styles.corps}>
            <dl className={styles.details}>
              <div>
                <dt>Propriétaire</dt>
                <dd>{fiche.aVous ? "Votre Foyer" : (fiche.chef ?? "Libre")}</dd>
              </div>
              <div>
                <dt>Zone</dt>
                <dd>{`${ZONES[fiche.zone]}Anneau ${fiche.anneau}`}</dd>
              </div>
            </dl>
            {fiche.distance > 0 ? <Distance cases={fiche.distance} /> : null}
            {fiche.zone === ZONE_COEUR ? <p className={styles.rares}>Les Espèces les plus rares vivent ici.</p> : null}
            <VersLExpedition vers={laCase} destination={destination} refus={fiche.chef !== null || fiche.distance === 0 ? CASE_D_UN_TERRITOIRE : horsDePortee(fiche)} />
          </div>
        </>
      ) : echec ? (
        <p className={styles.echec}>La fiche n&apos;a pas pu s&apos;ouvrir.</p>
      ) : (
        <div className={styles.attente} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </PanneauSurLaCarte>
  );
}

/**
 * Le bandeau peint en tête d'une fiche sur la carte, d'un bord à l'autre : le paysage du Biome `biome` (bandeauDuBiome),
 * la mer du soir d'une eau sans paysage, ou la brume d'une Case inconnue (null) ; fondu vers le panneau en bas, où se
 * pose son titre (`titre`), en Marcellus. US-0913 : aussi celui de la fiche d'une Expédition, du Biome de sa destination.
 */
export function Bandeau({ biome, titre }: { biome: string | null; titre?: string }) {
  const bandeau = bandeauDuBiome(biome);
  const fond = "fond" in bandeau && bandeau.fond ? styles[bandeau.fond] : "";
  return (
    <div className={`${styles.bandeau} ${fond}`} style={"peinture" in bandeau ? { backgroundImage: `url(${bandeau.peinture})` } : undefined}>
      {titre ? <h2 className={styles.biome}>{titre}</h2> : null}
    </div>
  );
}

/** US-0429 : « À 7 Cases de votre Foyer », après une petite Case de cuivre, sous un filet. */
function Distance({ cases }: { cases: number }) {
  return (
    <p className={styles.distance}>
      <svg viewBox="-9 -10 18 20" aria-hidden="true">
        <path d="M0-9 7.8-4.5v9L0 9-7.8 4.5v-9z" />
      </svg>
      {aDistance(cases)}
    </p>
  );
}

/** US-0908 : le refus d'une Case au-delà de la portée d'exploration, d'après sa distance au Foyer ; null à portée. */
const horsDePortee = ({ distance }: { distance: number }) => (distance > PORTEE_D_EXPLORATION_CASES ? CASE_HORS_DE_PORTEE : null);

/**
 * US-0901 : « Envoyer une Expédition », au pied de la fiche, vers l'écran d'Expédition avec la Case `vers` pour
 * destination ; rien sur une Case qui ne peut pas en être une (`refus`) : une Case d'un Territoire (US-0907), ou
 * au-delà de la portée d'exploration (US-0908). US-0907 : sur la carte ouverte pour choisir la destination
 * (`destination`, son adresse), « Choisir cette destination », qui revient à l'écran avec la Case et les autres choix
 * qu'il avait ; sur une Case qui ne peut pas en être une, le refus à sa place.
 */
function VersLExpedition({ vers, refus, destination }: { vers: Coordonnees; refus: string | null; destination: string | null }) {
  if (refus) return destination === null ? null : <p className={styles.refus}>{refus}</p>;
  return (
    <Link href={versLEcran(vers, destination ?? "")} className={`${kit.bouton} ${kit.principal} ${kit.grand} ${styles.envoyer}`}>
      {destination === null ? "Envoyer une Expédition" : "Choisir cette destination"}
    </Link>
  );
}
