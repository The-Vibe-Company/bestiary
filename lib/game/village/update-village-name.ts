'use server'

import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'
import { Prisma } from '@prisma/client'
import { villageNameSchema, firstZodError } from '@/lib/validation/schemas'

export type UpdateVillageNameResult =
  | { success: true; name: string }
  | { success: false; error: string }

export async function updateVillageName(name: string): Promise<UpdateVillageNameResult> {
  const { session } = await neonAuth()

  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  const parsed = villageNameSchema.safeParse(name)
  if (!parsed.success) {
    return { success: false, error: firstZodError(parsed) ?? 'Nom invalide' }
  }
  const trimmedName = parsed.data

  // Check if name is already taken
  const existingVillage = await prisma.village.findUnique({
    where: { name: trimmedName }
  })

  if (existingVillage && existingVillage.ownerId !== session.userId) {
    return { success: false, error: 'Ce nom de village est déjà pris' }
  }

  try {
    const village = await prisma.village.update({
      where: { ownerId: session.userId },
      data: { name: trimmedName }
    })

    return { success: true, name: village.name! }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: unique constraint (name already taken — race with the check above)
      if (error.code === 'P2002') {
        return { success: false, error: 'Ce nom de village est déjà pris' }
      }
      // P2025: village not found for this user
      if (error.code === 'P2025') {
        return { success: false, error: 'Village introuvable' }
      }
    }
    console.error('updateVillageName unexpected error:', error)
    return { success: false, error: 'Erreur lors de la mise à jour' }
  }
}
