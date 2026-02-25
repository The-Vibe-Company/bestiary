'use server'

import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'
import { revalidatePath } from 'next/cache'

/**
 * Deletes a single notification belonging to the current user's village.
 */
export async function deleteNotification(notificationId: string) {
  const { session } = await neonAuth()
  if (!session) return

  const village = await prisma.village.findUnique({
    where: { ownerId: session.userId },
    select: { id: true },
  })

  if (!village) return

  // Only delete if the notification belongs to this village
  await prisma.notification.deleteMany({
    where: {
      id: notificationId,
      villageId: village.id,
    },
  })

  revalidatePath('/', 'layout')
}
