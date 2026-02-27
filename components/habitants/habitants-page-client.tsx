'use client'

import { useState } from 'react'
import Image from 'next/image'
import { HabitantsPanel } from './habitants-panel'
import { SendFromHabitantsModal } from './send-from-habitants-modal'
import { MISSION_CAPABLE_TYPES } from '@/lib/game/missions/mission-config'
import type { WorldMap } from '@/lib/game/map/types'
import type { MissionTile } from '@/components/game/map-page-client'
import { GiCompass, GiGearHammer, GiVillage } from 'react-icons/gi'

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

const INHABITANT_CATEGORIES = [
  { key: 'all', label: 'Tous', icon: null },
  { key: 'outside', label: 'Expeditions', icon: GiCompass },
  { key: 'staff', label: 'Postes', icon: GiGearHammer },
  { key: 'community', label: 'Village', icon: GiVillage },
] as const

const INHABITANT_CATEGORY_BY_KEY: Record<string, string> = {
  explorer: 'outside',
  lumberjack: 'outside',
  miner: 'outside',
  hunter: 'outside',
  gatherer: 'outside',

  researcher: 'community',
  builder: 'community',

  tavernkeeper: 'staff',
  watchman: 'staff',
  splitter: 'staff',
  stonecutter: 'staff',
  victualer: 'staff',
  butcher: 'staff',
  farmer: 'staff',
  breeder: 'staff',

  mayor: 'community',
}

function CategoryTabs({
  activeCategory,
  onCategoryChange,
}: {
  activeCategory: string
  onCategoryChange: (category: string) => void
}) {
  return (
    <div className="flex items-center gap-1 px-4 py-2.5">
      {INHABITANT_CATEGORIES.map((cat) => {
        const isActive = activeCategory === cat.key
        const Icon = cat.icon
        return (
          <button
            key={cat.key}
            onClick={() => onCategoryChange(cat.key)}
            className={`
              cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-150
              ${isActive
                ? 'bg-[var(--burnt-amber)]/20 text-[var(--burnt-amber)] border border-[var(--burnt-amber)]/40'
                : 'text-[var(--ivory)]/40 hover:text-[var(--ivory)]/70 hover:bg-[var(--ivory)]/5 border border-transparent'
              }
            `}
          >
            {Icon && <Icon size={13} />}
            {cat.label}
          </button>
        )
      })}
    </div>
  )
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
  const [activeCategory, setActiveCategory] = useState('all')

  function handleClickHabitant(habitant: HabitantData) {
    if (!MISSION_CAPABLE_TYPES.includes(habitant.key)) return
    if ((habitant.count - habitant.inMission) <= 0) return
    setSelectedType(habitant.key)
  }

  const filteredInhabitants = activeCategory === 'all'
    ? inhabitantsList
    : inhabitantsList.filter((habitant) =>
        (INHABITANT_CATEGORY_BY_KEY[habitant.key] ?? 'community') === activeCategory
      )

  const categoryHeader = (
    <CategoryTabs
      activeCategory={activeCategory}
      onCategoryChange={setActiveCategory}
    />
  )

  return (
    <>
      <HabitantsPanel header={categoryHeader}>
        {filteredInhabitants.map((habitant) => {
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
