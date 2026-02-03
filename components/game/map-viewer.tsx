'use client'

import { WorldMap, BiomeType } from '@/lib/game/map/types'
import { BIOME_CONFIGS, BIOME_TEXTURES } from '@/lib/game/map/biomes'

interface MapViewerProps {
  map: WorldMap
  cellSize?: number
}

export function MapViewer({ map, cellSize = 8 }: MapViewerProps) {
  return (
    <div className="map-container overflow-auto max-h-screen bg-[var(--obsidian)] p-8">
      <div
        className="map-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(100, ${cellSize}px)`,
          gridTemplateRows: `repeat(100, ${cellSize}px)`,
          gap: '1px',
          border: '2px solid var(--ivory)',
          borderRadius: '4px',
          boxShadow: 'var(--shadow-stone)'
        }}
      >
        {map.flat().map((cell) => {
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
                e.currentTarget.style.transform = 'scale(1.5)'
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
  )
}
