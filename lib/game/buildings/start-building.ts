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

        // Check technology prerequisite
        if (buildingType.requiredTechnology) {
          const techCompleted = await tx.villageTechnology.findFirst({
            where: {
              villageId: village.id,
              technologyKey: buildingType.requiredTechnology,
              completedAt: { not: null },
            },
          })
          if (!techCompleted) {
            throw new StartBuildingError('Technologie requise non recherchée')
          }
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

        // Check maxCount and determine if this is an upgrade
        let isUpgrade = false
        let currentLevel = 0
        if (buildingType.maxCount !== null) {
          const existingBuilding = await tx.villageBuilding.findFirst({
            where: {
              villageId: village.id,
              buildingType: buildingTypeKey,
              completedAt: { not: null },
            },
            orderBy: { level: 'desc' },
          })

          if (existingBuilding) {
            // Unique building already exists — this is an upgrade
            isUpgrade = true
            currentLevel = existingBuilding.level

            if (currentLevel >= buildingType.maxLevel) {
              throw new StartBuildingError('Niveau maximum atteint')
            }
          } else {
            // No existing building — check maxCount for new construction
            const completedCount = await tx.villageBuilding.count({
              where: {
                villageId: village.id,
                buildingType: buildingTypeKey,
                completedAt: { not: null },
              },
            })
            if (completedCount >= buildingType.maxCount) {
              throw new StartBuildingError('Nombre maximum de ce bâtiment atteint')
            }
          }
        }

        const targetLevel = isUpgrade ? currentLevel + 1 : 1

        const totalBuilders = village.inhabitants.builder
        const busyBuilders = activeBuildings.reduce((sum, b) => sum + b.assignedBuilders, 0)
        const availableBuilders = totalBuilders - busyBuilders

        if (availableBuilders <= 0) {
          throw new StartBuildingError('Aucun bâtisseur disponible')
        }

        if (builderCount > availableBuilders) {
          throw new StartBuildingError(`Seulement ${availableBuilders} bâtisseur(s) disponible(s)`)
        }

        // Scale costs and build time by target level for upgrades
        const costBois = buildingType.costBois * targetLevel
        const costPierre = buildingType.costPierre * targetLevel
        const costCereales = buildingType.costCereales * targetLevel
        const costViande = buildingType.costViande * targetLevel
        const scaledBuildSeconds = buildingType.buildSeconds * targetLevel

        const actualBuildSeconds = Math.ceil(scaledBuildSeconds / builderCount)

        const resourceUpdate = await tx.villageResources.updateMany({
          where: {
            villageId: village.id,
            bois: { gte: costBois },
            pierre: { gte: costPierre },
            cereales: { gte: costCereales },
            viande: { gte: costViande },
          },
          data: {
            bois: { decrement: costBois },
            pierre: { decrement: costPierre },
            cereales: { decrement: costCereales },
            viande: { decrement: costViande },
          },
        })

        if (resourceUpdate.count !== 1) {
          throw new StartBuildingError('Ressources insuffisantes')
        }

        await tx.villageBuilding.create({
          data: {
            villageId: village.id,
            buildingType: buildingTypeKey,
            level: targetLevel,
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
