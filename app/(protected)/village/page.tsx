import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { VillagePageClient } from "@/components/village/village-page-client";
import { loadVillageContext } from "@/lib/game/page/load-village-context";
import { getTechnologies } from "@/lib/game/research/get-technologies";
import { getVillageTechnologies } from "@/lib/game/research/get-village-technologies";

export default async function VillagePage() {
  const ctx = await loadVillageContext({ ensureVillage: true });

  const [allTechnologies, villageTechnologies] = await Promise.all([
    getTechnologies(),
    getVillageTechnologies(ctx.village.id),
  ]);

  // Calculate available builders (total - busy on active constructions)
  const totalBuilders = ctx.villageInhabitants?.builder ?? 0;
  const busyBuilders = ctx.villageBuildings
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

  const buildingStaffCounts: Record<string, number> = {
    laboratoire: ctx.villageInhabitants?.researcher ?? 0,
    tour_de_guet: ctx.villageInhabitants?.watchman ?? 0,
    taverne: ctx.villageInhabitants?.tavernkeeper ?? 0,
    hotel_de_ville: ctx.villageInhabitants?.mayor ?? 0,
    entrepot_bois: ctx.villageInhabitants?.splitter ?? 0,
    entrepot_pierre: ctx.villageInhabitants?.stonecutter ?? 0,
    entrepot_cereales: ctx.villageInhabitants?.victualer ?? 0,
    entrepot_viande: ctx.villageInhabitants?.butcher ?? 0,
  };

  // Group buildings by type once (avoids O(n*m) re-filtering inside .map below)
  const buildingsByType = new Map<string, typeof ctx.villageBuildings>();
  for (const vb of ctx.villageBuildings) {
    const list = buildingsByType.get(vb.buildingType);
    if (list) list.push(vb);
    else buildingsByType.set(vb.buildingType, [vb]);
  }

  // Aggregate building data per type
  const buildingTypeData = ctx.buildingTypes.map((bt) => {
    const buildings = buildingsByType.get(bt.key) ?? [];
    let completedCount = 0;
    let currentLevel = 0;
    const activeConstructions: { startedAt: string; buildSeconds: number; assignedBuilders: number }[] = [];
    for (const vb of buildings) {
      if (vb.completedAt !== null) {
        completedCount++;
        if (vb.level > currentLevel) currentLevel = vb.level;
      } else {
        activeConstructions.push({
          startedAt: vb.startedAt.toISOString(),
          buildSeconds: vb.buildSeconds,
          assignedBuilders: vb.assignedBuilders,
        });
      }
    }

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

      {/* Main content area */}
      <div className="flex-1 min-h-0 flex items-start justify-center py-6 relative z-10">
        <VillagePageClient
          buildingTypes={buildingTypeData}
          villageResources={{
            bois: ctx.villageResources.bois,
            pierre: ctx.villageResources.pierre,
            cereales: ctx.villageResources.cereales,
            viande: ctx.villageResources.viande,
          }}
          storageCapacity={ctx.storageCapacity}
          availableBuilders={availableBuilders}
        />
      </div>
    </div>
  );
}
