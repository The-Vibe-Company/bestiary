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
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-black/90 backdrop-blur-md border border-[var(--burnt-amber)]/40 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.6)] max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-7 pb-5 border-b border-[var(--ivory)]/10">
          <h2 className="text-xl font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)] text-center mb-1">
            ASSIGNER UN MÉTIER
          </h2>
          <p className="text-sm text-[var(--ivory)]/40 text-center">
            Choisissez un métier pour ce voyageur.
          </p>
        </div>

        {/* Job grid */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {inhabitantTypes.map((type) => {
              const isSelected = selected === type.key

              return (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => setSelected(type.key)}
                  className={`
                    flex flex-col items-center gap-2 p-2.5 rounded-xl transition-all duration-150 cursor-pointer
                    ${isSelected
                      ? 'border border-[var(--burnt-amber)]/60 bg-[var(--burnt-amber)]/12 shadow-[0_0_16px_rgba(179,123,52,0.15)]'
                      : 'border border-[var(--ivory)]/10 bg-[var(--ivory)]/[0.03] hover:border-[var(--burnt-amber)]/30 hover:bg-[var(--ivory)]/[0.06]'
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
                  <span className={`text-xs font-[family-name:var(--font-title)] tracking-[0.12em] transition-colors ${isSelected ? 'text-[var(--burnt-amber)]' : 'text-[var(--ivory)]/60'}`}>
                    {type.title}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="mx-8 mb-4 p-3 text-sm bg-[var(--burnt-amber)]/10 border border-[var(--burnt-amber)]/30 rounded-xl text-[var(--burnt-amber)]">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end px-8 pb-6">
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
