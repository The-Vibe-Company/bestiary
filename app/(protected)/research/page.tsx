import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { ResearchPageClient } from "@/components/research/research-page-client";
import { loadVillageContext } from "@/lib/game/page/load-village-context";
import { getTechnologies } from "@/lib/game/research/get-technologies";
import { getVillageTechnologies } from "@/lib/game/research/get-village-technologies";
import Link from "next/link";
import { GiScrollUnfurled } from "react-icons/gi";

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const { focus } = await searchParams;
  const ctx = await loadVillageContext();

  const [technologies, villageTechnologies] = await Promise.all([
    getTechnologies(),
    getVillageTechnologies(ctx.village.id),
  ]);

  // Check if the player has a completed laboratory building and its level
  const laboratory = ctx.completedBuildings
    .filter((b) => b.buildingType === "laboratoire")
    .sort((a, b) => b.level - a.level)[0];
  const hasLaboratory = Boolean(laboratory);
  const labLevel = laboratory?.level ?? 0;

  // Calculate available researchers
  const totalResearchers = ctx.villageInhabitants?.researcher ?? 0;
  const busyResearchers = villageTechnologies
    .filter((vt) => vt.completedAt === null)
    .reduce((sum, vt) => sum + vt.assignedResearchers, 0);
  const availableResearchers = totalResearchers - busyResearchers;

  // Build technology data for the client
  const technologyData = technologies.map((tech) => {
    const villagetech = villageTechnologies.find(
      (vt) => vt.technologyKey === tech.key
    );
    const currentLevel = villagetech?.completedAt ? villagetech.level : 0;
    const isMaxLevel = currentLevel >= tech.maxLevel;
    const activeResearch =
      villagetech && !villagetech.completedAt
        ? {
            startedAt: villagetech.startedAt.toISOString(),
            researchSeconds: villagetech.researchSeconds,
            assignedResearchers: villagetech.assignedResearchers,
          }
        : null;

    // Next level costs scale by target level (same as buildings)
    const nextLevel = currentLevel + 1;

    return {
      key: tech.key,
      title: tech.title,
      description: tech.description,
      image: tech.image,
      costBois: tech.costBois * nextLevel,
      costPierre: tech.costPierre * nextLevel,
      costCereales: tech.costCereales * nextLevel,
      costViande: tech.costViande * nextLevel,
      researchSeconds: tech.researchSeconds * nextLevel,
      requiredLabLevel: tech.requiredLabLevel,
      maxLevel: tech.maxLevel,
      currentLevel,
      isMaxLevel,
      activeResearch,
      isLabLevelMet: labLevel >= tech.requiredLabLevel,
    };
  });

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
        {!hasLaboratory ? (
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
        ) : (
          <ResearchPageClient
            technologies={technologyData}
            villageResources={{
              bois: ctx.villageResources.bois,
              pierre: ctx.villageResources.pierre,
              cereales: ctx.villageResources.cereales,
              viande: ctx.villageResources.viande,
            }}
            availableResearchers={availableResearchers}
            focusKey={focus}
          />
        )}
      </div>
    </div>
  );
}
