export interface MissionTypeConfig {
  feature: string | null
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
  hunter: {
    feature: null,
    resource: 'viande',
    featureLabel: 'Prairie',
    resourceLabel: 'Viande',
    workerLabel: 'chasseur',
    workerLabelPlural: 'chasseurs',
    emoji: '🏹',
  },
  gatherer: {
    feature: null,
    resource: 'cereales',
    featureLabel: 'Prairie',
    resourceLabel: 'Céréales',
    workerLabel: 'cueilleur',
    workerLabelPlural: 'cueilleurs',
    emoji: '🌾',
  },
}

/** All inhabitant types capable of resource-gathering missions */
export const MISSION_CAPABLE_TYPES = Object.keys(MISSION_CONFIG)

/** Reverse lookup: given a map feature, return all inhabitant types that work it (array because multiple types can share feature: null) */
export function getInhabitantTypesForFeature(feature: string | null): string[] {
  return Object.entries(MISSION_CONFIG)
    .filter(([, cfg]) => cfg.feature === feature)
    .map(([type]) => type)
}
