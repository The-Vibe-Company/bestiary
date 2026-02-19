import { prisma } from '@/lib/prisma'
import {
  MIN_ARRIVAL_DELAY,
  MAX_ARRIVAL_DELAY,
  MIN_STAY_DURATION,
  MAX_STAY_DURATION,
} from './constants'

export type TravelerStatus =
  | { status: 'waiting'; arrivesAt: Date }
  | { status: 'present'; departsAt: Date; isWelcomed: boolean }

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function createTravelerDates() {
  const now = new Date()
  const arrivalDelay = randomBetween(MIN_ARRIVAL_DELAY, MAX_ARRIVAL_DELAY)
  const stayDuration = randomBetween(MIN_STAY_DURATION, MAX_STAY_DURATION)

  const arrivesAt = new Date(now.getTime() + arrivalDelay * 1000)
  const departsAt = new Date(arrivesAt.getTime() + stayDuration * 1000)

  return { arrivesAt, departsAt }
}

/**
 * Résout l'état du voyageur pour un village (lazy completion pattern).
 *
 * - Pas de record → crée un nouveau voyageur en route
 * - Voyageur déjà assigné ou reparti → supprime et relance le cycle
 * - Voyageur en route → retourne le countdown d'arrivée
 * - Voyageur présent → retourne le countdown de départ
 */
export async function resolveTraveler(villageId: string): Promise<TravelerStatus> {
  const now = new Date()
  const { arrivesAt: nextArrivesAt, departsAt: nextDepartsAt } = createTravelerDates()

  return prisma.$transaction(async (tx) => {
    const existing = await tx.villageTraveler.findUnique({
      where: { villageId },
    })

    // Cas : pas de record, déjà assigné, ou reparti sans avoir été accueilli
    if (
      !existing ||
      existing.assignedAt !== null ||
      (existing.welcomedAt === null && existing.departsAt <= now)
    ) {
      const refreshed = await tx.villageTraveler.upsert({
        where: { villageId },
        create: {
          villageId,
          arrivesAt: nextArrivesAt,
          departsAt: nextDepartsAt,
        },
        update: {
          arrivesAt: nextArrivesAt,
          departsAt: nextDepartsAt,
          welcomedAt: null,
          assignedAt: null,
        },
      })

      return { status: 'waiting', arrivesAt: refreshed.arrivesAt }
    }

    // Cas : voyageur pas encore arrivé
    if (existing.arrivesAt > now) {
      return { status: 'waiting', arrivesAt: existing.arrivesAt }
    }

    // Cas : voyageur présent (arrivesAt passé, departsAt futur)
    return {
      status: 'present',
      departsAt: existing.departsAt,
      isWelcomed: existing.welcomedAt !== null,
    }
  })
}
