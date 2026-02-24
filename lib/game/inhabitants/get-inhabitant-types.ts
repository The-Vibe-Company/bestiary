import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { memoryCache } from '@/lib/cache'
import type { InhabitantType } from '@prisma/client'

const CACHE_KEY = 'inhabitant-types'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchInhabitantTypes(): Promise<InhabitantType[]> {
  const cached = memoryCache.get<InhabitantType[]>(CACHE_KEY)
  if (cached) return cached

  const types = await prisma.inhabitantType.findMany({
    orderBy: { order: 'asc' },
  })

  memoryCache.set(CACHE_KEY, types, CACHE_TTL)
  return types
}

/** Cached: request-level dedup (React cache) + cross-request TTL (memory cache). */
export const getInhabitantTypes = cache(fetchInhabitantTypes)
