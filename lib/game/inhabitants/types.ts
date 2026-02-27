// Inhabitant types in display order (DB field names in English)
export const INHABITANT_TYPES = [
  "lumberjack", // Bûcheron
  "miner", // Tailleur de Pierre
  "explorer", // Explorateur
  "hunter", // Chasseur
  "gatherer", // Cueilleur
  "breeder", // Éleveur
  "farmer", // Agriculteur
  "researcher", // Chercheur
  "builder", // Bâtisseur
  "watchman", // Guetteur
  "tavernkeeper", // Tavernier
  "mayor", // Maire
  "splitter", // Fendeur
  "stonecutter", // Tailleur de pierre
  "victualer", // Vivandier
  "butcher", // Boucher
] as const;

export type InhabitantType = (typeof INHABITANT_TYPES)[number];

/** Inhabitant types that are permanently stationed at a building */
export const BUILDING_STAFF_TYPES: Record<string, string> = {
  watchman: "tour_de_guet",
  tavernkeeper: "taverne",
  mayor: "hotel_de_ville",
  splitter: "entrepot_bois",
  stonecutter: "entrepot_pierre",
  victualer: "entrepot_cereales",
  butcher: "entrepot_viande",
};

/** Display names for building staff types (used in error messages) */
export const STAFF_BUILDING_NAMES: Record<string, string> = {
  tour_de_guet: "La tour de guet",
  taverne: "La taverne",
  hotel_de_ville: "L'Hôtel de Ville",
  entrepot_bois: "Le Bûcher",
  entrepot_pierre: "La Taillerie",
  entrepot_cereales: "Le Cellier",
  entrepot_viande: "Le Fumoir",
};

/** Display names for staff types (used in error messages) */
export const STAFF_TYPE_NAMES: Record<string, string> = {
  watchman: "guetteur",
  tavernkeeper: "tavernier",
  mayor: "maire",
  splitter: "fendeur",
  stonecutter: "tailleur de pierre",
  victualer: "vivandier",
  butcher: "boucher",
};

export interface VillageInhabitants {
  id: string;
  villageId: string;
  lumberjack: number;
  miner: number;
  explorer: number;
  hunter: number;
  gatherer: number;
  breeder: number;
  farmer: number;
  researcher: number;
  builder: number;
  watchman: number;
  tavernkeeper: number;
  mayor: number;
  splitter: number;
  stonecutter: number;
  victualer: number;
  butcher: number;
  createdAt: Date;
  updatedAt: Date;
}
