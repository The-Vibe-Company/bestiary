/**
 * Procedural daily density for prairie tiles.
 *
 * Each prairie cell gets a deterministic density multiplier that changes daily.
 * The seed is based on: day of the year (UTC) + year + tile coordinates + type.
 * Returns a value between 0.3 (scarce) and 1.5 (abundant).
 *
 * No database, no cron — purely procedural like the map generator.
 */

type DensityType = 'gathering' | 'hunting'

/** Simple deterministic hash (same algorithm as many procedural generators). */
function hashSeed(seed: number): number {
  let h = seed | 0
  h = ((h >> 16) ^ h) * 0x45d9f3b
  h = ((h >> 16) ^ h) * 0x45d9f3b
  h = (h >> 16) ^ h
  return h
}

/** Map a hash to a float in [0, 1). */
function hashToFloat(seed: number): number {
  return (Math.abs(hashSeed(seed)) % 10000) / 10000
}

/**
 * Compute the density multiplier for a prairie tile on a given date.
 *
 * @param x       tile X coordinate
 * @param y       tile Y coordinate
 * @param date    reference date (typically mission.departedAt)
 * @param type    'gathering' (cereales) or 'hunting' (viande)
 * @returns       multiplier between 0.3 and 1.5
 */
export function computeTileDensity(
  x: number,
  y: number,
  date: Date,
  type: DensityType,
): number {
  const utcYear = date.getUTCFullYear()
  // Day of year: 0-based
  const startOfYear = Date.UTC(utcYear, 0, 1)
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / (24 * 60 * 60 * 1000))

  const typeSalt = type === 'hunting' ? 7919 : 6271

  // Combine all factors into a single seed
  const seed = (x * 73856093) ^ (y * 19349669) ^ (dayOfYear * 83492791) ^ (utcYear * 4256249) ^ typeSalt

  const t = hashToFloat(seed) // [0, 1)

  // Map to [0.3, 1.5]
  const MIN_DENSITY = 0.3
  const MAX_DENSITY = 1.5
  return MIN_DENSITY + t * (MAX_DENSITY - MIN_DENSITY)
}
