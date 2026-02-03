import { generateWorldMap } from '@/lib/game/map/generator'
import { MapPageClient } from '@/components/game/map-page-client'
import { neonAuth } from '@neondatabase/auth/next/server'
import { redirect } from 'next/navigation'

export default async function MapPage() {
  const { session } = await neonAuth()

  if (!session) {
    redirect('/sign-in')
  }

  const worldMap = generateWorldMap()

  return <MapPageClient map={worldMap} />
}
