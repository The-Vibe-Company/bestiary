import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { PlacePageClient } from "@/components/place/place-page-client";
import { computeEffectiveLevel } from "@/lib/game/buildings/compute-effective-level";
import { getInhabitantStats } from "@/lib/game/inhabitants/get-inhabitant-stats";
import { INHABITANT_TYPES, BUILDING_STAFF_TYPES } from "@/lib/game/inhabitants/types";
import { getActiveMissions } from "@/lib/game/missions/get-active-missions";
import { loadVillageContext } from "@/lib/game/page/load-village-context";
import { resolveTraveler } from "@/lib/game/travelers/resolve-traveler";
import { detectTraveler } from "@/lib/game/travelers/detect-traveler";

export default async function PlacePage() {
  const ctx = await loadVillageContext({ ensureVillage: true });

  const [inhabitantStats, missions] = await Promise.all([
    getInhabitantStats(),
    getActiveMissions(ctx.village.id),
  ]);

  // Build statsByType for all mission-capable types (including exploration)
  const statsByType: Record<string, { gatherRate: number; maxCapacity: number }> = {};
  for (const [type, stats] of Object.entries(inhabitantStats)) {
    if (stats.gatherRate > 0 || stats.maxCapacity > 0 || stats.speed > 0) {
      statsByType[type] = { gatherRate: stats.gatherRate, maxCapacity: stats.maxCapacity };
    }
  }

  // Résoudre l'état du voyageur (lazy completion) + détection tour de guet + taverne
  // Effective level = building level + assigned staff (0 staff → building doesn't function)
  const tavern = ctx.completedBuildings.find((b) => b.buildingType === "taverne");
  const tavernLevel = tavern?.level ?? 0;
  const effectiveTavernLevel = computeEffectiveLevel(tavernLevel, ctx.villageInhabitants?.tavernkeeper ?? 0);
  const rawTravelerStatus = await resolveTraveler(ctx.village.id, effectiveTavernLevel);
  const watchtower = ctx.completedBuildings.find((b) => b.buildingType === "tour_de_guet");
  const towerLevel = watchtower?.level ?? 0;
  const effectiveTowerLevel = computeEffectiveLevel(towerLevel, ctx.villageInhabitants?.watchman ?? 0);
  const travelerStatus = await detectTraveler(ctx.village.id, rawTravelerStatus, effectiveTowerLevel);
  const isVillageFull = ctx.totalInhabitants >= ctx.village.capacity;

  const inhabitantTypesData = ctx.inhabitantTypes.map((t) => ({
    key: t.key,
    title: t.title,
    image: t.image,
  }));

  // Build inhabitant counts per type for the overview panel
  const inhabitantCounts: Record<string, number> = {};
  for (const type of INHABITANT_TYPES) {
    inhabitantCounts[type] = ctx.villageInhabitants?.[type] ?? 0;
  }

  // Compute per-job capacity info for the assign modal
  // Mayor is excluded entirely; building staff only shown if their building exists
  const jobCapacities: Record<string, { current: number; max: number | null; available: boolean }> = {};
  for (const type of INHABITANT_TYPES) {
    if (type === "mayor") continue;

    const current = ctx.villageInhabitants?.[type] ?? 0;
    const requiredBuilding = BUILDING_STAFF_TYPES[type];

    if (requiredBuilding) {
      const building = ctx.completedBuildings.find((b) => b.buildingType === requiredBuilding);
      if (!building) continue; // building not built → hide from modal
      jobCapacities[type] = { current, max: building.level, available: current < building.level };
    } else {
      jobCapacities[type] = { current, max: null, available: true };
    }
  }

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
          username={ctx.userData.username}
          userResources={ctx.userResources}
        />
        <ResourceBar
          villageName={ctx.village.name}
          villageResources={ctx.villageResources}
          storageCapacity={ctx.storageCapacity}
          population={ctx.totalInhabitants}
          maxPopulation={ctx.village.capacity}
          unoccupiedInhabitants={ctx.unoccupiedInhabitants}
          dailyConsumption={ctx.dailyConsumption}
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
          inhabitantCounts={inhabitantCounts}
          totalInhabitants={ctx.totalInhabitants}
          maxPopulation={ctx.village.capacity}
          jobCapacities={jobCapacities}
        />
      </div>
    </div>
  );
}
