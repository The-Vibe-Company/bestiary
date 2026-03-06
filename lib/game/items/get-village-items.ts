import { prisma } from '@/lib/prisma'

export async function getVillageItems(villageId: string) {
  return prisma.villageItem.findMany({
    where: { villageId },
    orderBy: { discoveredAt: 'desc' },
  })
}
