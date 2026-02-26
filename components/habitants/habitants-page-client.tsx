'use client'

import { useState } from 'react'
import Image from 'next/image'
import { HabitantsPanel } from './habitants-panel'
import { SendFromHabitantsModal } from './send-from-habitants-modal'
import { MISSION_CAPABLE_TYPES } from '@/lib/game/missions/mission-config'
import type { WorldMap } from '@/lib/game/map/types'
import type { MissionTile } from '@/components/game/map-page-client'

interface HabitantData {
  id: string
  key: string
  title: string
  description: string
  image: string
  count: number
  inMission: number
}

interface HabitantsPageClientProps {
  inhabitantsList: HabitantData[]
  map: WorldMap
  villageX: number
  villageY: number
  workerAvailability: Record<string, number>
  workerStats: Record<string, {
    speed: number
    gatherRate: number
    maxCapacity: number
  }>
  missionTiles: MissionTile[]
  allVillagePositions: { x: number; y: number }[]
}

export function HabitantsPageClient({
  inhabitantsList,
  map,
  villageX,
  villageY,
  workerAvailability,
  workerStats,
  missionTiles,
  allVillagePositions,
}: HabitantsPageClientProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null)

  function handleClickHabitant(habitant: HabitantData) {
    if (!MISSION_CAPABLE_TYPES.includes(habitant.key)) return
    if ((habitant.count - habitant.inMission) <= 0) return
    setSelectedType(habitant.key)
  }

  return (
    <>
      <HabitantsPanel>
        {inhabitantsList.map((habitant) => {
          const isMissionCapable = MISSION_CAPABLE_TYPES.includes(habitant.key)
          const canSendMission =
            isMissionCapable && habitant.count > 0 && (habitant.count - habitant.inMission) > 0

          const idle = habitant.count - habitant.inMission

          return (
            <div
              key={habitant.id}
              className={`flex items-center gap-4 p-4 ${
                canSendMission ? 'cursor-pointer' : 'cursor-default'
              }`}
              onClick={() => handleClickHabitant(habitant)}
            >
              {/* Image on the left */}
              <div className="relative w-[140px] h-[140px] flex-shrink-0 rounded-xl overflow-hidden border-2 border-[var(--burnt-amber)]">
                <Image
                  src={habitant.image}
                  alt={habitant.title}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-xl font-bold font-[family-name:var(--font-title)] tracking-wider text-[var(--ivory)]">
                    {habitant.title}
                  </h2>
                  {habitant.count > 0 && (
                    <div className="flex items-center gap-3">
                      {habitant.inMission > 0 && (
                        <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--burnt-amber)]" title="En mission">
                          <div className="w-2 h-2 rounded-full bg-[var(--burnt-amber)]" />
                          {habitant.inMission}
                        </span>
                      )}
                      {idle > 0 && (
                        <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--ivory)]/50" title="Disponible">
                          <div className="w-2 h-2 rounded-full bg-[var(--ivory)]/30" />
                          {idle}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-sm text-[var(--ivory)]/70 leading-relaxed mt-2">
                  {habitant.description}
                </p>
                {canSendMission && (
                  <p className="text-xs mt-1 font-[family-name:var(--font-title)] tracking-wider text-[var(--burnt-amber)]/70">
                    Cliquer pour envoyer en mission
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </HabitantsPanel>

      {/* Mission modal (mini-map → config) for any mission-capable type */}
      {selectedType && workerStats[selectedType] && (
        <SendFromHabitantsModal
          inhabitantType={selectedType}
          map={map}
          villageX={villageX}
          villageY={villageY}
          speed={workerStats[selectedType].speed}
          gatherRate={workerStats[selectedType].gatherRate}
          maxCapacity={workerStats[selectedType].maxCapacity}
          availableWorkers={workerAvailability[selectedType] ?? 0}
          missionTiles={missionTiles}
          allVillagePositions={allVillagePositions}
          onClose={() => setSelectedType(null)}
        />
      )}
    </>
  )
}
