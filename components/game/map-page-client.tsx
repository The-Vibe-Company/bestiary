'use client'

import { Button } from '@/components/ui/button'
import { MapCell, WorldMap } from '@/lib/game/map/types'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { IsometricMapViewer } from './isometric-map-viewer'

const MAP_CONTAINER_SIZE = 490

const BIOME_LABELS: Record<string, string> = {
  prairie: 'Prairie',
  foret: 'Forêt',
  desert: 'Désert',
  savane: 'Savane',
  jungle: 'Jungle',
  banquise: 'Banquise',
  montagne: 'Montagne',
  eau: 'Eau'
}

export interface Village {
  x: number
  y: number
  ownerId: string
}

interface MapPageClientProps {
  map: WorldMap
  villages: Village[]
  initialX: number
  initialY: number
  currentUserId: string
}

export function MapPageClient({ map, villages, initialX, initialY, currentUserId }: MapPageClientProps) {
  const router = useRouter()
  const [viewSize, setViewSize] = useState(7)
  const halfView = Math.floor(viewSize / 2)
  const [startX, setStartX] = useState(Math.max(0, initialX - halfView))
  const [startY, setStartY] = useState(Math.max(0, initialY - halfView))
  const [hoveredCell, setHoveredCell] = useState<MapCell | null>(null)

  const maxStart = 100 - viewSize

  const handleZoomIn = () => {
    setViewSize(prev => Math.max(prev - 4, 7))
  }

  const handleZoomOut = () => {
    setViewSize(prev => Math.min(prev + 4, 19))
  }

  const handleReset = () => {
    setViewSize(7)
    const newHalfView = Math.floor(7 / 2)
    setStartX(Math.max(0, initialX - newHalfView))
    setStartY(Math.max(0, initialY - newHalfView))
  }

  const handleHome = () => router.push('/village')

  const handleMoveUp = () => setStartY(prev => Math.max(0, prev - 1))
  const handleMoveDown = () => setStartY(prev => Math.min(maxStart, prev + 1))
  const handleMoveLeft = () => setStartX(prev => Math.max(0, prev - 1))
  const handleMoveRight = () => setStartX(prev => Math.min(maxStart, prev + 1))

  return (
    <div
      className="min-h-[calc(100vh-72px)] w-full flex items-center justify-center overflow-hidden relative"
      style={{
        backgroundImage: 'url(/assets/background-map.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/50"></div>

      {/* Tooltip EN DEHORS de la zone 3D */}
      {hoveredCell && (
        <div
          className="absolute z-50 px-3 py-2 rounded text-sm pointer-events-none"
          style={{
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(26, 26, 26, 0.95)',
            color: '#f5f5dc',
            border: '1px solid rgba(245, 245, 220, 0.3)',
          }}
        >
          {BIOME_LABELS[hoveredCell.biome]} ({hoveredCell.x}, {hoveredCell.y})
        </div>
      )}

      <div className="flex flex-col items-center relative z-10">
        {/* Zone 3D pour la map et flèches haut/gauche/droite */}
        <div
          className="flex flex-col items-center gap-6"
          style={{
            transform: 'perspective(1200px) rotateX(35deg) translateY(-60px)',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Flèche haut */}
          <Button
            variant="stone"
            className="w-16 h-16 text-3xl border-2 border-[var(--ivory)] rounded"
            style={{ transformStyle: 'flat' }}
            onClick={handleMoveUp}
          >
            ↑
          </Button>

          <div className="flex items-center gap-8">
            {/* Flèche gauche */}
            <Button
              variant="stone"
              className="w-16 h-16 text-3xl border-2 border-[var(--ivory)] rounded"
              style={{ transformStyle: 'flat' }}
              onClick={handleMoveLeft}
            >
              ←
            </Button>

            {/* Map */}
            <div
              className="p-8 rounded-lg"
              style={{
                transform: 'translateZ(200px)',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                border: '3px solid rgba(139, 119, 83, 0.8)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              }}
            >
              <IsometricMapViewer
                map={map}
                viewSize={viewSize}
                startX={startX}
                startY={startY}
                onHoverCell={setHoveredCell}
                villages={villages}
                currentUserId={currentUserId}
                containerSize={MAP_CONTAINER_SIZE}
              />
            </div>

            {/* Flèche droite */}
            <Button
              variant="stone"
              className="w-16 h-16 text-3xl border-2 border-[var(--ivory)] rounded"
              style={{ transformStyle: 'flat' }}
              onClick={handleMoveRight}
            >
              →
            </Button>

          </div>
        </div>

        {/* Flèche bas EN DEHORS de la zone 3D */}
        <div className="-mt-10 relative z-10">
          <Button
            variant="stone"
            className="w-16 h-16 text-3xl border-2 border-[var(--ivory)] rounded"
            onClick={handleMoveDown}
          >
            ↓
          </Button>
        </div>
      </div>

      {/* Boutons Zoom - à droite de la page */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
        <Button
          variant="stone"
          className="w-16 h-16 text-3xl border-2 border-[var(--ivory)] rounded"
          onClick={handleZoomIn}
        >
          +
        </Button>
        <Button
          variant="stone"
          className="w-16 h-16 text-3xl border-2 border-[var(--ivory)] rounded"
          onClick={handleZoomOut}
        >
          −
        </Button>
      </div>
    </div>
  )
}
