'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GiWalk, GiWatchtower, GiBeerStein } from 'react-icons/gi'
import type { DetectedTravelerStatus } from '@/lib/game/travelers/detection'

function formatTimeRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

interface TravelerCardProps {
  travelerStatus: Exclude<DetectedTravelerStatus, { status: 'hidden' }>
  tavernLevel: number
  isVillageFull: boolean
  onWelcome: () => void
  onAssign: () => void
  pendingWelcome: boolean
  welcomeError: string | null
}

const STATE_CONFIG = {
  detected: {
    color: 'var(--burnt-amber)',
    bgColor: 'rgba(179, 123, 52, 0.15)',
  },
  waiting: {
    color: 'var(--burnt-amber)',
    bgColor: 'rgba(179, 123, 52, 0.15)',
  },
  tavern: {
    color: 'rgb(180, 140, 60)',
    bgColor: 'rgba(180, 140, 60, 0.12)',
  },
  welcomed: {
    color: 'rgb(101, 163, 78)',
    bgColor: 'rgba(101, 163, 78, 0.15)',
  },
}

export function TravelerCard({
  travelerStatus,
  tavernLevel,
  isVillageFull,
  onWelcome,
  onAssign,
  pendingWelcome,
  welcomeError,
}: TravelerCardProps) {
  const router = useRouter()
  const hasTavern = tavernLevel > 0

  // Determine visual state
  let stateKey: keyof typeof STATE_CONFIG
  let Icon: React.ComponentType<{ size: number }>
  let label: string
  let description: string
  let targetDate: Date | null = null

  if (travelerStatus.status === 'detected') {
    stateKey = 'detected'
    Icon = GiWatchtower
    label = 'En approche'
    description = 'Repéré par la tour de guet'
    targetDate = travelerStatus.arrivesAt
  } else if (travelerStatus.isWelcomed) {
    stateKey = 'welcomed'
    Icon = hasTavern ? GiBeerStein : GiWalk
    label = 'Accueilli'
    description = "En attente d'affectation"
  } else {
    stateKey = hasTavern ? 'tavern' : 'waiting'
    Icon = hasTavern ? GiBeerStein : GiWalk
    label = hasTavern ? 'À la taverne' : 'Aux portes'
    description = hasTavern ? 'Séjourne à la taverne' : 'En attente'
    targetDate = travelerStatus.departsAt
  }

  const config = STATE_CONFIG[stateKey]

  // Real-time countdown (same pattern as MissionCard)
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    if (!targetDate) return 0
    return Math.max(0, Math.ceil((new Date(targetDate).getTime() - Date.now()) / 1000))
  })

  useEffect(() => {
    if (!targetDate) return
    const target = new Date(targetDate).getTime()
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000))
      setSecondsRemaining(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        router.refresh()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [targetDate, router])

  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-[var(--ivory)]/10 p-3 transition-colors"
      style={{ backgroundColor: config.bgColor }}
    >
      {/* Icon */}
      <div
        className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg"
        style={{ backgroundColor: `color-mix(in srgb, ${config.color} 12%, transparent)`, color: config.color }}
      >
        <Icon size={24} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {/* Line 1: status + countdown */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
            <span
              className="text-sm font-[family-name:var(--font-title)] tracking-wider"
              style={{ color: config.color }}
            >
              {label}
            </span>
            {targetDate && secondsRemaining > 0 && (
              <span className="text-xs text-[var(--ivory)]/50">
                {formatTimeRemaining(secondsRemaining)}
              </span>
            )}
          </div>
        </div>

        {/* Line 2: description + action buttons */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--ivory)]/40">
            {description}
          </span>

          <div className="flex items-center gap-2">
            {travelerStatus.status === 'present' && !travelerStatus.isWelcomed && (
              isVillageFull ? (
                <span className="text-[10px] text-[var(--burnt-amber)]/50 font-[family-name:var(--font-title)] tracking-wider uppercase">
                  Village plein
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onWelcome}
                  disabled={pendingWelcome}
                  className="text-[10px] font-[family-name:var(--font-title)] tracking-wider px-2 py-0.5 rounded
                    border border-[var(--burnt-amber)]/40 text-[var(--burnt-amber)]
                    hover:bg-[var(--burnt-amber)]/10
                    disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {pendingWelcome ? '...' : 'ACCUEILLIR'}
                </button>
              )
            )}

            {travelerStatus.status === 'present' && travelerStatus.isWelcomed && (
              <button
                type="button"
                onClick={onAssign}
                className="text-[10px] font-[family-name:var(--font-title)] tracking-wider px-2 py-0.5 rounded
                  border text-[rgb(101,163,78)] border-[rgb(101,163,78)]/40
                  hover:bg-[rgb(101,163,78)]/10
                  cursor-pointer transition-colors"
              >
                ASSIGNER
              </button>
            )}
          </div>
        </div>

        {welcomeError && (
          <p className="mt-1 text-[10px] text-[var(--burnt-amber)]/80">{welcomeError}</p>
        )}
      </div>
    </div>
  )
}
