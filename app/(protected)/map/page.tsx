import { MapPageClient } from "@/components/game/map-page-client";
import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { getBuildingTypes } from "@/lib/game/buildings/get-building-types";
import { getVillageBuildings } from "@/lib/game/buildings/get-village-buildings";
import { completePendingBuildings } from "@/lib/game/buildings/complete-pending-buildings";
import { computeStorageCapacity, getStorageStaffCounts } from "@/lib/game/buildings/storage-capacity";
import { getInhabitantStats } from "@/lib/game/inhabitants/get-inhabitant-stats";
import { getInhabitantTypes } from "@/lib/game/inhabitants/get-inhabitant-types";
import { getUnoccupiedInhabitantsCount } from "@/lib/game/inhabitants/get-unoccupied-inhabitants-count";
import { getVillageInhabitants } from "@/lib/game/inhabitants/get-village-inhabitants";
import { INHABITANT_TYPES, type InhabitantType } from "@/lib/game/inhabitants/types";
import { generateWorldMap } from "@/lib/game/map/generator";
import { completePendingMissions } from "@/lib/game/missions/complete-missions";
import { MISSION_CAPABLE_TYPES } from "@/lib/game/missions/mission-config";
import { applyDailyConsumption } from "@/lib/game/resources/apply-daily-consumption";
import { computeDailyConsumption } from "@/lib/game/resources/compute-daily-consumption";
import { getUserResources } from "@/lib/game/resources/get-user-resources";
import { getVillageResources } from "@/lib/game/resources/get-village-resources";
import { getUser } from "@/lib/game/user/get-user";
import { getVillage } from "@/lib/game/village/get-village";
import { getAllVillagesWithOwner } from "@/lib/game/village/get-all-villages";
import { prisma } from "@/lib/prisma";
import { neonAuth } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";

export default async function MapPage() {
  const { session } = await neonAuth();

  if (!session) {
    redirect("/sign-in");
  }

  const worldMap = generateWorldMap();

  const [village, userResources, userData, inhabitantStats, inhabitantTypes, allVillages] =
    await Promise.all([
      getVillage(session.userId),
      getUserResources(session.userId),
      getUser(session.userId),
      getInhabitantStats(),
      getInhabitantTypes(),
      getAllVillagesWithOwner(),
    ]);

  if (!userData || !village) {
    redirect("/sign-in");
  }

  // Complete finished jobs and apply pending consumption before computing availability
  await Promise.all([
    completePendingMissions(village.id),
    completePendingBuildings(village.id),
    applyDailyConsumption(village.id, inhabitantTypes),
  ]);

  // Fetch mutable data + active missions in one round-trip
  const [villageResources, villageInhabitants, buildingTypes, villageBuildings, activeMissions] = await Promise.all([
    getVillageResources(session.userId),
    getVillageInhabitants(session.userId),
    getBuildingTypes(),
    getVillageBuildings(session.userId),
    prisma.mission.findMany({
      where: { villageId: village.id, completedAt: null },
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

  if (!villageResources) {
    redirect("/sign-in");
  }

  const totalInhabitants = villageInhabitants
    ? INHABITANT_TYPES.reduce((sum, type) => sum + (villageInhabitants[type] ?? 0), 0)
    : 0;

  const dailyConsumption = computeDailyConsumption(villageInhabitants, inhabitantTypes);

  // Compute storage capacity from completed buildings (staff-aware: no staff = inactive)
  const completedBuildings = villageBuildings.filter((vb) => vb.completedAt !== null);
  const storageStaffCounts = getStorageStaffCounts(villageInhabitants);
  const storageCapacity = computeStorageCapacity(buildingTypes, completedBuildings, storageStaffCounts);

  // Aggregate busy workers per inhabitant type from the active missions list (no extra query)
  const busyWorkerMap: Record<string, number> = {};
  for (const m of activeMissions) {
    busyWorkerMap[m.inhabitantType] = (busyWorkerMap[m.inhabitantType] ?? 0) + m.workerCount;
  }

  // Compute worker availability and stats for all mission-capable types
  const workerAvailability: Record<string, number> = {};
  const workerStats: Record<string, { speed: number; gatherRate: number; maxCapacity: number }> = {};
  for (const type of MISSION_CAPABLE_TYPES) {
    const total = villageInhabitants?.[type as InhabitantType] ?? 0;
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
  const unoccupiedInhabitants = await getUnoccupiedInhabitantsCount(
    village.id,
    totalInhabitants,
    villageInhabitants,
  );

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
          storageCapacity={storageCapacity}
          population={totalInhabitants}
          maxPopulation={village.capacity}
          unoccupiedInhabitants={unoccupiedInhabitants}
          dailyConsumption={dailyConsumption}
        />
      </div>
      <MapPageClient
        map={worldMap}
        villages={allVillages}
        initialX={village.x}
        initialY={village.y}
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
