'use client'

import { useState } from 'react'
import Image from 'next/image'
import { GiAxeInStump } from 'react-icons/gi'
import { Button } from '@/components/ui/button'
import { SendMissionModal } from '@/components/map/send-mission-modal'
import type { MissionTile, TileMissionSummary } from '@/components/game/map-page-client'
import { PHASE_COLORS } from '@/components/game/map-page-client'
import { computeMissionStatus } from '@/lib/game/missions/compute-mission-status'
import type { MissionPhase } from '@/lib/game/missions/types'
import type { WorldMap } from '@/lib/game/map/types'

interface SendFromHabitantsModalProps {
  map: WorldMap
  villageX: number
  villageY: number
  speed: number
  gatherRate: number
  maxCapacity: number
  availableLumberjacks: number
  missionTiles: MissionTile[]
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
  missionTiles,
  onClose,
}: SendFromHabitantsModalProps) {
  // Build mission tile lookup map
  const tileMissionMap = new Map<string, TileMissionSummary>()
  const now = new Date()
  for (const t of missionTiles) {
    const key = `${t.x},${t.y}`
    const status = computeMissionStatus(
      {
        departedAt: new Date(t.departedAt),
        travelSeconds: t.travelSeconds,
        workSeconds: t.workSeconds,
        recalledAt: t.recalledAt ? new Date(t.recalledAt) : null,
        gatherRate: 0,
        maxCapacity: 0,
      },
      now,
    )
    if (status.phase === 'completed') continue
    const existing = tileMissionMap.get(key)
    if (existing) {
      existing.total++
      existing.byPhase[status.phase] = (existing.byPhase[status.phase] ?? 0) + 1
      const priority: MissionPhase[] = ['working', 'traveling-to', 'traveling-back']
      existing.dominantPhase = priority.find((p) => existing.byPhase[p]) ?? status.phase
    } else {
      tileMissionMap.set(key, {
        total: 1,
        dominantPhase: status.phase,
        byPhase: { [status.phase]: 1 },
      })
    }
  }

  const [selectedForest, setSelectedForest] = useState<{ x: number; y: number } | null>(null)
  const [centerX, setCenterX] = useState(
    Math.max(MINIMAP_RADIUS, Math.min(villageX, map[0].length - 1 - MINIMAP_RADIUS))
  )
  const [centerY, setCenterY] = useState(
    Math.max(MINIMAP_RADIUS, Math.min(villageY, map.length - 1 - MINIMAP_RADIUS))
  )

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
  const startX = centerX - MINIMAP_RADIUS
  const startY = centerY - MINIMAP_RADIUS

  const mapHeight = map.length
  const mapWidth = map[0].length
  const canGoLeft = centerX - MINIMAP_RADIUS > 0
  const canGoRight = centerX + MINIMAP_RADIUS < mapWidth - 1
  const canGoUp = centerY - MINIMAP_RADIUS > 0
  const canGoDown = centerY + MINIMAP_RADIUS < mapHeight - 1

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative stone-texture border-engraved p-8 rounded-lg shadow-[var(--shadow-vellum)] max-w-lg w-full mx-4">
        {/* Mini-map grid with navigation arrows */}
        <div
          className="grid justify-center items-center mb-4 gap-2"
          style={{ gridTemplateColumns: 'auto auto auto', gridTemplateRows: 'auto auto auto' }}
        >
          {/* Up arrow — centered on grid column */}
          <div />
          <div className="flex justify-center">
            <Button
              variant="stone"
              disabled={!canGoUp}
              onClick={() => setCenterY(centerY - 1)}
              className="w-10 h-10 text-xl border-2 border-[var(--ivory)] rounded disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center p-0"
              style={{ transformStyle: 'flat' }}
            >
              ↑
            </Button>
          </div>
          <div />

          {/* Left arrow */}
          <div className="flex items-center justify-center">
            <Button
              variant="stone"
              disabled={!canGoLeft}
              onClick={() => setCenterX(centerX - 1)}
              className="w-10 h-10 text-xl border-2 border-[var(--ivory)] rounded disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center p-0"
              style={{ transformStyle: 'flat' }}
            >
              ←
            </Button>
          </div>

            {/* Grid */}
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
                      {isForest && !isVillage && (() => {
                        const summary = tileMissionMap.get(`${mapX},${mapY}`)
                        if (!summary) return null
                        const color = PHASE_COLORS[summary.dominantPhase]
                        return (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 1,
                              right: 1,
                              zIndex: 2,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <GiAxeInStump
                              style={{
                                width: 14,
                                height: 14,
                                color,
                                filter: `drop-shadow(0 0 3px ${color})`,
                              }}
                            />
                            {summary.total > 1 && (
                              <span
                                style={{
                                  fontSize: 9,
                                  color,
                                  fontWeight: 'bold',
                                  lineHeight: 1,
                                }}
                              >
                                {summary.total}
                              </span>
                            )}
                          </div>
                        )
                      })()}
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

          {/* Right arrow */}
          <div className="flex items-center justify-center">
            <Button
              variant="stone"
              disabled={!canGoRight}
              onClick={() => setCenterX(centerX + 1)}
              className="w-10 h-10 text-xl border-2 border-[var(--ivory)] rounded disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center p-0"
              style={{ transformStyle: 'flat' }}
            >
              →
            </Button>
          </div>

          {/* Down arrow — centered on grid column */}
          <div />
          <div className="flex justify-center">
            <Button
              variant="stone"
              disabled={!canGoDown}
              onClick={() => setCenterY(centerY + 1)}
              className="w-10 h-10 text-xl border-2 border-[var(--ivory)] rounded disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center p-0"
              style={{ transformStyle: 'flat' }}
            >
              ↓
            </Button>
          </div>
          <div />
        </div>

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
