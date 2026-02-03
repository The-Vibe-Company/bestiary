'use client'

import { WorldMap, MapCell } from '@/lib/game/map/types'
import { BIOME_CONFIGS, BIOME_TEXTURES } from '@/lib/game/map/biomes'
import { Village } from './map-page-client'

interface IsometricMapViewerProps {
  map: WorldMap
  cellSize: number
  viewSize: number
  centerX: number
  centerY: number
  onHoverCell?: (cell: MapCell | null) => void
  villages: Village[]
  currentUserId: string
}

export function IsometricMapViewer({
  map,
  cellSize,
  viewSize,
  centerX,
  centerY,
  onHoverCell,
  villages,
  currentUserId
}: IsometricMapViewerProps) {

  // Créer un map des villages pour lookup rapide
  const villageMap = new Map(villages.map(v => [`${v.x},${v.y}`, v]))

  // Calculer zone visible
  const halfView = Math.floor(viewSize / 2)
  const startX = Math.max(0, centerX - halfView)
  const startY = Math.max(0, centerY - halfView)
  const endX = Math.min(100, startX + viewSize)
  const endY = Math.min(100, startY + viewSize)

  const actualViewWidth = endX - startX
  const actualViewHeight = endY - startY

  // Générer les numéros d'axes
  const xLabels = Array.from({ length: actualViewWidth }, (_, i) => startX + i)
  const yLabels = Array.from({ length: actualViewHeight }, (_, i) => startY + i)

  const gridWidth = actualViewWidth * cellSize
  const gridHeight = actualViewHeight * cellSize

  return (
    <div className="relative" style={{ width: gridWidth, height: gridHeight }}>
      {/* Légende X - en haut, position absolue */}
      <div
        className="absolute flex pointer-events-none"
        style={{
          top: -16,
          left: 0,
          width: gridWidth,
        }}
      >
        {xLabels.map((x) => (
          <div
            key={`x-${x}`}
            className="flex items-center justify-center"
            style={{
              width: `${cellSize}px`,
              fontSize: '9px',
              color: '#f5f5dc',
              opacity: 0.6,
            }}
          >
            {x}
          </div>
        ))}
      </div>

      {/* Légende Y - à gauche, position absolue */}
      <div
        className="absolute flex flex-col pointer-events-none"
        style={{
          top: 0,
          left: -20,
          height: gridHeight,
        }}
      >
        {yLabels.map((y) => (
          <div
            key={`y-${y}`}
            className="flex items-center justify-end pr-1"
            style={{
              height: `${cellSize}px`,
              fontSize: '9px',
              color: '#f5f5dc',
              opacity: 0.6,
            }}
          >
            {y}
          </div>
        ))}
      </div>

      {/* Grille de la map */}
      <div
        className="map-grid-isometric"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${actualViewWidth}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${actualViewHeight}, ${cellSize}px)`,
          gap: '0px',
        }}
        onMouseLeave={() => onHoverCell?.(null)}
      >
        {Array.from({ length: actualViewHeight }, (_, rowIndex) =>
          Array.from({ length: actualViewWidth }, (_, colIndex) => {
            const cell = map[startY + rowIndex]?.[startX + colIndex]
            if (!cell) return null

            const biomeConfig = BIOME_CONFIGS[cell.biome]
            const texture = BIOME_TEXTURES[cell.biome]

            const village = villageMap.get(`${cell.x},${cell.y}`)
            const isOwnVillage = village?.ownerId === currentUserId

            return (
              <div
                key={`${cell.x}-${cell.y}`}
                style={{
                  width: `${cellSize}px`,
                  height: `${cellSize}px`,
                  backgroundColor: biomeConfig.baseColor,
                  backgroundImage: texture,
                  border: `1px solid ${biomeConfig.borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: `${cellSize * 0.5}px`,
                }}
                onMouseEnter={() => onHoverCell?.(cell)}
              >
                {village && (
                  <span style={{
                    filter: isOwnVillage ? 'drop-shadow(0 0 4px gold)' : 'none',
                  }}>
                    🏠
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
