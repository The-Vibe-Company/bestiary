'use client'

import { WorldMap, BiomeType } from '@/lib/game/map/types'
import { BIOME_CONFIGS } from '@/lib/game/map/biomes'

interface MapStatsProps {
  map: WorldMap
}

export function MapStats({ map }: MapStatsProps) {
  const counts: Record<BiomeType, number> = {
    prairie: 0,
    foret: 0,
    desert: 0,
    savane: 0,
    jungle: 0,
    banquise: 0,
    montagne: 0,
    eau: 0
  }

  for (const row of map) {
    for (const cell of row) {
      counts[cell.biome]++
    }
  }

  const total = 100 * 100

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 p-4 rounded border border-[var(--ivory)]/20 max-w-xs">
      <h3 className="text-[var(--ivory)] font-[family-name:var(--font-title)] text-sm mb-2">
        STATISTIQUES
      </h3>
      <div className="space-y-1 text-xs font-[family-name:var(--font-body)]">
        {Object.entries(counts).map(([biome, count]) => {
          const percentage = (count / total * 100).toFixed(1)
          const config = BIOME_CONFIGS[biome as BiomeType]

          return (
            <div key={biome} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 border"
                  style={{
                    backgroundColor: config.baseColor,
                    borderColor: config.borderColor
                  }}
                />
                <span className="text-[var(--ivory-dark)] capitalize">
                  {biome}
                </span>
              </div>
              <span className="text-[var(--burnt-amber)] font-mono">
                {percentage}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
