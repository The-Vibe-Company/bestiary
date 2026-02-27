import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { PlacePageClient } from "@/components/place/place-page-client";
import { getBuildingTypes } from "@/lib/game/buildings/get-building-types";
import { getVillageBuildings } from "@/lib/game/buildings/get-village-buildings";
import { completePendingBuildings } from "@/lib/game/buildings/complete-pending-buildings";
import { computeStorageCapacity } from "@/lib/game/buildings/storage-capacity";
import { completePendingResearch } from "@/lib/game/research/complete-pending-research";
import { getInhabitantStats } from "@/lib/game/inhabitants/get-inhabitant-stats";
import { getInhabitantTypes } from "@/lib/game/inhabitants/get-inhabitant-types";
import { getUnoccupiedInhabitantsCount } from "@/lib/game/inhabitants/get-unoccupied-inhabitants-count";
import { getVillageInhabitants } from "@/lib/game/inhabitants/get-village-inhabitants";
import { completePendingMissions } from "@/lib/game/missions/complete-missions";
import { getActiveMissions } from "@/lib/game/missions/get-active-missions";
import { applyDailyConsumption } from "@/lib/game/resources/apply-daily-consumption";
import { computeDailyConsumption } from "@/lib/game/resources/compute-daily-consumption";
import { getUserResources } from "@/lib/game/resources/get-user-resources";
import { getVillageResources } from "@/lib/game/resources/get-village-resources";
import { resolveTraveler } from "@/lib/game/travelers/resolve-traveler";
import { detectTraveler } from "@/lib/game/travelers/detect-traveler";
import { getUser } from "@/lib/game/user/get-user";
import { assignVillageToUser } from "@/lib/game/village/assign-village";
import { getVillage } from "@/lib/game/village/get-village";
import { INHABITANT_TYPES } from "@/lib/game/inhabitants/types";
import { computeEffectiveLevel } from "@/lib/game/buildings/compute-effective-level";
import { neonAuth } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";

export default async function PlacePage() {
  const { session, user } = await neonAuth();

  if (!session || !user) {
    redirect("/sign-in");
  }

  await assignVillageToUser(session.userId);

  const [village, userResources, userData, inhabitantTypes, inhabitantStats] =
    await Promise.all([
      getVillage(session.userId),
      getUserResources(session.userId),
      getUser(session.userId),
      getInhabitantTypes(),
      getInhabitantStats(),
    ]);

  if (!userData || !village) {
    redirect("/sign-in");
  }

  // Complete finished jobs and apply pending consumption before computing availability
  await Promise.all([
    completePendingMissions(village.id),
    completePendingBuildings(village.id),
    completePendingResearch(village.id),
    applyDailyConsumption(village.id, inhabitantTypes),
  ]);

  // Fetch mutable data AFTER catch-up for fresh values
  const [villageResources, villageInhabitants, buildingTypes, villageBuildings] = await Promise.all([
    getVillageResources(session.userId),
    getVillageInhabitants(session.userId),
    getBuildingTypes(),
    getVillageBuildings(session.userId),
  ]);

  if (!villageResources) {
    redirect("/sign-in");
  }

  // Fetch active missions
  const missions = await getActiveMissions(village.id);

  // Build statsByType for all mission-capable types
  const statsByType: Record<string, { gatherRate: number; maxCapacity: number }> = {};
  for (const [type, stats] of Object.entries(inhabitantStats)) {
    if (stats.gatherRate > 0 || stats.maxCapacity > 0) {
      statsByType[type] = { gatherRate: stats.gatherRate, maxCapacity: stats.maxCapacity };
    }
  }

  const dailyConsumption = computeDailyConsumption(villageInhabitants, inhabitantTypes);

  const totalInhabitants = villageInhabitants
    ? INHABITANT_TYPES.reduce((sum, type) => sum + (villageInhabitants[type] ?? 0), 0)
    : 0;
  const unoccupiedInhabitants = await getUnoccupiedInhabitantsCount(village.id, totalInhabitants);

  // Compute storage capacity from completed buildings
  const completedBuildings = villageBuildings.filter((vb) => vb.completedAt !== null);
  const storageCapacity = computeStorageCapacity(buildingTypes, completedBuildings);

  // Résoudre l'état du voyageur (lazy completion) + détection tour de guet + taverne
  // Effective level = building level + assigned staff (0 staff → building doesn't function)
  const tavern = completedBuildings.find((b) => b.buildingType === "taverne");
  const tavernLevel = tavern?.level ?? 0;
  const effectiveTavernLevel = computeEffectiveLevel(tavernLevel, villageInhabitants?.tavernkeeper ?? 0);
  const rawTravelerStatus = await resolveTraveler(village.id, effectiveTavernLevel);
  const watchtower = completedBuildings.find((b) => b.buildingType === "tour_de_guet");
  const towerLevel = watchtower?.level ?? 0;
  const effectiveTowerLevel = computeEffectiveLevel(towerLevel, villageInhabitants?.watchman ?? 0);
  const travelerStatus = await detectTraveler(village.id, rawTravelerStatus, effectiveTowerLevel);
  const isVillageFull = totalInhabitants >= village.capacity;

  const inhabitantTypesData = inhabitantTypes.map((t) => ({
    key: t.key,
    title: t.title,
    image: t.image,
  }));

  return (
    <div
      className="h-full flex flex-col bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "url('/assets/backgrounds/background-place.webp')",
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
          storageCapacity={storageCapacity}
          population={totalInhabitants}
          maxPopulation={village.capacity}
          unoccupiedInhabitants={unoccupiedInhabitants}
          dailyConsumption={dailyConsumption}
        />
      </div>

      {/* Main content — dual-panel layout */}
      <div className="flex-1 min-h-0 relative z-10 p-6 pt-4">
        <PlacePageClient
          travelerStatus={travelerStatus}
          inhabitantTypes={inhabitantTypesData}
          isVillageFull={isVillageFull}
          tavernLevel={effectiveTavernLevel}
          missions={missions}
          statsByType={statsByType}
        />
      </div>
    </div>
  );
}
