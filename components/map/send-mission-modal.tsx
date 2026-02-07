'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createMission } from '@/lib/game/missions/create-mission'
import { chebyshevDistance, computeTravelSeconds } from '@/lib/game/missions/distance'
import {
  MIN_WORK_SECONDS,
  MAX_WORK_SECONDS,
  WORK_STEP_SECONDS,
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
  const [workSeconds, setWorkSeconds] = useState(MIN_WORK_SECONDS)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const distance = chebyshevDistance(villageX, villageY, targetX, targetY)
  const travelSeconds = computeTravelSeconds(distance, speed)
  const totalSeconds = travelSeconds * 2 + workSeconds

  const projectedWood = Math.min(
    Math.floor((workSeconds / 3600) * gatherRate),
    maxCapacity,
  )
  const woodRatio = maxCapacity > 0 ? projectedWood / maxCapacity : 0
  const isAtCapacity = projectedWood >= maxCapacity

  const noLumberjacks = availableLumberjacks <= 0

  async function handleSend() {
    if (noLumberjacks) return
    setPending(true)
    setError(null)
    const result = await createMission(targetX, targetY, workSeconds)
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

        {/* Work duration slider */}
        <div className="mb-5">
          <label className="block text-sm text-[var(--ivory)]/70 mb-2">
            Durée de travail :
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={MIN_WORK_SECONDS}
              max={MAX_WORK_SECONDS}
              step={WORK_STEP_SECONDS}
              value={workSeconds}
              onChange={(e) => setWorkSeconds(Number(e.target.value))}
              disabled={noLumberjacks}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--burnt-amber)]
                [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--ivory)]
                [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(179,123,52,0.5)]
                disabled:opacity-50"
              style={{
                background: `linear-gradient(to right, var(--burnt-amber) ${((workSeconds - MIN_WORK_SECONDS) / (MAX_WORK_SECONDS - MIN_WORK_SECONDS)) * 100}%, rgba(245,245,220,0.2) ${((workSeconds - MIN_WORK_SECONDS) / (MAX_WORK_SECONDS - MIN_WORK_SECONDS)) * 100}%)`,
              }}
            />
            <span className="text-[var(--ivory)] font-[family-name:var(--font-title)] tracking-wider min-w-[5rem] text-right">
              {Math.floor(workSeconds / 60)} min
            </span>
          </div>
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
              className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${
                isAtCapacity ? 'text-[var(--burnt-amber)]' : 'text-[var(--ivory)]'
              }`}
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
            disabled={noLumberjacks}
          >
            ENVOYER
          </Button>
        </div>
      </div>
    </div>
  )
}
