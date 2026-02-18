import type { MissionPhase, MissionStatus } from './types'

interface MissionData {
  departedAt: Date
  travelSeconds: number
  workSeconds: number
  recalledAt: Date | null
  gatherRate: number
  maxCapacity: number
}

export function computeMissionStatus(mission: MissionData, now: Date = new Date()): MissionStatus {
  const nowMs = now.getTime()
  const departedMs = mission.departedAt.getTime()

  // Recalled during outbound travel
  if (mission.recalledAt) {
    const recalledMs = mission.recalledAt.getTime()
    const elapsedBeforeRecall = (recalledMs - departedMs) / 1000
    const returnArrivalMs = recalledMs + elapsedBeforeRecall * 1000
    const totalDuration = elapsedBeforeRecall * 2

    if (nowMs < returnArrivalMs) {
      const elapsed = (nowMs - recalledMs) / 1000
      return {
        phase: 'traveling-back',
        phaseProgress: clamp(elapsed / elapsedBeforeRecall),
        overallProgress: clamp((elapsedBeforeRecall + elapsed) / totalDuration),
        secondsRemaining: Math.max(0, Math.ceil((returnArrivalMs - nowMs) / 1000)),
        projectedResource: 0,
        canRecall: false,
      }
    }

    return {
      phase: 'completed',
      phaseProgress: 1,
      overallProgress: 1,
      secondsRemaining: 0,
      projectedResource: 0,
      canRecall: false,
    }
  }

  // Normal flow
  const travelMs = mission.travelSeconds * 1000
  const workMs = mission.workSeconds * 1000
  const totalMs = travelMs * 2 + workMs

  const arriveAtTarget = departedMs + travelMs
  const finishWork = arriveAtTarget + workMs
  const arriveHome = finishWork + travelMs

  const projectedResource = Math.min(
    Math.floor((mission.workSeconds / 3600) * mission.gatherRate),
    mission.maxCapacity,
  )

  let phase: MissionPhase
  let phaseProgress: number
  let overallProgress: number
  let secondsRemaining: number

  if (nowMs < arriveAtTarget) {
    phase = 'traveling-to'
    const elapsed = nowMs - departedMs
    phaseProgress = clamp(elapsed / travelMs)
    overallProgress = clamp(elapsed / totalMs)
    secondsRemaining = Math.max(0, Math.ceil((arriveHome - nowMs) / 1000))
  } else if (nowMs < finishWork) {
    phase = 'working'
    const elapsed = nowMs - arriveAtTarget
    phaseProgress = clamp(elapsed / workMs)
    overallProgress = clamp((travelMs + elapsed) / totalMs)
    secondsRemaining = Math.max(0, Math.ceil((arriveHome - nowMs) / 1000))
  } else if (nowMs < arriveHome) {
    phase = 'traveling-back'
    const elapsed = nowMs - finishWork
    phaseProgress = clamp(elapsed / travelMs)
    overallProgress = clamp((travelMs + workMs + elapsed) / totalMs)
    secondsRemaining = Math.max(0, Math.ceil((arriveHome - nowMs) / 1000))
  } else {
    phase = 'completed'
    phaseProgress = 1
    overallProgress = 1
    secondsRemaining = 0
  }

  return {
    phase,
    phaseProgress,
    overallProgress,
    secondsRemaining,
    projectedResource,
    canRecall: phase === 'traveling-to',
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}
