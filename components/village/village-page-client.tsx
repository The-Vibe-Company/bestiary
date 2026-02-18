'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { HabitantsPanel } from '@/components/habitants/habitants-panel'
import { Button } from '@/components/ui/button'
import { BuildModal } from '@/components/village/build-modal'
import { startBuilding } from '@/lib/game/buildings/start-building'
import { formatTimeRemaining } from '@/lib/utils/format-time'
import { GiWoodPile, GiStonePile, GiWheat, GiMeat, GiHammerNails } from 'react-icons/gi'

interface ActiveConstruction {
  startedAt: string
  buildSeconds: number
  assignedBuilders: number
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
  availableBuilders: number
}

const RESOURCE_CONFIG = [
  { key: 'costBois' as const, resKey: 'bois' as const, icon: GiWoodPile, color: '#8B4513', label: 'Bois' },
  { key: 'costPierre' as const, resKey: 'pierre' as const, icon: GiStonePile, color: '#708090', label: 'Pierre' },
  { key: 'costCereales' as const, resKey: 'cereales' as const, icon: GiWheat, color: '#DAA520', label: 'Céréales' },
  { key: 'costViande' as const, resKey: 'viande' as const, icon: GiMeat, color: '#CD5C5C', label: 'Viande' },
]

function ConstructionStatus({
  startedAt,
  buildSeconds,
  assignedBuilders,
}: ActiveConstruction) {
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

  const progress = Math.max(0, Math.min(1, 1 - (secondsRemaining / buildSeconds)))
  const radius = 9
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--burnt-amber)]/35 bg-[var(--obsidian)]/35">
      <svg
        className="h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          cx="12"
          cy="12"
          r={radius}
          stroke="rgba(245,245,220,0.2)"
          strokeWidth="3"
        />
        <circle
          cx="12"
          cy="12"
          r={radius}
          stroke="var(--burnt-amber)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 12 12)"
          className="transition-all duration-700 ease-linear"
        />
      </svg>
      <span className="text-xs text-[var(--burnt-amber)] font-bold min-w-[56px]">
        {formatTimeRemaining(secondsRemaining)}
      </span>
      <span className="inline-flex items-center gap-1 text-xs text-[var(--ivory)]/80">
        <GiHammerNails size={14} className="text-[var(--burnt-amber)]" />
        {assignedBuilders}
      </span>
    </div>
  )
}

export function VillagePageClient({ buildingTypes, villageResources, availableBuilders }: VillagePageClientProps) {
  const router = useRouter()
  const [buildModalKey, setBuildModalKey] = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [buildErrors, setBuildErrors] = useState<Record<string, string>>({})

  const noBuilders = availableBuilders <= 0

  function getButtonLabel(canAfford: boolean) {
    if (noBuilders) return 'AUCUN BÂTISSEUR'
    if (!canAfford) return 'RESSOURCES INSUFFISANTES'
    return 'CONSTRUIRE'
  }

  async function handleBuildClick(key: string, hasActiveConstruction: boolean) {
    if (hasActiveConstruction) return
    setBuildErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })

    if (availableBuilders === 1) {
      // Only 1 builder: skip modal, build directly
      setLoadingKey(key)
      const result = await startBuilding(key, 1)
      if (!result.success) {
        setBuildErrors((prev) => ({ ...prev, [key]: result.error }))
        setLoadingKey(null)
        return
      }
      router.refresh()
      setLoadingKey(null)
    } else {
      // Multiple builders: open modal to choose count
      setBuildModalKey(key)
    }
  }

  const selectedBuilding = buildModalKey
    ? buildingTypes.find((b) => b.key === buildModalKey) ?? null
    : null

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
        const activeConstruction = building.activeConstructions[0]
        const hasActiveConstruction = Boolean(activeConstruction)

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
                {hasActiveConstruction ? (
                  <ConstructionStatus
                    startedAt={activeConstruction.startedAt}
                    buildSeconds={activeConstruction.buildSeconds}
                    assignedBuilders={activeConstruction.assignedBuilders}
                  />
                ) : (
                  <Button
                    variant="seal"
                    size="sm"
                    className="ml-auto"
                    disabled={!canAfford || noBuilders || loadingKey === building.key}
                    isLoading={loadingKey === building.key}
                    onClick={() => handleBuildClick(building.key, hasActiveConstruction)}
                  >
                    {getButtonLabel(canAfford)}
                  </Button>
                )}
              </div>

              <p className="text-sm text-[var(--ivory)]/70 leading-relaxed">
                {building.description}
              </p>
              {buildErrors[building.key] && (
                <p className="mt-2 text-xs text-[var(--burnt-amber-light)]">
                  {buildErrors[building.key]}
                </p>
              )}

              {/* Cost display */}
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
              </div>

            </div>
          </div>
        )
      })}

      {/* Build modal */}
      {selectedBuilding && (
        <BuildModal
          buildingTitle={selectedBuilding.title}
          buildingTypeKey={selectedBuilding.key}
          baseBuildSeconds={selectedBuilding.buildSeconds}
          availableBuilders={availableBuilders}
          onClose={() => setBuildModalKey(null)}
        />
      )}
    </HabitantsPanel>
  )
}
