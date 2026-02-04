-- CreateTable
CREATE TABLE "Village" (
    "id" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Village_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Village_ownerId_key" ON "Village"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Village_x_y_key" ON "Village"("x", "y");
