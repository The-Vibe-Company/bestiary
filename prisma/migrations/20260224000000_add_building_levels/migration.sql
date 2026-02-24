-- AlterTable: Add maxLevel to BuildingTypes (default 1 for existing buildings)
ALTER TABLE "BuildingTypes" ADD COLUMN "maxLevel" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: Add level to VillageBuildings (default 1 for existing buildings)
ALTER TABLE "VillageBuildings" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;
