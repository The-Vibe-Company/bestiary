'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GiWalk } from 'react-icons/gi'
import { Button } from '@/components/ui/button'
import { PlacePanel } from './place-panel'
import { AssignJobModal } from './assign-job-modal'
import { Countdown } from './countdown'
import type { TravelerStatus } from '@/lib/game/travelers/resolve-traveler'
import { welcomeTraveler } from '@/lib/game/travelers/welcome-traveler'

interface TravelersPanelProps {
  travelerStatus: TravelerStatus
  inhabitantTypes: { key: string; title: string; image: string }[]
  isVillageFull: boolean
}

export function TravelersPanel({ travelerStatus, inhabitantTypes, isVillageFull }: TravelersPanelProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [pendingWelcome, setPendingWelcome] = useState(false)
  const [welcomeError, setWelcomeError] = useState<string | null>(null)
  const isWelcomed = travelerStatus.status === 'present' && travelerStatus.isWelcomed

  async function handleWelcome() {
    if (isWelcomed) {
      setWelcomeError(null)
      setShowModal(true)
      return
    }

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

  return (
    <>
      <PlacePanel icon={<GiWalk size={22} />} title="Voyageurs">
        {travelerStatus.status === 'present' ? (
          <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center rounded-xl border border-[var(--ivory)]/10 bg-[var(--ivory)]/5 px-5 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <p className="text-sm text-[var(--ivory)]/90">
              Un voyageur attend aux portes du village !
            </p>
            {!isWelcomed ? (
              <>
                <div className="mt-2 text-xs uppercase tracking-[0.12em] text-[var(--ivory)]/50">
                  Repart dans
                </div>
                <div className="mt-1 text-base font-semibold text-[var(--burnt-amber)]">
                  <Countdown targetDate={travelerStatus.departsAt} />
                </div>
              </>
            ) : (
              <div className="mt-3 text-xs uppercase tracking-[0.12em] text-[var(--burnt-amber)]/90">
                Voyageur accueilli
              </div>
            )}
            {isVillageFull ? (
              <p className="mt-4 text-xs text-[var(--burnt-amber)]/80">
                Le village est plein. Construisez pour augmenter la capacité.
              </p>
            ) : (
              <Button
                variant="seal"
                className="mt-5 w-full max-w-[220px]"
                onClick={handleWelcome}
                isLoading={pendingWelcome}
                disabled={pendingWelcome}
              >
                {isWelcomed ? 'ASSIGNER' : 'ACCUEILLIR'}
              </Button>
            )}
            {welcomeError && (
              <p className="mt-3 text-xs text-[var(--burnt-amber)]/90">{welcomeError}</p>
            )}
          </div>
        ) : travelerStatus.status === 'waiting' ? (
          <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center rounded-xl border border-[var(--ivory)]/10 bg-[var(--ivory)]/5 px-5 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <p className="text-sm text-[var(--ivory)]/75">
              Un voyageur est en route...
            </p>
            <div className="mt-2 text-xs uppercase tracking-[0.12em] text-[var(--ivory)]/50">
              Arrive dans
            </div>
            <div className="mt-1 text-base font-semibold text-[var(--burnt-amber)]">
              <Countdown targetDate={travelerStatus.arrivesAt} />
            </div>
          </div>
        ) : (
          <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center rounded-xl border border-[var(--ivory)]/10 bg-[var(--ivory)]/5 px-5 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <p className="text-sm text-[var(--ivory)]/60">Aucun voyageur en vue pour le moment.</p>
          </div>
        )}
      </PlacePanel>

      {showModal && (
        <AssignJobModal
          inhabitantTypes={inhabitantTypes}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
