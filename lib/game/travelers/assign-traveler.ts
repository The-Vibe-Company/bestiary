'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'
import { INHABITANT_TYPES, type InhabitantType } from '../inhabitants/types'

export type AssignTravelerResult =
  | { success: true }
  | { success: false; error: string }

export async function assignTraveler(type: InhabitantType): Promise<AssignTravelerResult> {
  const { session } = await neonAuth()

  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  if (!INHABITANT_TYPES.includes(type)) {
    return { success: false, error: "Type d'habitant invalide" }
  }

  try {
    const village = await prisma.village.findUnique({
      where: { ownerId: session.userId },
      include: { inhabitants: true, traveler: true },
    })

    if (!village) {
      return { success: false, error: 'Village introuvable' }
    }

    // Vérifier la capacité du village
    const totalInhabitants = village.inhabitants
      ? INHABITANT_TYPES.reduce((sum, t) => sum + (village.inhabitants![t] ?? 0), 0)
      : 0

    if (totalInhabitants >= village.capacity) {
      return { success: false, error: 'Le village est plein ! Construisez pour augmenter la capacité.' }
    }

    // Vérifier que le voyageur est bien présent
    const now = new Date()
    const traveler = village.traveler

    if (!traveler || traveler.assignedAt !== null) {
      return { success: false, error: 'Aucun voyageur disponible' }
    }

    if (traveler.arrivesAt > now) {
      return { success: false, error: "Le voyageur n'est pas encore arrivé" }
    }

    if (traveler.departsAt <= now) {
      return { success: false, error: 'Le voyageur est déjà reparti' }
    }

    // Marquer le voyageur comme assigné
    await prisma.villageTraveler.update({
      where: { id: traveler.id },
      data: { assignedAt: now },
    })

    // Incrémenter le compteur d'habitants
    if (!village.inhabitants) {
      await prisma.villageInhabitants.create({
        data: {
          villageId: village.id,
          [type]: 1,
        },
      })
    } else {
      await prisma.villageInhabitants.update({
        where: { villageId: village.id },
        data: { [type]: { increment: 1 } },
      })
    }

    revalidatePath('/place')
    return { success: true }
  } catch {
    return { success: false, error: "Erreur lors de l'assignation du voyageur" }
  }
}
