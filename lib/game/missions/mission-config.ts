export interface MissionTypeConfig {
  feature: string | null
  resource: string
  /** Density category for prairie yield calculation, or null for non-prairie types */
  densityType: 'hunting' | 'gathering' | null
  featureLabel: string
  resourceLabel: string
  workerLabel: string
  workerLabelPlural: string
  /** If true, the mission discovers items instead of gathering resources and can target any terrain */
  exploration?: boolean
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
  explorer: {
    feature: null,
    resource: '',
    densityType: null,
    featureLabel: 'Exploration',
    resourceLabel: 'Items',
    workerLabel: 'explorateur',
    workerLabelPlural: 'explorateurs',
    exploration: true,
  },
}

/** All inhabitant types capable of missions (resource-gathering + exploration) */
export const MISSION_CAPABLE_TYPES = Object.keys(MISSION_CONFIG)

/** Reverse lookup: given a map feature, return all inhabitant types that work it.
 *  Exploration types are always included (they can go anywhere). */
export function getInhabitantTypesForFeature(feature: string | null): string[] {
  return Object.entries(MISSION_CONFIG)
    .filter(([, cfg]) => cfg.exploration || cfg.feature === feature)
    .map(([type]) => type)
}
