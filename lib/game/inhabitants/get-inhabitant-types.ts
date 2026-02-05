import { prisma } from '@/lib/prisma'
import type { InhabitantTypeMetadata } from './types'

export async function getInhabitantTypes(): Promise<InhabitantTypeMetadata[]> {
  const types = await prisma.inhabitantType.findMany({
    orderBy: { order: 'asc' },
  })
  return types
}
