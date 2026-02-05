import { neonAuth } from '@neondatabase/auth/next/server'
import { redirect } from 'next/navigation'
import { UserResourceBar } from '@/components/layout/user-resource-bar'
import { ResourceBar } from '@/components/layout/resource-bar'
import { getVillageResources } from '@/lib/game/resources/get-village-resources'
import { getUserResources } from '@/lib/game/resources/get-user-resources'
import { getVillage } from '@/lib/game/village/get-village'
import { getUser } from '@/lib/game/user/get-user'

export default async function BestiaryPage() {
  const { session } = await neonAuth()

  if (!session) {
    redirect('/sign-in')
  }

  const [villageResources, village, userResources, userData] = await Promise.all([
    getVillageResources(session.userId),
    getVillage(session.userId),
    getUserResources(session.userId),
    getUser(session.userId),
  ])

  if (!villageResources || !userData) {
    redirect('/sign-in')
  }

  return (
    <div className="relative min-h-screen bg-white">
      <div className="absolute top-0 left-0 right-0 z-50 flex justify-center gap-2 mt-4">
        <UserResourceBar username={userData.username} userResources={userResources} />
        <ResourceBar villageName={village?.name ?? null} villageResources={villageResources} />
      </div>
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-4xl font-bold text-gray-400">TO BUILD</span>
      </div>
    </div>
  )
}
