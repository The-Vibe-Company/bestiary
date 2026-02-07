'use client'

import { useState } from 'react'
import { GiWalk } from 'react-icons/gi'
import { Button } from '@/components/ui/button'
import { PlacePanel } from './place-panel'
import { AssignJobModal } from './assign-job-modal'

interface TravelersPanelProps {
  hasTraveler: boolean
  inhabitantTypes: { key: string; title: string; image: string }[]
}

export function TravelersPanel({ hasTraveler, inhabitantTypes }: TravelersPanelProps) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <PlacePanel icon={<GiWalk size={22} />} title="Voyageurs">
        {hasTraveler ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-[var(--ivory)]/80">
              Un voyageur attend aux portes du village !
            </p>
            <Button
              variant="seal"
              className="w-full"
              onClick={() => setShowModal(true)}
            >
              ACCUEILLIR
            </Button>
          </div>
        ) : (
          <p className="text-sm text-[var(--ivory)]/50 text-center">
            Aucun voyageur en vue pour le moment.
          </p>
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
