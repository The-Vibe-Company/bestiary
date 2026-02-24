import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/prisma'
import type { NotificationType } from './types'

interface CreateNotificationParams {
  villageId: string
  type: NotificationType
  title: string
  message: string
  data?: Prisma.InputJsonValue
}

/**
 * Creates a notification record for a village.
 *
 * Accepts an optional transaction client (`tx`) so it can be called
 * inside an existing Prisma transaction without opening a nested one.
 */
export async function createNotification(
  params: CreateNotificationParams,
  tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
) {
  const client = tx ?? defaultPrisma

  return client.notification.create({
    data: {
      villageId: params.villageId,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data ?? undefined,
    },
  })
}
