'use client'

import { GiWoodPile, GiStonePile, GiWheat, GiMeat, GiVillage, GiThreeFriends } from 'react-icons/gi'
import { VillageResources } from '@/lib/game/resources/types'
import { DailyConsumption } from '@/lib/game/resources/compute-daily-consumption'
import { Tooltip } from '@/components/ui/tooltip'

interface ResourceBarProps {
  villageName: string | null
  villageResources: VillageResources
  population?: number
  maxPopulation?: number
  unoccupiedInhabitants?: number
  dailyConsumption?: DailyConsumption
}

const villageResourceConfig = [
  { key: 'bois' as const, icon: GiWoodPile, color: '#8B4513', label: 'Bois' },
  { key: 'pierre' as const, icon: GiStonePile, color: '#708090', label: 'Pierre' },
  { key: 'cereales' as const, icon: GiWheat, color: '#DAA520', label: 'Céréales' },
  { key: 'viande' as const, icon: GiMeat, color: '#CD5C5C', label: 'Viande' },
]

export function ResourceBar({
  villageName,
  villageResources,
  population,
  maxPopulation,
  unoccupiedInhabitants,
  dailyConsumption,
}: ResourceBarProps) {
  return (
    <div className="h-10 overflow-visible bg-black/80 backdrop-blur-sm border border-[var(--ivory)]/20 rounded-xl px-6">
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
        {villageResourceConfig.map(({ key, icon: Icon, color, label }) => {
          const consumption = (key === 'cereales' || key === 'viande')
            ? dailyConsumption?.[key] ?? 0
            : 0
          const tooltipLabel = consumption > 0
            ? `${label} — Consommation totale : ${consumption}/jour`
            : label

          return (
            <Tooltip key={key} label={tooltipLabel}>
              <div className="relative flex items-center gap-1.5">
                <Icon size={20} style={{ color }} />
                <span className="text-sm font-bold" style={{ color }}>
                  {villageResources[key]}
                </span>
                {consumption > 0 && (
                  <span className="absolute -top-5 -right-4 h-5 px-2 flex items-center justify-center
                    rounded-full text-[11px] font-bold leading-none whitespace-nowrap
                    bg-[var(--burnt-amber)] text-black shadow-sm shadow-black/50">
                    -{consumption}/j
                  </span>
                )}
              </div>
            </Tooltip>
          )
        })}

        {/* Population */}
        {population !== undefined && maxPopulation !== undefined && (
          <>
            <div className="w-px h-5 bg-[var(--ivory)]/30" />
            <Tooltip label={unoccupiedInhabitants !== undefined ? "Population et habitants inoccupés" : "Population"}>
              <div className="flex items-center gap-1.5">
                <GiThreeFriends size={20} style={{ color: '#C19A6B' }} />
                <span className="text-sm font-bold" style={{ color: '#C19A6B' }}>
                  {population} / {maxPopulation}
                </span>
                {unoccupiedInhabitants !== undefined && (
                  <>
                    <span className="text-[var(--ivory)]/35">·</span>
                    <span className="text-[10px] font-[family-name:var(--font-title)] tracking-wider uppercase text-[var(--ivory)]/55">
                      libres
                    </span>
                    <span
                      className="text-sm font-bold"
                      style={{ color: unoccupiedInhabitants === 0 ? '#CC7722' : '#EAD9BF' }}
                    >
                      {unoccupiedInhabitants}
                    </span>
                  </>
                )}
              </div>
            </Tooltip>
          </>
        )}

        {unoccupiedInhabitants !== undefined && !(population !== undefined && maxPopulation !== undefined) && (
          <>
            <div className="w-px h-5 bg-[var(--ivory)]/30" />
            <Tooltip label="Habitants inoccupés">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-[family-name:var(--font-title)] tracking-wider uppercase text-[var(--ivory)]/60">
                  Inoccupés
                </span>
                <span className="text-sm font-bold" style={{ color: '#F4E1C1' }}>
                  {unoccupiedInhabitants}
                </span>
              </div>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  )
}
