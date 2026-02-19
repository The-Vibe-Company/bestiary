-- CreateTable
CREATE TABLE IF NOT EXISTS "VillageTravelers" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "arrivesAt" TIMESTAMP(3) NOT NULL,
    "departsAt" TIMESTAMP(3) NOT NULL,
    "welcomedAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VillageTravelers_pkey" PRIMARY KEY ("id")
);

-- Backfill missing columns if the table already existed with an older shape
ALTER TABLE "VillageTravelers"
  ADD COLUMN IF NOT EXISTS "welcomedAt" TIMESTAMP(3);

ALTER TABLE "VillageTravelers"
  ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);

ALTER TABLE "VillageTravelers"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "VillageTravelers_villageId_key" ON "VillageTravelers"("villageId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'VillageTravelers_villageId_fkey'
  ) THEN
    ALTER TABLE "VillageTravelers"
      ADD CONSTRAINT "VillageTravelers_villageId_fkey"
      FOREIGN KEY ("villageId") REFERENCES "Villages"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
