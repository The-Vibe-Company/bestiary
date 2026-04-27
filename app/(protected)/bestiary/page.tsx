import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { loadVillageContext } from "@/lib/game/page/load-village-context";

export default async function BestiaryPage() {
  const ctx = await loadVillageContext({ completeResearch: false });

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
      <div className="flex-1 flex items-center justify-center relative z-10">
      </div>
    </div>
  );
}
