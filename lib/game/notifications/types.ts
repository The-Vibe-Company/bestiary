/** All known notification event types. */
export const NOTIFICATION_TYPES = {
  STARVATION: 'starvation',
  TRAVELER_DETECTED: 'traveler_detected',
} as const

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

/** Type-specific metadata payloads. */
export interface StarvationData {
  totalDeaths: number
  totalPopulationBefore: number
  totalPopulationAfter: number
}

export interface TravelerDetectedData {
  arrivesAt: string // ISO date string
  towerLevel: number
}
