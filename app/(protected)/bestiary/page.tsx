import { neonAuth } from '@neondatabase/auth/next/server'
import { redirect } from 'next/navigation'
import { ResourceBar } from '@/components/layout/resource-bar'
import { getUserResources } from '@/lib/game/resources/get-user-resources'

export default async function BestiaryPage() {
  const { session } = await neonAuth()

  if (!session) {
    redirect('/sign-in')
  }

  const resources = await getUserResources(session.userId)

  return (
    <div className="relative min-h-screen bg-white">
      <div className="absolute top-0 left-0 right-0 z-50">
        <ResourceBar resources={resources} />
      </div>
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-4xl font-bold text-gray-400">TO BUILD</span>
      </div>
    </div>
  )
}
