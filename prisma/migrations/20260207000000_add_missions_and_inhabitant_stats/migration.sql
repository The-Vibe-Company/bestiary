-- AlterTable
ALTER TABLE "InhabitantTypes" ADD COLUMN     "gatherRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "maxCapacity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "speed" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Missions" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "inhabitantType" TEXT NOT NULL,
    "targetX" INTEGER NOT NULL,
    "targetY" INTEGER NOT NULL,
    "departedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "travelSeconds" INTEGER NOT NULL,
    "workSeconds" INTEGER NOT NULL,
    "recalledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Missions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Missions" ADD CONSTRAINT "Missions_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Villages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
