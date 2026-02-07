/**
 * Chebyshev distance (consistent with assign-village.ts).
 * Returns one-way travel time in seconds.
 */
export function chebyshevDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))
}

export function computeTravelSeconds(distance: number, speed: number): number {
  if (speed <= 0) return Infinity
  return Math.ceil((distance / speed) * 3600)
}
