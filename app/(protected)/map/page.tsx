import { generateWorldMap } from '@/lib/game/map/generator'
import { MapPageClient } from '@/components/game/map-page-client'
import { neonAuth } from '@neondatabase/auth/next/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ResourceBar } from '@/components/layout/resource-bar'
import { getUserResources } from '@/lib/game/resources/get-user-resources'

export default async function MapPage() {
  const { session } = await neonAuth()

  if (!session) {
    redirect('/sign-in')
  }

  const worldMap = generateWorldMap()

  // Récupérer le village du joueur
  const userVillage = await prisma.village.findUnique({
    where: { ownerId: session.userId }
  })

  // Récupérer tous les villages pour les afficher sur la map
  const allVillages = await prisma.village.findMany({
    select: { x: true, y: true, ownerId: true }
  })

  const resources = await getUserResources(session.userId)

  return (
    <div className="relative">
      <div className="absolute top-0 left-0 right-0 z-50">
        <ResourceBar resources={resources} />
      </div>
      <MapPageClient
        map={worldMap}
        villages={allVillages}
        initialX={userVillage?.x ?? 50}
        initialY={userVillage?.y ?? 50}
        currentUserId={session.userId}
      />
    </div>
  )
}
