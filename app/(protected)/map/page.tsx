import { MapPageClient } from "@/components/game/map-page-client";
import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { getInhabitantStats } from "@/lib/game/inhabitants/get-inhabitant-stats";
import { type InhabitantType } from "@/lib/game/inhabitants/types";
import { generateWorldMap } from "@/lib/game/map/generator";
import { MISSION_CAPABLE_TYPES } from "@/lib/game/missions/mission-config";
import { loadVillageContext } from "@/lib/game/page/load-village-context";
import { getAllVillagesWithOwner } from "@/lib/game/village/get-all-villages";
import { prisma } from "@/lib/prisma";

export default async function MapPage() {
  const ctx = await loadVillageContext({ completeResearch: false });

  const worldMap = generateWorldMap();

  const [inhabitantStats, allVillages, activeMissions] = await Promise.all([
    getInhabitantStats(),
    getAllVillagesWithOwner(),
    prisma.mission.findMany({
      where: { villageId: ctx.village.id, completedAt: null },
      select: {
        inhabitantType: true,
        workerCount: true,
        targetX: true,
        targetY: true,
        departedAt: true,
        travelSeconds: true,
        workSeconds: true,
        recalledAt: true,
      },
    }),
  ]);

  // Aggregate busy workers per inhabitant type from the active missions list (no extra query)
  const busyWorkerMap: Record<string, number> = {};
  for (const m of activeMissions) {
    busyWorkerMap[m.inhabitantType] = (busyWorkerMap[m.inhabitantType] ?? 0) + m.workerCount;
  }

  // Compute worker availability and stats for all mission-capable types
  const workerAvailability: Record<string, number> = {};
  const workerStats: Record<string, { speed: number; gatherRate: number; maxCapacity: number }> = {};
  for (const type of MISSION_CAPABLE_TYPES) {
    const total = ctx.villageInhabitants?.[type as InhabitantType] ?? 0;
    workerAvailability[type] = total - (busyWorkerMap[type] ?? 0);
    const stats = inhabitantStats[type];
    if (stats) {
      workerStats[type] = { speed: stats.speed, gatherRate: stats.gatherRate, maxCapacity: stats.maxCapacity };
    }
  }

  const missionTiles = activeMissions.map((m) => ({
    x: m.targetX,
    y: m.targetY,
    inhabitantType: m.inhabitantType,
    workerCount: m.workerCount,
    departedAt: m.departedAt.toISOString(),
    travelSeconds: m.travelSeconds,
    workSeconds: m.workSeconds,
    recalledAt: m.recalledAt?.toISOString() ?? null,
  }));

  return (
    <div className="relative">
      <div className="absolute top-0 left-0 right-0 z-50 flex justify-center gap-2 mt-[32px]">
        <UserResourceBar
          username={ctx.userData.username}
          userResources={ctx.userResources}
        />
        <ResourceBar
          villageName={ctx.village.name}
          villageResources={ctx.villageResources}
          storageCapacity={ctx.storageCapacity}
          population={ctx.totalInhabitants}
          maxPopulation={ctx.village.capacity}
          unoccupiedInhabitants={ctx.unoccupiedInhabitants}
          dailyConsumption={ctx.dailyConsumption}
        />
      </div>
      <MapPageClient
        map={worldMap}
        villages={allVillages}
        initialX={ctx.village.x}
        initialY={ctx.village.y}
        currentUserId={ctx.userId}
        villageX={ctx.village.x}
        villageY={ctx.village.y}
        workerAvailability={workerAvailability}
        workerStats={workerStats}
        missionTiles={missionTiles}
      />
    </div>
  );
}
