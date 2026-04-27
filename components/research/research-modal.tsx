'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { startResearch } from '@/lib/game/research/start-research'
import { formatTimeRemaining } from '@/lib/utils/format-time'
import { GiSandsOfTime } from 'react-icons/gi'

interface ResearchModalProps {
  technologyTitle: string
  technologyKey: string
  baseResearchSeconds: number
  availableResearchers: number
  onClose: () => void
}

export function ResearchModal({
  technologyTitle,
  technologyKey,
  baseResearchSeconds,
  availableResearchers,
  onClose,
}: ResearchModalProps) {
  const router = useRouter()
  const [researcherCount, setResearcherCount] = useState(1)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const estimatedSeconds = Math.ceil(baseResearchSeconds / researcherCount)
  const sliderPercent = availableResearchers > 1
    ? ((researcherCount - 1) / (availableResearchers - 1)) * 100
    : 100

  async function handleConfirm() {
    setPending(true)
    setError(null)
    const result = await startResearch(technologyKey, researcherCount)
    if (result.success) {
      router.refresh()
      onClose()
    } else {
      setError(result.error)
      setPending(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => { if (!pending) onClose() }}
      />

      {/* Modal */}
      <div className="relative stone-texture border-engraved p-8 rounded-lg shadow-[var(--shadow-vellum)] max-w-md w-full mx-4">
        <h2 className="text-2xl font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)] text-center mb-6">
          RECHERCHER
        </h2>
        <p className="text-sm text-[var(--ivory)]/70 text-center mb-6">
          {technologyTitle}
        </p>

        {/* Researcher count slider */}
        <div className="mb-5">
          <label className="block text-sm text-[var(--ivory)]/70 mb-2">
            Chercheurs assignés :
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={availableResearchers}
              step={1}
              value={researcherCount}
              onChange={(e) => setResearcherCount(Number(e.target.value))}
              disabled={pending}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--burnt-amber)]
                [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--ivory)]
                [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(179,123,52,0.5)]
                disabled:opacity-50"
              style={{
                background: `linear-gradient(to right, var(--burnt-amber) ${sliderPercent}%, rgba(245,245,220,0.2) ${sliderPercent}%)`,
              }}
            />
            <span className="text-lg font-bold text-[var(--ivory)] font-[family-name:var(--font-title)] tracking-wider min-w-[2ch] text-center">
              {researcherCount}
            </span>
          </div>
        </div>

        {/* Estimated time */}
        <div className="flex items-center gap-2 mb-6 text-sm text-[var(--ivory)]/70">
          <GiSandsOfTime size={16} className="text-[var(--ivory)]/70" />
          <span>
            Temps de recherche : <span className="text-[var(--burnt-amber)] font-bold">{formatTimeRemaining(estimatedSeconds)}</span>
          </span>
        </div>

        {error && (
          <div className="p-4 text-sm bg-[var(--burnt-amber)]/20 border border-[var(--burnt-amber)] border-opacity-40 rounded text-[var(--burnt-amber-light)] mb-4">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="stone" onClick={onClose} disabled={pending}>
            ANNULER
          </Button>
          <Button
            variant="seal"
            onClick={handleConfirm}
            isLoading={pending}
          >
            RECHERCHER
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
