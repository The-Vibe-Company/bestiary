export type MissionPhase = 'traveling-to' | 'working' | 'traveling-back' | 'completed'

export interface MissionStatus {
  phase: MissionPhase
  phaseProgress: number    // 0–1
  overallProgress: number  // 0–1
  secondsRemaining: number
  projectedWood: number
  canRecall: boolean       // true only if phase = traveling-to and not recalled
}

export interface ActiveMission {
  id: string
  inhabitantType: string
  inhabitantTitle: string
  targetX: number
  targetY: number
  departedAt: Date
  travelSeconds: number
  workSeconds: number
  recalledAt: Date | null
  status: MissionStatus
}
