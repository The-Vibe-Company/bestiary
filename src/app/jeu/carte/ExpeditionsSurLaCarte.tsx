"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { DetailDeLExpedition } from "@/components/DetailDeLExpedition";
import { casesDuFoyer } from "@/expeditions/choix-de-destination";
import type { ExpeditionEnCours } from "@/expeditions/en-cours";
import { retourDUneExpedition } from "@/expeditions/phase";
import { positionDUneExpedition } from "@/expeditions/position";
import type { Coordonnees } from "@/monde/hex";
import { useHeureDuJeu } from "@/temps/heure-du-jeu";
import { aLEcran, type Cadre, type Vue } from "./dessin";
import styles from "./ExpeditionsSurLaCarte.module.css";
import { PanneauSurLaCarte } from "./FicheDeLaCase";

/** US-0913 : la moitié de la place d'un repère, 44 px pour le doigt, comme la flèche du Foyer : un toucher à moins de tant de pixels de son centre le touche. */
const DEMI_PLACE = 22;

/** US-0913 : une Expédition en cours sur la carte, et son chemin (cheminDUneExpedition), calculé une fois. */
export type ExpeditionSurLaCarte = { expedition: ExpeditionEnCours; chemin: readonly Coordonnees[] };

/**
 * US-0913 : le repère d'une Expédition, tel que la carte le pose à chaque dessin : son bouton, son chemin et où elle en est
 * (`avancee`, positionDUneExpedition) ; puis là où la carte l'a posé, en pixels de la carte (`ici`), null s'il est caché.
 */
export type Repere = { id: number; bouton: HTMLButtonElement | null; chemin: readonly Coordonnees[]; avancee: number; ici: { x: number; y: number } | null };

/**
 * US-0913 : le point de l'écran où en est une Expédition sur son chemin, montré par `vue` : sur la droite qui va du centre
 * de la dernière Case atteinte au centre de la suivante, à la part du pas déjà faite (`avancee`, en Cases depuis le Foyer).
 */
export function pointDuChemin(foyer: Coordonnees, chemin: readonly Coordonnees[], avancee: number, vue: Vue): { x: number; y: number } {
  const rang = Math.min(Math.floor(avancee), chemin.length);
  const depuis = aLEcran(rang === 0 ? foyer : chemin[rang - 1], vue);
  const part = avancee - rang;
  if (part === 0 || rang === chemin.length) return depuis;
  const vers = aLEcran(chemin[rang], vue);
  return { x: depuis.x + (vers.x - depuis.x) * part, y: depuis.y + (vers.y - depuis.y) * part };
}

/**
 * US-0913 : pose chaque repère sur la carte montrée par `vue` : au point de son chemin où en est son Expédition, caché
 * quand ce point sort de l'écran. La carte l'appelle à chaque dessin, et le temps du jeu à chaque seconde : les repères
 * suivent la vue à chaque image, sans que la carte se redessine quand ils avancent.
 */
export function placerLesReperes(reperes: readonly Repere[], foyer: Coordonnees, vue: Vue): void {
  for (const repere of reperes) poserUnRepere(repere, pointDuChemin(foyer, repere.chemin, repere.avancee, vue), vue);
}

/**
 * Un repère posé par-dessus la carte (US-0913), celui d'une Expédition ou, avec US-0948, d'une Bête repérée : son
 * identifiant, son bouton, et là où la carte l'a posé, en pixels de la carte (`ici`), null s'il est caché.
 */
export type RepereSurLaCarte<T> = { id: T; bouton: HTMLButtonElement | null; ici: { x: number; y: number } | null };

/**
 * US-0913 : pose le repère `repere` au point (x, y) de la carte montrée par `vue` : son bouton déplacé là, caché quand ce
 * point sort de l'écran. US-0948 : de même pour celui d'une Bête repérée.
 */
export function poserUnRepere(repere: RepereSurLaCarte<unknown>, { x, y }: { x: number; y: number }, vue: Vue): void {
  const visible = x >= 0 && x <= vue.largeur && y >= 0 && y <= vue.hauteur;
  repere.ici = visible ? { x, y } : null;
  if (!repere.bouton) return;
  repere.bouton.hidden = !visible;
  if (visible) repere.bouton.style.transform = `translate(${x}px, ${y}px)`;
}

/**
 * US-0913 : les repères sous le point (x, y) de la carte : le plus proche, à moins de DEMI_PLACE pixels, et ceux posés au
 * même point que lui (deux Expéditions sur la même Case, ou parties ensemble), dans leur ordre ; aucun sinon. US-0948 :
 * quelle que soit leur sorte, d'où un identifiant de toute sorte : une Bête repérée sur la Case où séjourne une Expédition.
 */
export function reperesSous<T>(reperes: readonly Pick<RepereSurLaCarte<T>, "id" | "ici">[], x: number, y: number): T[] {
  let plusProche: Pick<RepereSurLaCarte<T>, "id" | "ici"> | null = null;
  let ecartMin = DEMI_PLACE;
  for (const repere of reperes) {
    const ecart = repere.ici ? Math.hypot(repere.ici.x - x, repere.ici.y - y) : Infinity;
    if (ecart <= ecartMin && (!plusProche || ecart < ecartMin)) [plusProche, ecartMin] = [repere, ecart];
  }
  const la = plusProche?.ici;
  return la ? reperes.filter(({ ici }) => ici && Math.hypot(ici.x - la.x, ici.y - la.y) < 1).map(({ id }) => id) : [];
}

/**
 * US-0913 : ce que touche un toucher en (x, y), l'Expédition `suivie` ayant sa fiche ouverte : le premier des repères
 * sous le doigt (reperesSous) ; s'il est déjà suivi, le suivant, puis la Case dessous (null), puis de nouveau le premier :
 * toucher encore au même endroit passe d'une Expédition à l'autre, puis à la Case qu'elles cachent, comme le Foyer d'où
 * elles viennent de partir. Sans repère sous le doigt, la Case (null). US-0948 : de même entre une Expédition et la Bête
 * repérée sur sa Case, l'ouvert (`suivie`) étant l'un ou l'autre.
 */
export function repereTouche<T>(reperes: readonly Pick<RepereSurLaCarte<T>, "id" | "ici">[], x: number, y: number, suivie: T | null): T | null {
  const sous = reperesSous(reperes, x, y);
  const rang = suivie === null ? -1 : sous.indexOf(suivie);
  return rang < 0 ? (sous[0] ?? null) : (sous[rang + 1] ?? null);
}

/** US-0913 : ce que le repère d'une Expédition dit aux lecteurs d'écran : vers quoi elle va, et à quelle distance. */
const versOu = ({ destination }: ExpeditionEnCours) =>
  `Expédition vers ${"inconnue" in destination ? "une Case inconnue" : destination.biome}, à ${casesDuFoyer(destination.distance)}`;

/**
 * US-0913 : les Expéditions en cours du joueur sur la carte, seulement les siennes (la page ne lui donne qu'elles) :
 * l'heure du jeu, partie de `maintenant` à l'affichage de la page, qui avance au rythme du jeu (`vitesse`,
 * useHeureDuJeu) ; le repère de chacune encore dehors, un bouton par-dessus la carte, que la carte pose sur son chemin
 * (`poser`), à chaque seconde comme à chaque dessin ; et la fiche de l'Expédition suivie (`suivie`) : son détail, celui
 * de la liste des Expéditions, avec sa phase, son temps restant, ses explorateurs et son escorte. Toucher un repère, ou
 * l'appuyer au clavier, la suit (`suivre`). Sa fiche se ferme (`fermer`) comme celle d'une Case ; à son ouverture, la
 * carte glisse pour qu'elle ne cache pas la Case la plus proche du repère (`montrer`), puis ne bouge plus d'elle-même
 * quand l'Expédition avance. Une Expédition rentrée au Foyer n'a plus ni repère ni chemin : elle n'est plus dehors,
 * même tant qu'elle reste parmi les Expéditions en cours (jusqu'à US-0916).
 */
export function ExpeditionsSurLaCarte({
  expeditions,
  foyer,
  maintenant,
  vitesse,
  poser,
  suivie,
  suivre,
  fermer,
  carte,
  montrer,
}: {
  expeditions: readonly ExpeditionSurLaCarte[];
  foyer: Coordonnees;
  maintenant: Date;
  vitesse: number;
  poser: (reperes: Repere[]) => void;
  suivie: number | null;
  suivre: (id: number) => void;
  fermer: () => void;
  carte: RefObject<HTMLCanvasElement | null>;
  montrer: (c: Coordonnees, cache: Cadre) => void;
}) {
  const instant = useHeureDuJeu(maintenant, vitesse);
  const positions = expeditions.map(({ expedition, chemin }) => positionDUneExpedition(foyer, expedition.destination, expedition, instant, chemin));
  // Celles encore dehors : pas encore rentrées au Foyer, ou sans retour chiffré.
  const dehors = expeditions.flatMap((e, i) => {
    const retour = retourDUneExpedition(e.expedition);
    return retour === null || retour > instant ? [{ ...e, avancee: positions[i].avancee }] : [];
  });
  // Les boutons des repères, par Expédition.
  const boutons = useRef(new Map<number, HTMLButtonElement>());
  // À chaque seconde du jeu : où en est chaque Expédition dehors, pour la carte, qui pose aussitôt leurs repères.
  useEffect(() => {
    poser(dehors.map(({ expedition, chemin, avancee }) => ({ id: expedition.id, bouton: boutons.current.get(expedition.id) ?? null, chemin, avancee, ici: null })));
  });
  // Plus aucun repère sur la carte une fois les Expéditions parties de la page.
  useEffect(
    () => () => {
      poser([]);
    },
    [poser],
  );
  const rang = expeditions.findIndex(({ expedition }) => expedition.id === suivie);
  // La Case la plus proche du repère de l'Expédition suivie, à l'ouverture de sa fiche : celle que la fiche ne doit pas
  // cacher. Elle ne change plus tant que la fiche reste ouverte : la carte ne glisse pas sous les doigts du joueur.
  const proche = rang < 0 ? null : Math.round(positions[rang].avancee);
  const caseProche = !proche ? foyer : expeditions[rang].chemin[proche - 1];
  const [montree, setMontree] = useState<{ id: number; c: Coordonnees } | null>(null);
  if (suivie !== null && rang >= 0 && montree?.id !== suivie) setMontree({ id: suivie, c: caseProche });
  return (
    <>
      {dehors.map(({ expedition }) => (
        <button
          key={expedition.id}
          ref={(bouton) => {
            if (bouton) boutons.current.set(expedition.id, bouton);
            else boutons.current.delete(expedition.id);
          }}
          type="button"
          className={styles.repere}
          hidden
          aria-label={versOu(expedition)}
          aria-expanded={expedition.id === suivie}
          onClick={() => suivre(expedition.id)}
        >
          <svg viewBox="0 0 32 32" focusable="false" aria-hidden="true">
            <circle className={styles.halo} cx="16" cy="16" r="14" />
            <circle className={styles.pastille} cx="16" cy="16" r="9.5" />
            <circle className={styles.oeil} cx="16" cy="16" r="3.5" />
          </svg>
        </button>
      ))}
      {rang < 0 ? null : (
        <PanneauSurLaCarte
          nom="Fiche de l'Expédition"
          laCase={montree?.id === suivie ? montree.c : caseProche}
          carte={carte}
          montrer={montrer}
          fermer={fermer}
        >
          <h2 className={styles.titre}>Expédition</h2>
          <div className={styles.detail}>
            <DetailDeLExpedition expedition={expeditions[rang].expedition} instant={instant} />
          </div>
        </PanneauSurLaCarte>
      )}
    </>
  );
}
