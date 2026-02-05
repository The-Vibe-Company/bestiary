import { prisma } from '@/lib/prisma'

export interface Village {
  id: string
  name: string | null
  x: number
  y: number
}

export async function getVillage(userId: string): Promise<Village | null> {
  const village = await prisma.village.findUnique({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      x: true,
      y: true,
    }
  })

  return village
}
