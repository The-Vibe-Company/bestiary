import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/game/notifications/create-notification'
import { NOTIFICATION_TYPES } from '@/lib/game/notifications/types'
import { getTechnologies } from './get-technologies'

/**
 * Lazy completion: called on page load.
 * Finds research whose timer has elapsed and marks them complete.
 * Idempotent — safe to call multiple times.
 */
export async function completePendingResearch(villageId: string): Promise<void> {
  const now = new Date()

  const pendingResearch = await prisma.villageTechnology.findMany({
    where: {
      villageId,
      completedAt: null,
    },
  })

  if (pendingResearch.length === 0) return

  // Fetch all technologies once (cached) for notification messages
  const technologies = await getTechnologies()
  const techMap = new Map(technologies.map((t) => [t.key, t]))

  for (const research of pendingResearch) {
    const elapsedSeconds = (now.getTime() - research.startedAt.getTime()) / 1000
    if (elapsedSeconds < research.researchSeconds) continue

    await prisma.villageTechnology.update({
      where: { id: research.id },
      data: { completedAt: now },
    })

    // Notify player of completed research
    const tech = techMap.get(research.technologyKey)
    const displayTitle = tech?.title ?? research.technologyKey
    await createNotification({
      villageId,
      type: NOTIFICATION_TYPES.RESEARCH_COMPLETED,
      title: 'Recherche terminée',
      message: research.level > 1
        ? `${displayTitle} a atteint le niveau ${research.level}.`
        : `${displayTitle} a été découvert.`,
      data: {
        technologyKey: research.technologyKey,
        technologyTitle: displayTitle,
        level: research.level,
      },
    })
  }
}
