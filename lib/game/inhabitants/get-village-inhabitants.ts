import { prisma } from '@/lib/prisma'
import { getVillage } from '@/lib/game/village/get-village'
import { VillageInhabitants } from './types'

export async function getVillageInhabitants(
  userId: string
): Promise<VillageInhabitants | null> {
  const village = await getVillage(userId)
  if (!village) return null

  const inhabitants = await prisma.villageInhabitants.findUnique({
    where: { villageId: village.id },
  })

  // Lazy initialization
  if (!inhabitants) {
    return prisma.villageInhabitants.create({
      data: { villageId: village.id, mayor: 1 },
    })
  }

  // Ensure the village always has at least one mayor.
  if (inhabitants.mayor < 1) {
    return prisma.villageInhabitants.update({
      where: { villageId: village.id },
      data: { mayor: 1 },
    })
  }

  return inhabitants
}
