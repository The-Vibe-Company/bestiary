'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { assignTraveler } from '@/lib/game/travelers/assign-traveler'
import type { InhabitantType } from '@/lib/game/inhabitants/types'

interface AssignJobModalProps {
  inhabitantTypes: { key: string; title: string; image: string }[]
  onClose: () => void
}

export function AssignJobModal({ inhabitantTypes, onClose }: AssignJobModalProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<string>('lumberjack')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAssign() {
    if (!selected) return
    setPending(true)
    setError(null)

    const result = await assignTraveler(selected as InhabitantType)

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
      <div className="relative stone-texture border-engraved p-8 rounded-lg shadow-[var(--shadow-vellum)] max-w-2xl w-full mx-4">
        <h2 className="text-2xl font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)] text-center mb-2">
          ASSIGNER UN METIER
        </h2>
        <p className="text-sm text-[var(--ivory)]/70 text-center mb-6">
          Choisissez un metier pour ce voyageur.
        </p>

        {/* Job grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-6">
          {inhabitantTypes.map((type) => {
            const isSelected = selected === type.key

            return (
              <button
                key={type.key}
                type="button"
                onClick={() => setSelected(type.key)}
                className={`
                  flex flex-col items-center gap-2 p-3 rounded-lg transition-all duration-200
                  ${isSelected
                    ? 'border-2 border-[var(--burnt-amber)] bg-[var(--burnt-amber)]/20 scale-105 shadow-[0_0_20px_rgba(179,123,52,0.3)]'
                    : 'border-2 border-[var(--ivory)]/20 hover:border-[var(--burnt-amber)]/50 hover:scale-105 cursor-pointer'
                  }
                `}
              >
                <div className="relative w-20 h-20 overflow-hidden rounded-md bg-black/10">
                  <Image
                    src={type.image}
                    alt={type.title}
                    fill
                    className="object-cover object-center"
                  />
                </div>
                <span className="text-xs font-[family-name:var(--font-title)] tracking-[0.1em] text-[var(--ivory)]">
                  {type.title}
                </span>
              </button>
            )
          })}
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
            onClick={handleAssign}
            isLoading={pending}
            disabled={!selected || pending}
          >
            ASSIGNER
          </Button>
        </div>
      </div>
    </div>
  )
}
