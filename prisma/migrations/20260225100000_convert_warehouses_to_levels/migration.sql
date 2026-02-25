-- Convert warehouses from multiple-building system to level-based system (THE-176)

-- Step 1: Update BuildingType configuration
UPDATE "BuildingTypes"
SET "maxCount" = 1, "maxLevel" = 5
WHERE "key" IN ('entrepot_bois', 'entrepot_pierre', 'entrepot_cereales', 'entrepot_viande');

-- Step 2: For each village + warehouse type, set the kept building's level = number of completed instances (capped at 5)
WITH warehouse_levels AS (
  SELECT
    "villageId",
    "buildingType",
    LEAST(COUNT(*)::int, 5) AS "newLevel",
    MIN("id") AS "keepId"
  FROM "VillageBuildings"
  WHERE "buildingType" IN ('entrepot_bois', 'entrepot_pierre', 'entrepot_cereales', 'entrepot_viande')
    AND "completedAt" IS NOT NULL
  GROUP BY "villageId", "buildingType"
)
UPDATE "VillageBuildings" vb
SET "level" = wl."newLevel"
FROM warehouse_levels wl
WHERE vb."id" = wl."keepId";

-- Step 3: Delete duplicate warehouse buildings, keeping only the one we updated
WITH warehouse_keep AS (
  SELECT
    MIN("id") AS "keepId",
    "villageId",
    "buildingType"
  FROM "VillageBuildings"
  WHERE "buildingType" IN ('entrepot_bois', 'entrepot_pierre', 'entrepot_cereales', 'entrepot_viande')
    AND "completedAt" IS NOT NULL
  GROUP BY "villageId", "buildingType"
)
DELETE FROM "VillageBuildings" vb
USING warehouse_keep wk
WHERE vb."villageId" = wk."villageId"
  AND vb."buildingType" = wk."buildingType"
  AND vb."completedAt" IS NOT NULL
  AND vb."id" != wk."keepId";
