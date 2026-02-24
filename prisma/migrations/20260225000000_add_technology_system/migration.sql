-- CreateTable
CREATE TABLE "Technologies" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "costBois" INTEGER NOT NULL DEFAULT 0,
    "costPierre" INTEGER NOT NULL DEFAULT 0,
    "costCereales" INTEGER NOT NULL DEFAULT 0,
    "costViande" INTEGER NOT NULL DEFAULT 0,
    "researchSeconds" INTEGER NOT NULL,
    "requiredLabLevel" INTEGER NOT NULL DEFAULT 1,
    "maxLevel" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Technologies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VillageTechnologies" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "technologyKey" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "researchSeconds" INTEGER NOT NULL,
    "assignedResearchers" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VillageTechnologies_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "BuildingTypes" ADD COLUMN "requiredTechnology" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Technologies_key_key" ON "Technologies"("key");

-- CreateIndex
CREATE UNIQUE INDEX "VillageTechnologies_villageId_technologyKey_key" ON "VillageTechnologies"("villageId", "technologyKey");

-- AddForeignKey
ALTER TABLE "VillageTechnologies" ADD CONSTRAINT "VillageTechnologies_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Villages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
