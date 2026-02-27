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
] as const;

export type InhabitantType = (typeof INHABITANT_TYPES)[number];

/** Inhabitant types that are permanently stationed at a building */
export const BUILDING_STAFF_TYPES: Record<string, string> = {
  watchman: "tour_de_guet",
  tavernkeeper: "taverne",
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
  createdAt: Date;
  updatedAt: Date;
}
