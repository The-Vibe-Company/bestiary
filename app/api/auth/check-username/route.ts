import { prisma } from '@/lib/prisma'
import { checkUsernameSchema, firstZodError } from '@/lib/validation/schemas'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = checkUsernameSchema.safeParse({ username: searchParams.get('username') })

  if (!parsed.success) {
    return Response.json(
      { error: firstZodError(parsed) ?? 'Paramètre username invalide' },
      { status: 400 },
    )
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: { username: parsed.data.username },
    })

    return Response.json({ exists: !!existingUser })
  } catch (error) {
    console.error('Error checking username:', error)
    return Response.json({ error: 'Failed to check username' }, { status: 500 })
  }
}
