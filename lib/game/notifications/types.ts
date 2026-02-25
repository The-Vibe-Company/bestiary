/** All known notification event types. */
export const NOTIFICATION_TYPES = {
  STARVATION: 'starvation',
  TRAVELER_DETECTED: 'traveler_detected',
  MISSION_COMPLETED: 'mission_completed',
  BUILDING_COMPLETED: 'building_completed',
  RESEARCH_COMPLETED: 'research_completed',
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

export interface MissionCompletedData {
  inhabitantType: string
  resourceGathered: number
  resourceType: string
}

export interface BuildingCompletedData {
  buildingType: string
  buildingTitle: string
  level: number
}

export interface ResearchCompletedData {
  technologyKey: string
  technologyTitle: string
  level: number
}
