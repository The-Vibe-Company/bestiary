'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { HabitantsPanel } from '@/components/habitants/habitants-panel'
import { Button } from '@/components/ui/button'
import { startBuilding } from '@/lib/game/buildings/start-building'
import { GiWoodPile, GiStonePile, GiWheat, GiMeat } from 'react-icons/gi'

interface ActiveConstruction {
  startedAt: string
  buildSeconds: number
}

export interface BuildingTypeData {
  key: string
  title: string
  description: string
  image: string
  costBois: number
  costPierre: number
  costCereales: number
  costViande: number
  buildSeconds: number
  capacityBonus: number
  completedCount: number
  activeConstructions: ActiveConstruction[]
}

interface VillagePageClientProps {
  buildingTypes: BuildingTypeData[]
  villageResources: {
    bois: number
    pierre: number
    cereales: number
    viande: number
  }
}

const RESOURCE_CONFIG = [
  { key: 'costBois' as const, resKey: 'bois' as const, icon: GiWoodPile, color: '#8B4513', label: 'Bois' },
  { key: 'costPierre' as const, resKey: 'pierre' as const, icon: GiStonePile, color: '#708090', label: 'Pierre' },
  { key: 'costCereales' as const, resKey: 'cereales' as const, icon: GiWheat, color: '#DAA520', label: 'Céréales' },
  { key: 'costViande' as const, resKey: 'viande' as const, icon: GiMeat, color: '#CD5C5C', label: 'Viande' },
]

function formatTimeRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0s'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

function ConstructionTimer({ startedAt, buildSeconds }: ActiveConstruction) {
  const router = useRouter()
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000
    return Math.max(0, Math.ceil(buildSeconds - elapsed))
  })

  useEffect(() => {
    if (secondsRemaining <= 0) return
    const interval = setInterval(() => {
      const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000
      const remaining = Math.max(0, Math.ceil(buildSeconds - elapsed))
      setSecondsRemaining(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        router.refresh()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt, buildSeconds, secondsRemaining, router])

  const progress = Math.min(1, (Date.now() - new Date(startedAt).getTime()) / 1000 / buildSeconds)

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-[var(--ivory)]/5">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${progress * 100}%`,
            backgroundColor: 'var(--burnt-amber)',
            opacity: 0.8,
          }}
        />
      </div>
      <span className="text-xs text-[var(--burnt-amber)]">
        {formatTimeRemaining(secondsRemaining)}
      </span>
    </div>
  )
}

export function VillagePageClient({ buildingTypes, villageResources }: VillagePageClientProps) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null)

  async function handleBuild(key: string) {
    setLoadingKey(key)
    await startBuilding(key)
    setLoadingKey(null)
  }

  return (
    <HabitantsPanel>
      {buildingTypes.map((building) => {
        const canAfford =
          villageResources.bois >= building.costBois &&
          villageResources.pierre >= building.costPierre &&
          villageResources.cereales >= building.costCereales &&
          villageResources.viande >= building.costViande

        const costs = RESOURCE_CONFIG.filter(
          (r) => building[r.key] > 0
        )

        return (
          <div
            key={building.key}
            className="flex items-center gap-4 p-4"
          >
            {/* Image on the left */}
            <div className="relative w-[140px] h-[140px] flex-shrink-0 rounded-xl overflow-hidden border-2 border-[var(--burnt-amber)]">
              <Image
                src={building.image}
                alt={building.title}
                fill
                className="object-cover"
              />
            </div>

            {/* Content on the right */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold font-[family-name:var(--font-title)] tracking-wider text-[var(--ivory)]">
                  {building.title}
                </h2>
                {building.completedCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[var(--burnt-amber)]/20 text-[var(--burnt-amber)] border border-[var(--burnt-amber)]/30">
                    ×{building.completedCount}
                  </span>
                )}
                <Button
                  variant="seal"
                  size="sm"
                  className="ml-auto"
                  disabled={!canAfford || loadingKey === building.key}
                  isLoading={loadingKey === building.key}
                  onClick={() => handleBuild(building.key)}
                >
                  {canAfford ? 'CONSTRUIRE' : 'RESSOURCES INSUFFISANTES'}
                </Button>
              </div>

              <p className="text-sm text-[var(--ivory)]/70 leading-relaxed">
                {building.description}
              </p>

              {/* Cost display + construction timer on same line */}
              <div className="flex items-center gap-3 mt-2">
                {costs.map((r) => {
                  const cost = building[r.key]
                  const hasEnough = villageResources[r.resKey] >= cost
                  return (
                    <div key={r.key} className="flex items-center gap-1">
                      <r.icon size={16} style={{ color: r.color }} />
                      <span
                        className="text-sm font-bold"
                        style={{ color: hasEnough ? r.color : '#CD5C5C' }}
                      >
                        {cost}
                      </span>
                    </div>
                  )
                })}
                <span className="text-xs text-[var(--ivory)]/40">
                  +{building.capacityBonus} capacité
                </span>
                {building.activeConstructions.length > 0 && (
                  <div className="ml-auto flex items-center gap-2">
                    {building.activeConstructions.map((construction, i) => (
                      <ConstructionTimer
                        key={`${building.key}-${i}`}
                        startedAt={construction.startedAt}
                        buildSeconds={construction.buildSeconds}
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )
      })}
    </HabitantsPanel>
  )
}
