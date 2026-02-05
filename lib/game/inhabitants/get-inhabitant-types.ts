import { prisma } from '@/lib/prisma'
import type { InhabitantType } from '@prisma/client'

export async function getInhabitantTypes(): Promise<InhabitantType[]> {
  const types = await prisma.inhabitantType.findMany({
    orderBy: { order: 'asc' },
  })
  return types
}
