'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'

export type StartBuildingResult =
  | { success: true }
  | { success: false; error: string }

export async function startBuilding(
  buildingTypeKey: string,
  builderCount: number = 1
): Promise<StartBuildingResult> {
  const { session } = await neonAuth()
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  if (builderCount < 1 || !Number.isInteger(builderCount)) {
    return { success: false, error: 'Nombre de bâtisseurs invalide' }
  }

  const village = await prisma.village.findUnique({
    where: { ownerId: session.userId },
    include: { resources: true, inhabitants: true },
  })

  if (!village || !village.resources || !village.inhabitants) {
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

  // Check builder availability
  const totalBuilders = village.inhabitants.builder
  const activeBuildings = await prisma.villageBuilding.findMany({
    where: { villageId: village.id, completedAt: null },
    select: { assignedBuilders: true, buildingType: true },
  })

  const hasSameTypeInProgress = activeBuildings.some(
    (building) => building.buildingType === buildingTypeKey
  )
  if (hasSameTypeInProgress) {
    return { success: false, error: 'Ce type de bâtiment est déjà en construction' }
  }

  const busyBuilders = activeBuildings.reduce((sum, b) => sum + b.assignedBuilders, 0)
  const availableBuilders = totalBuilders - busyBuilders

  if (availableBuilders <= 0) {
    return { success: false, error: 'Aucun bâtisseur disponible' }
  }

  if (builderCount > availableBuilders) {
    return { success: false, error: `Seulement ${availableBuilders} bâtisseur(s) disponible(s)` }
  }

  // Calculate build time based on number of builders
  const actualBuildSeconds = Math.ceil(buildingType.buildSeconds / builderCount)

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
        buildSeconds: actualBuildSeconds,
        assignedBuilders: builderCount,
      },
    }),
  ])

  revalidatePath('/village')

  return { success: true }
}
