import { cache } from 'react'
import { prisma } from '@/lib/prisma'

/**
 * Fetches all available technologies.
 * Deduplicated within a single request via React cache().
 */
export const getTechnologies = cache(async () => {
  return prisma.technology.findMany({
    orderBy: { order: 'asc' },
  })
})
