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
      data: { villageId: village.id },
    })
  }

  return village.inhabitants
}
