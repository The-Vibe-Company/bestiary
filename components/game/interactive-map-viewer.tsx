'use client'

import { useState } from 'react'
import { WorldMap, BiomeType } from '@/lib/game/map/types'
import { BIOME_CONFIGS, BIOME_TEXTURES } from '@/lib/game/map/biomes'
import { MapControls } from './map-controls'

interface InteractiveMapViewerProps {
  map: WorldMap
  initialCellSize?: number
  initialViewSize?: number
}

export function InteractiveMapViewer({
  map,
  initialCellSize = 40,
  initialViewSize = 10
}: InteractiveMapViewerProps) {
  const [cellSize, setCellSize] = useState(initialCellSize)
  const [viewSize, setViewSize] = useState(initialViewSize)
  const [centerX, setCenterX] = useState(50) // Centre de la map 100x100
  const [centerY, setCenterY] = useState(50)

  const handleZoomIn = () => {
    setCellSize(prev => Math.min(prev + 5, 60))
    setViewSize(prev => Math.max(prev - 2, 5))
  }

  const handleZoomOut = () => {
    setCellSize(prev => Math.max(prev - 5, 20))
    setViewSize(prev => Math.min(prev + 2, 100))
  }

  const handleReset = () => {
    setCellSize(initialCellSize)
    setViewSize(initialViewSize)
    setCenterX(50)
    setCenterY(50)
  }

  // Calculer la zone visible
  const halfView = Math.floor(viewSize / 2)
  const startX = Math.max(0, centerX - halfView)
  const startY = Math.max(0, centerY - halfView)
  const endX = Math.min(100, startX + viewSize)
  const endY = Math.min(100, startY + viewSize)

  // Extraire seulement les cellules visibles
  const visibleCells = []
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      visibleCells.push(map[y][x])
    }
  }

  const actualViewWidth = endX - startX
  const actualViewHeight = endY - startY

  return (
    <>
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        onHome={() => {}}
      />

      <div className="map-container overflow-auto max-h-screen bg-[var(--obsidian)] p-8">
        <div
          className="map-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${actualViewWidth}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${actualViewHeight}, ${cellSize}px)`,
            gap: '1px',
            border: '2px solid var(--ivory)',
            borderRadius: '4px',
            boxShadow: 'var(--shadow-stone)'
          }}
        >
          {visibleCells.map((cell) => {
            const biomeConfig = BIOME_CONFIGS[cell.biome]
            const texture = BIOME_TEXTURES[cell.biome]

            return (
              <div
                key={`${cell.x}-${cell.y}`}
                className="map-cell"
                title={`${cell.biome} (${cell.x}, ${cell.y})`}
                style={{
                  backgroundColor: biomeConfig.baseColor,
                  backgroundImage: texture,
                  borderColor: biomeConfig.borderColor,
                  width: `${cellSize}px`,
                  height: `${cellSize}px`,
                  cursor: 'pointer',
                  transition: 'transform 0.1s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.2)'
                  e.currentTarget.style.zIndex = '10'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.zIndex = '0'
                }}
              />
            )
          })}
        </div>

        <div className="mt-4 text-center text-[var(--ivory-dark)] text-sm font-[family-name:var(--font-body)]">
          Vue: {actualViewWidth}x{actualViewHeight} • Centre: ({centerX}, {centerY})
        </div>

        <div className="map-legend mt-8 flex flex-wrap gap-4 justify-center">
          {Object.entries(BIOME_CONFIGS).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className="w-6 h-6 border-2"
                style={{
                  backgroundColor: config.baseColor,
                  backgroundImage: BIOME_TEXTURES[key as BiomeType],
                  borderColor: config.borderColor
                }}
              />
              <span className="text-[var(--ivory)] font-[family-name:var(--font-body)] capitalize">
                {config.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
