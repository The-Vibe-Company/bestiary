import type { BuildingType, VillageBuilding } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getBuildingTypes } from './get-building-types'

/** Base storage capacity before any warehouses are built */
export const BASE_STORAGE = {
  bois: 500,
  pierre: 500,
  cereales: 200,
  viande: 200,
} as const

export interface StorageCapacity {
  bois: number
  pierre: number
  cereales: number
  viande: number
}

/**
 * Pure computation: given building types and completed buildings,
 * compute the total storage capacity for each resource.
 */
export function computeStorageCapacity(
  buildingTypes: BuildingType[],
  completedBuildings: VillageBuilding[],
): StorageCapacity {
  const typeMap = new Map(buildingTypes.map((t) => [t.key, t]))

  const capacity: StorageCapacity = { ...BASE_STORAGE }

  for (const building of completedBuildings) {
    const type = typeMap.get(building.buildingType)
    if (!type) continue
    const level = building.level ?? 1
    capacity.bois += (type.storageBonusBois ?? 0) * level
    capacity.pierre += (type.storageBonusPierre ?? 0) * level
    capacity.cereales += (type.storageBonusCereales ?? 0) * level
    capacity.viande += (type.storageBonusViande ?? 0) * level
  }

  return capacity
}

/**
 * DB-backed: fetch building data and compute storage capacity for a village.
 * Used in contexts where building data isn't already available (e.g. mission completion).
 */
export async function getStorageCapacityForVillage(villageId: string): Promise<StorageCapacity> {
  const [buildingTypes, completedBuildings] = await Promise.all([
    getBuildingTypes(),
    prisma.villageBuilding.findMany({
      where: { villageId, completedAt: { not: null } },
    }),
  ])

  return computeStorageCapacity(buildingTypes, completedBuildings)
}
