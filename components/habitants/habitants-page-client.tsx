'use client'

import { useState } from 'react'
import Image from 'next/image'
import { HabitantsPanel } from './habitants-panel'
import { SendFromHabitantsModal } from './send-from-habitants-modal'
import type { WorldMap } from '@/lib/game/map/types'

interface HabitantData {
  id: string
  key: string
  title: string
  description: string
  image: string
  count: number
}

interface HabitantsPageClientProps {
  inhabitantsList: HabitantData[]
  map: WorldMap
  villageX: number
  villageY: number
  availableLumberjacks: number
  lumberjackStats: {
    speed: number
    gatherRate: number
    maxCapacity: number
  }
}

const MISSION_CAPABLE_TYPES = ['lumberjack']

export function HabitantsPageClient({
  inhabitantsList,
  map,
  villageX,
  villageY,
  availableLumberjacks,
  lumberjackStats,
}: HabitantsPageClientProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null)

  function handleClickHabitant(habitant: HabitantData) {
    if (!MISSION_CAPABLE_TYPES.includes(habitant.key)) return
    if (habitant.count <= 0) return
    setSelectedType(habitant.key)
  }

  return (
    <>
      <HabitantsPanel>
        {inhabitantsList.map((habitant) => {
          const canSendMission =
            MISSION_CAPABLE_TYPES.includes(habitant.key) && habitant.count > 0

          return (
            <div
              key={habitant.id}
              className={`group flex items-center gap-4 p-4 transition-colors ${
                canSendMission ? 'cursor-pointer' : 'cursor-default'
              }`}
              onClick={() => handleClickHabitant(habitant)}
            >
              {/* Image on the left */}
              <div className="relative w-[140px] h-[140px] flex-shrink-0 rounded-xl overflow-hidden border-2 border-[var(--burnt-amber)] transition-all duration-300 group-hover:border-4">
                <Image
                  src={habitant.image}
                  alt={habitant.title}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Content in the middle */}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold font-[family-name:var(--font-title)] tracking-wider text-[var(--ivory)] mb-2 transition-colors duration-300 group-hover:text-[var(--burnt-amber)]">
                  {habitant.title}
                </h2>
                <p className="text-sm text-[var(--ivory)]/70 leading-relaxed">
                  {habitant.description}
                </p>
                {canSendMission && (
                  <p className="text-xs text-[var(--burnt-amber)]/70 mt-1 font-[family-name:var(--font-title)] tracking-wider">
                    Cliquer pour envoyer en mission
                  </p>
                )}
              </div>

              {/* Count box on the right */}
              <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center bg-black/50 border-2 border-[var(--burnt-amber)] rounded-xl">
                <span className="text-3xl font-bold text-[var(--burnt-amber)]">
                  {habitant.count}
                </span>
              </div>
            </div>
          )
        })}
      </HabitantsPanel>

      {/* Mission modal (mini-map → config) */}
      {selectedType === 'lumberjack' && (
        <SendFromHabitantsModal
          map={map}
          villageX={villageX}
          villageY={villageY}
          speed={lumberjackStats.speed}
          gatherRate={lumberjackStats.gatherRate}
          maxCapacity={lumberjackStats.maxCapacity}
          availableLumberjacks={availableLumberjacks}
          onClose={() => setSelectedType(null)}
        />
      )}
    </>
  )
}
