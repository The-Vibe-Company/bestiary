import { prisma } from '@/lib/prisma'
import { getInhabitantStats } from '@/lib/game/inhabitants/get-inhabitant-stats'
import { computeMissionStatus } from './compute-mission-status'

/**
 * Lazy completion: called on page load.
 * Finds missions that should be completed, awards resources, and marks them done.
 * Idempotent — safe to call multiple times.
 *
 * After completing missions, auto-restarts any that had loop=true (unless recalled).
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

  interface LoopCandidate {
    inhabitantType: string
    targetX: number
    targetY: number
    workSeconds: number
    travelSeconds: number
  }

  const loopCandidates: LoopCandidate[] = []

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

    // Collect looped, non-recalled missions for auto-restart
    if (mission.loop && !mission.recalledAt) {
      loopCandidates.push({
        inhabitantType: mission.inhabitantType,
        targetX: mission.targetX,
        targetY: mission.targetY,
        workSeconds: mission.workSeconds,
        travelSeconds: mission.travelSeconds,
      })
    }
  }

  // Auto-restart looped missions if inhabitants are available
  if (loopCandidates.length > 0) {
    const village = await prisma.village.findUnique({
      where: { id: villageId },
      include: { inhabitants: true },
    })
    if (!village || !village.inhabitants) return

    // Count still-active missions per type (those NOT completed in this run)
    const stillActiveMissions = await prisma.mission.findMany({
      where: { villageId, completedAt: null },
      select: { inhabitantType: true },
    })

    const activeCountByType: Record<string, number> = {}
    for (const m of stillActiveMissions) {
      activeCountByType[m.inhabitantType] = (activeCountByType[m.inhabitantType] ?? 0) + 1
    }

    // Track how many new missions we allocate per type in this batch
    const allocatedByType: Record<string, number> = {}

    for (const candidate of loopCandidates) {
      const totalOfType = (village.inhabitants as Record<string, unknown>)[candidate.inhabitantType] as number ?? 0
      const activeOfType = (activeCountByType[candidate.inhabitantType] ?? 0)
        + (allocatedByType[candidate.inhabitantType] ?? 0)

      if (totalOfType - activeOfType <= 0) continue

      await prisma.mission.create({
        data: {
          villageId,
          inhabitantType: candidate.inhabitantType,
          targetX: candidate.targetX,
          targetY: candidate.targetY,
          travelSeconds: candidate.travelSeconds,
          workSeconds: candidate.workSeconds,
          loop: true,
        },
      })

      allocatedByType[candidate.inhabitantType] = (allocatedByType[candidate.inhabitantType] ?? 0) + 1
    }
  }
}
