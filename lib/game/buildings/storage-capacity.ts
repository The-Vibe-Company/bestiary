import type { BuildingType, VillageBuilding } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getBuildingTypes } from './get-building-types'
import { computeEffectiveLevel } from './compute-effective-level'
import type { VillageInhabitants } from '../inhabitants/types'

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

/** Staff counts keyed by building type (e.g. entrepot_bois → splitter count) */
export type BuildingStaffCounts = Record<string, number>

/**
 * Build the staff counts map for storage buildings from a VillageInhabitants record.
 * Centralised here to avoid duplication across pages.
 */
export function getStorageStaffCounts(inhabitants: VillageInhabitants | null): BuildingStaffCounts {
  return {
    entrepot_bois: inhabitants?.splitter ?? 0,
    entrepot_pierre: inhabitants?.stonecutter ?? 0,
    entrepot_cereales: inhabitants?.victualer ?? 0,
    entrepot_viande: inhabitants?.butcher ?? 0,
  }
}

/**
 * Pure computation: given building types, completed buildings, and staff counts,
 * compute the total storage capacity for each resource.
 *
 * Storage buildings require at least 1 staff to function (effective level 0 without staff).
 * Each additional staff increases the effective level beyond the building level.
 */
export function computeStorageCapacity(
  buildingTypes: BuildingType[],
  completedBuildings: VillageBuilding[],
  buildingStaffCounts: BuildingStaffCounts = {},
): StorageCapacity {
  const typeMap = new Map(buildingTypes.map((t) => [t.key, t]))

  const capacity: StorageCapacity = { ...BASE_STORAGE }

  for (const building of completedBuildings) {
    const type = typeMap.get(building.buildingType)
    if (!type) continue

    const rawLevel = building.level ?? 1
    const hasStorageBonus =
      (type.storageBonusBois ?? 0) > 0 ||
      (type.storageBonusPierre ?? 0) > 0 ||
      (type.storageBonusCereales ?? 0) > 0 ||
      (type.storageBonusViande ?? 0) > 0

    // Storage buildings use effective level (requires staff to function).
    // Non-storage buildings keep raw level (unchanged behaviour).
    const level = hasStorageBonus
      ? computeEffectiveLevel(rawLevel, buildingStaffCounts[building.buildingType] ?? 0)
      : rawLevel

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
  const [buildingTypes, completedBuildings, inhabitants] = await Promise.all([
    getBuildingTypes(),
    prisma.villageBuilding.findMany({
      where: { villageId, completedAt: { not: null } },
    }),
    prisma.villageInhabitants.findUnique({
      where: { villageId },
    }),
  ])

  const staffCounts = getStorageStaffCounts(inhabitants as VillageInhabitants | null)

  return computeStorageCapacity(buildingTypes, completedBuildings, staffCounts)
}
