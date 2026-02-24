import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { memoryCache } from '@/lib/cache'
import type { BuildingType } from '@prisma/client'

const CACHE_KEY = 'building-types'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchBuildingTypes(): Promise<BuildingType[]> {
  const cached = memoryCache.get<BuildingType[]>(CACHE_KEY)
  if (cached) return cached

  const types = await prisma.buildingType.findMany({
    orderBy: { order: 'asc' },
  })

  memoryCache.set(CACHE_KEY, types, CACHE_TTL)
  return types
}

/** Cached: request-level dedup (React cache) + cross-request TTL (memory cache). */
export const getBuildingTypes = cache(fetchBuildingTypes)
