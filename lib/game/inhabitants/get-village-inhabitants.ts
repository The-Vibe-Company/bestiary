import { prisma } from '@/lib/prisma'
import { VillageInhabitants } from './types'

export async function getVillageInhabitants(
  userId: string
): Promise<VillageInhabitants | null> {
  const village = await prisma.village.findUnique({
    where: { ownerId: userId },
    include: { inhabitants: true },
  })

  if (!village) return null

  // Create inhabitants record if not exists (lazy initialization)
  if (!village.inhabitants) {
    return await prisma.villageInhabitants.create({
      data: {
        villageId: village.id,
        mayor: 1,
      },
    })
  }

  // Ensure the village always has at least one mayor.
  if (village.inhabitants.mayor < 1) {
    return await prisma.villageInhabitants.update({
      where: { villageId: village.id },
      data: { mayor: 1 },
    })
  }

  return village.inhabitants
}
