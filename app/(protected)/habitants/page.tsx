import { HabitantsPageClient } from "@/components/habitants/habitants-page-client";
import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { getInhabitantStats } from "@/lib/game/inhabitants/get-inhabitant-stats";
import { getInhabitantTypes } from "@/lib/game/inhabitants/get-inhabitant-types";
import { getVillageInhabitants } from "@/lib/game/inhabitants/get-village-inhabitants";
import type { InhabitantType } from "@/lib/game/inhabitants/types";
import { generateWorldMap } from "@/lib/game/map/generator";
import { completePendingMissions } from "@/lib/game/missions/complete-missions";
import { getUserResources } from "@/lib/game/resources/get-user-resources";
import { getVillageResources } from "@/lib/game/resources/get-village-resources";
import { getUser } from "@/lib/game/user/get-user";
import { getVillage } from "@/lib/game/village/get-village";
import { prisma } from "@/lib/prisma";
import { neonAuth } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";

export default async function HabitantsPage() {
  const { session } = await neonAuth();

  if (!session) {
    redirect("/sign-in");
  }

  const [
    villageResources,
    village,
    userResources,
    userData,
    villageInhabitants,
    inhabitantTypes,
    inhabitantStats,
  ] = await Promise.all([
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

  // Complete any finished missions (lazy pattern)
  await completePendingMissions(village.id);

  // Compute available lumberjacks
  const totalLumberjacks = villageInhabitants?.lumberjack ?? 0;
  const activeLumberjackMissions = await prisma.mission.count({
    where: {
      villageId: village.id,
      inhabitantType: 'lumberjack',
      completedAt: null,
    },
  });
  const availableLumberjacks = totalLumberjacks - activeLumberjackMissions;

  const lumberjackStats = inhabitantStats['lumberjack'] ?? { speed: 2, gatherRate: 10, maxCapacity: 30 };

  // Build ordered list for display using DB metadata
  const inhabitantsList = inhabitantTypes.map((type) => ({
    ...type,
    id: type.key,
    count: villageInhabitants?.[type.key as InhabitantType] ?? 0,
  }));

  const worldMap = generateWorldMap();

  return (
    <div
      className="h-full flex flex-col bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "url('/assets/backgrounds/background-habitants.png')",
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
        />
      </div>

      {/* Main content area - panel fills available space */}
      <div className="flex-1 min-h-0 flex justify-center py-6 relative z-10">
        <HabitantsPageClient
          inhabitantsList={inhabitantsList}
          map={worldMap}
          villageX={village.x}
          villageY={village.y}
          availableLumberjacks={availableLumberjacks}
          lumberjackStats={lumberjackStats}
        />
      </div>
    </div>
  );
}
