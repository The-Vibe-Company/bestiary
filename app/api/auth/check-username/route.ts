import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')

  if (!username) {
    return Response.json({ error: 'Username required' }, { status: 400 })
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: { username },
    })

    return Response.json({ exists: !!existingUser })
  } catch (error) {
    console.error('Error checking username:', error)
    return Response.json({ error: 'Failed to check username' }, { status: 500 })
  }
}
