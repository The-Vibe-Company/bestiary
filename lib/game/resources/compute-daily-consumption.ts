import type { InhabitantType as PrismaInhabitantType } from '@prisma/client'
import { INHABITANT_TYPES } from '@/lib/game/inhabitants/types'
import type { VillageInhabitants } from '@/lib/game/inhabitants/types'

export interface DailyConsumption {
  cereales: number
  viande: number
}

/**
 * Computes the total daily food consumption for all village inhabitants.
 * Pure function — no DB calls.
 */
export function computeDailyConsumption(
  villageInhabitants: VillageInhabitants | null,
  inhabitantTypes: PrismaInhabitantType[],
): DailyConsumption {
  if (!villageInhabitants) {
    return { cereales: 0, viande: 0 }
  }

  const typeMap = new Map(inhabitantTypes.map((t) => [t.key, t]))

  let cereales = 0
  let viande = 0

  for (const key of INHABITANT_TYPES) {
    const count = villageInhabitants[key] ?? 0
    const typeData = typeMap.get(key)
    if (!typeData || count === 0) continue

    cereales += count * typeData.consumeCereales
    viande += count * typeData.consumeViande
  }

  return {
    cereales: Math.round(cereales * 10) / 10,
    viande: Math.round(viande * 10) / 10,
  }
}
