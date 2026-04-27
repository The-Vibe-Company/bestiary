import { HabitantsPageClient } from "@/components/habitants/habitants-page-client";
import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { getInhabitantStats } from "@/lib/game/inhabitants/get-inhabitant-stats";
import { type InhabitantType } from "@/lib/game/inhabitants/types";
import { generateWorldMap } from "@/lib/game/map/generator";
import { MISSION_CAPABLE_TYPES } from "@/lib/game/missions/mission-config";
import { loadVillageContext } from "@/lib/game/page/load-village-context";
import { getAllVillagePositions } from "@/lib/game/village/get-all-villages";
import { prisma } from "@/lib/prisma";

export default async function HabitantsPage() {
  const ctx = await loadVillageContext({ completeResearch: false });

  const [inhabitantStats, allVillagePositions, activeMissions] = await Promise.all([
    getInhabitantStats(),
    getAllVillagePositions(),
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

  // Aggregate busy workers per inhabitant type in JS (no DB groupBy needed)
  const missionCountMap: Record<string, number> = {};
  for (const m of activeMissions) {
    missionCountMap[m.inhabitantType] = (missionCountMap[m.inhabitantType] ?? 0) + m.workerCount;
  }

  // Compute worker availability and stats for all mission-capable types
  const workerAvailability: Record<string, number> = {};
  const workerStats: Record<string, { speed: number; gatherRate: number; maxCapacity: number }> = {};
  for (const type of MISSION_CAPABLE_TYPES) {
    const total = ctx.villageInhabitants?.[type as InhabitantType] ?? 0;
    workerAvailability[type] = total - (missionCountMap[type] ?? 0);
    const stats = inhabitantStats[type];
    if (stats) {
      workerStats[type] = { speed: stats.speed, gatherRate: stats.gatherRate, maxCapacity: stats.maxCapacity };
    }
  }

  // Build ordered list for display using DB metadata
  const inhabitantsList = ctx.inhabitantTypes.map((type) => ({
    ...type,
    id: type.key,
    count: ctx.villageInhabitants?.[type.key as InhabitantType] ?? 0,
    inMission: missionCountMap[type.key] ?? 0,
  }));

  const worldMap = generateWorldMap();

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
    <div
      className="h-full flex flex-col bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "url('/assets/backgrounds/background-habitants.webp')",
      }}
    >
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Resource bars container */}
      <div className="flex-shrink-0 relative z-10 flex justify-center gap-2 mt-[32px]">
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

      {/* Main content area - panel fills available space */}
      <div className="flex-1 min-h-0 flex items-start justify-center py-6 relative z-10">
        <HabitantsPageClient
          inhabitantsList={inhabitantsList}
          map={worldMap}
          villageX={ctx.village.x}
          villageY={ctx.village.y}
          workerAvailability={workerAvailability}
          workerStats={workerStats}
          missionTiles={missionTiles}
          allVillagePositions={allVillagePositions}
        />
      </div>
    </div>
  );
}
