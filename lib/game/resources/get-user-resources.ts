import { prisma } from '@/lib/prisma'
import { UserResources } from './types'

export async function getUserResources(userId: string): Promise<UserResources> {
  const existing = await prisma.userResources.findUnique({
    where: { userId }
  })

  if (existing) return existing

  return prisma.userResources.create({
    data: { userId }
  })
}
