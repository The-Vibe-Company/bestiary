'use client'

import { GiWoodPile, GiStonePile, GiWheat, GiMeat, GiTwoCoins, GiSpellBook } from 'react-icons/gi'
import { UserResources } from '@/lib/game/resources/types'

interface ResourceBarProps {
  resources: UserResources
}

const resourceConfig = [
  { key: 'bois' as const, icon: GiWoodPile, color: '#8B4513' },
  { key: 'pierre' as const, icon: GiStonePile, color: '#708090' },
  { key: 'cereales' as const, icon: GiWheat, color: '#DAA520' },
  { key: 'viande' as const, icon: GiMeat, color: '#CD5C5C' },
  { key: 'or' as const, icon: GiTwoCoins, color: '#FFD700' },
  { key: 'savoir' as const, icon: GiSpellBook, color: '#9370DB' },
]

export function ResourceBar({ resources }: ResourceBarProps) {
  return (
    <div className="mx-auto mt-4 h-10 w-fit bg-black/80 backdrop-blur-sm border border-[var(--ivory)]/20 rounded-xl px-6">
      <div className="h-full flex items-center justify-center gap-6">
        {resourceConfig.map(({ key, icon: Icon, color }) => (
          <div key={key} className="flex items-center gap-1.5">
            <Icon size={20} style={{ color }} />
            <span className="text-sm font-bold" style={{ color }}>
              {resources[key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
