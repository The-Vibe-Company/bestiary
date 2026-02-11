import { prisma } from '@/lib/prisma'
import type { BuildingType } from '@prisma/client'

export async function getBuildingTypes(): Promise<BuildingType[]> {
  const types = await prisma.buildingType.findMany({
    orderBy: { order: 'asc' },
  })
  return types
}
