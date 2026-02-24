export interface MissionTypeConfig {
  feature: string | null
  resource: string
  /** Density category for prairie yield calculation, or null for non-prairie types */
  densityType: 'hunting' | 'gathering' | null
  featureLabel: string
  resourceLabel: string
  workerLabel: string
  workerLabelPlural: string
}

export const MISSION_CONFIG: Record<string, MissionTypeConfig> = {
  lumberjack: {
    feature: 'foret',
    resource: 'bois',
    densityType: null,
    featureLabel: 'Forêt',
    resourceLabel: 'Bois',
    workerLabel: 'bûcheron',
    workerLabelPlural: 'bûcherons',
  },
  miner: {
    feature: 'montagne',
    resource: 'pierre',
    densityType: null,
    featureLabel: 'Montagne',
    resourceLabel: 'Pierre',
    workerLabel: 'mineur',
    workerLabelPlural: 'mineurs',
  },
  hunter: {
    feature: null,
    resource: 'viande',
    densityType: 'hunting',
    featureLabel: 'Prairie',
    resourceLabel: 'Viande',
    workerLabel: 'chasseur',
    workerLabelPlural: 'chasseurs',
  },
  gatherer: {
    feature: null,
    resource: 'cereales',
    densityType: 'gathering',
    featureLabel: 'Prairie',
    resourceLabel: 'Céréales',
    workerLabel: 'cueilleur',
    workerLabelPlural: 'cueilleurs',
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
