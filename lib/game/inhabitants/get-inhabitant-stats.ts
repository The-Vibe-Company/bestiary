import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { memoryCache } from '@/lib/cache'

export interface InhabitantStats {
  speed: number
  gatherRate: number
  maxCapacity: number
}

const CACHE_KEY = 'inhabitant-stats'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchInhabitantStats(): Promise<Record<string, InhabitantStats>> {
  const cached = memoryCache.get<Record<string, InhabitantStats>>(CACHE_KEY)
  if (cached) return cached

  const multiplier = process.env.DEV_STAT_MULTIPLIER
    ? parseFloat(process.env.DEV_STAT_MULTIPLIER)
    : 1

  const types = await prisma.inhabitantType.findMany()
  const map: Record<string, InhabitantStats> = {}
  for (const t of types) {
    map[t.key] = {
      speed: t.speed * multiplier,
      gatherRate: t.gatherRate * multiplier,
      maxCapacity: t.maxCapacity * multiplier,
    }
  }

  memoryCache.set(CACHE_KEY, map, CACHE_TTL)
  return map
}

/** Cached: request-level dedup (React cache) + cross-request TTL (memory cache). */
export const getInhabitantStats = cache(fetchInhabitantStats)
