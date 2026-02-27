import type { TravelerStatus } from './resolve-traveler'

/**
 * Detection window (in seconds) by effective watchtower level.
 *
 * Effective level = building level + assigned watchmen (0 watchmen → level 0).
 * - Level 0: no detection — travelers appear only when present
 * - Level 1: detects 5 minutes before arrival
 * - Level 2: detects 10 minutes before arrival
 * - Level 3: detects 15 minutes before arrival
 * - Level 4: detects 20 minutes before arrival
 * - Level 5: detects 25 minutes before arrival
 * - Level 6: detects 30 minutes before arrival (covers max arrival delay)
 */
export const DETECTION_WINDOW_SECONDS: Record<number, number> = {
  0: 0,
  1: 5 * 60,
  2: 10 * 60,
  3: 15 * 60,
  4: 20 * 60,
  5: 25 * 60,
  6: 30 * 60,
}

export type DetectedTravelerStatus =
  | { status: 'hidden' }
  | { status: 'detected'; arrivesAt: Date }
  | { status: 'present'; departsAt: Date; isWelcomed: boolean }

/**
 * Applies watchtower detection logic on top of the raw traveler status.
 *
 * - Without tower: 'waiting' → 'hidden' (player doesn't know a traveler is coming)
 * - With tower: 'waiting' → 'detected' only if arrival is within the detection window
 * - 'present' always passes through unchanged
 */
export function applyDetection(
  raw: TravelerStatus,
  towerLevel: number,
): DetectedTravelerStatus {
  if (raw.status === 'present') {
    return raw
  }

  const windowSeconds = DETECTION_WINDOW_SECONDS[towerLevel] ?? 0
  if (windowSeconds <= 0) {
    return { status: 'hidden' }
  }

  const now = new Date()
  const timeUntilArrivalMs = raw.arrivesAt.getTime() - now.getTime()

  if (timeUntilArrivalMs <= windowSeconds * 1000) {
    return { status: 'detected', arrivesAt: raw.arrivesAt }
  }

  return { status: 'hidden' }
}
