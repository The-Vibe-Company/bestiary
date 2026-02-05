import { HabitantsPanel } from '@/components/habitants/habitants-panel'
import { UserResourceBar } from '@/components/layout/user-resource-bar'
import { ResourceBar } from '@/components/layout/resource-bar'
import { getInhabitantTypes } from '@/lib/game/inhabitants/get-inhabitant-types'
import { getVillageInhabitants } from '@/lib/game/inhabitants/get-village-inhabitants'
import type { InhabitantType } from '@/lib/game/inhabitants/types'
import { getVillageResources } from '@/lib/game/resources/get-village-resources'
import { getUserResources } from '@/lib/game/resources/get-user-resources'
import { getVillage } from '@/lib/game/village/get-village'
import { getUser } from '@/lib/game/user/get-user'
import { neonAuth } from '@neondatabase/auth/next/server'
import Image from 'next/image'
import { redirect } from 'next/navigation'

export default async function HabitantsPage() {
  const { session } = await neonAuth()

  if (!session) {
    redirect('/sign-in')
  }

  const [villageResources, village, userResources, userData, villageInhabitants, inhabitantTypes] = await Promise.all([
    getVillageResources(session.userId),
    getVillage(session.userId),
    getUserResources(session.userId),
    getUser(session.userId),
    getVillageInhabitants(session.userId),
    getInhabitantTypes(),
  ])

  if (!villageResources || !userData) {
    redirect('/sign-in')
  }

  // Build ordered list for display using DB metadata
  const inhabitantsList = inhabitantTypes.map((type) => ({
    ...type,
    id: type.key,
    count: villageInhabitants?.[type.key as InhabitantType] ?? 0,
  }))

  return (
    <div
      className="h-full flex flex-col bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: "url('/assets/backgrounds/background-habitants.png')" }}
    >
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Resource bars container */}
      <div className="flex-shrink-0 relative z-10 flex justify-center gap-2 mt-4">
        <UserResourceBar username={userData.username} userResources={userResources} />
        <ResourceBar villageName={village?.name ?? null} villageResources={villageResources} />
      </div>

      {/* Main content area - panel fills available space */}
      <div className="flex-1 min-h-0 flex justify-center py-6 relative z-10">
        {/* Scrollable panel */}
        <HabitantsPanel>
          {inhabitantsList.map((habitant) => (
            <div
              key={habitant.id}
              className="flex items-center gap-6 p-6 hover:bg-white/5 transition-colors cursor-pointer"
            >
              {/* Large image on the left */}
              <div className="relative w-[180px] h-[180px] flex-shrink-0 rounded-xl overflow-hidden border-2 border-[var(--burnt-amber)]">
                <Image
                  src={habitant.image}
                  alt={habitant.title}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Content in the middle */}
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold font-[family-name:var(--font-title)] tracking-wider text-[var(--ivory)] mb-3">
                  {habitant.title}
                </h2>
                <p className="text-base text-[var(--ivory)]/70 leading-relaxed">
                  {habitant.description}
                </p>
              </div>

              {/* Count box on the right */}
              <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center bg-black/50 border-2 border-[var(--burnt-amber)] rounded-xl">
                <span className="text-4xl font-bold text-[var(--burnt-amber)]">
                  {habitant.count}
                </span>
              </div>
            </div>
          ))}
        </HabitantsPanel>
      </div>
    </div>
  )
}
