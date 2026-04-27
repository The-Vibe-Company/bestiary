import { prisma } from '@/lib/prisma'
import { getVillage } from '@/lib/game/village/get-village'
import { VillageResources } from './types'

export async function getVillageResources(
  userId: string
): Promise<VillageResources | null> {
  const village = await getVillage(userId)
  if (!village) return null

  const resources = await prisma.villageResources.findUnique({
    where: { villageId: village.id },
  })

  if (resources) return resources

  // Lazy initialization
  return prisma.villageResources.create({
    data: { villageId: village.id },
  })
}
