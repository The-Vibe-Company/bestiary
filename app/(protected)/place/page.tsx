import { GiPawPrint, GiCrossedSwords } from "react-icons/gi";
import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { ActiveJobsPanel } from "@/components/place/active-jobs-panel";
import { PlacePanel } from "@/components/place/place-panel";
import { TravelersPanel } from "@/components/place/travelers-panel";
import { completePendingBuildings } from "@/lib/game/buildings/complete-pending-buildings";
import { getInhabitantStats } from "@/lib/game/inhabitants/get-inhabitant-stats";
import { getInhabitantTypes } from "@/lib/game/inhabitants/get-inhabitant-types";
import { getUnoccupiedInhabitantsCount } from "@/lib/game/inhabitants/get-unoccupied-inhabitants-count";
import { getVillageInhabitants } from "@/lib/game/inhabitants/get-village-inhabitants";
import { completePendingMissions } from "@/lib/game/missions/complete-missions";
import { getActiveMissions } from "@/lib/game/missions/get-active-missions";
import { computeDailyConsumption } from "@/lib/game/resources/compute-daily-consumption";
import { getUserResources } from "@/lib/game/resources/get-user-resources";
import { getVillageResources } from "@/lib/game/resources/get-village-resources";
import { getUser } from "@/lib/game/user/get-user";
import { assignVillageToUser } from "@/lib/game/village/assign-village";
import { getVillage } from "@/lib/game/village/get-village";
import { INHABITANT_TYPES } from "@/lib/game/inhabitants/types";
import { neonAuth } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";

export default async function PlacePage() {
  const { session, user } = await neonAuth();

  if (!session || !user) {
    redirect("/sign-in");
  }

  await assignVillageToUser(session.userId);

  const [villageResources, village, userResources, userData, villageInhabitants, inhabitantTypes, inhabitantStats] =
    await Promise.all([
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

  // Complete finished jobs before computing availability
  await Promise.all([
    completePendingMissions(village.id),
    completePendingBuildings(village.id),
  ]);

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

  // A traveler awaits when the village has no inhabitants yet
  const totalInhabitants = villageInhabitants
    ? INHABITANT_TYPES.reduce((sum, type) => sum + (villageInhabitants[type] ?? 0), 0)
    : 0;
  const unoccupiedInhabitants = await getUnoccupiedInhabitantsCount(village.id, totalInhabitants);
  const hasTraveler = totalInhabitants === 0;

  const inhabitantTypesData = inhabitantTypes.map((t) => ({
    key: t.key,
    title: t.title,
    image: t.image,
  }));

  return (
    <div
      className="h-full flex flex-col bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "url('/assets/backgrounds/background-place.png')",
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
        />
      </div>

      {/* Main content — 2×2 grid */}
      <div className="flex-1 min-h-0 relative z-10 p-6 pt-4">
        <div className="h-full grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 gap-4 max-w-5xl mx-auto">
          {/* Voyageurs */}
          <TravelersPanel
            hasTraveler={hasTraveler}
            inhabitantTypes={inhabitantTypesData}
          />

          {/* Placeholder — Animaux errants */}
          <PlacePanel icon={<GiPawPrint size={22} />} title="Animaux errants">
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <GiPawPrint size={48} className="text-[var(--ivory)]/20" />
              <p className="text-sm font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)]/30 uppercase">
                Bientôt disponible
              </p>
            </div>
          </PlacePanel>

          {/* Placeholder — Troupes & Combats */}
          <PlacePanel icon={<GiCrossedSwords size={22} />} title="Troupes & Combats">
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <GiCrossedSwords size={48} className="text-[var(--ivory)]/20" />
              <p className="text-sm font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)]/30 uppercase">
                Bientôt disponible
              </p>
            </div>
          </PlacePanel>

          {/* Jobs en cours */}
          <ActiveJobsPanel
            missions={missions}
            statsByType={statsByType}
          />
        </div>
      </div>
    </div>
  );
}
