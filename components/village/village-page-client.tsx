'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { HabitantsPanel } from '@/components/habitants/habitants-panel'
import { Button } from '@/components/ui/button'
import { BuildModal } from '@/components/village/build-modal'
import { startBuilding } from '@/lib/game/buildings/start-building'
import { formatTimeRemaining } from '@/lib/utils/format-time'
import Link from 'next/link'
import { GiWoodPile, GiStonePile, GiWheat, GiMeat, GiHammerNails, GiThreeFriends, GiPadlock, GiSandsOfTime, GiWatchtower, GiBeerStein, GiTowerFlag, GiBookshelf, GiBarrel, GiCrossedSwords, GiPartyPopper } from 'react-icons/gi'
import { DETECTION_WINDOW_SECONDS } from '@/lib/game/travelers/detection'
import { TAVERN_STAY_MULTIPLIER } from '@/lib/game/travelers/tavern'

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
  category: string
  costBois: number
  costPierre: number
  costCereales: number
  costViande: number
  buildSeconds: number
  capacityBonus: number
  storageBonusBois: number
  storageBonusPierre: number
  storageBonusCereales: number
  storageBonusViande: number
  maxCount: number | null
  maxLevel: number
  requiredTechnology: string | null
  requiredTechnologyTitle: string | null
  isTechMet: boolean
  completedCount: number
  currentLevel: number
  activeConstructions: ActiveConstruction[]
  staffCount: number
}

interface VillagePageClientProps {
  buildingTypes: BuildingTypeData[]
  villageResources: {
    bois: number
    pierre: number
    cereales: number
    viande: number
  }
  storageCapacity: {
    bois: number
    pierre: number
    cereales: number
    viande: number
  }
  availableBuilders: number
}

const BUILDING_CATEGORIES = [
  { key: 'all', label: 'Tous', icon: null },
  { key: 'centre', label: 'Centre', icon: GiTowerFlag },
  { key: 'ressources', label: 'Ressources', icon: GiBarrel },
  { key: 'savoir', label: 'Savoir', icon: GiBookshelf },
  { key: 'militaire', label: 'Militaire', icon: GiCrossedSwords },
  { key: 'social', label: 'Social', icon: GiPartyPopper },
] as const

const RESOURCE_CONFIG = [
  { key: 'costBois' as const, resKey: 'bois' as const, icon: GiWoodPile, color: '#8B4513', label: 'Bois' },
  { key: 'costPierre' as const, resKey: 'pierre' as const, icon: GiStonePile, color: '#708090', label: 'Pierre' },
  { key: 'costCereales' as const, resKey: 'cereales' as const, icon: GiWheat, color: '#DAA520', label: 'Céréales' },
  { key: 'costViande' as const, resKey: 'viande' as const, icon: GiMeat, color: '#CD5C5C', label: 'Viande' },
]

const STORAGE_BONUS_CONFIG = [
  { key: 'storageBonusBois' as const, capacityKey: 'bois' as const, icon: GiWoodPile, color: '#8B4513', label: 'stockage bois' },
  { key: 'storageBonusPierre' as const, capacityKey: 'pierre' as const, icon: GiStonePile, color: '#708090', label: 'stockage pierre' },
  { key: 'storageBonusCereales' as const, capacityKey: 'cereales' as const, icon: GiWheat, color: '#DAA520', label: 'stockage céréales' },
  { key: 'storageBonusViande' as const, capacityKey: 'viande' as const, icon: GiMeat, color: '#CD5C5C', label: 'stockage viande' },
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

function CategoryTabs({
  activeCategory,
  onCategoryChange,
}: {
  activeCategory: string
  onCategoryChange: (category: string) => void
}) {
  return (
    <div className="flex items-center gap-1 px-4 py-2.5">
      {BUILDING_CATEGORIES.map((cat) => {
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

export function VillagePageClient({ buildingTypes, villageResources, storageCapacity, availableBuilders }: VillagePageClientProps) {
  const router = useRouter()
  const [buildModalKey, setBuildModalKey] = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [buildErrors, setBuildErrors] = useState<Record<string, string>>({})
  const [activeCategory, setActiveCategory] = useState('all')

  const noBuilders = availableBuilders <= 0

  const filteredBuildings = activeCategory === 'all'
    ? buildingTypes
    : buildingTypes.filter((b) => b.category === activeCategory)

  function getButtonLabel(building: BuildingTypeData, canAfford: boolean) {
    const isUnique = building.maxCount === 1
    const isUpgradeable = isUnique && building.maxLevel > 1
    const maxLevelReached = isUnique && building.currentLevel >= building.maxLevel
    const maxCountReached = building.maxCount !== null && building.completedCount >= building.maxCount

    if (!building.isTechMet) return 'TECHNOLOGIE REQUISE'
    if (maxLevelReached) return 'NIVEAU MAX'
    if (!isUpgradeable && maxCountReached) return 'DÉJÀ CONSTRUIT'
    if (noBuilders) return 'AUCUN BÂTISSEUR'
    if (!canAfford) return 'RESSOURCES INSUFFISANTES'
    return isUpgradeable && building.currentLevel > 0 ? 'AMÉLIORER' : 'CONSTRUIRE'
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

  const categoryHeader = (
    <CategoryTabs
      activeCategory={activeCategory}
      onCategoryChange={setActiveCategory}
    />
  )

  return (
    <HabitantsPanel header={categoryHeader}>
      {filteredBuildings.map((building) => {
        const isUnique = building.maxCount === 1
        const isUpgradeable = isUnique && building.maxLevel > 1
        const isUpgrade = isUpgradeable && building.currentLevel > 0
        const maxLevelReached = isUnique && building.currentLevel >= building.maxLevel
        const maxCountReached = !isUpgradeable && building.maxCount !== null && building.completedCount >= building.maxCount

        // Scale costs by target level for upgrades
        const targetLevel = isUpgrade ? building.currentLevel + 1 : 1
        const costMultiplier = isUpgrade ? targetLevel : 1

        const canAfford =
          villageResources.bois >= building.costBois * costMultiplier &&
          villageResources.pierre >= building.costPierre * costMultiplier &&
          villageResources.cereales >= building.costCereales * costMultiplier &&
          villageResources.viande >= building.costViande * costMultiplier

        const isTechLocked = !building.isTechMet
        const isDisabled = isTechLocked || maxLevelReached || maxCountReached || !canAfford || noBuilders || loadingKey === building.key

        const costs = RESOURCE_CONFIG.filter(
          (r) => building[r.key] > 0
        )
        const activeConstruction = building.activeConstructions[0]
        const hasActiveConstruction = Boolean(activeConstruction)

        return (
          <div
            key={building.key}
            className="relative flex items-start gap-4 p-4 h-[176px]"
          >
            {/* Image on the left */}
            <div className={`relative w-[140px] h-[140px] flex-shrink-0 rounded-xl overflow-hidden border-2 ${isTechLocked ? 'border-[var(--ivory)]/20 grayscale opacity-50' : 'border-[var(--burnt-amber)]'}`}>
              <Image
                src={building.image}
                alt={building.title}
                fill
                className="object-cover"
              />
            </div>

            {/* Content on the right */}
            <div className="flex-1 min-w-0 flex flex-col h-[140px]">
              {/* Top: title + action */}
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold font-[family-name:var(--font-title)] tracking-wider text-[var(--ivory)]">
                  {building.title}
                </h2>
                {hasActiveConstruction ? (
                  <ConstructionStatus
                    startedAt={activeConstruction.startedAt}
                    buildSeconds={activeConstruction.buildSeconds}
                    assignedBuilders={activeConstruction.assignedBuilders}
                  />
                ) : (
                  <>
                    <div className="flex-1" />
                    {building.capacityBonus > 0 && building.key !== 'cabane_en_bois' && (
                      <div className="flex items-center gap-1">
                        <GiThreeFriends size={14} style={{ color: '#C19A6B' }} />
                        <span className="text-xs font-bold text-[var(--ivory)]/60">
                          +{building.capacityBonus}
                        </span>
                      </div>
                    )}
                    {STORAGE_BONUS_CONFIG.map((sb) =>
                      building[sb.key] > 0 ? (
                        <div key={sb.key} className="flex items-center gap-1">
                          <sb.icon size={14} style={{ color: sb.color }} />
                          <span className="text-xs font-bold text-[var(--ivory)]/60">
                            +{building[sb.key]}
                          </span>
                        </div>
                      ) : null
                    )}
                    <Button
                      variant="seal"
                      size="xs"
                      disabled={isDisabled}
                      isLoading={loadingKey === building.key}
                      onClick={() => handleBuildClick(building.key, hasActiveConstruction)}
                    >
                      {getButtonLabel(building, canAfford)}
                    </Button>
                  </>
                )}
              </div>

              {/* Description (fixed 2 lines) */}
              <p className="text-sm text-[var(--ivory)]/70 leading-relaxed line-clamp-2 mt-2">
                {building.description}
              </p>

              {/* Spacer to push bottom content down */}
              <div className="flex-1" />

              {/* Bottom: effect line + costs (always at bottom of card) */}
              <div>
                {/* Current effect for upgradeable buildings */}
                {isUpgradeable &&
                  STORAGE_BONUS_CONFIG.some((sb) => building[sb.key] > 0) && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--ivory)]/40">
                      Capacité actuelle
                    </span>
                    <span className="text-[var(--ivory)]/20">|</span>
                    {building.completedCount > 0 && building.staffCount === 0 ? (
                      <span className="text-xs italic text-amber-400/60">
                        Inactif — aucun professionnel
                      </span>
                    ) : (
                      STORAGE_BONUS_CONFIG.map((sb) => {
                        if (building[sb.key] <= 0) return null
                        return (
                          <div key={sb.key} className="flex items-center gap-1">
                            <sb.icon size={14} style={{ color: sb.color }} />
                            <span className="text-xs font-bold text-[var(--burnt-amber)]">
                              {storageCapacity[sb.capacityKey]}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}

                {isUpgradeable && building.key === 'tour_de_guet' && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--ivory)]/40">
                      Détection
                    </span>
                    <span className="text-[var(--ivory)]/20">|</span>
                    <div className="flex items-center gap-1">
                      <GiWatchtower size={14} className="text-amber-400/80" />
                      {building.currentLevel > 0 ? (
                        <span className="text-xs font-bold text-[var(--burnt-amber)]">
                          {(DETECTION_WINDOW_SECONDS[building.currentLevel] ?? 0) / 60} min avant l&apos;arrivée
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--ivory)]/30">aucune</span>
                      )}
                    </div>
                  </div>
                )}

                {isUpgradeable && building.key === 'taverne' && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--ivory)]/40">
                      Durée de séjour
                    </span>
                    <span className="text-[var(--ivory)]/20">|</span>
                    <div className="flex items-center gap-1">
                      <GiBeerStein size={14} className="text-amber-600/80" />
                      {building.currentLevel > 0 ? (
                        <span className="text-xs font-bold text-[var(--burnt-amber)]">
                          ×{TAVERN_STAY_MULTIPLIER[building.currentLevel] ?? 1}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--ivory)]/30">normale</span>
                      )}
                    </div>
                  </div>
                )}

                {buildErrors[building.key] && (
                  <p className="text-xs text-[var(--burnt-amber-light)]">
                    {buildErrors[building.key]}
                  </p>
                )}

                {isTechLocked && building.requiredTechnology && (
                  <Link
                    href={`/research?focus=${building.requiredTechnology}`}
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--burnt-amber)]/70 hover:text-[var(--burnt-amber)] transition-colors"
                  >
                    <GiPadlock size={12} />
                    Nécessite {building.requiredTechnologyTitle} Niv. 1
                  </Link>
                )}

                {/* Cost & time display */}
                {!maxLevelReached && !maxCountReached && !isTechLocked && (
                  <div className="flex items-center gap-3 mt-1">
                    {costs.map((r) => {
                      const cost = building[r.key] * costMultiplier
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
                    <span className="text-[var(--ivory)]/30">|</span>
                    <div className="flex items-center gap-1">
                      <GiSandsOfTime size={16} className="text-[var(--ivory)]/60" />
                      <span className="text-sm font-bold text-[var(--ivory)]/60">
                        {formatTimeRemaining(building.buildSeconds * costMultiplier)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Badges: bottom-right of the card */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
              {building.staffCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-[#C19A6B]/15 text-[#C19A6B] border border-[#C19A6B]/30">
                  <GiThreeFriends size={11} />
                  {building.staffCount}
                </span>
              )}
              {isUpgradeable && building.currentLevel > 0 ? (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[var(--burnt-amber)]/20 text-[var(--burnt-amber)] border border-[var(--burnt-amber)]/30">
                  Niv. {building.currentLevel}
                </span>
              ) : building.completedCount > 0 && !isUpgradeable ? (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[var(--burnt-amber)]/20 text-[var(--burnt-amber)] border border-[var(--burnt-amber)]/30">
                  ×{building.completedCount}
                </span>
              ) : null}
            </div>
          </div>
        )
      })}

      {/* Build modal */}
      {selectedBuilding && (() => {
        const isUpgradeModal = selectedBuilding.maxCount === 1 && selectedBuilding.maxLevel > 1 && selectedBuilding.currentLevel > 0
        const targetLevel = isUpgradeModal ? selectedBuilding.currentLevel + 1 : 1
        return (
          <BuildModal
            buildingTitle={selectedBuilding.title}
            buildingTypeKey={selectedBuilding.key}
            baseBuildSeconds={selectedBuilding.buildSeconds * targetLevel}
            availableBuilders={availableBuilders}
            isUpgrade={isUpgradeModal}
            onClose={() => setBuildModalKey(null)}
          />
        )
      })()}
    </HabitantsPanel>
  )
}
