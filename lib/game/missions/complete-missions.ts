import { prisma } from '@/lib/prisma'
import { getInhabitantStats } from '@/lib/game/inhabitants/get-inhabitant-stats'
import { getStorageCapacityForVillage } from '@/lib/game/buildings/storage-capacity'
import { rollDiscoveredItems } from '@/lib/game/items/discovery'
import { computeMissionStatus } from './compute-mission-status'
import { MISSION_CONFIG } from './mission-config'
import { computeTileDensity } from './density'

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

  const [pendingMissions, village] = await Promise.all([
    prisma.mission.findMany({
      where: { villageId, completedAt: null },
    }),
    prisma.village.findUnique({
      where: { id: villageId },
      select: { ownerId: true },
    }),
  ])

  if (!village) return

  interface LoopCandidate {
    inhabitantType: string
    workerCount: number
    targetX: number
    targetY: number
    workSeconds: number
    travelSeconds: number
  }

  const loopCandidates: LoopCandidate[] = []
  let resourcesDeposited = false
  let totalSavoirGained = 0

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

    const config = MISSION_CONFIG[mission.inhabitantType]
    const recalled = !!mission.recalledAt

    // Atomic claim + rewards in a single interactive transaction
    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.mission.updateMany({
        where: { id: mission.id, completedAt: null },
        data: { completedAt: now },
      })
      if (claimed.count === 0) return null

      if (config?.exploration) {
        const items = recalled ? [] : rollDiscoveredItems(mission.workSeconds, mission.workerCount)
        const savoir = recalled
          ? 0
          : mission.workerCount * Math.min(
              Math.floor((mission.workSeconds / 3600) * typeStats.gatherRate),
              typeStats.maxCapacity,
            )

        for (const rarity of items) {
          await tx.villageItem.create({
            data: { villageId, missionId: mission.id, rarity },
          })
        }

        return { savoir, resourceDeposited: false }
      } else {
        let baseResource = recalled
          ? 0
          : mission.workerCount * Math.min(
              Math.floor((mission.workSeconds / 3600) * typeStats.gatherRate),
              typeStats.maxCapacity,
            )

        if (baseResource > 0 && config?.densityType) {
          const density = computeTileDensity(mission.targetX, mission.targetY, mission.departedAt, config.densityType)
          baseResource = Math.max(1, Math.floor(baseResource * density))
        }

        if (baseResource > 0 && config) {
          await tx.villageResources.update({
            where: { villageId },
            data: { [config.resource]: { increment: baseResource } },
          })
          return { savoir: 0, resourceDeposited: true }
        }

        return { savoir: 0, resourceDeposited: false }
      }
    })

    if (!result) continue

    totalSavoirGained += result.savoir
    if (result.resourceDeposited) resourcesDeposited = true

    // Collect looped, non-recalled missions for auto-restart
    if (mission.loop && !mission.recalledAt) {
      loopCandidates.push({
        inhabitantType: mission.inhabitantType,
        workerCount: mission.workerCount,
        targetX: mission.targetX,
        targetY: mission.targetY,
        workSeconds: mission.workSeconds,
        travelSeconds: mission.travelSeconds,
      })
    }
  }

  // Award savoir to the user (per-user resource) — must run before loop-restart which can early-return
  if (totalSavoirGained > 0) {
    await prisma.userResources.update({
      where: { userId: village.ownerId },
      data: { savoir: { increment: totalSavoirGained } },
    })
  }

  // Auto-restart looped missions if inhabitants are available
  if (loopCandidates.length > 0) {
    const [inhabitants, stillActiveMissions] = await Promise.all([
      prisma.villageInhabitants.findUnique({ where: { villageId } }),
      prisma.mission.findMany({
        where: { villageId, completedAt: null },
        select: { inhabitantType: true, workerCount: true },
      }),
    ])
    if (!inhabitants) return

    const busyByType: Record<string, number> = {}
    for (const m of stillActiveMissions) {
      busyByType[m.inhabitantType] = (busyByType[m.inhabitantType] ?? 0) + m.workerCount
    }

    const allocatedByType: Record<string, number> = {}
    const toCreate: {
      villageId: string
      inhabitantType: string
      workerCount: number
      targetX: number
      targetY: number
      travelSeconds: number
      workSeconds: number
      loop: true
    }[] = []

    for (const candidate of loopCandidates) {
      const totalOfType = (inhabitants as unknown as Record<string, number>)[candidate.inhabitantType] ?? 0
      const busyOfType = (busyByType[candidate.inhabitantType] ?? 0)
        + (allocatedByType[candidate.inhabitantType] ?? 0)

      if (totalOfType - busyOfType < candidate.workerCount) continue

      toCreate.push({
        villageId,
        inhabitantType: candidate.inhabitantType,
        workerCount: candidate.workerCount,
        targetX: candidate.targetX,
        targetY: candidate.targetY,
        travelSeconds: candidate.travelSeconds,
        workSeconds: candidate.workSeconds,
        loop: true,
      })

      allocatedByType[candidate.inhabitantType] = (allocatedByType[candidate.inhabitantType] ?? 0) + candidate.workerCount
    }

    if (toCreate.length > 0) {
      await prisma.mission.createMany({ data: toCreate })
    }
  }

  // Cap resources to storage capacity after all deposits
  if (resourcesDeposited) {
    const capacity = await getStorageCapacityForVillage(villageId)
    await prisma.$executeRaw`
      UPDATE "VillageResources"
      SET
        bois = LEAST(bois, ${capacity.bois}::int),
        pierre = LEAST(pierre, ${capacity.pierre}::int),
        cereales = LEAST(cereales, ${capacity.cereales}::double precision),
        viande = LEAST(viande, ${capacity.viande}::double precision)
      WHERE "villageId" = ${villageId}
    `
  }
}
