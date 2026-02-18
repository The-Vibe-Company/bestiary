import { prisma } from '@/lib/prisma'

export async function getUnoccupiedInhabitantsCount(
  villageId: string,
  totalInhabitants: number
): Promise<number> {
  if (totalInhabitants <= 0) {
    return 0
  }

  const [activeMissionsCount, activeBuildings] = await Promise.all([
    prisma.mission.count({
      where: {
        villageId,
        completedAt: null,
      },
    }),
    prisma.villageBuilding.aggregate({
      where: {
        villageId,
        completedAt: null,
      },
      _sum: {
        assignedBuilders: true,
      },
    }),
  ])

  const busyBuilders = activeBuildings._sum.assignedBuilders ?? 0

  return Math.max(totalInhabitants - activeMissionsCount - busyBuilders, 0)
}
