import { prisma } from '@/lib/prisma'

/**
 * Lazy completion: called on page load.
 * Finds buildings whose construction timer has elapsed,
 * marks them complete, and increments village capacity.
 * Idempotent — safe to call multiple times.
 */
export async function completePendingBuildings(villageId: string): Promise<void> {
  const now = new Date()

  const pendingBuildings = await prisma.villageBuilding.findMany({
    where: {
      villageId,
      completedAt: null,
    },
  })

  for (const building of pendingBuildings) {
    const elapsedSeconds = (now.getTime() - building.startedAt.getTime()) / 1000
    if (elapsedSeconds < building.buildSeconds) continue

    // Look up the building type to get capacityBonus and maxCount
    const buildingType = await prisma.buildingType.findUnique({
      where: { key: building.buildingType },
    })

    const capacityBonus = buildingType?.capacityBonus ?? 0

    // For upgrades (unique buildings with level > 1): delete the previous-level building
    const isUpgrade = building.level > 1 && buildingType?.maxCount === 1

    await prisma.$transaction([
      prisma.villageBuilding.update({
        where: { id: building.id },
        data: { completedAt: now },
      }),
      ...(isUpgrade
        ? [
            prisma.villageBuilding.deleteMany({
              where: {
                villageId,
                buildingType: building.buildingType,
                completedAt: { not: null },
                id: { not: building.id },
              },
            }),
          ]
        : []),
      // Only apply capacity bonus for new constructions, not upgrades
      // (upgrades replace the old building which already granted the bonus)
      ...(capacityBonus > 0 && !isUpgrade
        ? [
            prisma.village.update({
              where: { id: villageId },
              data: { capacity: { increment: capacityBonus } },
            }),
          ]
        : []),
    ])
  }
}
