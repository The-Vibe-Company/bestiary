import { NextResponse } from 'next/server'
import { neonAuth } from '@neondatabase/auth/next/server'
import { assignVillageToUser } from '@/lib/game/village/assign-village'

export async function POST() {
  const { session } = await neonAuth()

  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    const village = await assignVillageToUser(session.userId)
    return NextResponse.json({ village })
  } catch (error) {
    console.error('Erreur création village:', error)
    return NextResponse.json({ error: 'Erreur création village' }, { status: 500 })
  }
}
