import { prisma } from '@/lib/prisma'
import {
  MIN_ARRIVAL_DELAY,
  MAX_ARRIVAL_DELAY,
  MIN_STAY_DURATION,
  MAX_STAY_DURATION,
} from './constants'

export type TravelerStatus =
  | { status: 'waiting'; arrivesAt: Date }
  | { status: 'present'; departsAt: Date }

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

  const existing = await prisma.villageTraveler.findUnique({
    where: { villageId },
  })

  // Cas : pas de record ou voyageur déjà traité (assigné ou reparti)
  if (!existing || existing.assignedAt !== null || existing.departsAt <= now) {
    const { arrivesAt, departsAt } = createTravelerDates()

    // Upsert atomique : supprime l'ancien et crée le nouveau en une transaction
    await prisma.$transaction(async (tx) => {
      await tx.villageTraveler.deleteMany({ where: { villageId } })
      await tx.villageTraveler.create({
        data: { villageId, arrivesAt, departsAt },
      })
    })

    return { status: 'waiting', arrivesAt }
  }

  // Cas : voyageur pas encore arrivé
  if (existing.arrivesAt > now) {
    return { status: 'waiting', arrivesAt: existing.arrivesAt }
  }

  // Cas : voyageur présent (arrivesAt passé, departsAt futur)
  return { status: 'present', departsAt: existing.departsAt }
}
