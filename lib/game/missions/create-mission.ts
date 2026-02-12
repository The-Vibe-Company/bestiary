'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'
import { getInhabitantStats } from '@/lib/game/inhabitants/get-inhabitant-stats'
import { generateWorldMap } from '@/lib/game/map/generator'
import { manhattanDistance, computeTravelSeconds } from './distance'
import { MIN_WORK_SECONDS, MAX_WORK_SECONDS } from './constants'

export type CreateMissionResult =
  | { success: true }
  | { success: false; error: string }

export async function createMission(
  targetX: number,
  targetY: number,
  workSeconds: number,
  loop: boolean = false,
): Promise<CreateMissionResult> {
  const { session } = await neonAuth()
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // Validate workSeconds
  if (workSeconds < MIN_WORK_SECONDS || workSeconds > MAX_WORK_SECONDS) {
    return { success: false, error: 'Durée de travail invalide' }
  }

  const village = await prisma.village.findUnique({
    where: { ownerId: session.userId },
    include: { inhabitants: true },
  })

  if (!village) {
    return { success: false, error: 'Village introuvable' }
  }

  // Verify target cell is a forest
  const worldMap = generateWorldMap()
  const cell = worldMap[targetY]?.[targetX]
  if (!cell || cell.feature !== 'foret') {
    return { success: false, error: 'La case cible n\'est pas une forêt' }
  }

  // Get lumberjack stats
  const stats = await getInhabitantStats()
  const lumberjackStats = stats['lumberjack']
  if (!lumberjackStats || lumberjackStats.speed <= 0) {
    return { success: false, error: 'Statistiques du bûcheron introuvables' }
  }

  // Check lumberjack availability
  const totalLumberjacks = village.inhabitants?.lumberjack ?? 0
  const activeMissions = await prisma.mission.count({
    where: {
      villageId: village.id,
      inhabitantType: 'lumberjack',
      completedAt: null,
    },
  })

  if (totalLumberjacks - activeMissions <= 0) {
    return { success: false, error: 'Aucun bûcheron disponible' }
  }

  // Compute travel time
  const distance = manhattanDistance(village.x, village.y, targetX, targetY)
  if (distance === 0) {
    return { success: false, error: 'La cible est sur votre village' }
  }

  const travelSeconds = computeTravelSeconds(distance, lumberjackStats.speed)

  await prisma.mission.create({
    data: {
      village: { connect: { id: village.id } },
      inhabitantType: 'lumberjack',
      targetX,
      targetY,
      travelSeconds,
      workSeconds,
      loop,
    },
  })

  revalidatePath('/place')
  revalidatePath('/map')
  revalidatePath('/habitants')

  return { success: true }
}
