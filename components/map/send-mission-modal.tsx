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

interface SendMissionModalProps {
  targetX: number
  targetY: number
  villageX: number
  villageY: number
  speed: number
  gatherRate: number
  maxCapacity: number
  availableLumberjacks: number
  onClose: () => void
  onBack?: () => void // if coming from habitants mini-map
}

function formatDuration(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || isNaN(totalSeconds)) return '—'
  const totalMinutes = Math.floor(totalSeconds / 60)
  return `${totalMinutes} min`
}

export function SendMissionModal({
  targetX,
  targetY,
  villageX,
  villageY,
  speed,
  gatherRate,
  maxCapacity,
  availableLumberjacks,
  onClose,
  onBack,
}: SendMissionModalProps) {
  const router = useRouter()
  const [workHours, setWorkHours] = useState(0)
  const [workMinutes, setWorkMinutes] = useState(30)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const workSeconds = workHours * 3600 + workMinutes * 60

  // Cap duration to the time needed to fill capacity
  const capacitySeconds = gatherRate > 0
    ? Math.ceil((maxCapacity / gatherRate) * 3600 / 60) * 60 // round up to next minute
    : MAX_WORK_SECONDS
  const effectiveMax = Math.min(MAX_WORK_SECONDS, capacitySeconds)

  const isBelowMin = workSeconds < MIN_WORK_SECONDS
  const isAboveMax = workSeconds > effectiveMax
  const isInvalidDuration = isBelowMin || isAboveMax

  const clampedWorkSeconds = Math.min(workSeconds, effectiveMax)

  const distance = manhattanDistance(villageX, villageY, targetX, targetY)
  const travelSeconds = computeTravelSeconds(distance, speed)
  const totalSeconds = travelSeconds * 2 + clampedWorkSeconds

  const projectedWood = Math.min(
    Math.floor((clampedWorkSeconds / 3600) * gatherRate),
    maxCapacity,
  )
  const woodRatio = maxCapacity > 0 ? projectedWood / maxCapacity : 0
  const isAtCapacity = projectedWood >= maxCapacity

  const noLumberjacks = availableLumberjacks <= 0

  async function handleSend() {
    if (noLumberjacks || isInvalidDuration) return
    setPending(true)
    setError(null)
    const result = await createMission(targetX, targetY, clampedWorkSeconds)
    if (result.success) {
      router.refresh()
      onClose()
    } else {
      setError(result.error)
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative stone-texture border-engraved p-8 rounded-lg shadow-[var(--shadow-vellum)] max-w-lg w-full mx-4">
        <h2 className="text-2xl font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)] text-center mb-6">
          ENVOYER UN BUCHERON
        </h2>

        {noLumberjacks && (
          <div className="p-4 text-sm bg-[var(--burnt-amber)]/20 border border-[var(--burnt-amber)] border-opacity-40 rounded text-[var(--burnt-amber-light)] mb-4 text-center">
            Aucun bûcheron disponible
          </div>
        )}

        {/* Target info */}
        <div className="flex items-center justify-between mb-4 text-[var(--ivory)]">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌲</span>
            <span className="font-[family-name:var(--font-title)] tracking-wider">
              Forêt ({targetX}, {targetY})
            </span>
          </div>
          <span className="text-sm text-[var(--ivory)]/70">
            Distance : {distance}
          </span>
        </div>

        {/* Travel time outbound */}
        <div className="flex items-center gap-2 mb-5 text-sm text-[var(--ivory)]/70">
          <span>⏱</span>
          <span>Trajet aller : {formatDuration(travelSeconds)}</span>
        </div>

        {/* Work duration — slider + inputs on the same row */}
        <div className="mb-5">
          <label className="block text-sm text-[var(--ivory)]/70 mb-2">
            Durée de travail :
          </label>
          <div className="flex items-center gap-3">
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
              disabled={noLumberjacks}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--burnt-amber)]
                [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--ivory)]
                [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(179,123,52,0.5)]
                disabled:opacity-50"
              style={{
                background: `linear-gradient(to right, var(--burnt-amber) ${((Math.min(Math.max(workSeconds, MIN_WORK_SECONDS), effectiveMax) - MIN_WORK_SECONDS) / (effectiveMax - MIN_WORK_SECONDS)) * 100}%, rgba(245,245,220,0.2) ${((Math.min(Math.max(workSeconds, MIN_WORK_SECONDS), effectiveMax) - MIN_WORK_SECONDS) / (effectiveMax - MIN_WORK_SECONDS)) * 100}%)`,
              }}
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="number"
                min={0}
                max={8}
                value={workHours}
                onChange={(e) => setWorkHours(Math.max(0, Math.min(8, Number(e.target.value) || 0)))}
                disabled={noLumberjacks}
                className="w-12 px-1 py-1 rounded bg-[var(--ivory)]/10 border border-[var(--ivory)]/20
                  text-[var(--ivory)] text-center font-[family-name:var(--font-title)] tracking-wider text-sm
                  focus:outline-none focus:border-[var(--burnt-amber)] focus:ring-1 focus:ring-[var(--burnt-amber)]/50
                  disabled:opacity-50
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-xs text-[var(--ivory)]/70">h</span>
              <input
                type="number"
                min={0}
                max={59}
                value={workMinutes}
                onChange={(e) => setWorkMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                disabled={noLumberjacks}
                className="w-12 px-1 py-1 rounded bg-[var(--ivory)]/10 border border-[var(--ivory)]/20
                  text-[var(--ivory)] text-center font-[family-name:var(--font-title)] tracking-wider text-sm
                  focus:outline-none focus:border-[var(--burnt-amber)] focus:ring-1 focus:ring-[var(--burnt-amber)]/50
                  disabled:opacity-50
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-xs text-[var(--ivory)]/70">min</span>
            </div>
          </div>
          {isInvalidDuration && (
            <p className="mt-2 text-xs text-[var(--burnt-amber)]">
              {isBelowMin
                ? 'Minimum 1 minute'
                : `Capacité maximale atteinte (${Math.floor(effectiveMax / 3600)}h${String(Math.floor((effectiveMax % 3600) / 60)).padStart(2, '0')})`}
            </p>
          )}
        </div>

        {/* Projected wood gauge */}
        <div className="mb-5">
          <label className="block text-sm text-[var(--ivory)]/70 mb-2">
            Bois estimé :
          </label>
          <div className="relative h-6 bg-[var(--ivory)]/10 rounded-full overflow-hidden border border-[var(--ivory)]/20">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${woodRatio * 100}%`,
                backgroundColor: isAtCapacity
                  ? 'var(--burnt-amber)'
                  : 'rgb(101, 163, 78)',
              }}
            />
            <span
              className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[var(--ivory)]"
            >
              {projectedWood} / {maxCapacity}
            </span>
          </div>
        </div>

        {/* Total return time */}
        <div className="flex items-center gap-2 mb-6 text-sm text-[var(--ivory)]/70">
          <span>⏱</span>
          <span>Retour au village : {formatDuration(totalSeconds)}</span>
        </div>

        {error && (
          <div className="p-4 text-sm bg-[var(--burnt-amber)]/20 border border-[var(--burnt-amber)] border-opacity-40 rounded text-[var(--burnt-amber-light)] mb-4">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          {onBack && (
            <Button variant="stone" onClick={onBack} disabled={pending}>
              RETOUR
            </Button>
          )}
          <Button variant="stone" onClick={onClose} disabled={pending}>
            ANNULER
          </Button>
          <Button
            variant="seal"
            onClick={handleSend}
            isLoading={pending}
            disabled={noLumberjacks || isInvalidDuration}
          >
            ENVOYER
          </Button>
        </div>
      </div>
    </div>
  )
}
