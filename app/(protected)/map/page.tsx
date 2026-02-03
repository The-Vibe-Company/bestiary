import { generateWorldMap } from '@/lib/game/map/generator'
import { MapPageClient } from '@/components/game/map-page-client'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function MapPage() {
  const session = await getSession()

  if (!session) {
    redirect('/sign-in')
  }

  const worldMap = generateWorldMap()

  return <MapPageClient map={worldMap} />
}
