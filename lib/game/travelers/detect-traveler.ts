import { prisma } from '@/lib/prisma'
import type { TravelerStatus } from './resolve-traveler'
import { applyDetection, type DetectedTravelerStatus } from './detection'

/**
 * Applies watchtower detection to a raw traveler status.
 *
 * When a traveler enters the detection window for the first time,
 * sets `detectedAt` on the record.
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

  // First detection — mark it
  await prisma.villageTraveler.update({
    where: { id: traveler.id },
    data: { detectedAt: new Date() },
  })

  return detected
}
