/**
 * Computes the effective level of a building based on its level and assigned staff.
 *
 * Workers complement the building level:
 * - 0 workers → effective level 0 (building doesn't function)
 * - N workers → effective level = buildingLevel + workerCount
 *
 * Max assignable workers = building level (enforced elsewhere during assignment).
 */
export function computeEffectiveLevel(buildingLevel: number, workerCount: number): number {
  if (workerCount <= 0) return 0
  return buildingLevel + workerCount
}
