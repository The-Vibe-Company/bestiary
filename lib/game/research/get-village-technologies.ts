import { cache } from 'react'
import { prisma } from '@/lib/prisma'

/**
 * Fetches all technology research records for a village.
 * Includes both in-progress and completed research.
 */
export const getVillageTechnologies = cache(async (villageId: string) => {
  return prisma.villageTechnology.findMany({
    where: { villageId },
  })
})
