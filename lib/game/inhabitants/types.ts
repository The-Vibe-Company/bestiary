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
] as const;

export type InhabitantType = (typeof INHABITANT_TYPES)[number];

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
  createdAt: Date;
  updatedAt: Date;
}
