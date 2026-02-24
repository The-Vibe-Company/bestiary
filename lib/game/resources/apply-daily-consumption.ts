import { prisma } from '@/lib/prisma'
import type { InhabitantType as PrismaInhabitantType } from '@prisma/client'
import { INHABITANT_TYPES } from '@/lib/game/inhabitants/types'
import type { VillageInhabitants } from '@/lib/game/inhabitants/types'
import { computeStarvation } from './compute-starvation'

/** Duration of one consumption cycle in milliseconds (1 day). */
const CYCLE_MS = 86_400_000

/**
 * Counts the number of full cycles elapsed between two dates.
 */
function computeFullCyclesElapsed(since: Date, now: Date): number {
  const sinceCycle = Math.floor(since.getTime() / CYCLE_MS)
  const nowCycle = Math.floor(now.getTime() / CYCLE_MS)
  return nowCycle - sinceCycle
}

/**
 * Returns the Date of the Nth cycle boundary after `since`.
 * Used to advance lastConsumptionAt to the exact boundary, avoiding drift.
 */
function computeCycleBoundary(since: Date, cycles: number): Date {
  const sinceCycle = Math.floor(since.getTime() / CYCLE_MS)
  return new Date((sinceCycle + cycles) * CYCLE_MS)
}

/**
 * Cancels excess missions for inhabitant types that lost members to starvation.
 * Force-completes the most recent missions first (no resource reward).
 */
async function cancelOrphanedMissions(
  villageId: string,
  survivingInhabitants: Record<string, number>,
): Promise<void> {
  const now = new Date()

  for (const key of INHABITANT_TYPES) {
    const surviving = survivingInhabitants[key] ?? 0

    const activeMissions = await prisma.mission.findMany({
      where: {
        villageId,
        inhabitantType: key,
        completedAt: null,
      },
      orderBy: { departedAt: 'desc' },
    })

    const excess = activeMissions.length - surviving
    if (excess <= 0) continue

    const toCancel = activeMissions.slice(0, excess)
    await prisma.mission.updateMany({
      where: {
        id: { in: toCancel.map((m) => m.id) },
      },
      data: { completedAt: now },
    })
  }
}

/**
 * Applies daily food consumption for a single village.
 *
 * Processes each elapsed day individually (day-by-day loop) so that starvation
 * on day 1 correctly reduces population before computing day 2 consumption.
 *
 * If food is insufficient on any day, random inhabitants die and their missions
 * are cancelled. Uses optimistic locking to prevent double deductions.
 *
 * Returns true if resources were updated, false otherwise (no-op or conflict).
 */
export async function applyDailyConsumption(
  villageId: string,
  inhabitantTypes: PrismaInhabitantType[],
  now: Date = new Date(),
): Promise<boolean> {
  const village = await prisma.village.findUnique({
    where: { id: villageId },
    include: {
      resources: true,
      inhabitants: true,
    },
  })

  if (!village?.resources) return false

  const { resources, inhabitants } = village
  const daysElapsed = computeFullCyclesElapsed(resources.lastConsumptionAt, now)

  if (daysElapsed <= 0) return false

  // Build mutable state for day-by-day simulation
  let currentCereales = resources.cereales
  let currentViande = resources.viande
  const currentInhabitants: Record<string, number> = {}
  for (const key of INHABITANT_TYPES) {
    currentInhabitants[key] = (inhabitants as VillageInhabitants | null)?.[key] ?? 0
  }

  let starvationOccurred = false

  for (let day = 0; day < daysElapsed; day++) {
    const result = computeStarvation(
      { ...currentInhabitants },
      inhabitantTypes,
      currentCereales,
      currentViande,
    )

    if (result.starvation) {
      starvationOccurred = true
      for (const key of INHABITANT_TYPES) {
        currentInhabitants[key] = result.survivingInhabitants[key] ?? 0
      }
    }

    currentCereales = Math.max(0, currentCereales - result.consumedCereales)
    currentViande = Math.max(0, currentViande - result.consumedViande)

    // No population left — skip remaining days
    const totalPop = INHABITANT_TYPES.reduce((s, k) => s + currentInhabitants[k], 0)
    if (totalPop === 0) break
  }

  const newLastConsumptionAt = computeCycleBoundary(
    resources.lastConsumptionAt,
    daysElapsed,
  )

  // Build update payload
  const resourceUpdate: {
    cereales: number
    viande: number
    lastConsumptionAt: Date
    lastStarvationAt?: Date
  } = {
    cereales: currentCereales,
    viande: currentViande,
    lastConsumptionAt: newLastConsumptionAt,
  }

  if (starvationOccurred) {
    resourceUpdate.lastStarvationAt = now
  }

  // Atomically update resources (and inhabitants if starvation occurred)
  const committed = await prisma.$transaction(async (tx) => {
    // Optimistic lock: only update if lastConsumptionAt hasn't changed
    const result = await tx.villageResources.updateMany({
      where: {
        villageId,
        lastConsumptionAt: resources.lastConsumptionAt,
      },
      data: resourceUpdate,
    })

    if (result.count === 0) return false

    if (starvationOccurred) {
      await tx.villageInhabitants.update({
        where: { villageId },
        data: currentInhabitants,
      })
    }

    return true
  })

  if (!committed) return false

  // Cancel orphaned missions outside the transaction (non-critical)
  if (starvationOccurred) {
    await cancelOrphanedMissions(villageId, currentInhabitants)
  }

  return true
}
