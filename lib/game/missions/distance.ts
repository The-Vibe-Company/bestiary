/**
 * Manhattan distance — diagonal costs 2, cardinal costs 1.
 */
export function manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1)
}

export function computeTravelSeconds(distance: number, speed: number): number {
  if (speed <= 0) return Infinity
  return Math.ceil((distance / speed) * 3600)
}
