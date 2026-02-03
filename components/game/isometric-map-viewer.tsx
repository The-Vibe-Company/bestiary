'use client'

import { WorldMap } from '@/lib/game/map/types'
import { BIOME_CONFIGS, BIOME_TEXTURES } from '@/lib/game/map/biomes'

interface IsometricMapViewerProps {
  map: WorldMap
  cellSize: number
  viewSize: number
  centerX: number
  centerY: number
}

export function IsometricMapViewer({
  map,
  cellSize,
  viewSize,
  centerX,
  centerY
}: IsometricMapViewerProps) {
  // Calculer zone visible
  const halfView = Math.floor(viewSize / 2)
  const startX = Math.max(0, centerX - halfView)
  const startY = Math.max(0, centerY - halfView)
  const endX = Math.min(100, startX + viewSize)
  const endY = Math.min(100, startY + viewSize)

  // Extraire cellules visibles
  const visibleCells = []
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      visibleCells.push(map[y][x])
    }
  }

  const actualViewWidth = endX - startX
  const actualViewHeight = endY - startY

  return (
    <div
      className="map-grid-isometric"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${actualViewWidth}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${actualViewHeight}, ${cellSize}px)`,
        gap: '0px',
      }}
    >
      {visibleCells.map((cell) => {
        const biomeConfig = BIOME_CONFIGS[cell.biome]
        const texture = BIOME_TEXTURES[cell.biome]

        return (
          <div
            key={`${cell.x}-${cell.y}`}
            style={{
              width: `${cellSize}px`,
              height: `${cellSize}px`,
              backgroundColor: biomeConfig.baseColor,
              backgroundImage: texture,
              border: `1px solid ${biomeConfig.borderColor}`,
            }}
          />
        )
      })}
    </div>
  )
}
