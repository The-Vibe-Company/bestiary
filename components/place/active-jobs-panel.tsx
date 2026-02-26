'use client'

import { MissionCard } from './mission-card'
import type { ActiveMission } from '@/lib/game/missions/types'

interface ActiveJobsPanelProps {
  missions: ActiveMission[]
  statsByType: Record<string, { gatherRate: number; maxCapacity: number }>
}

export function ActiveJobsPanel({ missions, statsByType }: ActiveJobsPanelProps) {
  if (missions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[var(--ivory)]/30 font-[family-name:var(--font-title)] tracking-[0.15em]">
          Aucune mission en cours
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {missions.map((mission) => {
        const typeStats = statsByType[mission.inhabitantType] ?? { gatherRate: 0, maxCapacity: 0 }
        return (
          <MissionCard
            key={mission.id}
            mission={mission}
            gatherRate={typeStats.gatherRate}
            maxCapacity={typeStats.maxCapacity}
          />
        )
      })}
    </div>
  )
}
