'use server'

import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'

export type UpdateVillageNameResult =
  | { success: true; name: string }
  | { success: false; error: string }

export async function updateVillageName(name: string): Promise<UpdateVillageNameResult> {
  const { session } = await neonAuth()

  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  const trimmedName = name.trim()

  if (trimmedName.length < 3) {
    return { success: false, error: 'Le nom doit contenir au moins 3 caractères' }
  }

  if (trimmedName.length > 30) {
    return { success: false, error: 'Le nom ne peut pas dépasser 30 caractères' }
  }

  // Check if name is already taken
  const existingVillage = await prisma.village.findUnique({
    where: { name: trimmedName }
  })

  if (existingVillage && existingVillage.ownerId !== session.userId) {
    return { success: false, error: 'Ce nom de village est déjà pris' }
  }

  // Update the village name
  try {
    const village = await prisma.village.update({
      where: { ownerId: session.userId },
      data: { name: trimmedName }
    })

    return { success: true, name: village.name! }
  } catch {
    return { success: false, error: 'Erreur lors de la mise à jour' }
  }
}
