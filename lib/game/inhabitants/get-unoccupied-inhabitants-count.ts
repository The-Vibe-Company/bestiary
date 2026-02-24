import { prisma } from '@/lib/prisma'

export async function getUnoccupiedInhabitantsCount(
  villageId: string,
  totalInhabitants: number
): Promise<number> {
  if (totalInhabitants <= 0) {
    return 0
  }

  const [activeMissionsCount, activeBuildings, activeResearch] = await Promise.all([
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
    prisma.villageTechnology.aggregate({
      where: {
        villageId,
        completedAt: null,
      },
      _sum: {
        assignedResearchers: true,
      },
    }),
  ])

  const busyBuilders = activeBuildings._sum.assignedBuilders ?? 0
  const busyResearchers = activeResearch._sum.assignedResearchers ?? 0

  return Math.max(totalInhabitants - activeMissionsCount - busyBuilders - busyResearchers, 0)
}
