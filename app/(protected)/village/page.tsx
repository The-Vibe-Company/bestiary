import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { VillagePageClient } from "@/components/village/village-page-client";
import { getBuildingTypes } from "@/lib/game/buildings/get-building-types";
import { getVillageBuildings } from "@/lib/game/buildings/get-village-buildings";
import { completePendingBuildings } from "@/lib/game/buildings/complete-pending-buildings";
import { getInhabitantTypes } from "@/lib/game/inhabitants/get-inhabitant-types";
import { getUnoccupiedInhabitantsCount } from "@/lib/game/inhabitants/get-unoccupied-inhabitants-count";
import { getVillageInhabitants } from "@/lib/game/inhabitants/get-village-inhabitants";
import { completePendingMissions } from "@/lib/game/missions/complete-missions";
import { INHABITANT_TYPES } from "@/lib/game/inhabitants/types";
import { applyDailyConsumption } from "@/lib/game/resources/apply-daily-consumption";
import { computeDailyConsumption } from "@/lib/game/resources/compute-daily-consumption";
import { getUserResources } from "@/lib/game/resources/get-user-resources";
import { getVillageResources } from "@/lib/game/resources/get-village-resources";
import { getUser } from "@/lib/game/user/get-user";
import { assignVillageToUser } from "@/lib/game/village/assign-village";
import { getVillage } from "@/lib/game/village/get-village";
import { neonAuth } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";

export default async function VillagePage() {
  const { session, user } = await neonAuth();

  if (!session || !user) {
    redirect("/sign-in");
  }

  // S'assurer que l'utilisateur a un village (créé au signup ou ici en fallback)
  await assignVillageToUser(session.userId);

  const [village, userResources, userData, inhabitantTypes] =
    await Promise.all([
      getVillage(session.userId),
      getUserResources(session.userId),
      getUser(session.userId),
      getInhabitantTypes(),
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

  // Fetch all mutable data AFTER catch-up for fresh state
  const [buildingTypes, villageBuildings, villageResources, villageInhabitants] =
    await Promise.all([
      getBuildingTypes(),
      getVillageBuildings(session.userId),
      getVillageResources(session.userId),
      getVillageInhabitants(session.userId),
    ]);

  if (!villageResources) {
    redirect("/sign-in");
  }

  const totalInhabitants = villageInhabitants
    ? INHABITANT_TYPES.reduce((sum, type) => sum + (villageInhabitants[type] ?? 0), 0)
    : 0;

  const dailyConsumption = computeDailyConsumption(villageInhabitants, inhabitantTypes);
  const unoccupiedInhabitants = await getUnoccupiedInhabitantsCount(village.id, totalInhabitants);

  // Calculate available builders (total - busy on active constructions)
  const totalBuilders = villageInhabitants?.builder ?? 0;
  const busyBuilders = villageBuildings
    .filter((vb) => vb.completedAt === null)
    .reduce((sum, vb) => sum + vb.assignedBuilders, 0);
  const availableBuilders = totalBuilders - busyBuilders;

  // Aggregate building data per type
  const buildingTypeData = buildingTypes.map((bt) => {
    const buildings = villageBuildings.filter((vb) => vb.buildingType === bt.key);
    const completedCount = buildings.filter((vb) => vb.completedAt !== null).length;
    const activeConstructions = buildings
      .filter((vb) => vb.completedAt === null)
      .map((vb) => ({
        startedAt: vb.startedAt.toISOString(),
        buildSeconds: vb.buildSeconds,
        assignedBuilders: vb.assignedBuilders,
      }));

    return {
      key: bt.key,
      title: bt.title,
      description: bt.description,
      image: bt.image,
      costBois: bt.costBois,
      costPierre: bt.costPierre,
      costCereales: bt.costCereales,
      costViande: bt.costViande,
      buildSeconds: bt.buildSeconds,
      capacityBonus: bt.capacityBonus,
      completedCount,
      activeConstructions,
    };
  });

  return (
    <div
      className="h-full flex flex-col bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "url('/assets/backgrounds/background-village.png')",
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
          unoccupiedInhabitants={unoccupiedInhabitants}
          dailyConsumption={dailyConsumption}
          starvationRisk={
            villageResources.cereales < Math.round(dailyConsumption.cereales) ||
            villageResources.viande < Math.round(dailyConsumption.viande)
          }
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0 flex items-start justify-center py-6 relative z-10">
        <VillagePageClient
          buildingTypes={buildingTypeData}
          villageResources={{
            bois: villageResources.bois,
            pierre: villageResources.pierre,
            cereales: villageResources.cereales,
            viande: villageResources.viande,
          }}
          availableBuilders={availableBuilders}
        />
      </div>
    </div>
  );
}
