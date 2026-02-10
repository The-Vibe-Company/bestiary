'use client'

import { GiWoodPile, GiStonePile, GiWheat, GiMeat, GiVillage, GiThreeFriends } from 'react-icons/gi'
import { VillageResources } from '@/lib/game/resources/types'
import { Tooltip } from '@/components/ui/tooltip'

interface ResourceBarProps {
  villageName: string | null
  villageResources: VillageResources
  population?: number
  maxPopulation?: number
}

const villageResourceConfig = [
  { key: 'bois' as const, icon: GiWoodPile, color: '#8B4513', label: 'Bois' },
  { key: 'pierre' as const, icon: GiStonePile, color: '#708090', label: 'Pierre' },
  { key: 'cereales' as const, icon: GiWheat, color: '#DAA520', label: 'Céréales' },
  { key: 'viande' as const, icon: GiMeat, color: '#CD5C5C', label: 'Viande' },
]

export function ResourceBar({ villageName, villageResources, population, maxPopulation }: ResourceBarProps) {
  return (
    <div className="h-10 bg-black/80 backdrop-blur-sm border border-[var(--ivory)]/20 rounded-xl px-6">
      <div className="h-full flex items-center justify-center gap-6">
        {/* Village Name */}
        {villageName && (
          <>
            <div className="flex items-center gap-1.5">
              <GiVillage size={18} style={{ color: '#228B22' }} />
              <span className="text-sm font-bold font-[family-name:var(--font-title)] tracking-wider" style={{ color: '#228B22' }}>
                {villageName}
              </span>
            </div>
            <div className="w-px h-5 bg-[var(--ivory)]/30" />
          </>
        )}

        {/* Village Resources */}
        {villageResourceConfig.map(({ key, icon: Icon, color, label }) => (
          <Tooltip key={key} label={label}>
            <div className="flex items-center gap-1.5">
              <Icon size={20} style={{ color }} />
              <span className="text-sm font-bold" style={{ color }}>
                {villageResources[key]}
              </span>
            </div>
          </Tooltip>
        ))}

        {/* Population */}
        {population !== undefined && maxPopulation !== undefined && (
          <>
            <div className="w-px h-5 bg-[var(--ivory)]/30" />
            <Tooltip label="Population">
              <div className="flex items-center gap-1.5">
                <GiThreeFriends size={20} style={{ color: '#C19A6B' }} />
                <span className="text-sm font-bold" style={{ color: '#C19A6B' }}>
                  {population} / {maxPopulation}
                </span>
              </div>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  )
}
