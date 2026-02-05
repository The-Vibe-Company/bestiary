import { NextResponse } from 'next/server'
import { neonAuth } from '@neondatabase/auth/next/server'
import { createUser } from '@/lib/game/user/create-user'

export async function POST(request: Request) {
  const { session } = await neonAuth()

  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { username, email } = await request.json()

  if (!username || !email) {
    return NextResponse.json({ error: 'Username et email requis' }, { status: 400 })
  }

  try {
    const user = await createUser(session.userId, username, email)
    return NextResponse.json({ user })
  } catch (error) {
    console.error('Erreur création utilisateur:', error)
    return NextResponse.json({ error: 'Erreur création utilisateur' }, { status: 500 })
  }
}
