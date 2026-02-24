'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'
import { Prisma } from '@prisma/client'

export type StartResearchResult =
  | { success: true }
  | { success: false; error: string }

class StartResearchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StartResearchError'
  }
}

function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
}

export async function startResearch(
  technologyKey: string,
  researcherCount: number = 1
): Promise<StartResearchResult> {
  const { session } = await neonAuth()
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  if (researcherCount < 1 || !Number.isInteger(researcherCount)) {
    return { success: false, error: 'Nombre de chercheurs invalide' }
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
          throw new StartResearchError('Village introuvable')
        }

        const technology = await tx.technology.findUnique({
          where: { key: technologyKey },
        })

        if (!technology) {
          throw new StartResearchError('Technologie introuvable')
        }

        // Check existing research state for this technology
        const existing = await tx.villageTechnology.findUnique({
          where: { villageId_technologyKey: { villageId: village.id, technologyKey } },
        })

        let targetLevel = 1

        if (existing) {
          if (!existing.completedAt) {
            throw new StartResearchError('Recherche déjà en cours')
          }
          // Completed — check if upgrade is possible
          if (existing.level >= technology.maxLevel) {
            throw new StartResearchError('Niveau maximum atteint')
          }
          targetLevel = existing.level + 1
        }

        // Check laboratory level requirement
        const laboratory = await tx.villageBuilding.findFirst({
          where: {
            villageId: village.id,
            buildingType: 'laboratoire',
            completedAt: { not: null },
          },
          orderBy: { level: 'desc' },
        })

        if (!laboratory) {
          throw new StartResearchError('Laboratoire requis')
        }

        if (laboratory.level < technology.requiredLabLevel) {
          throw new StartResearchError(`Laboratoire niveau ${technology.requiredLabLevel} requis`)
        }

        // Check available researchers
        const totalResearchers = village.inhabitants.researcher
        const activeResearch = await tx.villageTechnology.aggregate({
          where: {
            villageId: village.id,
            completedAt: null,
          },
          _sum: { assignedResearchers: true },
        })
        const busyResearchers = activeResearch._sum.assignedResearchers ?? 0
        const availableResearchers = totalResearchers - busyResearchers

        if (availableResearchers <= 0) {
          throw new StartResearchError('Aucun chercheur disponible')
        }

        if (researcherCount > availableResearchers) {
          throw new StartResearchError(`Seulement ${availableResearchers} chercheur(s) disponible(s)`)
        }

        // Scale costs and research time by target level (same as buildings)
        const costBois = technology.costBois * targetLevel
        const costPierre = technology.costPierre * targetLevel
        const costCereales = technology.costCereales * targetLevel
        const costViande = technology.costViande * targetLevel
        const scaledResearchSeconds = technology.researchSeconds * targetLevel

        const actualResearchSeconds = Math.ceil(scaledResearchSeconds / researcherCount)

        // Deduct resource costs
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
          throw new StartResearchError('Ressources insuffisantes')
        }

        if (existing) {
          // Upgrade: update the existing completed record
          await tx.villageTechnology.update({
            where: { id: existing.id },
            data: {
              level: targetLevel,
              startedAt: new Date(),
              researchSeconds: actualResearchSeconds,
              assignedResearchers: researcherCount,
              completedAt: null,
            },
          })
        } else {
          // First research: create a new record
          await tx.villageTechnology.create({
            data: {
              villageId: village.id,
              technologyKey,
              level: 1,
              researchSeconds: actualResearchSeconds,
              assignedResearchers: researcherCount,
            },
          })
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

      revalidatePath('/research')
      return { success: true }
    } catch (error) {
      if (error instanceof StartResearchError) {
        return { success: false, error: error.message }
      }

      if (isRetryableTransactionError(error) && attempt < MAX_RETRIES - 1) {
        continue
      }

      return { success: false, error: 'Impossible de lancer la recherche pour le moment' }
    }
  }

  return { success: false, error: 'Impossible de lancer la recherche pour le moment' }
}
