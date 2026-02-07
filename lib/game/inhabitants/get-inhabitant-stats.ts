import { prisma } from '@/lib/prisma'

export interface InhabitantStats {
  speed: number
  gatherRate: number
  maxCapacity: number
}

export async function getInhabitantStats(): Promise<Record<string, InhabitantStats>> {
  const types = await prisma.inhabitantType.findMany()
  const map: Record<string, InhabitantStats> = {}
  for (const t of types) {
    map[t.key] = {
      speed: t.speed,
      gatherRate: t.gatherRate,
      maxCapacity: t.maxCapacity,
    }
  }
  return map
}
