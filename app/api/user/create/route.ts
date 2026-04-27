import { NextResponse } from 'next/server'
import { neonAuth } from '@neondatabase/auth/next/server'
import { createUser } from '@/lib/game/user/create-user'
import { createUserSchema, firstZodError } from '@/lib/validation/schemas'

export async function POST(request: Request) {
  const { session } = await neonAuth()

  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstZodError(parsed) ?? 'Données invalides' },
      { status: 400 },
    )
  }

  try {
    const user = await createUser(session.userId, parsed.data.username, parsed.data.email)
    return NextResponse.json({ user })
  } catch (error) {
    console.error('Erreur création utilisateur:', error)
    return NextResponse.json({ error: 'Erreur création utilisateur' }, { status: 500 })
  }
}
