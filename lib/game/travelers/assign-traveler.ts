'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'
import { INHABITANT_TYPES, type InhabitantType } from '../inhabitants/types'
import { Prisma } from '@prisma/client'

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

      if (traveler.assignedAt !== null) {
        throw new AssignTravelerError('Ce voyageur est deja assigne')
      }

      if (traveler.arrivesAt > now) {
        throw new AssignTravelerError("Le voyageur n'est pas encore arrive")
      }

      if (traveler.welcomedAt === null) {
        throw new AssignTravelerError("Ce voyageur n'est plus accueilli. Rafraichissez la page.")
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
          assignedAt: null,
          arrivesAt: { lte: now },
        },
        data: { assignedAt: now },
      })

      if (claimedTraveler.count === 0) {
        throw new AssignTravelerError("Le voyageur n'est plus assignable. Rafraichissez la page.")
      }

      const updatedInhabitants = await tx.villageInhabitants.updateMany({
        where: { villageId: village.id },
        data: { [type]: { increment: 1 } },
      })

      if (updatedInhabitants.count === 0) {
        try {
          await tx.villageInhabitants.create({
            data: {
              village: { connect: { id: village.id } },
              [type]: 1,
            },
          })
        } catch (createError) {
          // Handle rare race where record is created between updateMany and create.
          if (
            createError instanceof Prisma.PrismaClientKnownRequestError &&
            createError.code === 'P2002'
          ) {
            await tx.villageInhabitants.update({
              where: { villageId: village.id },
              data: { [type]: { increment: 1 } },
            })
          } else {
            throw createError
          }
        }
      }
    })

    revalidatePath('/place')
    return { success: true }
  } catch (error) {
    if (error instanceof AssignTravelerError) {
      return { success: false, error: error.message }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error('assignTraveler prisma known error:', {
        code: error.code,
        message: error.message,
        meta: error.meta,
      })
      return { success: false, error: "Le voyageur n'est plus disponible. Rafraichissez puis reessayez." }
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
      console.error('assignTraveler validation error:', error.message)
      return { success: false, error: `Erreur validation assignation: ${error.message}` }
    }
    console.error('assignTraveler unexpected error:', error)
    if (error instanceof Error) {
      return { success: false, error: `Erreur assignation: ${error.message}` }
    }
    return { success: false, error: "Erreur assignation: erreur inconnue" }
  }
}
