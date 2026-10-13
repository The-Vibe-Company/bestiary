import Image from "next/image";
import styles from "./Paysage.module.css";

/**
 * La peinture de chaque Biome, sous public/illustrations, par le nom que le jeu lui donne (une eau, par sa variante,
 * comme la fiche d'une Case).
 */
const PEINTURES: Record<string, string> = {
  Prairie: "prototype/biomes/plains-1.webp",
  Forêt: "prototype/biomes/forest-1.webp",
  Jungle: "prototype/biomes/jungle-1.webp",
  Savane: "prototype/biomes/savanna-1.webp",
  Désert: "prototype/biomes/desert-1.webp",
  Montagne: "prototype/biomes/highlands-1.webp",
  Toundra: "prototype/biomes/tundra-2.webp",
  Banquise: "prototype/biomes/tundra-1.webp",
  Eau: "prototype/biomes/plains-2.webp",
  Lac: "prototype/biomes/plains-2.webp",
  Rivière: "prototype/biomes/forest-1.webp",
  Côte: "prototype/biomes/jungle-2.webp",
  Mer: "prototype/biomes/jungle-2.webp",
};

/** La peinture d'un Biome que la liste n'a pas encore : la prairie, où naissent tous les Foyers. */
const PEINTURE_PAR_DEFAUT = PEINTURES.Prairie;

/** Sous la brume, une terre qu'on ne distingue pas : la vallée et son lac, floutés. */
const SOUS_LA_BRUME = "prototype/biomes/plains-2.webp";

/** La peinture d'un Biome, sous public/illustrations (« prototype/biomes/jungle-1.webp »). */
export const peintureDuBiome = (biome: string): string => PEINTURES[biome] ?? PEINTURE_PAR_DEFAUT;

type PaysageProps = {
  /** Le Biome de la destination : sa peinture. */
  biome?: string;
  /** Une autre peinture, sous public/illustrations, à la place de celle du Biome (sous la brume aussi). */
  peinture?: string;
  /** La destination est encore sous le brouillard : la peinture se perd dans la brume, un « ? » au milieu. */
  brume?: boolean;
  /** La largeur affichée selon l'écran, pour charger la bonne taille (voir next/image). */
  sizes?: string;
  /** À charger tout de suite : le paysage est visible sans défiler. */
  prioritaire?: boolean;
  className?: string;
};

/**
 * Le paysage d'une destination, en bandeau dans un panneau (une Expédition en cours, celle qu'on prépare) : la peinture de
 * son Biome, qui remplit la place que la page lui donne ; sous le brouillard, une terre qu'on ne distingue pas, perdue
 * dans la brume, et au milieu un « ? » dans son hexagone de cuivre, comme une Case encore à découvrir. Il ne sert qu'aux
 * yeux : la page dit le Biome, ou « inconnu », en mots.
 */
export function Paysage({ biome, peinture, brume = false, sizes = "100vw", prioritaire, className }: PaysageProps) {
  const chemin = peinture ?? (biome && !brume ? peintureDuBiome(biome) : SOUS_LA_BRUME);
  return (
    <div className={[styles.paysage, brume && styles.brume, className].filter(Boolean).join(" ")} aria-hidden="true">
      <Image src={`/illustrations/${chemin}`} alt="" fill sizes={sizes} preload={prioritaire} className={styles.peinture} />
      {brume ? (
        // L'hexagone de cuivre d'une Case, et son « ? » (le ::after, pour qu'il ne se lise pas parmi les textes de la page).
        <span className={styles.inconnu}>
          <svg viewBox="-34 -38 68 76">
            <path d="M0-36 31.2-18v36L0 36-31.2 18v-36z" />
            <path d="M0-30 26-15v30L0 30-26 15v-30z" />
          </svg>
        </span>
      ) : null}
    </div>
  );
}
