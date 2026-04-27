import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { memoryCache } from '@/lib/cache'
import type { Technology } from '@prisma/client'

const CACHE_KEY = 'technologies'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchTechnologies(): Promise<Technology[]> {
  const cached = memoryCache.get<Technology[]>(CACHE_KEY)
  if (cached) return cached

  const techs = await prisma.technology.findMany({
    orderBy: { order: 'asc' },
  })

  memoryCache.set(CACHE_KEY, techs, CACHE_TTL)
  return techs
}

/** Cached: request-level dedup (React cache) + cross-request TTL (memory cache). */
export const getTechnologies = cache(fetchTechnologies)
