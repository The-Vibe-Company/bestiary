import type { ItemRarity } from './types'
import { RARITY_THRESHOLDS } from './types'

/** Roll a single item rarity based on probability thresholds */
function rollRarity(): ItemRarity {
  const roll = Math.random()
  for (const { rarity, cumulative } of RARITY_THRESHOLDS) {
    if (roll < cumulative) return rarity
  }
  return 'commun'
}

/** Base interval range in seconds */
const BASE_MIN_INTERVAL = 600   // 10 minutes
const BASE_MAX_INTERVAL = 2400  // 40 minutes

/** Each discovery stretches future intervals by this factor */
const INTERVAL_GROWTH = 0.6

/**
 * Simulate item discoveries during an exploration mission.
 *
 * Discoveries happen at random intervals that grow over time (terrain depletion).
 * More workers accelerate the shared discovery timer.
 *
 * ~1-2 items in 1h, ~3-4 in 4h, ~6-7 in 8h (1 explorer).
 */
export function rollDiscoveredItems(workSeconds: number, workerCount: number = 1): ItemRarity[] {
  if (workSeconds <= 0) return []

  const items: ItemRarity[] = []
  let elapsed = 0
  let discoveryCount = 0

  // More workers = shorter intervals (shared timer, accelerated)
  const workerFactor = 1 + (workerCount - 1) * 0.5

  while (elapsed < workSeconds) {
    const scale = 1 + discoveryCount * INTERVAL_GROWTH
    const minInterval = (BASE_MIN_INTERVAL * scale) / workerFactor
    const maxInterval = (BASE_MAX_INTERVAL * scale) / workerFactor
    const interval = minInterval + Math.random() * (maxInterval - minInterval)

    elapsed += interval
    if (elapsed > workSeconds) break

    items.push(rollRarity())
    discoveryCount++
  }

  return items
}
