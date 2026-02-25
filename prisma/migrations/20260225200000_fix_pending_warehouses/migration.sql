-- Fix: delete any pending (in-construction) warehouse buildings left over from
-- the warehouse-to-levels migration (THE-176). These would complete as level 1
-- and violate maxCount: 1 for the now-unique warehouse building types.
DELETE FROM "VillageBuildings"
WHERE "buildingType" IN ('entrepot_bois', 'entrepot_pierre', 'entrepot_cereales', 'entrepot_viande')
  AND "completedAt" IS NULL;
