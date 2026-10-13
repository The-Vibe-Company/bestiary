// La peinture du Biome d'une Case, en bandeau de sa fiche sur la carte (US-0428) : les paysages du prototype. Côté navigateur.
import { getImageProps } from "next/image";

/** Une peinture servie par Next en petit : assez pour le bandeau de la fiche, net sur un écran haute densité. */
const enBandeau = (fichier: string) => getImageProps({ src: `/illustrations/prototype/biomes/${fichier}.webp`, alt: "", width: 640, height: 427 }).props.src;

/** Le paysage de chaque Biome, par le nom que la fiche affiche ; d'une eau, seulement le Lac. */
const PEINTURES: Record<string, string> = {
  Prairie: enBandeau("plains-1"),
  Forêt: enBandeau("forest-1"),
  Jungle: enBandeau("jungle-1"),
  Savane: enBandeau("savanna-1"),
  Désert: enBandeau("desert-1"),
  Montagne: enBandeau("highlands-1"),
  Toundra: enBandeau("taiga-2"),
  Banquise: enBandeau("tundra-1"),
  Lac: enBandeau("plains-2"),
};

/** Les autres eaux, sans paysage : leur bandeau prend la mer du soir de la carte. */
const EAUX = new Set(["Côte", "Rivière", "Mer"]);

/**
 * Ce que montre le bandeau d'une Case de Biome `biome` : son paysage ; la mer du soir pour une eau sans paysage ; la brume
 * pour une Case inconnue (null) ; rien de plus pour un Biome sans paysage.
 */
export function bandeauDuBiome(biome: string | null): { peinture: string } | { fond: "eau" | "brume" | null } {
  if (biome === null) return { fond: "brume" };
  const peinture = PEINTURES[biome];
  if (peinture) return { peinture };
  return { fond: EAUX.has(biome) ? "eau" : null };
}
