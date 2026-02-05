import { prisma } from '@/lib/prisma'

export interface User {
  id: string
  username: string
  email: string
}

export async function getUser(userId: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
    }
  })

  return user
}
