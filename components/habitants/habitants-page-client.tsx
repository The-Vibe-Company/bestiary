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
}

export function HabitantsPageClient({
  inhabitantsList,
  map,
  villageX,
  villageY,
  workerAvailability,
  workerStats,
  missionTiles,
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

              {/* Content in the middle */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold font-[family-name:var(--font-title)] tracking-wider text-[var(--ivory)]">
                    {habitant.title}
                  </h2>
                  <div className="flex items-center gap-2 text-base font-bold text-[var(--ivory)]/80">
                    {/* Village icon + count */}
                    <span className="flex items-center gap-1" title="Au village">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M11.47 3.841a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.061l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.689z" />
                        <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15.75a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a.747.747 0 00.091-.086L12 5.432z" />
                      </svg>
                      <span>{habitant.count - habitant.inMission}</span>
                    </span>
                    {/* Mission icon + count (only if > 0) */}
                    {habitant.inMission > 0 && (
                      <span className="flex items-center gap-1 text-[var(--burnt-amber)]/70" title="En mission">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                        <span>{habitant.inMission}</span>
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-[var(--ivory)]/70 leading-relaxed mt-2">
                  {habitant.description}
                </p>
                {isMissionCapable && (
                  <p className={`text-xs mt-1 font-[family-name:var(--font-title)] tracking-wider ${
                    canSendMission
                      ? 'text-[var(--burnt-amber)]/70'
                      : 'text-[var(--ivory)]/30'
                  }`}>
                    {canSendMission
                      ? 'Cliquer pour envoyer en mission'
                      : 'Aucune unité disponible'}
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
          onClose={() => setSelectedType(null)}
        />
      )}
    </>
  )
}
