import { prisma } from '@/lib/prisma'

export interface InhabitantStats {
  speed: number
  gatherRate: number
  maxCapacity: number
}

export async function getInhabitantStats(): Promise<Record<string, InhabitantStats>> {
  const multiplier = process.env.DEV_STAT_MULTIPLIER
    ? parseFloat(process.env.DEV_STAT_MULTIPLIER)
    : 1

  const types = await prisma.inhabitantType.findMany()
  const map: Record<string, InhabitantStats> = {}
  for (const t of types) {
    map[t.key] = {
      speed: t.speed * multiplier,
      gatherRate: t.gatherRate * multiplier,
      maxCapacity: t.maxCapacity * multiplier,
    }
  }
  return map
}
