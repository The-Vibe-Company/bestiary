'use client'

import { MapCell, WorldMap } from '@/lib/game/map/types'
import { Village } from './map-page-client'

interface IsometricMapViewerProps {
  map: WorldMap
  viewSize: number
  startX: number
  startY: number
  onHoverCell?: (cell: MapCell | null) => void
  villages: Village[]
  currentUserId: string
  containerSize: number
}

export function IsometricMapViewer({
  map,
  viewSize,
  startX,
  startY,
  onHoverCell,
  villages,
  currentUserId,
  containerSize
}: IsometricMapViewerProps) {

  // Créer un map des villages pour lookup rapide
  const villageMap = new Map(villages.map(v => [`${v.x},${v.y}`, v]))

  // Calculer cellSize basé sur viewSize pour garder une taille constante
  const actualCellSize = Math.floor(containerSize / viewSize)

  return (
    <div className="relative" style={{ width: containerSize, height: containerSize }}>
      {/* Légende X - en haut, centrée sur première et dernière case */}
      <div
        className="absolute pointer-events-none font-bold"
        style={{
          top: -18,
          left: actualCellSize / 2,
          transform: 'translateX(-50%)',
          fontSize: '12px',
          color: '#f5f5dc',
          textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
        }}
      >
        {startX}
      </div>
      <div
        className="absolute pointer-events-none font-bold"
        style={{
          top: -18,
          left: containerSize - actualCellSize / 2,
          transform: 'translateX(-50%)',
          fontSize: '12px',
          color: '#f5f5dc',
          textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
        }}
      >
        {startX + viewSize - 1}
      </div>

      {/* Légende Y - à gauche, centrée sur première et dernière case */}
      <div
        className="absolute pointer-events-none font-bold text-right"
        style={{
          top: actualCellSize / 2,
          left: -22,
          transform: 'translateY(-50%)',
          fontSize: '12px',
          color: '#f5f5dc',
          textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
        }}
      >
        {startY}
      </div>
      <div
        className="absolute pointer-events-none font-bold text-right"
        style={{
          top: containerSize - actualCellSize / 2,
          left: -22,
          transform: 'translateY(-50%)',
          fontSize: '12px',
          color: '#f5f5dc',
          textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
        }}
      >
        {startY + viewSize - 1}
      </div>

      {/* Grille de la map - toujours viewSize x viewSize */}
      <div
        className="map-grid-isometric"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${viewSize}, ${actualCellSize}px)`,
          gridTemplateRows: `repeat(${viewSize}, ${actualCellSize}px)`,
          gap: '0px',
        }}
        onMouseLeave={() => onHoverCell?.(null)}
      >
        {Array.from({ length: viewSize }, (_, rowIndex) =>
          Array.from({ length: viewSize }, (_, colIndex) => {
            const mapX = startX + colIndex
            const mapY = startY + rowIndex
            const cell = map[mapY]?.[mapX]

            // Case vide si hors de la map
            if (!cell) {
              return (
                <div
                  key={`empty-${mapX}-${mapY}`}
                  style={{
                    width: `${actualCellSize}px`,
                    height: `${actualCellSize}px`,
                    backgroundColor: '#1a1a1a',
                  }}
                />
              )
            }

            const village = villageMap.get(`${cell.x},${cell.y}`)
            const isOwnVillage = village?.ownerId === currentUserId

            // PNG associé au biome (sauf prairie)
            const biomeImage = cell.biome !== 'prairie' ? `/assets/${cell.biome}.png` : null

            // Taille ajustée par biome (certaines images ont moins de transparent)
            const biomeSizeMultiplier: Record<string, number> = {
              savane: 0.75,
              desert: 0.85,
              foret: 0.95,
              jungle: 0.95,
              banquise: 0.95,
              montagne: 0.95,
              eau: 0.95,
            }
            const biomeSize = biomeSizeMultiplier[cell.biome] || 0.95

            return (
              <div
                key={`${cell.x}-${cell.y}`}
                style={{
                  width: `${actualCellSize}px`,
                  height: `${actualCellSize}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  boxShadow: 'inset 0 0 0 0.5px rgba(255, 255, 255, 0.15)',
                }}
                onMouseEnter={() => onHoverCell?.(cell)}
              >
                {/* Fond herbe texturé */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: '#6ab04c',
                    backgroundImage: `
                      radial-gradient(circle at 20% 30%, rgba(90, 160, 70, 0.4) 1px, transparent 1px),
                      radial-gradient(circle at 80% 70%, rgba(100, 170, 80, 0.4) 1px, transparent 1px),
                      radial-gradient(circle at 50% 20%, rgba(85, 155, 65, 0.35) 1px, transparent 1px),
                      radial-gradient(circle at 40% 80%, rgba(95, 165, 75, 0.35) 1px, transparent 1px),
                      radial-gradient(circle at 10% 50%, rgba(80, 150, 60, 0.3) 1px, transparent 1px),
                      linear-gradient(180deg, rgba(120, 190, 90, 0.2) 0%, transparent 50%, rgba(70, 130, 50, 0.2) 100%)
                    `,
                    backgroundSize: '7px 7px, 9px 9px, 6px 6px, 8px 8px, 11px 11px, 100% 100%',
                    opacity: 0.5,
                  }}
                />
                {biomeImage && !village && (
                  <img
                    src={biomeImage}
                    alt={cell.biome}
                    style={{
                      width: `${actualCellSize * biomeSize}px`,
                      height: `${actualCellSize * biomeSize}px`,
                      objectFit: 'contain',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  />
                )}
                {village && (
                  <img
                    src="/assets/village_lvl_1.png"
                    alt="Village"
                    style={{
                      width: `${actualCellSize * 0.95}px`,
                      height: `${actualCellSize * 0.95}px`,
                      objectFit: 'contain',
                      filter: isOwnVillage ? 'drop-shadow(0 0 4px gold)' : 'none',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
