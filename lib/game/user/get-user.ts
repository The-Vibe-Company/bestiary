import { cache } from 'react'
import { prisma } from '@/lib/prisma'

export interface User {
  id: string
  username: string
  email: string
}

/** Cached per-request: avoids duplicate DB lookups within the same render. */
export const getUser = cache(async (userId: string): Promise<User | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
    }
  })

  return user
})
