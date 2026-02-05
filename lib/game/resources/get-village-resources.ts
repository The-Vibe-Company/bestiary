import { prisma } from '@/lib/prisma'
import { VillageResources } from './types'

export async function getVillageResources(
  userId: string
): Promise<VillageResources | null> {
  const village = await prisma.village.findUnique({
    where: { ownerId: userId },
    include: { resources: true },
  })

  if (!village) return null

  // Create resources record if not exists (lazy initialization)
  if (!village.resources) {
    return await prisma.villageResources.create({
      data: { villageId: village.id },
    })
  }

  return village.resources
}
