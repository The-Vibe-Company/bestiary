import type { ComponentType } from 'react'
import { GiAxeInStump, GiWarPick, GiBowArrow, GiBasket, GiCompass } from 'react-icons/gi'

export const MISSION_ICONS: Record<string, ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  lumberjack: GiAxeInStump,
  miner: GiWarPick,
  hunter: GiBowArrow,
  gatherer: GiBasket,
  explorer: GiCompass,
}
