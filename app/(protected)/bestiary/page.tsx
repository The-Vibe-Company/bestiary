import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { getBuildingTypes } from "@/lib/game/buildings/get-building-types";
import { getVillageBuildings } from "@/lib/game/buildings/get-village-buildings";
import { completePendingBuildings } from "@/lib/game/buildings/complete-pending-buildings";
import { computeStorageCapacity, getStorageStaffCounts } from "@/lib/game/buildings/storage-capacity";
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
import { getVillage } from "@/lib/game/village/get-village";
import { neonAuth } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";

export default async function BestiaryPage() {
  const { session } = await neonAuth();

  if (!session) {
    redirect("/sign-in");
  }

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

  await Promise.all([
    completePendingMissions(village.id),
    completePendingBuildings(village.id),
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

  const totalInhabitants = villageInhabitants
    ? INHABITANT_TYPES.reduce((sum, type) => sum + (villageInhabitants[type] ?? 0), 0)
    : 0;

  const dailyConsumption = computeDailyConsumption(villageInhabitants, inhabitantTypes);
  const unoccupiedInhabitants = await getUnoccupiedInhabitantsCount(
    village.id,
    totalInhabitants,
    villageInhabitants,
  );

  // Compute storage capacity from completed buildings (staff-aware: no staff = inactive)
  const completedBuildings = villageBuildings.filter((vb) => vb.completedAt !== null);
  const storageStaffCounts = getStorageStaffCounts(villageInhabitants);
  const storageCapacity = computeStorageCapacity(buildingTypes, completedBuildings, storageStaffCounts);

  return (
    <div
      className="h-full flex flex-col bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "url('/assets/backgrounds/background-bestiary.webp')",
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
      <div className="flex-1 flex items-center justify-center relative z-10">
      </div>
    </div>
  );
}
