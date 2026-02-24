import { cache } from 'react'
import { prisma } from '@/lib/prisma'

export interface Village {
  id: string
  name: string | null
  x: number
  y: number
  capacity: number
}

/** Cached per-request: deduplicates layout + page calls for the same userId. */
export const getVillage = cache(async (userId: string): Promise<Village | null> => {
  const village = await prisma.village.findUnique({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      x: true,
      y: true,
      capacity: true,
    }
  })

  return village
})
