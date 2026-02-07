'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'
import { INHABITANT_TYPES, type InhabitantType } from './types'

export type AssignInhabitantResult =
  | { success: true }
  | { success: false; error: string }

export async function assignInhabitant(type: InhabitantType): Promise<AssignInhabitantResult> {
  const { session } = await neonAuth()

  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  if (!INHABITANT_TYPES.includes(type)) {
    return { success: false, error: 'Type d\'habitant invalide' }
  }

  try {
    const village = await prisma.village.findUnique({
      where: { ownerId: session.userId },
      include: { inhabitants: true },
    })

    if (!village) {
      return { success: false, error: 'Village introuvable' }
    }

    // Ensure inhabitants record exists
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
    return { success: false, error: 'Erreur lors de l\'assignation' }
  }
}
