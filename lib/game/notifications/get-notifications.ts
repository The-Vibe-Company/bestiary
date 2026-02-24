import { prisma } from '@/lib/prisma'

export interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  data: unknown
  readAt: Date | null
  createdAt: Date
}

/**
 * Fetches the most recent notifications for a village.
 * Returns unread first, then read, ordered by most recent.
 */
export async function getNotifications(
  villageId: string,
  limit = 20,
): Promise<NotificationItem[]> {
  return prisma.notification.findMany({
    where: { villageId },
    orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      data: true,
      readAt: true,
      createdAt: true,
    },
  })
}

/**
 * Counts unread notifications for a village.
 */
export async function getUnreadCount(villageId: string): Promise<number> {
  return prisma.notification.count({
    where: { villageId, readAt: null },
  })
}
