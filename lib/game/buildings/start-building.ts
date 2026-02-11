'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'

export type StartBuildingResult =
  | { success: true }
  | { success: false; error: string }

export async function startBuilding(
  buildingTypeKey: string
): Promise<StartBuildingResult> {
  const { session } = await neonAuth()
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  const village = await prisma.village.findUnique({
    where: { ownerId: session.userId },
    include: { resources: true },
  })

  if (!village || !village.resources) {
    return { success: false, error: 'Village introuvable' }
  }

  const buildingType = await prisma.buildingType.findUnique({
    where: { key: buildingTypeKey },
  })

  if (!buildingType) {
    return { success: false, error: 'Type de bâtiment introuvable' }
  }

  // Check resources
  const res = village.resources
  if (
    res.bois < buildingType.costBois ||
    res.pierre < buildingType.costPierre ||
    res.cereales < buildingType.costCereales ||
    res.viande < buildingType.costViande
  ) {
    return { success: false, error: 'Ressources insuffisantes' }
  }

  // Deduct resources + create building in a transaction
  await prisma.$transaction([
    prisma.villageResources.update({
      where: { villageId: village.id },
      data: {
        bois: { decrement: buildingType.costBois },
        pierre: { decrement: buildingType.costPierre },
        cereales: { decrement: buildingType.costCereales },
        viande: { decrement: buildingType.costViande },
      },
    }),
    prisma.villageBuilding.create({
      data: {
        villageId: village.id,
        buildingType: buildingTypeKey,
        buildSeconds: buildingType.buildSeconds,
      },
    }),
  ])

  revalidatePath('/village')

  return { success: true }
}
