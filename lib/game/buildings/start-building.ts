'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'
import { Prisma } from '@prisma/client'

export type StartBuildingResult =
  | { success: true }
  | { success: false; error: string }

class StartBuildingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StartBuildingError'
  }
}

function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
}

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

  const MAX_RETRIES = 3

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        const village = await tx.village.findUnique({
          where: { ownerId: session.userId },
          include: { resources: true, inhabitants: true },
        })

        if (!village || !village.resources || !village.inhabitants) {
          throw new StartBuildingError('Village introuvable')
        }

        const buildingType = await tx.buildingType.findUnique({
          where: { key: buildingTypeKey },
        })

        if (!buildingType) {
          throw new StartBuildingError('Type de bâtiment introuvable')
        }

        const activeBuildings = await tx.villageBuilding.findMany({
          where: { villageId: village.id, completedAt: null },
          select: { assignedBuilders: true, buildingType: true },
        })

        const hasSameTypeInProgress = activeBuildings.some(
          (building) => building.buildingType === buildingTypeKey
        )
        if (hasSameTypeInProgress) {
          throw new StartBuildingError('Ce type de bâtiment est déjà en construction')
        }

        const totalBuilders = village.inhabitants.builder
        const busyBuilders = activeBuildings.reduce((sum, b) => sum + b.assignedBuilders, 0)
        const availableBuilders = totalBuilders - busyBuilders

        if (availableBuilders <= 0) {
          throw new StartBuildingError('Aucun bâtisseur disponible')
        }

        if (builderCount > availableBuilders) {
          throw new StartBuildingError(`Seulement ${availableBuilders} bâtisseur(s) disponible(s)`)
        }

        const actualBuildSeconds = Math.ceil(buildingType.buildSeconds / builderCount)

        const resourceUpdate = await tx.villageResources.updateMany({
          where: {
            villageId: village.id,
            bois: { gte: buildingType.costBois },
            pierre: { gte: buildingType.costPierre },
            cereales: { gte: buildingType.costCereales },
            viande: { gte: buildingType.costViande },
          },
          data: {
            bois: { decrement: buildingType.costBois },
            pierre: { decrement: buildingType.costPierre },
            cereales: { decrement: buildingType.costCereales },
            viande: { decrement: buildingType.costViande },
          },
        })

        if (resourceUpdate.count !== 1) {
          throw new StartBuildingError('Ressources insuffisantes')
        }

        await tx.villageBuilding.create({
          data: {
            villageId: village.id,
            buildingType: buildingTypeKey,
            buildSeconds: actualBuildSeconds,
            assignedBuilders: builderCount,
          },
        })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

      revalidatePath('/village')
      return { success: true }
    } catch (error) {
      if (error instanceof StartBuildingError) {
        return { success: false, error: error.message }
      }

      if (isRetryableTransactionError(error) && attempt < MAX_RETRIES - 1) {
        continue
      }

      return { success: false, error: 'Impossible de lancer la construction pour le moment' }
    }
  }

  return { success: false, error: 'Impossible de lancer la construction pour le moment' }
}
