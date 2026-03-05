'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createMission } from '@/lib/game/missions/create-mission'
import { manhattanDistance, computeTravelSeconds } from '@/lib/game/missions/distance'
import {
  MIN_WORK_SECONDS,
  MAX_WORK_SECONDS,
} from '@/lib/game/missions/constants'
import { MISSION_CONFIG } from '@/lib/game/missions/mission-config'
import { MISSION_ICONS } from '@/lib/game/missions/mission-icons'
import { GiSandsOfTime, GiPositionMarker } from 'react-icons/gi'

interface SendMissionModalProps {
  targetX: number
  targetY: number
  villageX: number
  villageY: number
  speed: number
  gatherRate: number
  maxCapacity: number
  availableWorkers: number
  inhabitantType: string
  onClose: () => void
  onBack?: () => void
}

function formatDuration(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || isNaN(totalSeconds)) return '—'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
  return `${m} min`
}

const SLIDER_THUMB = `[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--burnt-amber)]
  [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--ivory)]
  [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(179,123,52,0.4)]`

function sliderBackground(ratio: number): string {
  const pct = ratio * 100
  return `linear-gradient(to right, var(--burnt-amber) ${pct}%, rgba(245,245,220,0.15) ${pct}%)`
}

export function SendMissionModal({
  targetX,
  targetY,
  villageX,
  villageY,
  speed,
  gatherRate,
  maxCapacity,
  availableWorkers,
  inhabitantType,
  onClose,
  onBack,
}: SendMissionModalProps) {
  const router = useRouter()
  const [workerCount, setWorkerCount] = useState(1)
  const [workHours, setWorkHours] = useState(0)
  const [workMinutes, setWorkMinutes] = useState(30)
  const [loop, setLoop] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const config = MISSION_CONFIG[inhabitantType]
  const isExploration = config?.exploration ?? false
  const MissionIcon = MISSION_ICONS[inhabitantType] ?? GiPositionMarker
  const featureLabel = config?.featureLabel ?? 'Cible'
  const resourceLabel = config?.resourceLabel ?? 'Ressource'

  const workSeconds = workHours * 3600 + workMinutes * 60

  // For exploration: no capacity cap; for resource: cap to fill capacity
  const capacitySeconds = isExploration
    ? MAX_WORK_SECONDS
    : gatherRate > 0
      ? Math.ceil((maxCapacity / gatherRate) * 3600 / 60) * 60
      : MAX_WORK_SECONDS
  const effectiveMax = Math.min(MAX_WORK_SECONDS, capacitySeconds)

  const isBelowMin = workSeconds < MIN_WORK_SECONDS
  const isAboveMax = workSeconds > effectiveMax
  const isInvalidDuration = isBelowMin || isAboveMax

  const clampedWorkSeconds = Math.min(workSeconds, effectiveMax)

  const distance = manhattanDistance(villageX, villageY, targetX, targetY)
  const travelSeconds = computeTravelSeconds(distance, speed)
  const totalSeconds = travelSeconds * 2 + clampedWorkSeconds

  // Resource projection (only for non-exploration)
  const perWorkerResource = Math.min(
    Math.floor((clampedWorkSeconds / 3600) * gatherRate),
    maxCapacity,
  )
  const projectedResource = workerCount * perWorkerResource
  const totalCapacity = workerCount * maxCapacity
  const resourceRatio = totalCapacity > 0 ? projectedResource / totalCapacity : 0
  const isAtCapacity = perWorkerResource >= maxCapacity

  // Exploration: savoir projection (same formula as resources)
  const projectedSavoir = workerCount * Math.min(
    Math.floor((clampedWorkSeconds / 3600) * gatherRate),
    maxCapacity,
  )

  const noWorkers = availableWorkers <= 0

  async function handleSend() {
    if (noWorkers || isInvalidDuration) return
    setPending(true)
    setError(null)
    const result = await createMission(targetX, targetY, clampedWorkSeconds, loop, inhabitantType, workerCount)
    if (result.success) {
      router.refresh()
      onClose()
    } else {
      setError(result.error)
      setPending(false)
    }
  }

  const workerSliderRatio = availableWorkers > 1
    ? (workerCount - 1) / (availableWorkers - 1)
    : 0
  const durationSliderRatio = effectiveMax > MIN_WORK_SECONDS
    ? (Math.min(Math.max(workSeconds, MIN_WORK_SECONDS), effectiveMax) - MIN_WORK_SECONDS) / (effectiveMax - MIN_WORK_SECONDS)
    : 0

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative stone-texture border-engraved rounded-lg shadow-[var(--shadow-vellum)] max-w-md w-full mx-4 overflow-hidden">

        {/* Header */}
        <div className="relative px-6 pt-5 pb-4">
          {/* Back arrow (from habitants mini-map) */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={pending}
              className="absolute left-4 top-4 w-8 h-8 flex items-center justify-center rounded
                text-[var(--ivory)]/50 hover:text-[var(--ivory)] hover:bg-[var(--ivory)]/10
                transition-colors cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 12L6 8L10 4" />
              </svg>
            </button>
          )}

          {/* Close X */}
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded
              text-[var(--ivory)]/50 hover:text-[var(--ivory)] hover:bg-[var(--ivory)]/10
              transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1L13 13M13 1L1 13" />
            </svg>
          </button>

          {/* Icon + title */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(179, 123, 52, 0.15)' }}
            >
              <MissionIcon size={28} className="text-[var(--burnt-amber)]" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)]">
                {featureLabel}
              </h2>
              <span className="text-xs text-[var(--ivory)]/40">
                ({targetX}, {targetY}) — distance {distance}
              </span>
            </div>
          </div>
        </div>

        {noWorkers && (
          <div className="mx-6 mb-4 p-3 text-sm bg-[var(--burnt-amber)]/15 border border-[var(--burnt-amber)]/30 rounded text-[var(--burnt-amber-light)] text-center">
            Aucun {config?.workerLabel ?? 'travailleur'} disponible
          </div>
        )}

        {/* Configuration section */}
        <div className="px-6 pb-5 space-y-4">

          {/* Worker count slider */}
          {availableWorkers > 1 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--ivory)]/50 uppercase tracking-wider font-[family-name:var(--font-title)]">
                  {isExploration ? 'Explorateurs' : 'Travailleurs'}
                </span>
                <span className="text-sm text-[var(--ivory)] font-[family-name:var(--font-title)] tracking-wider">
                  {workerCount} / {availableWorkers}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={availableWorkers}
                step={1}
                value={workerCount}
                onChange={(e) => setWorkerCount(Number(e.target.value))}
                disabled={noWorkers}
                className={`w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-50 ${SLIDER_THUMB}`}
                style={{ background: sliderBackground(workerSliderRatio) }}
              />
            </div>
          )}

          {/* Duration slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--ivory)]/50 uppercase tracking-wider font-[family-name:var(--font-title)]">
                {isExploration ? "Durée d'exploration" : 'Durée de travail'}
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={8}
                  value={workHours}
                  onChange={(e) => setWorkHours(Math.max(0, Math.min(8, Number(e.target.value) || 0)))}
                  disabled={noWorkers}
                  className="w-10 px-1 py-0.5 rounded bg-[var(--ivory)]/10 border border-[var(--ivory)]/20
                    text-[var(--ivory)] text-center font-[family-name:var(--font-title)] tracking-wider text-xs
                    focus:outline-none focus:border-[var(--burnt-amber)] focus:ring-1 focus:ring-[var(--burnt-amber)]/50
                    disabled:opacity-50
                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[10px] text-[var(--ivory)]/50">h</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={workMinutes}
                  onChange={(e) => setWorkMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                  disabled={noWorkers}
                  className="w-10 px-1 py-0.5 rounded bg-[var(--ivory)]/10 border border-[var(--ivory)]/20
                    text-[var(--ivory)] text-center font-[family-name:var(--font-title)] tracking-wider text-xs
                    focus:outline-none focus:border-[var(--burnt-amber)] focus:ring-1 focus:ring-[var(--burnt-amber)]/50
                    disabled:opacity-50
                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[10px] text-[var(--ivory)]/50">min</span>
              </div>
            </div>
            <input
              type="range"
              min={MIN_WORK_SECONDS}
              max={effectiveMax}
              step={60}
              value={Math.min(Math.max(workSeconds, MIN_WORK_SECONDS), effectiveMax)}
              onChange={(e) => {
                const total = Number(e.target.value)
                setWorkHours(Math.floor(total / 3600))
                setWorkMinutes(Math.floor((total % 3600) / 60))
              }}
              disabled={noWorkers}
              className={`w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-50 ${SLIDER_THUMB}`}
              style={{ background: sliderBackground(durationSliderRatio) }}
            />
            {isInvalidDuration && (
              <p className="mt-1.5 text-[10px] text-[var(--burnt-amber)]">
                {isBelowMin
                  ? 'Minimum 1 minute'
                  : `Capacité max atteinte (${formatDuration(effectiveMax)})`}
              </p>
            )}
          </div>

          {isExploration ? (
            /* Exploration: savoir projection */
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--ivory)]/50 uppercase tracking-wider font-[family-name:var(--font-title)]">
                  Savoir estimé
                </span>
                <span className="text-sm font-[family-name:var(--font-title)] tracking-wider" style={{ color: '#9370DB' }}>
                  +{projectedSavoir}
                </span>
              </div>
              <p className="text-[10px] text-[var(--ivory)]/40">
                Les explorateurs peuvent aussi rapporter des objets
              </p>
            </div>
          ) : (
            /* Resource projection */
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--ivory)]/50 uppercase tracking-wider font-[family-name:var(--font-title)]">
                  {resourceLabel} estimé
                </span>
                <span className="text-sm text-[var(--ivory)] font-[family-name:var(--font-title)] tracking-wider">
                  {projectedResource}
                </span>
              </div>
              <div className="relative h-5 bg-[var(--ivory)]/10 rounded-full overflow-hidden border border-[var(--ivory)]/10">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${resourceRatio * 100}%`,
                    backgroundColor: isAtCapacity
                      ? 'var(--burnt-amber)'
                      : 'rgb(101, 163, 78)',
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[var(--ivory)]/70">
                  {projectedResource} / {totalCapacity}
                </span>
              </div>
            </div>
          )}

          {/* Summary row: travel times + loop */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3 text-xs text-[var(--ivory)]/40">
              <div className="flex items-center gap-1">
                <GiSandsOfTime size={12} />
                <span>Aller {formatDuration(travelSeconds)}</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1">
                <GiSandsOfTime size={12} />
                <span>Total {formatDuration(totalSeconds)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLoop(!loop)}
              disabled={noWorkers}
              title="Relancer automatiquement"
              className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors cursor-pointer
                ${loop
                  ? 'bg-[var(--burnt-amber)]/20 text-[var(--burnt-amber)]'
                  : 'text-[var(--ivory)]/30 hover:text-[var(--ivory)]/60 hover:bg-[var(--ivory)]/5'}
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <span className="text-[10px] uppercase tracking-wider font-[family-name:var(--font-title)]">
                Boucle
              </span>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 p-3 text-sm bg-[var(--burnt-amber)]/15 border border-[var(--burnt-amber)]/30 rounded text-[var(--burnt-amber-light)]">
            {error}
          </div>
        )}

        {/* Send button — full width footer */}
        <div className="px-6 pb-5">
          <Button
            variant="seal"
            onClick={handleSend}
            isLoading={pending}
            disabled={noWorkers || isInvalidDuration}
            className="w-full"
          >
            {isExploration
              ? workerCount > 1
                ? `ENVOYER ${workerCount} ${(config?.workerLabelPlural ?? inhabitantType).toUpperCase()}`
                : 'EXPLORER'
              : workerCount > 1
                ? `ENVOYER ${workerCount} ${(config?.workerLabelPlural ?? inhabitantType).toUpperCase()}`
                : `ENVOYER`}
          </Button>
        </div>
      </div>
    </div>
  )
}
