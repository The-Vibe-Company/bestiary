export interface MissionTypeConfig {
  feature: string
  resource: string
  featureLabel: string
  resourceLabel: string
  workerLabel: string
  workerLabelPlural: string
  emoji: string
}

export const MISSION_CONFIG: Record<string, MissionTypeConfig> = {
  lumberjack: {
    feature: 'foret',
    resource: 'bois',
    featureLabel: 'Forêt',
    resourceLabel: 'Bois',
    workerLabel: 'bûcheron',
    workerLabelPlural: 'bûcherons',
    emoji: '🌲',
  },
  miner: {
    feature: 'montagne',
    resource: 'pierre',
    featureLabel: 'Montagne',
    resourceLabel: 'Pierre',
    workerLabel: 'mineur',
    workerLabelPlural: 'mineurs',
    emoji: '⛰️',
  },
}

/** All inhabitant types capable of resource-gathering missions */
export const MISSION_CAPABLE_TYPES = Object.keys(MISSION_CONFIG)

/** Reverse lookup: given a map feature (e.g. 'foret'), return the inhabitant type that works it */
export function getInhabitantTypeForFeature(feature: string): string | undefined {
  return Object.entries(MISSION_CONFIG).find(([, cfg]) => cfg.feature === feature)?.[0]
}
