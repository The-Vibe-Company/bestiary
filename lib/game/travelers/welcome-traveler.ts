'use server'

import { revalidatePath } from 'next/cache'
import { neonAuth } from '@neondatabase/auth/next/server'
import { prisma } from '@/lib/prisma'

export type WelcomeTravelerResult =
  | { success: true }
  | { success: false; error: string }

const LOCK_DURATION_SECONDS = 24 * 60 * 60

export async function welcomeTraveler(): Promise<WelcomeTravelerResult> {
  const { session } = await neonAuth()

  if (!session) {
    return { success: false, error: 'Non authentifie' }
  }

  try {
    const village = await prisma.village.findUnique({
      where: { ownerId: session.userId },
      include: { traveler: true },
    })

    if (!village || !village.traveler) {
      return { success: false, error: 'Aucun voyageur disponible' }
    }

    const now = new Date()
    const traveler = village.traveler

    if (traveler.arrivesAt > now) {
      return { success: false, error: "Le voyageur n'est pas encore arrive" }
    }

    if (traveler.departsAt <= now) {
      return { success: false, error: 'Le voyageur est deja reparti' }
    }

    await prisma.villageTraveler.update({
      where: { id: traveler.id },
      data: { departsAt: new Date(now.getTime() + LOCK_DURATION_SECONDS * 1000) },
    })

    revalidatePath('/place')
    return { success: true }
  } catch {
    return { success: false, error: "Erreur lors de l'accueil du voyageur" }
  }
}
