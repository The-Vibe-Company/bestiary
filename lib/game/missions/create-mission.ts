'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'
import { getInhabitantStats } from '@/lib/game/inhabitants/get-inhabitant-stats'
import { generateWorldMap } from '@/lib/game/map/generator'
import { manhattanDistance, computeTravelSeconds } from './distance'
import { MIN_WORK_SECONDS, MAX_WORK_SECONDS } from './constants'
import { MISSION_CONFIG } from './mission-config'

export type CreateMissionResult =
  | { success: true }
  | { success: false; error: string }

export async function createMission(
  targetX: number,
  targetY: number,
  workSeconds: number,
  loop: boolean = false,
  inhabitantType: string = 'lumberjack',
): Promise<CreateMissionResult> {
  const { session } = await neonAuth()
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // Validate inhabitant type
  const config = MISSION_CONFIG[inhabitantType]
  if (!config) {
    return { success: false, error: 'Type d\'habitant non valide pour les missions' }
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

  // Verify target cell matches the expected feature for this worker type
  const worldMap = generateWorldMap()
  const cell = worldMap[targetY]?.[targetX]
  if (!cell || cell.feature !== config.feature) {
    return { success: false, error: `La case cible n'est pas une ${config.featureLabel.toLowerCase()}` }
  }

  // Get worker stats
  const stats = await getInhabitantStats()
  const workerStats = stats[inhabitantType]
  if (!workerStats || workerStats.speed <= 0) {
    return { success: false, error: `Statistiques du ${config.workerLabel} introuvables` }
  }

  // Check worker availability
  const totalWorkers = (village.inhabitants as Record<string, unknown>)?.[inhabitantType] as number ?? 0
  const activeMissions = await prisma.mission.count({
    where: {
      villageId: village.id,
      inhabitantType,
      completedAt: null,
    },
  })

  if (totalWorkers - activeMissions <= 0) {
    return { success: false, error: `Aucun ${config.workerLabel} disponible` }
  }

  // Compute travel time
  const distance = manhattanDistance(village.x, village.y, targetX, targetY)
  if (distance === 0) {
    return { success: false, error: 'La cible est sur votre village' }
  }

  const travelSeconds = computeTravelSeconds(distance, workerStats.speed)

  await prisma.mission.create({
    data: {
      village: { connect: { id: village.id } },
      inhabitantType,
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
