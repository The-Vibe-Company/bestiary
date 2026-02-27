'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { assignTraveler } from '@/lib/game/travelers/assign-traveler'
import type { InhabitantType } from '@/lib/game/inhabitants/types'

interface JobCapacity {
  current: number
  max: number | null
  available: boolean
}

interface AssignJobModalProps {
  inhabitantTypes: { key: string; title: string; image: string }[]
  jobCapacities: Record<string, JobCapacity>
  onClose: () => void
}

export function AssignJobModal({ inhabitantTypes, jobCapacities, onClose }: AssignJobModalProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only show jobs present in jobCapacities (mayor excluded, unbuilt building staff excluded)
  // Sort alphabetically by French title for readability
  const visibleTypes = inhabitantTypes
    .filter((t) => t.key in jobCapacities)
    .sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }))

  // Auto-select first available job if nothing selected
  const firstAvailable = visibleTypes.find((t) => jobCapacities[t.key]?.available)
  const effectiveSelected = selected ?? firstAvailable?.key ?? null

  async function handleAssign() {
    if (!effectiveSelected) return
    setPending(true)
    setError(null)

    const result = await assignTraveler(effectiveSelected as InhabitantType)

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
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative stone-texture border-engraved rounded-lg shadow-[var(--shadow-vellum)] max-w-lg w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden">

        {/* Close X */}
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="absolute right-3 top-3 z-10 w-8 h-8 flex items-center justify-center rounded
            text-[var(--ivory)]/50 hover:text-[var(--ivory)] hover:bg-[var(--ivory)]/10
            transition-colors cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1L13 13M13 1L1 13" />
          </svg>
        </button>

        {/* Header */}
        <div className="px-6 pt-5 pb-4">
          <h2 className="text-xl font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)] text-center mb-1">
            ASSIGNER UN MÉTIER
          </h2>
          <p className="text-sm text-[var(--ivory)]/40 text-center">
            Choisissez un métier pour ce voyageur.
          </p>
        </div>

        {/* Job grid — scrollable on small screens */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
          <div className="grid grid-cols-3 gap-3">
            {visibleTypes.map((type) => {
              const capacity = jobCapacities[type.key]
              const isSelected = effectiveSelected === type.key
              const isFull = !capacity?.available

              return (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => !isFull && setSelected(type.key)}
                  disabled={isFull}
                  className={`
                    relative flex flex-col items-center gap-2 p-3 rounded-lg transition-all duration-150
                    ${isFull
                      ? 'opacity-40 cursor-not-allowed border border-[var(--ivory)]/5'
                      : isSelected
                        ? 'border border-[var(--burnt-amber)]/60 bg-[var(--burnt-amber)]/12 shadow-[0_0_16px_rgba(179,123,52,0.15)] cursor-pointer'
                        : 'border border-[var(--ivory)]/10 bg-[var(--ivory)]/[0.03] hover:border-[var(--burnt-amber)]/30 hover:bg-[var(--ivory)]/[0.06] cursor-pointer'
                    }
                  `}
                >
                  <div className={`relative w-16 h-16 overflow-hidden rounded-lg bg-black/30 ${isSelected ? 'ring-1 ring-[var(--burnt-amber)]/30' : ''}`}>
                    <Image
                      src={type.image}
                      alt={type.title}
                      fill
                      className="object-cover object-center"
                    />
                  </div>
                  <span className={`text-sm font-[family-name:var(--font-title)] tracking-[0.1em] leading-tight text-center transition-colors ${isSelected ? 'text-[var(--burnt-amber)]' : 'text-[var(--ivory)]/60'}`}>
                    {type.title}
                  </span>
                  {/* Capacity badge */}
                  <span className={`text-xs tracking-wider ${isFull ? 'text-[var(--ivory)]/25' : 'text-[var(--ivory)]/35'}`}>
                    en poste : {capacity?.max != null ? (
                      <span className={`font-bold ${isFull ? '' : isSelected ? 'text-[var(--burnt-amber)]' : 'text-[var(--ivory)]/60'}`}>
                        {capacity.current}<span className="text-[var(--ivory)]/30 font-normal">/{capacity.max}</span>
                      </span>
                    ) : (
                      <span className={`font-bold ${isSelected ? 'text-[var(--burnt-amber)]' : 'text-[var(--ivory)]/60'}`}>
                        {capacity?.current ?? 0}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex-shrink-0 mx-6 mb-2 p-3 text-sm bg-[var(--burnt-amber)]/15 border border-[var(--burnt-amber)]/30 rounded text-[var(--burnt-amber-light)]">
            {error}
          </div>
        )}

        {/* Actions — pinned at bottom */}
        <div className="flex-shrink-0 flex gap-3 justify-end px-6 pb-5 pt-2">
          <Button variant="stone" onClick={onClose} disabled={pending}>
            ANNULER
          </Button>
          <Button
            variant="seal"
            onClick={handleAssign}
            isLoading={pending}
            disabled={!effectiveSelected || pending}
          >
            ASSIGNER
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
