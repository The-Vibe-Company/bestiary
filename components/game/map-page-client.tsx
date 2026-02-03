'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WorldMap } from '@/lib/game/map/types'
import { IsometricMapViewer } from './isometric-map-viewer'
import { Button } from '@/components/ui/button'

interface MapPageClientProps {
  map: WorldMap
}

export function MapPageClient({ map }: MapPageClientProps) {
  const router = useRouter()
  const [cellSize, setCellSize] = useState(80)
  const [viewSize, setViewSize] = useState(7)
  const [centerX, setCenterX] = useState(50)
  const [centerY, setCenterY] = useState(50)

  const handleZoomIn = () => {
    setCellSize(prev => Math.min(prev + 10, 120))
    setViewSize(prev => Math.max(prev - 1, 3))
  }

  const handleZoomOut = () => {
    setCellSize(prev => Math.max(prev - 10, 40))
    setViewSize(prev => Math.min(prev + 1, 20))
  }

  const handleReset = () => {
    setCellSize(80)
    setViewSize(7)
    setCenterX(50)
    setCenterY(50)
  }

  const handleHome = () => router.push('/home')

  const handleMoveUp = () => setCenterY(prev => Math.max(0, prev - 1))
  const handleMoveDown = () => setCenterY(prev => Math.min(99, prev + 1))
  const handleMoveLeft = () => setCenterX(prev => Math.max(0, prev - 1))
  const handleMoveRight = () => setCenterX(prev => Math.min(99, prev + 1))

  return (
    <div
      className="min-h-[calc(100vh-72px)] w-full flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage: 'url(/assets/background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div
        className="flex flex-col items-center gap-8"
        style={{
          transform: 'perspective(1200px) rotateX(35deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Flèche haut */}
        <Button
          variant="stone"
          className="w-16 h-16 text-3xl border-2 border-[var(--ivory)] rounded"
          onClick={handleMoveUp}
        >
          ↑
        </Button>

        <div className="flex items-center gap-12">
          {/* Flèche gauche */}
          <Button
            variant="stone"
            className="w-16 h-16 text-3xl border-2 border-[var(--ivory)] rounded"
            onClick={handleMoveLeft}
          >
            ←
          </Button>

          {/* Map */}
          <div style={{ transformStyle: 'preserve-3d' }}>
            <IsometricMapViewer
              map={map}
              cellSize={cellSize}
              viewSize={viewSize}
              centerX={centerX}
              centerY={centerY}
            />
          </div>

          {/* Flèche droite */}
          <Button
            variant="stone"
            className="w-16 h-16 text-3xl border-2 border-[var(--ivory)] rounded"
            onClick={handleMoveRight}
          >
            →
          </Button>
        </div>

        {/* Flèche bas */}
        <Button
          variant="stone"
          className="w-16 h-16 text-3xl border-2 border-[var(--ivory)] rounded"
          onClick={handleMoveDown}
        >
          ↓
        </Button>
      </div>
    </div>
  )
}
