"use client";

import { Button } from "@/components/ui/button";
import { SendMissionModal } from "@/components/map/send-mission-modal";
import { MapCell, WorldMap } from "@/lib/game/map/types";
import { computeMissionStatus } from "@/lib/game/missions/compute-mission-status";
import type { MissionPhase } from "@/lib/game/missions/types";
import { useState } from "react";
import { IsometricMapViewer } from "./isometric-map-viewer";

const MAP_CONTAINER_SIZE = 490;

const FEATURE_LABELS: Record<string, string> = {
  foret: "Forêt",
  montagne: "Montagne",
};

export interface Village {
  x: number;
  y: number;
  ownerId: string;
  name: string | null;
  owner: { username: string };
}

interface LumberjackStats {
  speed: number;
  gatherRate: number;
  maxCapacity: number;
}

export interface MissionTile {
  x: number;
  y: number;
  departedAt: string;
  travelSeconds: number;
  workSeconds: number;
  recalledAt: string | null;
}

const PHASE_LABELS: Record<MissionPhase, string> = {
  'traveling-to': 'en route',
  working: 'au travail',
  'traveling-back': 'sur le retour',
  completed: 'terminé',
};

export const PHASE_COLORS: Record<MissionPhase, string> = {
  'traveling-to': 'var(--burnt-amber)',
  working: 'rgb(101, 163, 78)',
  'traveling-back': 'var(--ivory)',
  completed: 'var(--ivory)',
};

export interface TileMissionSummary {
  total: number;
  /** The "dominant" phase (priority: working > traveling-to > traveling-back) */
  dominantPhase: MissionPhase;
  byPhase: Partial<Record<MissionPhase, number>>;
}

interface MapPageClientProps {
  map: WorldMap;
  villages: Village[];
  initialX: number;
  initialY: number;
  currentUserId: string;
  villageX: number;
  villageY: number;
  availableLumberjacks: number;
  lumberjackStats: LumberjackStats;
  missionTiles: MissionTile[];
}

export function MapPageClient({
  map,
  villages,
  initialX,
  initialY,
  currentUserId,
  villageX,
  villageY,
  availableLumberjacks,
  lumberjackStats,
  missionTiles,
}: MapPageClientProps) {
  // Build a lookup map for mission tiles: "x,y" → TileMissionSummary
  const missionTileMap = new Map<string, TileMissionSummary>();
  const now = new Date();
  for (const t of missionTiles) {
    const key = `${t.x},${t.y}`;
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
    );
    if (status.phase === 'completed') continue;
    const existing = missionTileMap.get(key);
    if (existing) {
      existing.total++;
      existing.byPhase[status.phase] = (existing.byPhase[status.phase] ?? 0) + 1;
      // Priority: working > traveling-to > traveling-back
      const priority: MissionPhase[] = ['working', 'traveling-to', 'traveling-back'];
      existing.dominantPhase = priority.find((p) => existing.byPhase[p]) ?? status.phase;
    } else {
      missionTileMap.set(key, {
        total: 1,
        dominantPhase: status.phase,
        byPhase: { [status.phase]: 1 },
      });
    }
  }

  const [viewSize, setViewSize] = useState(7);
  const halfView = Math.floor(viewSize / 2);
  const [startX, setStartX] = useState(Math.max(0, initialX - halfView));
  const [startY, setStartY] = useState(Math.max(0, initialY - halfView));
  const [hoveredCell, setHoveredCell] = useState<MapCell | null>(null);
  const [selectedForestCell, setSelectedForestCell] = useState<MapCell | null>(null);

  const MAP_SIZE = 100;

  // Clamper startX/startY pour ne jamais montrer de cases hors limites
  const clamp = (val: number, size: number) =>
    Math.max(0, Math.min(MAP_SIZE - size, val));

  const handleZoomIn = () => {
    setViewSize((prev) => {
      const next = Math.max(prev - 4, 7);
      setStartX((sx) => clamp(sx, next));
      setStartY((sy) => clamp(sy, next));
      return next;
    });
  };

  const handleZoomOut = () => {
    setViewSize((prev) => {
      const next = Math.min(prev + 4, 19);
      setStartX((sx) => clamp(sx, next));
      setStartY((sy) => clamp(sy, next));
      return next;
    });
  };

  const handleClickCell = (cell: MapCell) => {
    const half = Math.floor(viewSize / 2);
    setStartX(clamp(cell.x - half, viewSize));
    setStartY(clamp(cell.y - half, viewSize));
    if (cell.feature === 'foret') {
      setSelectedForestCell(cell);
    }
  };

  const handleMoveUp = () => setStartY((prev) => clamp(prev - 1, viewSize));
  const handleMoveDown = () => setStartY((prev) => clamp(prev + 1, viewSize));
  const handleMoveLeft = () => setStartX((prev) => clamp(prev - 1, viewSize));
  const handleMoveRight = () => setStartX((prev) => clamp(prev + 1, viewSize));

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center overflow-hidden relative"
      style={{
        backgroundImage: "url(/assets/backgrounds/background-map.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/50"></div>

      <div className="flex flex-col items-center relative z-10">
        {/* Zone 3D pour la map et flèches haut/gauche/droite */}
        <div
          className="flex flex-col items-center gap-6"
          style={{
            transform: "perspective(1200px) rotateX(35deg) translateY(-60px)",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Flèche haut */}
          <Button
            variant="stone"
            className="w-16 h-16 text-3xl border-2 border-[var(--ivory)] rounded"
            style={{ transformStyle: "flat" }}
            onClick={handleMoveUp}
          >
            ↑
          </Button>

          <div className="flex items-center gap-8">
            {/* Flèche gauche */}
            <Button
              variant="stone"
              className="w-16 h-16 text-3xl border-2 border-[var(--ivory)] rounded"
              style={{ transformStyle: "flat" }}
              onClick={handleMoveLeft}
            >
              ←
            </Button>

            {/* Map */}
            <div
              className="p-8 rounded-lg"
              style={{
                transform: "translateZ(200px)",
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                border: "3px solid rgba(139, 119, 83, 0.8)",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
              }}
            >
              <IsometricMapViewer
                map={map}
                viewSize={viewSize}
                startX={startX}
                startY={startY}
                onHoverCell={setHoveredCell}
                onClickCell={handleClickCell}
                villages={villages}
                currentUserId={currentUserId}
                containerSize={MAP_CONTAINER_SIZE}
                tileMissionMap={missionTileMap}
              />
            </div>

            {/* Flèche droite */}
            <Button
              variant="stone"
              className="w-16 h-16 text-3xl border-2 border-[var(--ivory)] rounded"
              style={{ transformStyle: "flat" }}
              onClick={handleMoveRight}
            >
              →
            </Button>
          </div>
        </div>

        {/* Tooltip — entre la carte et la flèche bas */}
        <div className="-mt-16 h-6 flex items-center justify-end relative z-10" style={{ width: MAP_CONTAINER_SIZE + 64 + 6 }}>
          {hoveredCell &&
            (() => {
              const hoveredVillage = villages.find(
                (v) => v.x === hoveredCell.x && v.y === hoveredCell.y,
              );
              return (
                <div
                  className="px-3 py-1 rounded text-sm pointer-events-none"
                  style={{
                    backgroundColor: "rgba(26, 26, 26, 0.95)",
                    color: "#f5f5dc",
                    border: "1px solid rgba(245, 245, 220, 0.3)",
                  }}
                >
                  {hoveredVillage
                    ? `${hoveredVillage.owner.username}${hoveredVillage.name ? ` — ${hoveredVillage.name}` : ""}`
                    : (() => {
                        const label = hoveredCell.feature ? FEATURE_LABELS[hoveredCell.feature] : "Prairie";
                        const summary = missionTileMap.get(`${hoveredCell.x},${hoveredCell.y}`);
                        if (!summary) return label;
                        const parts = (Object.entries(summary.byPhase) as [MissionPhase, number][])
                          .filter(([, count]) => count > 0)
                          .map(([phase, count]) => `${count} bûcheron${count > 1 ? "s" : ""} ${PHASE_LABELS[phase]}`);
                        return `${label} — ${parts.join(", ")}`;
                      })()}{" "}
                  ({hoveredCell.x}, {hoveredCell.y})
                </div>
              );
            })()}
        </div>

        {/* Flèche bas EN DEHORS de la zone 3D */}
        <div className="relative z-10">
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

      {/* Mission modal for forest click */}
      {selectedForestCell && (
        <SendMissionModal
          targetX={selectedForestCell.x}
          targetY={selectedForestCell.y}
          villageX={villageX}
          villageY={villageY}
          speed={lumberjackStats.speed}
          gatherRate={lumberjackStats.gatherRate}
          maxCapacity={lumberjackStats.maxCapacity}
          availableLumberjacks={availableLumberjacks}
          onClose={() => setSelectedForestCell(null)}
        />
      )}
    </div>
  );
}
