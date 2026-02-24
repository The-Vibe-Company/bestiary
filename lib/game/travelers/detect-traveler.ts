import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/game/notifications/create-notification'
import { NOTIFICATION_TYPES } from '@/lib/game/notifications/types'
import type { TravelerStatus } from './resolve-traveler'
import { applyDetection, type DetectedTravelerStatus } from './detection'

/**
 * Applies watchtower detection to a raw traveler status.
 *
 * When a traveler enters the detection window for the first time,
 * sets `detectedAt` on the record and creates a notification.
 * Subsequent calls for the same traveler cycle are idempotent.
 */
export async function detectTraveler(
  villageId: string,
  raw: TravelerStatus,
  towerLevel: number,
): Promise<DetectedTravelerStatus> {
  const detected = applyDetection(raw, towerLevel)

  if (detected.status !== 'detected') {
    return detected
  }

  // Check if this traveler was already detected (avoid duplicate notifications)
  const traveler = await prisma.villageTraveler.findUnique({
    where: { villageId },
    select: { id: true, detectedAt: true },
  })

  if (!traveler || traveler.detectedAt !== null) {
    return detected
  }

  // First detection — mark and notify
  await prisma.villageTraveler.update({
    where: { id: traveler.id },
    data: { detectedAt: new Date() },
  })

  await createNotification({
    villageId,
    type: NOTIFICATION_TYPES.TRAVELER_DETECTED,
    title: 'Voyageur détecté',
    message: 'La tour de guet a repéré un voyageur en approche !',
    data: {
      arrivesAt: detected.arrivesAt.toISOString(),
      towerLevel,
    },
  })

  return detected
}
