'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ResearchModal } from '@/components/research/research-modal'
import { formatTimeRemaining } from '@/lib/utils/format-time'
import { GiWoodPile, GiStonePile, GiWheat, GiMeat, GiMicroscope, GiSandsOfTime } from 'react-icons/gi'

interface ActiveResearch {
  startedAt: string
  researchSeconds: number
  assignedResearchers: number
}

export interface TechnologyData {
  key: string
  title: string
  description: string
  image: string
  costBois: number
  costPierre: number
  costCereales: number
  costViande: number
  researchSeconds: number
  requiredLabLevel: number
  maxLevel: number
  currentLevel: number
  isMaxLevel: boolean
  activeResearch: ActiveResearch | null
  isLabLevelMet: boolean
}

interface ResearchPageClientProps {
  technologies: TechnologyData[]
  villageResources: {
    bois: number
    pierre: number
    cereales: number
    viande: number
  }
  availableResearchers: number
  focusKey?: string
}

const RESOURCE_CONFIG = [
  { key: 'costBois' as const, resKey: 'bois' as const, icon: GiWoodPile, color: '#8B4513', label: 'Bois' },
  { key: 'costPierre' as const, resKey: 'pierre' as const, icon: GiStonePile, color: '#708090', label: 'Pierre' },
  { key: 'costCereales' as const, resKey: 'cereales' as const, icon: GiWheat, color: '#DAA520', label: 'Céréales' },
  { key: 'costViande' as const, resKey: 'viande' as const, icon: GiMeat, color: '#CD5C5C', label: 'Viande' },
]

function ResearchStatus({
  startedAt,
  researchSeconds,
  assignedResearchers,
}: ActiveResearch) {
  const router = useRouter()
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000
    return Math.max(0, Math.ceil(researchSeconds - elapsed))
  })

  useEffect(() => {
    if (secondsRemaining <= 0) return
    const interval = setInterval(() => {
      const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000
      const remaining = Math.max(0, Math.ceil(researchSeconds - elapsed))
      setSecondsRemaining(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        router.refresh()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt, researchSeconds, secondsRemaining, router])

  const progress = Math.max(0, Math.min(1, 1 - (secondsRemaining / researchSeconds)))
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
        <GiMicroscope size={14} className="text-[var(--burnt-amber)]" />
        {assignedResearchers}
      </span>
    </div>
  )
}

export function ResearchPageClient({ technologies, villageResources, availableResearchers, focusKey }: ResearchPageClientProps) {
  const [researchModalKey, setResearchModalKey] = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [researchErrors, setResearchErrors] = useState<Record<string, string>>({})
  const [highlightedKey, setHighlightedKey] = useState<string | null>(focusKey ?? null)
  const focusRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (focusKey && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Remove highlight after animation
      const timeout = setTimeout(() => setHighlightedKey(null), 2000)
      return () => clearTimeout(timeout)
    }
  }, [focusKey])

  const noResearchers = availableResearchers <= 0

  function getButtonLabel(tech: TechnologyData, canAfford: boolean) {
    if (tech.isMaxLevel) return 'NIVEAU MAX'
    if (!tech.isLabLevelMet) return 'LABO INSUFFISANT'
    if (noResearchers) return 'AUCUN CHERCHEUR'
    if (!canAfford) return 'RESSOURCES INSUFFISANTES'
    return tech.currentLevel > 0 ? 'AMELIORER' : 'RECHERCHER'
  }

  async function handleResearchClick(key: string) {
    setResearchErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })

    if (availableResearchers === 1) {
      setLoadingKey(key)
      const { startResearch } = await import('@/lib/game/research/start-research')
      const result = await startResearch(key, 1)
      if (!result.success) {
        setResearchErrors((prev) => ({ ...prev, [key]: result.error }))
        setLoadingKey(null)
        return
      }
      router.refresh()
      setLoadingKey(null)
    } else {
      setResearchModalKey(key)
    }
  }

  const selectedTech = researchModalKey
    ? technologies.find((t) => t.key === researchModalKey) ?? null
    : null

  return (
    <>
      <style>{`
        .research-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .research-scroll::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.8);
        }
        .research-scroll::-webkit-scrollbar-thumb {
          background: var(--burnt-amber);
          border-radius: 2px;
        }
        .research-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--burnt-amber-light);
        }
      `}</style>
      <div className="w-[60%] max-w-3xl max-h-full bg-black/75 backdrop-blur border border-[var(--burnt-amber)]/50 rounded-l-2xl rounded-r-lg overflow-hidden flex flex-col">
        <div className="overflow-y-auto research-scroll divide-y divide-[var(--ivory)]/10 pr-1 min-h-0">
          {technologies.map((tech) => {
            const canAfford =
              villageResources.bois >= tech.costBois &&
              villageResources.pierre >= tech.costPierre &&
              villageResources.cereales >= tech.costCereales &&
              villageResources.viande >= tech.costViande

            const isDisabled = tech.isMaxLevel || !tech.isLabLevelMet || !canAfford || noResearchers || loadingKey === tech.key
            const costs = RESOURCE_CONFIG.filter((r) => tech[r.key] > 0)
            const hasActiveResearch = Boolean(tech.activeResearch)

            const isFocused = tech.key === focusKey
            const isHighlighted = tech.key === highlightedKey

            return (
              <div
                key={tech.key}
                ref={isFocused ? focusRef : undefined}
                className={`relative flex items-center gap-4 p-4 transition-colors duration-1000 ${isHighlighted ? 'bg-[var(--burnt-amber)]/15' : ''}`}
              >
                {/* Image on the left */}
                <div className="relative w-[140px] h-[140px] flex-shrink-0 rounded-xl overflow-hidden border-2 border-[var(--burnt-amber)]">
                  <Image
                    src={tech.image}
                    alt={tech.title}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Content on the right */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold font-[family-name:var(--font-title)] tracking-wider text-[var(--ivory)]">
                      {tech.title}
                    </h2>
                    {hasActiveResearch ? (
                      <ResearchStatus
                        startedAt={tech.activeResearch!.startedAt}
                        researchSeconds={tech.activeResearch!.researchSeconds}
                        assignedResearchers={tech.activeResearch!.assignedResearchers}
                      />
                    ) : (
                      <>
                        <div className="flex-1" />
                        <Button
                          variant="seal"
                          size="xs"
                          disabled={isDisabled}
                          isLoading={loadingKey === tech.key}
                          onClick={() => handleResearchClick(tech.key)}
                        >
                          {getButtonLabel(tech, canAfford)}
                        </Button>
                      </>
                    )}
                  </div>

                  <p className="text-sm text-[var(--ivory)]/70 leading-relaxed">
                    {tech.description}
                  </p>
                  {researchErrors[tech.key] && (
                    <p className="mt-2 text-xs text-[var(--burnt-amber-light)]">
                      {researchErrors[tech.key]}
                    </p>
                  )}

                  {/* Cost & time display — show next level costs if not max */}
                  {!tech.isMaxLevel && !hasActiveResearch && (
                    <div className="flex items-center gap-3 mt-2">
                      {costs.map((r) => {
                        const cost = tech[r.key]
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
                          {formatTimeRemaining(tech.researchSeconds)}
                        </span>
                      </div>
                    </div>
                  )}

                  {!tech.isLabLevelMet && !tech.isMaxLevel && (
                    <p className="mt-2 text-xs text-[var(--burnt-amber)]/70">
                      Nécessite un laboratoire niveau {tech.requiredLabLevel}
                    </p>
                  )}
                </div>

                {/* Badge: bottom-right of the card */}
                {tech.currentLevel > 0 && (
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 text-xs font-bold rounded-full bg-[var(--burnt-amber)]/20 text-[var(--burnt-amber)] border border-[var(--burnt-amber)]/30">
                    Niv. {tech.currentLevel}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Research modal */}
      {selectedTech && (
        <ResearchModal
          technologyTitle={selectedTech.title}
          technologyKey={selectedTech.key}
          baseResearchSeconds={selectedTech.researchSeconds}
          availableResearchers={availableResearchers}
          onClose={() => setResearchModalKey(null)}
        />
      )}
    </>
  )
}
