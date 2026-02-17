import { prisma } from '@/lib/prisma'
import type { InhabitantType as PrismaInhabitantType } from '@prisma/client'
import { computeDailyConsumption } from './compute-daily-consumption'

/**
 * Counts the number of full UTC midnights between two dates.
 * Example: Jan 1 23:00 → Jan 3 01:00 = 2 midnights crossed (Jan 2 00:00 and Jan 3 00:00)
 */
function computeFullDaysElapsed(since: Date, now: Date): number {
  const sinceDay = Math.floor(since.getTime() / 86_400_000)
  const nowDay = Math.floor(now.getTime() / 86_400_000)
  return nowDay - sinceDay
}

/**
 * Returns the Date of the Nth UTC midnight after `since`.
 * Used to advance lastConsumptionAt to the exact boundary, avoiding clock drift.
 */
function computeMidnightBoundary(since: Date, days: number): Date {
  const sinceDay = Math.floor(since.getTime() / 86_400_000)
  return new Date((sinceDay + days) * 86_400_000)
}

/**
 * Applies daily food consumption for a single village.
 *
 * - Computes how many full UTC days have elapsed since lastConsumptionAt
 * - Deducts (daysElapsed × dailyConsumption) from cereales and viande
 * - Floors resources at 0 (never goes negative)
 * - Uses optimistic locking (WHERE lastConsumptionAt = oldValue) to prevent double deductions
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
  const daysElapsed = computeFullDaysElapsed(resources.lastConsumptionAt, now)

  if (daysElapsed <= 0) return false

  const daily = computeDailyConsumption(inhabitants, inhabitantTypes)

  const totalCereales = daily.cereales * daysElapsed
  const totalViande = daily.viande * daysElapsed

  const newCereales = Math.max(0, resources.cereales - Math.round(totalCereales))
  const newViande = Math.max(0, resources.viande - Math.round(totalViande))

  const newLastConsumptionAt = computeMidnightBoundary(
    resources.lastConsumptionAt,
    daysElapsed,
  )

  // Optimistic lock: only update if lastConsumptionAt hasn't changed
  const result = await prisma.villageResources.updateMany({
    where: {
      villageId,
      lastConsumptionAt: resources.lastConsumptionAt,
    },
    data: {
      cereales: newCereales,
      viande: newViande,
      lastConsumptionAt: newLastConsumptionAt,
    },
  })

  return result.count > 0
}
