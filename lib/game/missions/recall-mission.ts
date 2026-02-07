'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'

export type RecallMissionResult =
  | { success: true }
  | { success: false; error: string }

export async function recallMission(missionId: string): Promise<RecallMissionResult> {
  const { session } = await neonAuth()
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    include: { village: true },
  })

  if (!mission) {
    return { success: false, error: 'Mission introuvable' }
  }

  // Verify ownership
  if (mission.village.ownerId !== session.userId) {
    return { success: false, error: 'Cette mission ne vous appartient pas' }
  }

  // Check not already recalled
  if (mission.recalledAt) {
    return { success: false, error: 'Mission déjà rappelée' }
  }

  // Check still in traveling-to phase
  const now = new Date()
  const arriveAt = mission.departedAt.getTime() + mission.travelSeconds * 1000
  if (now.getTime() >= arriveAt) {
    return { success: false, error: 'Le bûcheron n\'est plus en trajet aller' }
  }

  await prisma.mission.update({
    where: { id: missionId },
    data: { recalledAt: now },
  })

  revalidatePath('/place')
  revalidatePath('/map')

  return { success: true }
}
