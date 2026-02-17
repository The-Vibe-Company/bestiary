import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { applyDailyConsumption } from '@/lib/game/resources/apply-daily-consumption'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date()

  const villages = await prisma.village.findMany({
    select: { id: true },
  })

  const inhabitantTypes = await prisma.inhabitantType.findMany()

  let processed = 0

  for (const village of villages) {
    try {
      const updated = await applyDailyConsumption(village.id, inhabitantTypes, now)
      if (updated) processed++
    } catch (error) {
      console.error(`Failed to process village ${village.id}:`, error)
    }
  }

  return NextResponse.json({
    ok: true,
    totalVillages: villages.length,
    processed,
    timestamp: now.toISOString(),
  })
}
