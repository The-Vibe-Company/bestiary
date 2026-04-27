import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { memoryCache } from '@/lib/cache'

const POSITIONS_KEY = 'all-village-positions'
const VILLAGES_KEY = 'all-villages'
// 60s — new villages can wait one minute to appear on the world map.
const TTL = 60 * 1000

export interface VillagePosition {
  x: number
  y: number
}

export interface VillageWithOwner {
  x: number
  y: number
  ownerId: string
  name: string | null
  owner: { username: string }
}

/**
 * Cached: lightweight (x, y) positions for all villages.
 * Used by mini-maps to mark occupied tiles. Cached 60s.
 */
export const getAllVillagePositions = cache(async (): Promise<VillagePosition[]> => {
  const cached = memoryCache.get<VillagePosition[]>(POSITIONS_KEY)
  if (cached) return cached

  const positions = await prisma.village.findMany({
    select: { x: true, y: true },
  })

  memoryCache.set(POSITIONS_KEY, positions, TTL)
  return positions
})

/**
 * Cached: full village list (with owner username) for the world map.
 * Cached 60s — sufficient freshness for occupancy display.
 */
export const getAllVillagesWithOwner = cache(async (): Promise<VillageWithOwner[]> => {
  const cached = memoryCache.get<VillageWithOwner[]>(VILLAGES_KEY)
  if (cached) return cached

  const villages = await prisma.village.findMany({
    select: {
      x: true,
      y: true,
      ownerId: true,
      name: true,
      owner: { select: { username: true } },
    },
  })

  memoryCache.set(VILLAGES_KEY, villages, TTL)
  return villages
})

/** Invalidate both caches — call after creating/deleting a village. */
export function invalidateVillageListCache(): void {
  memoryCache.invalidate(POSITIONS_KEY)
  memoryCache.invalidate(VILLAGES_KEY)
}
