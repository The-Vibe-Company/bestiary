import { neonAuth } from '@neondatabase/auth/next/server'
import { redirect } from 'next/navigation'
import { ResourceBar } from '@/components/layout/resource-bar'
import { getUserResources } from '@/lib/game/resources/get-user-resources'
import { getVillageInhabitants } from '@/lib/game/inhabitants/get-village-inhabitants'
import {
  INHABITANT_TYPES,
  INHABITANT_METADATA,
  InhabitantType,
} from '@/lib/game/inhabitants/types'
import { HabitantsPanel } from '@/components/habitants/habitants-panel'
import Image from 'next/image'

export default async function HabitantsPage() {
  const { session } = await neonAuth()

  if (!session) {
    redirect('/sign-in')
  }

  const [resources, villageInhabitants] = await Promise.all([
    getUserResources(session.userId),
    getVillageInhabitants(session.userId),
  ])

  // Build ordered list for display using the defined order
  const inhabitantsList = INHABITANT_TYPES.map((type: InhabitantType) => ({
    ...INHABITANT_METADATA[type],
    id: type,
    count: villageInhabitants?.[type] ?? 0,
  }))

  return (
    <div
      className="h-full min-h-0 flex flex-col bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: "url('/assets/backgrounds/background-habitants.png')" }}
    >
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/50" />

      {/* ResourceBar sticky at top */}
      <div className="flex-shrink-0 relative z-10">
        <ResourceBar resources={resources} />
      </div>

      {/* Main content area - panel stays fixed, content scrolls inside */}
      <div className="flex-1 overflow-hidden flex justify-center items-center relative z-10">
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
