'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateVillageName } from '@/lib/game/village/update-village-name'

export function VillageNameModal() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const result = await updateVillageName(name)

    if (result.success) {
      router.refresh()
    } else {
      setError(result.error)
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative stone-texture border-engraved p-8 rounded-lg shadow-[var(--shadow-vellum)] max-w-md w-full mx-4">
        <h2 className="text-2xl font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)] text-center mb-2">
          NOMMEZ VOTRE VILLAGE
        </h2>
        <p className="text-sm text-[var(--ivory)]/70 text-center mb-6">
          Choisissez un nom unique pour votre village
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            type="text"
            name="villageName"
            label="Nom du village"
            placeholder="Ex: Havremont"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={3}
            maxLength={30}
            autoFocus
          />

          {error && (
            <div className="p-4 text-sm bg-[var(--burnt-amber)]/20 border border-[var(--burnt-amber)] border-opacity-40 rounded text-[var(--burnt-amber-light)]">
              {error}
            </div>
          )}

          <Button type="submit" variant="seal" className="w-full" isLoading={pending}>
            CONFIRMER
          </Button>
        </form>
      </div>
    </div>
  )
}
