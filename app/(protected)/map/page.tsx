import { MapPageClient } from "@/components/game/map-page-client";
import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { getInhabitantStats } from "@/lib/game/inhabitants/get-inhabitant-stats";
import { getInhabitantTypes } from "@/lib/game/inhabitants/get-inhabitant-types";
import { getUnoccupiedInhabitantsCount } from "@/lib/game/inhabitants/get-unoccupied-inhabitants-count";
import { getVillageInhabitants } from "@/lib/game/inhabitants/get-village-inhabitants";
import { INHABITANT_TYPES, type InhabitantType } from "@/lib/game/inhabitants/types";
import { generateWorldMap } from "@/lib/game/map/generator";
import { completePendingMissions } from "@/lib/game/missions/complete-missions";
import { MISSION_CAPABLE_TYPES } from "@/lib/game/missions/mission-config";
import { computeDailyConsumption } from "@/lib/game/resources/compute-daily-consumption";
import { getUserResources } from "@/lib/game/resources/get-user-resources";
import { getVillageResources } from "@/lib/game/resources/get-village-resources";
import { getUser } from "@/lib/game/user/get-user";
import { getVillage } from "@/lib/game/village/get-village";
import { prisma } from "@/lib/prisma";
import { neonAuth } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";

export default async function MapPage() {
  const { session } = await neonAuth();

  if (!session) {
    redirect("/sign-in");
  }

  const worldMap = generateWorldMap();

  // Récupérer le village du joueur
  const userVillage = await prisma.village.findUnique({
    where: { ownerId: session.userId },
  });

  // Récupérer tous les villages pour les afficher sur la map
  const allVillages = await prisma.village.findMany({
    select: {
      x: true,
      y: true,
      ownerId: true,
      name: true,
      owner: { select: { username: true } },
    },
  });

  const [villageResources, village, userResources, userData, villageInhabitants, inhabitantStats, inhabitantTypes] =
    await Promise.all([
      getVillageResources(session.userId),
      getVillage(session.userId),
      getUserResources(session.userId),
      getUser(session.userId),
      getVillageInhabitants(session.userId),
      getInhabitantStats(),
      getInhabitantTypes(),
    ]);

  if (!villageResources || !userData || !village) {
    redirect("/sign-in");
  }

  const totalInhabitants = villageInhabitants
    ? INHABITANT_TYPES.reduce((sum, type) => sum + (villageInhabitants[type] ?? 0), 0)
    : 0;

  const dailyConsumption = computeDailyConsumption(villageInhabitants, inhabitantTypes);

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

  // Query active missions with timing data for phase computation on the client
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
  const unoccupiedInhabitants = await getUnoccupiedInhabitantsCount(village.id, totalInhabitants);

  return (
    <div className="relative">
      <div className="absolute top-0 left-0 right-0 z-50 flex justify-center gap-2 mt-[32px]">
        <UserResourceBar
          username={userData.username}
          userResources={userResources}
        />
        <ResourceBar
          villageName={village?.name ?? null}
          villageResources={villageResources}
          population={totalInhabitants}
          maxPopulation={village.capacity}
          unoccupiedInhabitants={unoccupiedInhabitants}
          dailyConsumption={dailyConsumption}
        />
      </div>
      <MapPageClient
        map={worldMap}
        villages={allVillages}
        initialX={userVillage?.x ?? 50}
        initialY={userVillage?.y ?? 50}
        currentUserId={session.userId}
        villageX={village.x}
        villageY={village.y}
        workerAvailability={workerAvailability}
        workerStats={workerStats}
        missionTiles={missionTiles}
      />
    </div>
  );
}
