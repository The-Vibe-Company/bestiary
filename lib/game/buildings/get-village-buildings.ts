import { prisma } from '@/lib/prisma'
import { getVillage } from '@/lib/game/village/get-village'
import type { VillageBuilding } from '@prisma/client'

export async function getVillageBuildings(
  userId: string
): Promise<VillageBuilding[]> {
  const village = await getVillage(userId)
  if (!village) return []

  return prisma.villageBuilding.findMany({
    where: { villageId: village.id },
  })
}
