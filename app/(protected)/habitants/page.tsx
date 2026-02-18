import { HabitantsPageClient } from "@/components/habitants/habitants-page-client";
import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { getInhabitantStats } from "@/lib/game/inhabitants/get-inhabitant-stats";
import { getInhabitantTypes } from "@/lib/game/inhabitants/get-inhabitant-types";
import { getVillageInhabitants } from "@/lib/game/inhabitants/get-village-inhabitants";
import { INHABITANT_TYPES, type InhabitantType } from "@/lib/game/inhabitants/types";
import { generateWorldMap } from "@/lib/game/map/generator";
import { completePendingMissions } from "@/lib/game/missions/complete-missions";
import { MISSION_CAPABLE_TYPES } from "@/lib/game/missions/mission-config";
import { getUserResources } from "@/lib/game/resources/get-user-resources";
import { computeDailyConsumption } from "@/lib/game/resources/compute-daily-consumption";
import { getVillageResources } from "@/lib/game/resources/get-village-resources";
import { getUser } from "@/lib/game/user/get-user";
import { getVillage } from "@/lib/game/village/get-village";
import { prisma } from "@/lib/prisma";
import { neonAuth } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";

export default async function HabitantsPage() {
  const { session } = await neonAuth();

  if (!session) {
    redirect("/sign-in");
  }

  const [
    villageResources,
    village,
    userResources,
    userData,
    villageInhabitants,
    inhabitantTypes,
    inhabitantStats,
  ] = await Promise.all([
    getVillageResources(session.userId),
    getVillage(session.userId),
    getUserResources(session.userId),
    getUser(session.userId),
    getVillageInhabitants(session.userId),
    getInhabitantTypes(),
    getInhabitantStats(),
  ]);

  if (!villageResources || !userData || !village) {
    redirect("/sign-in");
  }

  // Complete any finished missions (lazy pattern)
  await completePendingMissions(village.id);

  // Count active missions grouped by inhabitant type
  const activeMissionCounts = await prisma.mission.groupBy({
    by: ['inhabitantType'],
    where: { villageId: village.id, completedAt: null },
    _count: true,
  });
  const missionCountMap = Object.fromEntries(
    activeMissionCounts.map((m) => [m.inhabitantType, m._count])
  );

  const totalInhabitants = villageInhabitants
    ? INHABITANT_TYPES.reduce((sum, type) => sum + (villageInhabitants[type] ?? 0), 0)
    : 0;

  const dailyConsumption = computeDailyConsumption(villageInhabitants, inhabitantTypes);

  // Compute worker availability and stats for all mission-capable types
  const workerAvailability: Record<string, number> = {};
  const workerStats: Record<string, { speed: number; gatherRate: number; maxCapacity: number }> = {};
  for (const type of MISSION_CAPABLE_TYPES) {
    const total = villageInhabitants?.[type as InhabitantType] ?? 0;
    workerAvailability[type] = total - (missionCountMap[type] ?? 0);
    const stats = inhabitantStats[type];
    if (stats) {
      workerStats[type] = { speed: stats.speed, gatherRate: stats.gatherRate, maxCapacity: stats.maxCapacity };
    }
  }

  // Build ordered list for display using DB metadata
  const inhabitantsList = inhabitantTypes.map((type) => ({
    ...type,
    id: type.key,
    count: villageInhabitants?.[type.key as InhabitantType] ?? 0,
    inMission: missionCountMap[type.key] ?? 0,
  }));

  const worldMap = generateWorldMap();

  // Query active missions with timing data for mini-map icons
  const activeMissions = await prisma.mission.findMany({
    where: {
      villageId: village.id,
      completedAt: null,
    },
    select: {
      inhabitantType: true,
      targetX: true,
      targetY: true,
      departedAt: true,
      travelSeconds: true,
      workSeconds: true,
      recalledAt: true,
    },
  });

  const missionTiles = activeMissions.map((m) => ({
    x: m.targetX,
    y: m.targetY,
    inhabitantType: m.inhabitantType,
    departedAt: m.departedAt.toISOString(),
    travelSeconds: m.travelSeconds,
    workSeconds: m.workSeconds,
    recalledAt: m.recalledAt?.toISOString() ?? null,
  }));

  return (
    <div
      className="h-full flex flex-col bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "url('/assets/backgrounds/background-habitants.png')",
      }}
    >
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Resource bars container */}
      <div className="flex-shrink-0 relative z-10 flex justify-center gap-2 mt-[32px]">
        <UserResourceBar
          username={userData.username}
          userResources={userResources}
        />
        <ResourceBar
          villageName={village?.name ?? null}
          villageResources={villageResources}
          population={totalInhabitants}
          maxPopulation={village.capacity}
          dailyConsumption={dailyConsumption}
        />
      </div>

      {/* Main content area - panel fills available space */}
      <div className="flex-1 min-h-0 flex items-start justify-center py-6 relative z-10">
        <HabitantsPageClient
          inhabitantsList={inhabitantsList}
          map={worldMap}
          villageX={village.x}
          villageY={village.y}
          workerAvailability={workerAvailability}
          workerStats={workerStats}
          missionTiles={missionTiles}
        />
      </div>
    </div>
  );
}
