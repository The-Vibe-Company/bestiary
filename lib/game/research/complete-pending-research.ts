import { prisma } from '@/lib/prisma'

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

  for (const research of pendingResearch) {
    const elapsedSeconds = (now.getTime() - research.startedAt.getTime()) / 1000
    if (elapsedSeconds < research.researchSeconds) continue

    await prisma.villageTechnology.update({
      where: { id: research.id },
      data: { completedAt: now },
    })
  }
}
