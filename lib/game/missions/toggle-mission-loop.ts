'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'

export type ToggleMissionLoopResult =
  | { success: true; loop: boolean }
  | { success: false; error: string }

export async function toggleMissionLoop(missionId: string): Promise<ToggleMissionLoopResult> {
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

  if (mission.village.ownerId !== session.userId) {
    return { success: false, error: 'Cette mission ne vous appartient pas' }
  }

  if (mission.completedAt) {
    return { success: false, error: 'Mission déjà terminée' }
  }

  const updated = await prisma.mission.update({
    where: { id: missionId },
    data: { loop: !mission.loop },
  })

  revalidatePath('/place')
  revalidatePath('/map')

  return { success: true, loop: updated.loop }
}
