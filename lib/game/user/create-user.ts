import { prisma } from '@/lib/prisma'

export async function createUser(userId: string, username: string, email: string) {
  return prisma.user.create({
    data: {
      id: userId,
      email,
      username,
    },
  })
}
