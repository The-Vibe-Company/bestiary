import { prisma } from '@/lib/prisma'
import { getInhabitantStats } from '@/lib/game/inhabitants/get-inhabitant-stats'
import { computeMissionStatus } from './compute-mission-status'

/**
 * Lazy completion: called on page load.
 * Finds missions that should be completed, awards resources, and marks them done.
 * Idempotent — safe to call multiple times.
 */
export async function completePendingMissions(villageId: string): Promise<void> {
  const stats = await getInhabitantStats()
  const now = new Date()

  const pendingMissions = await prisma.mission.findMany({
    where: {
      villageId,
      completedAt: null,
    },
  })

  for (const mission of pendingMissions) {
    const typeStats = stats[mission.inhabitantType] ?? { speed: 0, gatherRate: 0, maxCapacity: 0 }
    const status = computeMissionStatus(
      {
        departedAt: mission.departedAt,
        travelSeconds: mission.travelSeconds,
        workSeconds: mission.workSeconds,
        recalledAt: mission.recalledAt,
        gatherRate: typeStats.gatherRate,
        maxCapacity: typeStats.maxCapacity,
      },
      now,
    )

    if (status.phase !== 'completed') continue

    const woodGathered = mission.recalledAt
      ? 0
      : Math.min(
          Math.floor((mission.workSeconds / 3600) * typeStats.gatherRate),
          typeStats.maxCapacity,
        )

    await prisma.$transaction([
      prisma.mission.update({
        where: { id: mission.id },
        data: { completedAt: now },
      }),
      ...(woodGathered > 0
        ? [
            prisma.villageResources.update({
              where: { villageId },
              data: { bois: { increment: woodGathered } },
            }),
          ]
        : []),
    ])
  }
}
