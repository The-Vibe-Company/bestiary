import { assignVillageToUser } from '@/lib/game/village/assign-village'
import { neonAuth } from '@neondatabase/auth/next/server'
import { redirect } from 'next/navigation'
import { ResourceBar } from '@/components/layout/resource-bar'
import { getUserResources } from '@/lib/game/resources/get-user-resources'

export default async function VillagePage() {
  const { session, user } = await neonAuth()

  if (!session || !user) {
    redirect('/sign-in')
  }

  // S'assurer que l'utilisateur a un village (créé au signup ou ici en fallback)
  await assignVillageToUser(session.userId)

  const resources = await getUserResources(session.userId)

  return (
    <div
      className="h-full flex flex-col bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: "url('/assets/backgrounds/background-village.png')" }}
    >
      {/* Dark overlay for better contrast - same as map page */}
      <div className="absolute inset-0 bg-black/50" />

      {/* ResourceBar sticky at top */}
      <div className="flex-shrink-0 relative z-10">
        <ResourceBar resources={resources} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center relative z-10">
        <span className="text-4xl font-bold text-[var(--ivory)]/40">TO BUILD</span>
      </div>
    </div>
  )
}
