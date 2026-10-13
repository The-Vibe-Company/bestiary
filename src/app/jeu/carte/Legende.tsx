"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import kit from "@/components/kit.module.css";
import { BROUILLARD } from "@/monde/couleurs-de-la-carte";
import { ZONE_COEUR, ZONE_COURONNE } from "@/monde/zones";
import { Echantillon, ICI } from "./Echantillon";
import styles from "./Legende.module.css";

/** Une teinte de la carte (un Biome de terre, ou une eau), et son nom affiché. */
export type TeinteNommee = { teinte: string; nom: string };

/** Ce que l'appareil retient de la légende : « ouverte » ou « fermee ». */
const CLE = "bestia.legende-de-la-carte";

/** Si la légende était ouverte ; sans mémoire de l'appareil (navigation privée stricte), elle reste fermée. */
function legendeOuverte(): boolean {
  try {
    return localStorage.getItem(CLE) === "ouverte";
  } catch {
    return false;
  }
}

/** Retient si la légende est ouverte. Sans mémoire de l'appareil, rien ne casse : elle s'ouvre fermée la prochaine fois. */
function retenirLaLegende(ouverte: boolean): void {
  try {
    localStorage.setItem(CLE, ouverte ? "ouverte" : "fermee");
  } catch {
    // Elle s'ouvrira fermée, voilà tout.
  }
}

/** US-0426 : les écrans où la légende s'ouvre en bas de la carte, ceux de Legende.module.css. */
const MOBILE = "(max-width: 820px)";

/**
 * US-0431 : ce que la légende dit à la page quand elle se montre : sur mobile, un seul panneau en bas de la carte à
 * la fois, et la fiche d'une Case ouverte là se ferme (FicheDeLaCase).
 */
export const LEGENDE_MONTREE = "bestia:legende-montree";

/**
 * US-0426 : la bande du bas de la carte que prend un panneau posé en bas de l'écran, la légende ou la fiche d'une Case :
 * sa hauteur, et la marge qui le sépare du bas de la carte ; rien d'un panneau fermé.
 */
export function bandeDuBas(panneau: Element): number {
  const { height } = panneau.getBoundingClientRect();
  return height > 0 ? height + (parseFloat(getComputedStyle(panneau).marginBottom) || 0) : 0;
}

/**
 * US-0426 : publie sur la page (--hauteur-legende) la bande du bas de la carte que prend le panneau ouvert, sur mobile :
 * les boutons de la carte et la flèche du Foyer restent au-dessus. Rien quand il est fermé, ni sur ordinateur.
 */
function publierLaHauteur(panneau: HTMLElement): void {
  const hauteur = matchMedia(MOBILE).matches ? bandeDuBas(panneau) : 0;
  if (hauteur > 0) document.documentElement.style.setProperty("--hauteur-legende", `${hauteur}px`);
  else document.documentElement.style.removeProperty("--hauteur-legende");
}

/** US-0433 : deux Cases côte à côte, celle de gauche de la zone `zone`, celle de droite non : leur limite entre elles. */
const deuxCases = (zone: number) => ({ q: [0, 1], r: [0, 0], teinte: [0, 0], zone: [zone, 0] });

/** Une liste de la légende, sous son petit titre ; sur une colonne, pour des échantillons plus larges. */
function Groupe({ titre, uneColonne = false, children }: { titre: string; uneColonne?: boolean; children: ReactNode }) {
  return (
    <div className={styles.groupe}>
      <h2 className={`${kit.etiquette} ${styles.titre}`}>{titre}</h2>
      <ul className={`${styles.liste} ${uneColonne ? styles.uneColonne : ""}`}>{children}</ul>
    </div>
  );
}

/**
 * US-0432 : la légende de la carte, derrière un bouton « Légende » en haut à droite : chaque Biome de terre et chaque
 * eau, dans leur ordre, chacun dans une Case dessinée comme sur la carte, puis le repère de son Foyer et les Foyers des
 * autres chefs ; US-0433 : et les liserés des limites de la Couronne et du Cœur sauvage ; US-0437 : enfin le brouillard.
 * Un geste l'ouvre, un autre la ferme ; l'appareil retient si elle était ouverte. Le bouton et le panneau sont du verre
 * du kit, comme la fiche d'une Case. Sur ordinateur, un panneau flottant sous le bouton ; sur mobile, un panneau en bas,
 * au-dessus des onglets, qui laisse voir la carte.
 * US-0426 : elle se déclare posée sur la carte, et publie la hauteur de son panneau ouvert en bas. US-0431 : sur
 * mobile, elle cède sa place en bas à la fiche d'une Case, et la reprend dès qu'on touche son bouton.
 */
export function Legende({ terre, eaux }: { terre: TeinteNommee[]; eaux: TeinteNommee[] }) {
  const [ouverte, setOuverte] = useState(false);
  const panneau = useId();
  const refPanneau = useRef<HTMLDivElement>(null);

  // L'appareil retient la légende ouverte : on ne peut le lire qu'une fois dans le navigateur.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique d'un état extérieur (localStorage)
    if (legendeOuverte()) setOuverte(true);
  }, []);

  // US-0426 : sa hauteur publiée à chaque changement de taille du panneau (ouvert, fermé) ou de l'écran.
  useEffect(() => {
    const publier = () => publierLaHauteur(refPanneau.current!);
    const suivi = new ResizeObserver(publier);
    suivi.observe(refPanneau.current!);
    const ecran = matchMedia(MOBILE);
    ecran.addEventListener("change", publier);
    return () => {
      suivi.disconnect();
      ecran.removeEventListener("change", publier);
      document.documentElement.style.removeProperty("--hauteur-legende");
    };
  }, []);

  // US-0431 : sur mobile, la fiche d'une Case ouverte masque le panneau (page.module.css) : le bouton ferme alors la
  // fiche et montre la légende, sans la refermer ; elle le dit à chaque fois qu'elle se montre.
  const basculer = () => {
    const masquee = ouverte && getComputedStyle(refPanneau.current!).display === "none";
    if (!ouverte || masquee) document.dispatchEvent(new Event(LEGENDE_MONTREE));
    if (masquee) return;
    setOuverte(!ouverte);
    retenirLaLegende(!ouverte);
  };

  return (
    <div className={styles.legende} data-sur-la-carte="">
      <button type="button" className={styles.bouton} aria-expanded={ouverte} aria-controls={panneau} onClick={basculer}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M8 2 14.5 5.4 8 8.8 1.5 5.4z" />
          <path d="M2.6 8.2 8 11l5.4-2.8M2.6 10.9 8 13.7l5.4-2.8" />
        </svg>
        Légende
      </button>
      <div id={panneau} ref={refPanneau} className={`${kit.panneau} ${kit.verre} ${styles.panneau}`} hidden={!ouverte}>
        <Groupe titre="Terre">
          {terre.map(({ teinte, nom }) => (
            <li key={teinte}>
              <Echantillon teinte={teinte} />
              {nom}
            </li>
          ))}
        </Groupe>
        <Groupe titre="Eau">
          {eaux.map(({ teinte, nom }) => (
            <li key={teinte}>
              <Echantillon teinte={teinte} />
              {nom}
            </li>
          ))}
        </Groupe>
        <Groupe titre="Repères" uneColonne>
          {/* Tous les Foyers naissent en prairie. */}
          <li>
            <Echantillon teinte="prairie" foyer={ICI} />
            Votre Foyer
          </li>
          <li>
            <Echantillon teinte="prairie" foyers={[ICI]} />
            Autres Foyers
          </li>
          <li>
            <Echantillon teinte="prairie" cases={deuxCases(ZONE_COURONNE)} />
            Limite de la Couronne
          </li>
          <li>
            <Echantillon teinte="prairie" cases={deuxCases(ZONE_COEUR)} />
            Limite du Cœur sauvage
          </li>
          <li>
            <Echantillon teinte={BROUILLARD} />
            Brouillard
          </li>
        </Groupe>
      </div>
    </div>
  );
}
