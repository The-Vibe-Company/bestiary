import { prisma } from '@/lib/prisma'
import type { VillageBuilding } from '@prisma/client'

export async function getVillageBuildings(
  userId: string
): Promise<VillageBuilding[]> {
  const village = await prisma.village.findUnique({
    where: { ownerId: userId },
    include: { buildings: true },
  })

  if (!village) return []

  return village.buildings
}
