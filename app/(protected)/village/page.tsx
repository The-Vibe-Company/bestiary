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
import { computeStorageCapacity, getStorageStaffCounts } from "@/lib/game/buildings/storage-capacity";
import { getTechnologies } from "@/lib/game/research/get-technologies";
import { getVillageTechnologies } from "@/lib/game/research/get-village-technologies";
import { completePendingResearch } from "@/lib/game/research/complete-pending-research";
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
    completePendingResearch(village.id),
    applyDailyConsumption(village.id, inhabitantTypes),
  ]);

  // Fetch all mutable data AFTER catch-up for fresh state
  const [buildingTypes, villageBuildings, villageResources, villageInhabitants, villageTechnologies, allTechnologies] =
    await Promise.all([
      getBuildingTypes(),
      getVillageBuildings(session.userId),
      getVillageResources(session.userId),
      getVillageInhabitants(session.userId),
      getVillageTechnologies(village.id),
      getTechnologies(),
    ]);

  if (!villageResources) {
    redirect("/sign-in");
  }

  const totalInhabitants = villageInhabitants
    ? INHABITANT_TYPES.reduce((sum, type) => sum + (villageInhabitants[type] ?? 0), 0)
    : 0;

  const dailyConsumption = computeDailyConsumption(villageInhabitants, inhabitantTypes);
  const unoccupiedInhabitants = await getUnoccupiedInhabitantsCount(village.id, totalInhabitants);

  // Compute storage capacity from completed buildings (staff-aware: no staff = inactive)
  const completedBuildings = villageBuildings.filter((vb) => vb.completedAt !== null);
  const storageStaffCounts = getStorageStaffCounts(villageInhabitants);
  const storageCapacity = computeStorageCapacity(buildingTypes, completedBuildings, storageStaffCounts);

  // Calculate available builders (total - busy on active constructions)
  const totalBuilders = villageInhabitants?.builder ?? 0;
  const busyBuilders = villageBuildings
    .filter((vb) => vb.completedAt === null)
    .reduce((sum, vb) => sum + vb.assignedBuilders, 0);
  const availableBuilders = totalBuilders - busyBuilders;

  // Build a set of completed technology keys for prerequisite checks
  const completedTechKeys = new Set(
    villageTechnologies
      .filter((vt) => vt.completedAt !== null)
      .map((vt) => vt.technologyKey)
  );

  // Map technology key → title for display on locked buildings
  const techTitleMap = new Map(allTechnologies.map((t) => [t.key, t.title]));

  // Compute staff counts for buildings with personnel
  const busyResearchers = villageTechnologies
    .filter((vt) => vt.completedAt === null)
    .reduce((sum, vt) => sum + vt.assignedResearchers, 0);

  const buildingStaffCounts: Record<string, number> = {
    laboratoire: busyResearchers,
    tour_de_guet: villageInhabitants?.watchman ?? 0,
    taverne: villageInhabitants?.tavernkeeper ?? 0,
    hotel_de_ville: villageInhabitants?.mayor ?? 0,
    entrepot_bois: villageInhabitants?.splitter ?? 0,
    entrepot_pierre: villageInhabitants?.stonecutter ?? 0,
    entrepot_cereales: villageInhabitants?.victualer ?? 0,
    entrepot_viande: villageInhabitants?.butcher ?? 0,
  };

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

    // For unique buildings: find the current level from the highest-level completed building
    const currentLevel = buildings
      .filter((vb) => vb.completedAt !== null)
      .reduce((max, vb) => Math.max(max, vb.level), 0)

    return {
      key: bt.key,
      title: bt.title,
      description: bt.description,
      image: bt.image,
      category: bt.category,
      costBois: bt.costBois,
      costPierre: bt.costPierre,
      costCereales: bt.costCereales,
      costViande: bt.costViande,
      buildSeconds: bt.buildSeconds,
      capacityBonus: bt.capacityBonus ?? 0,
      storageBonusBois: bt.storageBonusBois ?? 0,
      storageBonusPierre: bt.storageBonusPierre ?? 0,
      storageBonusCereales: bt.storageBonusCereales ?? 0,
      storageBonusViande: bt.storageBonusViande ?? 0,
      maxCount: bt.maxCount,
      maxLevel: bt.maxLevel,
      requiredTechnology: bt.requiredTechnology,
      requiredTechnologyTitle: bt.requiredTechnology ? (techTitleMap.get(bt.requiredTechnology) ?? bt.requiredTechnology) : null,
      isTechMet: !bt.requiredTechnology || completedTechKeys.has(bt.requiredTechnology),
      completedCount,
      currentLevel,
      activeConstructions,
      staffCount: buildingStaffCounts[bt.key] ?? 0,
    };
  });

  return (
    <div
      className="h-full flex flex-col bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "url('/assets/backgrounds/background-village.webp')",
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
          storageCapacity={storageCapacity}
          availableBuilders={availableBuilders}
        />
      </div>
    </div>
  );
}
