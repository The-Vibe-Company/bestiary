import { ResourceBar } from "@/components/layout/resource-bar";
import { UserResourceBar } from "@/components/layout/user-resource-bar";
import { getVillageInhabitants } from "@/lib/game/inhabitants/get-village-inhabitants";
import { INHABITANT_TYPES } from "@/lib/game/inhabitants/types";
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

  const totalInhabitants = villageInhabitants
    ? INHABITANT_TYPES.reduce((sum, type) => sum + villageInhabitants[type], 0)
    : 0;

  return (
    <div
      className="h-full flex flex-col bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "url('/assets/backgrounds/background-bestiary.png')",
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
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center relative z-10">
      </div>
    </div>
  );
}
