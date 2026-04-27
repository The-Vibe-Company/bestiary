import { prisma } from '@/lib/prisma'
import { getVillage } from '@/lib/game/village/get-village'
import { VillageResources } from './types'

export async function getVillageResources(
  userId: string
): Promise<VillageResources | null> {
  const village = await getVillage(userId)
  if (!village) return null

  // Atomic lazy initialization — prevents unique-constraint race when two
  // concurrent requests both observe a missing row.
  return prisma.villageResources.upsert({
    where: { villageId: village.id },
    update: {},
    create: { villageId: village.id },
  })
}
