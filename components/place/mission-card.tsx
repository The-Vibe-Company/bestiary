'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { computeMissionStatus } from '@/lib/game/missions/compute-mission-status'
import { recallMission } from '@/lib/game/missions/recall-mission'
import { toggleMissionLoop } from '@/lib/game/missions/toggle-mission-loop'
import { GiAxeInStump } from 'react-icons/gi'
import type { ActiveMission, MissionPhase } from '@/lib/game/missions/types'

const MISSION_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  lumberjack: GiAxeInStump,
}

interface MissionCardProps {
  mission: ActiveMission
  gatherRate: number
  maxCapacity: number
}

const PHASE_CONFIG: Record<MissionPhase, { label: string; color: string; bgColor: string }> = {
  'traveling-to': {
    label: 'En route',
    color: 'var(--burnt-amber)',
    bgColor: 'rgba(179, 123, 52, 0.15)',
  },
  working: {
    label: 'Au travail',
    color: 'rgb(101, 163, 78)',
    bgColor: 'rgba(101, 163, 78, 0.15)',
  },
  'traveling-back': {
    label: 'Retour',
    color: 'var(--ivory)',
    bgColor: 'rgba(245, 245, 220, 0.1)',
  },
  completed: {
    label: 'Terminé',
    color: 'var(--ivory)',
    bgColor: 'rgba(245, 245, 220, 0.1)',
  },
}

function formatTimeRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

export function MissionCard({ mission, gatherRate, maxCapacity }: MissionCardProps) {
  const router = useRouter()
  const [confirmRecall, setConfirmRecall] = useState(false)
  const [recalling, setRecalling] = useState(false)
  const [loopActive, setLoopActive] = useState(mission.loop)

  const computeStatus = useCallback(() => {
    return computeMissionStatus(
      {
        departedAt: new Date(mission.departedAt),
        travelSeconds: mission.travelSeconds,
        workSeconds: mission.workSeconds,
        recalledAt: mission.recalledAt ? new Date(mission.recalledAt) : null,
        gatherRate,
        maxCapacity,
      },
      new Date(),
    )
  }, [mission, gatherRate, maxCapacity])

  const [status, setStatus] = useState(computeStatus)

  // Real-time timer
  useEffect(() => {
    if (status.phase === 'completed') return
    const interval = setInterval(() => {
      const newStatus = computeStatus()
      setStatus(newStatus)
      if (newStatus.phase === 'completed') {
        clearInterval(interval)
        router.refresh()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [computeStatus, status.phase, router])

  const phaseConfig = PHASE_CONFIG[status.phase]

  // Segmented progress bar proportions
  const totalDuration = mission.travelSeconds * 2 + mission.workSeconds
  const travelPct = (mission.travelSeconds / totalDuration) * 100
  const workPct = (mission.workSeconds / totalDuration) * 100

  async function handleRecall() {
    if (!confirmRecall) {
      setConfirmRecall(true)
      return
    }
    setRecalling(true)
    const result = await recallMission(mission.id)
    if (result.success) {
      router.refresh()
    }
    setRecalling(false)
    setConfirmRecall(false)
  }

  async function handleToggleLoop() {
    const prev = loopActive
    setLoopActive(!prev)
    const result = await toggleMissionLoop(mission.id)
    if (!result.success) {
      setLoopActive(prev)
    }
  }

  const IconComponent = MISSION_ICON[mission.inhabitantType]

  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-[var(--ivory)]/10 p-3 transition-colors"
      style={{ backgroundColor: phaseConfig.bgColor }}
    >
      {/* Big icon on the left */}
      <div
        className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg"
        style={{ backgroundColor: `${phaseConfig.color}20`, color: phaseConfig.color }}
      >
        {IconComponent ? <IconComponent size={24} /> : (
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: phaseConfig.color }} />
        )}
      </div>

      {/* Right side: info */}
      <div className="flex-1 min-w-0">
        {/* Line 1: phase + time + coordinates */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: phaseConfig.color }} />
            <span
              className="text-sm font-[family-name:var(--font-title)] tracking-wider"
              style={{ color: phaseConfig.color }}
            >
              {phaseConfig.label}
            </span>
            <span className="text-xs text-[var(--ivory)]/50">
              {status.secondsRemaining > 0
                ? formatTimeRemaining(status.secondsRemaining)
                : 'Terminé'}
            </span>
          </div>
          <span className="text-xs text-[var(--ivory)]/40">
            ({mission.targetX}, {mission.targetY})
          </span>
        </div>

        {/* Line 2: segmented progress bar */}
        <div className="flex h-1.5 rounded-full overflow-hidden mb-1.5 bg-[var(--ivory)]/5">
          {/* Travel-to segment */}
          <div className="relative" style={{ width: `${travelPct}%` }}>
            <div
              className="absolute inset-0 rounded-l-full"
              style={{
                backgroundColor: PHASE_CONFIG['traveling-to'].color,
                width:
                  status.phase === 'traveling-to'
                    ? `${status.phaseProgress * 100}%`
                    : status.phase === 'working' || status.phase === 'traveling-back' || status.phase === 'completed'
                      ? '100%'
                      : '0%',
                opacity: 0.8,
              }}
            />
          </div>
          {/* Work segment */}
          <div className="relative" style={{ width: `${workPct}%` }}>
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: PHASE_CONFIG['working'].color,
                width:
                  status.phase === 'working'
                    ? `${status.phaseProgress * 100}%`
                    : status.phase === 'traveling-back' || status.phase === 'completed'
                      ? '100%'
                      : '0%',
                opacity: 0.8,
              }}
            />
          </div>
          {/* Travel-back segment */}
          <div className="relative" style={{ width: `${travelPct}%` }}>
            <div
              className="absolute inset-0 rounded-r-full"
              style={{
                backgroundColor: PHASE_CONFIG['traveling-back'].color,
                width:
                  status.phase === 'traveling-back'
                    ? `${status.phaseProgress * 100}%`
                    : status.phase === 'completed'
                      ? '100%'
                      : '0%',
                opacity: 0.6,
              }}
            />
          </div>
        </div>

        {/* Line 3: worker info + recall button */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--ivory)]/40">
            1 {mission.inhabitantTitle}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleLoop}
              title="Activer/Désactiver la boucle"
              className="flex items-center justify-center w-7 h-7 rounded transition-colors hover:bg-[var(--ivory)]/10 cursor-pointer"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  color: loopActive ? 'var(--burnt-amber)' : 'rgba(245, 245, 220, 0.3)',
                }}
              >
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </button>

            {status.canRecall && (
              <button
                type="button"
                onClick={handleRecall}
                disabled={recalling}
                className="text-[10px] font-[family-name:var(--font-title)] tracking-wider px-2 py-0.5 rounded
                  border border-[var(--ivory)]/20 text-[var(--ivory)]/70
                  hover:bg-[var(--ivory)]/10 hover:text-[var(--ivory)]
                  disabled:opacity-50 cursor-pointer transition-colors"
              >
                {confirmRecall ? 'CONFIRMER ?' : 'RAPPELER'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
