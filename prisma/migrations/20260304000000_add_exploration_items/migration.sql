-- CreateTable
CREATE TABLE "VillageItems" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "missionId" TEXT,
    "rarity" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VillageItems_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VillageItems_villageId_idx" ON "VillageItems"("villageId");

-- AddForeignKey
ALTER TABLE "VillageItems" ADD CONSTRAINT "VillageItems_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Villages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillageItems" ADD CONSTRAINT "VillageItems_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
