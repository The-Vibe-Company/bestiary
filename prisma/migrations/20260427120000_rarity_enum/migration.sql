-- Convert VillageItems.rarity from String to a Postgres enum.
-- All current values must be valid enum members; the cast will fail otherwise.

CREATE TYPE "Rarity" AS ENUM ('commun', 'rare', 'epique', 'legendaire', 'mythique');

ALTER TABLE "VillageItems"
  ALTER COLUMN "rarity" TYPE "Rarity" USING "rarity"::"Rarity";
