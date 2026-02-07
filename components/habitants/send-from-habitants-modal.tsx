'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { SendMissionModal } from '@/components/map/send-mission-modal'
import type { WorldMap } from '@/lib/game/map/types'

interface SendFromHabitantsModalProps {
  map: WorldMap
  villageX: number
  villageY: number
  speed: number
  gatherRate: number
  maxCapacity: number
  availableLumberjacks: number
  onClose: () => void
}

const MINIMAP_RADIUS = 4 // 9x9 grid centered on village

export function SendFromHabitantsModal({
  map,
  villageX,
  villageY,
  speed,
  gatherRate,
  maxCapacity,
  availableLumberjacks,
  onClose,
}: SendFromHabitantsModalProps) {
  const [selectedForest, setSelectedForest] = useState<{ x: number; y: number } | null>(null)

  if (selectedForest) {
    return (
      <SendMissionModal
        targetX={selectedForest.x}
        targetY={selectedForest.y}
        villageX={villageX}
        villageY={villageY}
        speed={speed}
        gatherRate={gatherRate}
        maxCapacity={maxCapacity}
        availableLumberjacks={availableLumberjacks}
        onClose={onClose}
        onBack={() => setSelectedForest(null)}
      />
    )
  }

  const gridSize = MINIMAP_RADIUS * 2 + 1
  const startX = villageX - MINIMAP_RADIUS
  const startY = villageY - MINIMAP_RADIUS

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
          CHOISIR UNE FORET
        </h2>

        {/* Mini-map grid */}
        <div className="flex justify-center mb-4">
          <div
            className="grid gap-0 rounded-lg overflow-hidden border-2 border-[var(--burnt-amber)]/50"
            style={{
              gridTemplateColumns: `repeat(${gridSize}, 40px)`,
              gridTemplateRows: `repeat(${gridSize}, 40px)`,
            }}
          >
            {Array.from({ length: gridSize }, (_, rowIdx) =>
              Array.from({ length: gridSize }, (_, colIdx) => {
                const mapX = startX + colIdx
                const mapY = startY + rowIdx
                const cell = map[mapY]?.[mapX]
                const isVillage = mapX === villageX && mapY === villageY
                const isForest = cell?.feature === 'foret'
                const isOutOfBounds = !cell

                return (
                  <div
                    key={`${mapX}-${mapY}`}
                    className={`
                      relative flex items-center justify-center
                      ${isForest ? 'cursor-pointer hover:ring-2 hover:ring-[var(--burnt-amber)] hover:z-10' : ''}
                      ${isOutOfBounds ? 'bg-black/80' : ''}
                    `}
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: isOutOfBounds
                        ? '#1a1a1a'
                        : isVillage
                          ? 'rgba(179, 123, 52, 0.3)'
                          : isForest
                            ? 'rgba(101, 163, 78, 0.2)'
                            : 'rgba(101, 163, 78, 0.08)',
                      borderRight: '1px solid rgba(245, 245, 220, 0.06)',
                      borderBottom: '1px solid rgba(245, 245, 220, 0.06)',
                    }}
                    onClick={() => {
                      if (isForest) {
                        setSelectedForest({ x: mapX, y: mapY })
                      }
                    }}
                  >
                    {isVillage && (
                      <Image
                        src="/assets/map/village_lvl_1.png"
                        alt="Village"
                        width={36}
                        height={36}
                        className="object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]"
                      />
                    )}
                    {isForest && !isVillage && (
                      <Image
                        src="/assets/map/foret.png"
                        alt="Forêt"
                        width={34}
                        height={34}
                        className="object-contain"
                      />
                    )}
                    {cell?.feature === 'montagne' && !isVillage && (
                      <Image
                        src="/assets/map/montagne.png"
                        alt="Montagne"
                        width={34}
                        height={34}
                        className="object-contain opacity-40"
                      />
                    )}
                  </div>
                )
              }),
            )}
          </div>
        </div>

        <p className="text-sm text-[var(--ivory)]/50 text-center mb-6">
          Cliquez sur une forêt pour envoyer un bûcheron
        </p>

        {/* Actions */}
        <div className="flex justify-end">
          <Button variant="stone" onClick={onClose}>
            ANNULER
          </Button>
        </div>
      </div>
    </div>
  )
}
