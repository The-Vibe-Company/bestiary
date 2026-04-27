import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { applyDailyConsumption } from '@/lib/game/resources/apply-daily-consumption'
import { getInhabitantTypes } from '@/lib/game/inhabitants/get-inhabitant-types'

// Process villages in batches to avoid overwhelming the DB connection pool.
const BATCH_SIZE = 25

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date()

  const [villages, inhabitantTypes] = await Promise.all([
    prisma.village.findMany({ select: { id: true } }),
    getInhabitantTypes(),
  ])

  let processed = 0

  for (let i = 0; i < villages.length; i += BATCH_SIZE) {
    const batch = villages.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map((v) => applyDailyConsumption(v.id, inhabitantTypes, now))
    )
    for (let j = 0; j < results.length; j++) {
      const r = results[j]
      if (r.status === 'fulfilled') {
        if (r.value) processed++
      } else {
        console.error(`Failed to process village ${batch[j].id}:`, r.reason)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    totalVillages: villages.length,
    processed,
    timestamp: now.toISOString(),
  })
}
