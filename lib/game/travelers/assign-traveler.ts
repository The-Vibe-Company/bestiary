'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'
import { INHABITANT_TYPES, type InhabitantType } from '../inhabitants/types'

export type AssignTravelerResult =
  | { success: true }
  | { success: false; error: string }

class AssignTravelerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssignTravelerError'
  }
}

export async function assignTraveler(type: InhabitantType): Promise<AssignTravelerResult> {
  const { session } = await neonAuth()

  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  if (!INHABITANT_TYPES.includes(type)) {
    return { success: false, error: "Type d'habitant invalide" }
  }

  try {
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      const village = await tx.village.findUnique({
        where: { ownerId: session.userId },
        include: { inhabitants: true, traveler: true },
      })

      if (!village) {
        throw new AssignTravelerError('Village introuvable')
      }

      const traveler = village.traveler
      if (!traveler) {
        throw new AssignTravelerError('Aucun voyageur disponible')
      }

      if (traveler.welcomedAt === null) {
        throw new AssignTravelerError("Accueillez d'abord le voyageur")
      }

      const latestInhabitants = await tx.villageInhabitants.findUnique({
        where: { villageId: village.id },
      })

      const totalInhabitants = latestInhabitants
        ? INHABITANT_TYPES.reduce((sum, t) => sum + (latestInhabitants[t] ?? 0), 0)
        : 0

      if (totalInhabitants >= village.capacity) {
        throw new AssignTravelerError('Le village est plein ! Construisez pour augmenter la capacité.')
      }

      const claimedTraveler = await tx.villageTraveler.updateMany({
        where: {
          id: traveler.id,
          welcomedAt: { not: null },
          assignedAt: null,
          arrivesAt: { lte: now },
          departsAt: { gt: now },
        },
        data: { assignedAt: now },
      })

      if (claimedTraveler.count === 0) {
        throw new AssignTravelerError('Aucun voyageur disponible')
      }

      if (!latestInhabitants) {
        await tx.villageInhabitants.create({
          data: {
            villageId: village.id,
            [type]: 1,
          },
        })
      } else {
        await tx.villageInhabitants.update({
          where: { villageId: village.id },
          data: { [type]: { increment: 1 } },
        })
      }
    })

    revalidatePath('/place')
    return { success: true }
  } catch (error) {
    if (error instanceof AssignTravelerError) {
      return { success: false, error: error.message }
    }
    return { success: false, error: "Erreur lors de l'assignation du voyageur" }
  }
}
