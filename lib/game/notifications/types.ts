/** All known notification event types. */
export const NOTIFICATION_TYPES = {
  STARVATION: 'starvation',
} as const

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

/** Type-specific metadata payloads. */
export interface StarvationData {
  totalDeaths: number
  totalPopulationBefore: number
  totalPopulationAfter: number
}
