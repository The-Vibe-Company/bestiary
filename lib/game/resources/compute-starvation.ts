import type { InhabitantType as PrismaInhabitantType } from '@prisma/client'
import { INHABITANT_TYPES } from '@/lib/game/inhabitants/types'
import type { VillageInhabitants } from '@/lib/game/inhabitants/types'

export interface StarvationResult {
  starvation: boolean
  survivingInhabitants: Record<string, number>
  totalDeaths: number
  consumedCereales: number
  consumedViande: number
}

/**
 * Fisher-Yates shuffle (in-place).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Computes starvation effects for a single day.
 * Pure function (no DB calls).
 *
 * If the village has enough cereales AND viande for the day,
 * no starvation occurs and normal consumption is returned.
 * Otherwise, computes how many can survive based on the most
 * deficient resource, then randomly selects which inhabitants die.
 */
export function computeStarvation(
  villageInhabitants: VillageInhabitants | null,
  inhabitantTypes: PrismaInhabitantType[],
  availableCereales: number,
  availableViande: number,
): StarvationResult {
  if (!villageInhabitants) {
    return {
      starvation: false,
      survivingInhabitants: Object.fromEntries(
        INHABITANT_TYPES.map((k) => [k, 0]),
      ),
      totalDeaths: 0,
      consumedCereales: 0,
      consumedViande: 0,
    }
  }

  const typeMap = new Map(inhabitantTypes.map((t) => [t.key, t]))

  // Compute needed consumption for full population
  let neededCereales = 0
  let neededViande = 0
  let totalPop = 0

  for (const key of INHABITANT_TYPES) {
    const count = villageInhabitants[key] ?? 0
    const typeData = typeMap.get(key)
    if (!typeData || count === 0) continue
    totalPop += count
    neededCereales += count * typeData.consumeCereales
    neededViande += count * typeData.consumeViande
  }

  // No population = no consumption, no starvation
  if (totalPop === 0 || (neededCereales === 0 && neededViande === 0)) {
    return {
      starvation: false,
      survivingInhabitants: Object.fromEntries(
        INHABITANT_TYPES.map((k) => [k, villageInhabitants[k] ?? 0]),
      ),
      totalDeaths: 0,
      consumedCereales: 0,
      consumedViande: 0,
    }
  }

  // Can we feed everyone?
  const cerealesRatio =
    neededCereales > 0 ? availableCereales / neededCereales : Infinity
  const viandeRatio =
    neededViande > 0 ? availableViande / neededViande : Infinity
  const survivalRatio = Math.min(cerealesRatio, viandeRatio, 1)

  if (survivalRatio >= 1) {
    // No starvation — normal deduction
    return {
      starvation: false,
      survivingInhabitants: Object.fromEntries(
        INHABITANT_TYPES.map((k) => [k, villageInhabitants[k] ?? 0]),
      ),
      totalDeaths: 0,
      consumedCereales: neededCereales,
      consumedViande: neededViande,
    }
  }

  // Starvation: determine how many survive
  const totalSurvivors = Math.floor(totalPop * survivalRatio)
  const totalDeaths = totalPop - totalSurvivors

  // Build a pool of all inhabitants by type, then shuffle to pick random deaths
  const pool: string[] = []
  for (const key of INHABITANT_TYPES) {
    const count = villageInhabitants[key] ?? 0
    for (let i = 0; i < count; i++) {
      pool.push(key)
    }
  }

  shuffle(pool)

  // The first `totalDeaths` in the shuffled pool die
  // Count survivors from the remaining entries
  const survivingInhabitants: Record<string, number> = Object.fromEntries(
    INHABITANT_TYPES.map((k) => [k, 0]),
  )

  for (let i = totalDeaths; i < pool.length; i++) {
    survivingInhabitants[pool[i]]++
  }

  // Recompute consumption for survivors only
  let survivorCereales = 0
  let survivorViande = 0

  for (const key of INHABITANT_TYPES) {
    const count = survivingInhabitants[key]
    const typeData = typeMap.get(key)
    if (!typeData || count === 0) continue
    survivorCereales += count * typeData.consumeCereales
    survivorViande += count * typeData.consumeViande
  }

  return {
    starvation: true,
    survivingInhabitants,
    totalDeaths,
    consumedCereales: survivorCereales,
    consumedViande: survivorViande,
  }
}
