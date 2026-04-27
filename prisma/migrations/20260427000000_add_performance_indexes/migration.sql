-- Performance indexes: speed up the very hot "find active items in this village" queries.
-- Used heavily by complete-pending-* helpers, getUnoccupiedInhabitantsCount, and applyDailyConsumption.

CREATE INDEX IF NOT EXISTS "Missions_villageId_completedAt_idx" ON "Missions"("villageId", "completedAt");
CREATE INDEX IF NOT EXISTS "Missions_villageId_inhabitantType_completedAt_idx" ON "Missions"("villageId", "inhabitantType", "completedAt");
CREATE INDEX IF NOT EXISTS "VillageBuildings_villageId_completedAt_idx" ON "VillageBuildings"("villageId", "completedAt");
CREATE INDEX IF NOT EXISTS "VillageTechnologies_villageId_completedAt_idx" ON "VillageTechnologies"("villageId", "completedAt");
