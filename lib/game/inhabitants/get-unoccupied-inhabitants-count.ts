import { prisma } from '@/lib/prisma'
import type { VillageInhabitants } from './types'

type StaffSlice = Pick<
  VillageInhabitants,
  'watchman' | 'tavernkeeper' | 'mayor' | 'splitter' | 'stonecutter' | 'victualer' | 'butcher'
>

/**
 * Counts unoccupied inhabitants by subtracting busy ones from the total.
 * If `inhabitants` is provided (already fetched by the caller), the staff query is skipped.
 */
export async function getUnoccupiedInhabitantsCount(
  villageId: string,
  totalInhabitants: number,
  inhabitants?: StaffSlice | null,
): Promise<number> {
  if (totalInhabitants <= 0) {
    return 0
  }

  const promises: [
    Promise<{ _sum: { workerCount: number | null } }>,
    Promise<{ _sum: { assignedBuilders: number | null } }>,
    Promise<{ _sum: { assignedResearchers: number | null } }>,
    Promise<StaffSlice | null> | null,
  ] = [
    prisma.mission.aggregate({
      _sum: { workerCount: true },
      where: { villageId, completedAt: null },
    }),
    prisma.villageBuilding.aggregate({
      _sum: { assignedBuilders: true },
      where: { villageId, completedAt: null },
    }),
    prisma.villageTechnology.aggregate({
      _sum: { assignedResearchers: true },
      where: { villageId, completedAt: null },
    }),
    inhabitants !== undefined
      ? null
      : prisma.villageInhabitants.findUnique({
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
  ]

  const [activeMissionsAgg, activeBuildings, activeResearch, fetchedStaff] = await Promise.all(promises)
  const staff = inhabitants !== undefined ? inhabitants : fetchedStaff

  const busyBuilders = activeBuildings._sum.assignedBuilders ?? 0
  const busyResearchers = activeResearch._sum.assignedResearchers ?? 0
  const busyMissionWorkers = activeMissionsAgg._sum.workerCount ?? 0
  const busyBuildingStaff =
    (staff?.watchman ?? 0) +
    (staff?.tavernkeeper ?? 0) +
    (staff?.mayor ?? 0) +
    (staff?.splitter ?? 0) +
    (staff?.stonecutter ?? 0) +
    (staff?.victualer ?? 0) +
    (staff?.butcher ?? 0)

  return Math.max(totalInhabitants - busyMissionWorkers - busyBuilders - busyResearchers - busyBuildingStaff, 0)
}
