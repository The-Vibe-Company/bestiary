import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { VillagePageClient } from "@/components/village/village-page-client";
import { getBuildingTypes } from "@/lib/game/buildings/get-building-types";
import { getVillageBuildings } from "@/lib/game/buildings/get-village-buildings";
import { completePendingBuildings } from "@/lib/game/buildings/complete-pending-buildings";
import { getVillageInhabitants } from "@/lib/game/inhabitants/get-village-inhabitants";
import { INHABITANT_TYPES } from "@/lib/game/inhabitants/types";
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

  const [villageResources, village, userResources, userData, villageInhabitants] =
    await Promise.all([
      getVillageResources(session.userId),
      getVillage(session.userId),
      getUserResources(session.userId),
      getUser(session.userId),
      getVillageInhabitants(session.userId),
    ]);

  if (!villageResources || !userData || !village) {
    redirect("/sign-in");
  }

  // Lazy completion: complete any buildings whose timer has elapsed
  await completePendingBuildings(village.id);

  // Fetch building data AFTER lazy completion for fresh state
  const [buildingTypes, villageBuildings, freshVillage, freshResources] =
    await Promise.all([
      getBuildingTypes(),
      getVillageBuildings(session.userId),
      getVillage(session.userId),
      getVillageResources(session.userId),
    ]);

  const totalInhabitants = villageInhabitants
    ? INHABITANT_TYPES.reduce((sum, type) => sum + villageInhabitants[type], 0)
    : 0;

  // Aggregate building data per type
  const buildingTypeData = buildingTypes.map((bt) => {
    const buildings = villageBuildings.filter((vb) => vb.buildingType === bt.key);
    const completedCount = buildings.filter((vb) => vb.completedAt !== null).length;
    const activeConstructions = buildings
      .filter((vb) => vb.completedAt === null)
      .map((vb) => ({
        startedAt: vb.startedAt.toISOString(),
        buildSeconds: vb.buildSeconds,
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

  const currentResources = freshResources ?? villageResources;
  const currentVillage = freshVillage ?? village;

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
          villageName={currentVillage?.name ?? null}
          villageResources={currentResources}
          population={totalInhabitants}
          maxPopulation={currentVillage.capacity}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0 flex items-start justify-center py-6 relative z-10">
        <VillagePageClient
          buildingTypes={buildingTypeData}
          villageResources={{
            bois: currentResources.bois,
            pierre: currentResources.pierre,
            cereales: currentResources.cereales,
            viande: currentResources.viande,
          }}
        />
      </div>
    </div>
  );
}
