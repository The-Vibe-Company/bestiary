'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AssignJobModal } from './assign-job-modal'
import { TravelerCard } from './traveler-card'
import type { DetectedTravelerStatus } from '@/lib/game/travelers/detection'
import { welcomeTraveler } from '@/lib/game/travelers/welcome-traveler'

interface TravelersPanelProps {
  travelerStatus: DetectedTravelerStatus
  inhabitantTypes: { key: string; title: string; image: string }[]
  isVillageFull: boolean
  tavernLevel?: number
  jobCapacities: Record<string, { current: number; max: number | null; available: boolean }>
}

export function TravelersPanel({ travelerStatus, inhabitantTypes, isVillageFull, tavernLevel = 0, jobCapacities }: TravelersPanelProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [pendingWelcome, setPendingWelcome] = useState(false)
  const [welcomeError, setWelcomeError] = useState<string | null>(null)

  async function handleWelcome() {
    setPendingWelcome(true)
    setWelcomeError(null)

    const result = await welcomeTraveler()

    if (!result.success) {
      setWelcomeError(result.error)
      setPendingWelcome(false)
      return
    }

    setPendingWelcome(false)
    router.refresh()
    setShowModal(true)
  }

  function handleAssign() {
    setWelcomeError(null)
    setShowModal(true)
  }

  if (travelerStatus.status === 'hidden') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[var(--ivory)]/30 font-[family-name:var(--font-title)] tracking-[0.15em]">
          Aucun voyageur en vue
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <TravelerCard
          travelerStatus={travelerStatus}
          tavernLevel={tavernLevel}
          isVillageFull={isVillageFull}
          onWelcome={handleWelcome}
          onAssign={handleAssign}
          pendingWelcome={pendingWelcome}
          welcomeError={welcomeError}
        />
      </div>

      {showModal && (
        <AssignJobModal
          inhabitantTypes={inhabitantTypes}
          jobCapacities={jobCapacities}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
