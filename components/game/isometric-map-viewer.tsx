"use client";

import Image from "next/image";

import { MapCell, WorldMap } from "@/lib/game/map/types";
import { Village } from "./map-page-client";

interface IsometricMapViewerProps {
  map: WorldMap;
  viewSize: number;
  startX: number;
  startY: number;
  onHoverCell?: (cell: MapCell | null) => void;
  onClickCell?: (cell: MapCell) => void;
  villages: Village[];
  currentUserId: string;
  containerSize: number;
}

export function IsometricMapViewer({
  map,
  viewSize,
  startX,
  startY,
  onHoverCell,
  onClickCell,
  villages,
  currentUserId,
  containerSize,
}: IsometricMapViewerProps) {
  // Dégradé de vert doux basé sur les coordonnées
  function cellGreen(x: number, y: number): string {
    const v =
      0.5 +
      0.2 * Math.sin(x * 0.5 + y * 0.35) +
      0.15 * Math.sin(x * 0.3 - y * 0.4 + 2) +
      0.1 * Math.sin((x + y) * 0.2 + 1.5);

    const clamped = Math.max(0, Math.min(1, v));
    const r = Math.round(60 + clamped * 45); // 60–105
    const g = Math.round(100 + clamped * 55); // 100–155
    const b = Math.round(30 + clamped * 30); // 30–60
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Créer un map des villages pour lookup rapide
  const villageMap = new Map(villages.map((v) => [`${v.x},${v.y}`, v]));

  // Calculer cellSize basé sur viewSize pour garder une taille constante
  const actualCellSize = Math.floor(containerSize / viewSize);

  return (
    <div
      className="relative"
      style={{ width: containerSize, height: containerSize }}
    >
      {/* Légende X - en haut, centrée sur première et dernière case */}
      <div
        className="absolute pointer-events-none font-bold"
        style={{
          top: -18,
          left: actualCellSize / 2,
          transform: "translateX(-50%)",
          fontSize: "12px",
          color: "#f5f5dc",
          textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
        }}
      >
        {startX}
      </div>
      <div
        className="absolute pointer-events-none font-bold"
        style={{
          top: -18,
          left: containerSize - actualCellSize / 2,
          transform: "translateX(-50%)",
          fontSize: "12px",
          color: "#f5f5dc",
          textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
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
          transform: "translateY(-50%)",
          fontSize: "12px",
          color: "#f5f5dc",
          textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
        }}
      >
        {startY}
      </div>
      <div
        className="absolute pointer-events-none font-bold text-right"
        style={{
          top: containerSize - actualCellSize / 2,
          left: -22,
          transform: "translateY(-50%)",
          fontSize: "12px",
          color: "#f5f5dc",
          textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
        }}
      >
        {startY + viewSize - 1}
      </div>

      {/* Grille de la map - toujours viewSize x viewSize */}
      <div
        className="map-grid-isometric"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${viewSize}, ${actualCellSize}px)`,
          gridTemplateRows: `repeat(${viewSize}, ${actualCellSize}px)`,
          gap: "0px",
        }}
        onMouseLeave={() => onHoverCell?.(null)}
      >
        {Array.from({ length: viewSize }, (_, rowIndex) =>
          Array.from({ length: viewSize }, (_, colIndex) => {
            const mapX = startX + colIndex;
            const mapY = startY + rowIndex;
            const cell = map[mapY]?.[mapX];

            // Case vide si hors de la map
            if (!cell) {
              return (
                <div
                  key={`empty-${mapX}-${mapY}`}
                  style={{
                    width: `${actualCellSize}px`,
                    height: `${actualCellSize}px`,
                    backgroundColor: "#1a1a1a",
                  }}
                />
              );
            }

            const village = villageMap.get(`${cell.x},${cell.y}`);
            const isOwnVillage = village?.ownerId === currentUserId;

            return (
              <div
                key={`${cell.x}-${cell.y}`}
                style={{
                  width: `${actualCellSize}px`,
                  height: `${actualCellSize}px`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  cursor: "pointer",
                }}
                onMouseEnter={() => onHoverCell?.(cell)}
                onClick={() => onClickCell?.(cell)}
              >
                {/* Fond herbe — nuance de vert variée par cellule */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: cellGreen(cell.x, cell.y),
                    backgroundImage: `
                      repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 5px),
                      repeating-linear-gradient(-45deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 6px)
                    `,
                    opacity: 0.6,
                    boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.03)",
                  }}
                />
                {cell.feature &&
                  !village &&
                  (() => {
                    return (
                      <Image
                        src={`/assets/map/${cell.feature}.png`}
                        alt={cell.feature}
                        height={actualCellSize}
                        width={actualCellSize}
                        style={{
                          filter:
                            cell.feature === "foret"
                              ? "drop-shadow(1px 2px 10px #5D9656)"
                              : "drop-shadow(1px 2px 10px #303342)",
                          objectFit: "contain",
                          position: "relative",
                          zIndex: 1,
                          maxWidth: "none",
                        }}
                      />
                    );
                  })()}
                {village && (
                  <Image
                    src="/assets/map/village_lvl_1.png"
                    alt="Village"
                    height={10}
                    width={actualCellSize * 1.1}
                    style={{
                      filter: isOwnVillage
                        ? "drop-shadow(1px 2px 10px white)"
                        : "none",
                      zIndex: 1,
                      maxWidth: "none",
                    }}
                  />
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
