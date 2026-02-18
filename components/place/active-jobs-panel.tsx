'use client'

import { GiHammerNails } from 'react-icons/gi'
import { PlacePanel } from './place-panel'
import { MissionCard } from './mission-card'
import type { ActiveMission } from '@/lib/game/missions/types'

interface ActiveJobsPanelProps {
  missions: ActiveMission[]
  statsByType: Record<string, { gatherRate: number; maxCapacity: number }>
}

export function ActiveJobsPanel({ missions, statsByType }: ActiveJobsPanelProps) {
  return (
    <PlacePanel icon={<GiHammerNails size={22} />} title="Missions en cours">
      {missions.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <p className="text-sm text-[var(--ivory)]/30 font-[family-name:var(--font-title)] tracking-[0.15em]">
            Aucune mission en cours
          </p>
        </div>
      ) : (
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
      )}
    </PlacePanel>
  )
}
