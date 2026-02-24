'use server'

import { prisma } from '@/lib/prisma'
import { neonAuth } from '@neondatabase/auth/next/server'
import { revalidatePath } from 'next/cache'

/**
 * Marks all unread notifications for the current user's village as read.
 */
export async function markNotificationsRead() {
  const { session } = await neonAuth()
  if (!session) return

  const village = await prisma.village.findUnique({
    where: { ownerId: session.userId },
    select: { id: true },
  })

  if (!village) return

  await prisma.notification.updateMany({
    where: {
      villageId: village.id,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  })

  revalidatePath('/', 'layout')
}
