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
    <div className="relative min-h-screen bg-white">
      <div className="absolute top-0 left-0 right-0 z-50">
        <ResourceBar resources={resources} />
      </div>
    </div>
  )
}
