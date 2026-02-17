import { prisma } from '@/lib/prisma'
import { getInhabitantStats } from '@/lib/game/inhabitants/get-inhabitant-stats'
import { getInhabitantTypes } from '@/lib/game/inhabitants/get-inhabitant-types'
import { computeMissionStatus } from './compute-mission-status'
import type { ActiveMission } from './types'

export async function getActiveMissions(villageId: string): Promise<ActiveMission[]> {
  const [stats, types] = await Promise.all([
    getInhabitantStats(),
    getInhabitantTypes(),
  ])

  const titleByKey = Object.fromEntries(types.map((t) => [t.key, t.title]))

  const missions = await prisma.mission.findMany({
    where: {
      villageId,
      completedAt: null,
    },
    orderBy: { departedAt: 'asc' },
  })

  const now = new Date()

  return missions.map((m) => {
    const typeStats = stats[m.inhabitantType] ?? { speed: 0, gatherRate: 0, maxCapacity: 0 }
    const status = computeMissionStatus(
      {
        departedAt: m.departedAt,
        travelSeconds: m.travelSeconds,
        workSeconds: m.workSeconds,
        recalledAt: m.recalledAt,
        gatherRate: typeStats.gatherRate,
        maxCapacity: typeStats.maxCapacity,
      },
      now,
    )
    return {
      id: m.id,
      inhabitantType: m.inhabitantType,
      inhabitantTitle: titleByKey[m.inhabitantType] ?? m.inhabitantType,
      targetX: m.targetX,
      targetY: m.targetY,
      departedAt: m.departedAt,
      travelSeconds: m.travelSeconds,
      workSeconds: m.workSeconds,
      recalledAt: m.recalledAt,
      loop: m.loop,
      status,
    }
  })
}
