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

    // Look up the building type to get capacityBonus
    const buildingType = await prisma.buildingType.findUnique({
      where: { key: building.buildingType },
    })

    const capacityBonus = buildingType?.capacityBonus ?? 0

    await prisma.$transaction([
      prisma.villageBuilding.update({
        where: { id: building.id },
        data: { completedAt: now },
      }),
      ...(capacityBonus > 0
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
