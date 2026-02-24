import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { getBuildingTypes } from "@/lib/game/buildings/get-building-types";
import { completePendingBuildings } from "@/lib/game/buildings/complete-pending-buildings";
import { getVillageBuildings } from "@/lib/game/buildings/get-village-buildings";
import { computeStorageCapacity } from "@/lib/game/buildings/storage-capacity";
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
import Link from "next/link";
import { GiScrollUnfurled } from "react-icons/gi";

export default async function ResearchPage() {
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
  const [villageResources, villageInhabitants, villageBuildings, buildingTypes] =
    await Promise.all([
      getVillageResources(session.userId),
      getVillageInhabitants(session.userId),
      getVillageBuildings(session.userId),
      getBuildingTypes(),
    ]);

  if (!villageResources) {
    redirect("/sign-in");
  }

  const totalInhabitants = villageInhabitants
    ? INHABITANT_TYPES.reduce(
        (sum, type) => sum + (villageInhabitants[type] ?? 0),
        0
      )
    : 0;

  const dailyConsumption = computeDailyConsumption(
    villageInhabitants,
    inhabitantTypes
  );
  const unoccupiedInhabitants = await getUnoccupiedInhabitantsCount(
    village.id,
    totalInhabitants
  );

  // Compute storage capacity from completed buildings
  const completedBuildings = villageBuildings.filter((vb) => vb.completedAt !== null);
  const storageCapacity = computeStorageCapacity(buildingTypes, completedBuildings);

  // Check if the player has a completed laboratory building
  const hasLaboratory = villageBuildings.some(
    (b) => b.buildingType === "laboratoire" && b.completedAt !== null
  );

  return (
    <div
      className="h-full flex flex-col bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "url('/assets/backgrounds/background-lab.webp')",
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
        {!hasLaboratory && (
          <div className="max-w-md w-full mx-4 bg-black/75 backdrop-blur border border-[var(--burnt-amber)]/50 rounded-xl p-8 text-center">
            <GiScrollUnfurled
              size={64}
              className="mx-auto mb-4 text-[var(--burnt-amber)]/60"
            />
            <h2 className="text-2xl font-bold font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)] mb-3">
              Laboratoire requis
            </h2>
            <p className="text-[var(--ivory)]/70 leading-relaxed mb-6">
              Vous devez construire un laboratoire dans votre village avant de
              pouvoir accéder à la recherche.
            </p>
            <Link
              href="/village"
              className="inline-block px-6 py-2.5 font-[family-name:var(--font-title)] tracking-[0.15em] rounded-lg transition-all duration-300 border-2 bg-[var(--burnt-amber)] text-[var(--ivory)] hover:bg-[var(--burnt-amber-light)] hover:shadow-[0_0_30px_rgba(179,123,52,0.4)] stone-texture border-[var(--burnt-amber)] hover:border-[var(--burnt-amber-light)] hover:scale-105 active:scale-95"
            >
              Construire
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
