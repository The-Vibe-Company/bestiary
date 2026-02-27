import { prisma } from '@/lib/prisma'

export async function getUnoccupiedInhabitantsCount(
  villageId: string,
  totalInhabitants: number
): Promise<number> {
  if (totalInhabitants <= 0) {
    return 0
  }

  const [activeMissionsAgg, activeBuildings, activeResearch, buildingStaff] = await Promise.all([
    prisma.mission.aggregate({
      _sum: { workerCount: true },
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
    prisma.villageInhabitants.findUnique({
      where: { villageId },
      select: {
        watchman: true,
        tavernkeeper: true,
        mayor: true,
        splitter: true,
        stonecutter: true,
        victualer: true,
        butcher: true,
      },
    }),
  ])

  const busyBuilders = activeBuildings._sum.assignedBuilders ?? 0
  const busyResearchers = activeResearch._sum.assignedResearchers ?? 0
  const busyMissionWorkers = activeMissionsAgg._sum.workerCount ?? 0
  const busyBuildingStaff =
    (buildingStaff?.watchman ?? 0) +
    (buildingStaff?.tavernkeeper ?? 0) +
    (buildingStaff?.mayor ?? 0) +
    (buildingStaff?.splitter ?? 0) +
    (buildingStaff?.stonecutter ?? 0) +
    (buildingStaff?.victualer ?? 0) +
    (buildingStaff?.butcher ?? 0)

  return Math.max(totalInhabitants - busyMissionWorkers - busyBuilders - busyResearchers - busyBuildingStaff, 0)
}
