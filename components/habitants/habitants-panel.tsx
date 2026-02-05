import { type ReactNode } from 'react'

interface HabitantsPanelProps {
  children: ReactNode
}

/**
 * Panel wrapper for the habitants list.
 * The panel stays fixed while its content scrolls internally.
 */
export function HabitantsPanel({ children }: HabitantsPanelProps) {
  return (
    <div className="w-[60%] max-w-3xl max-h-[70vh] bg-black/75 backdrop-blur border border-[var(--burnt-amber)]/50 rounded-2xl flex flex-col">
      <div className="overflow-y-auto scrollbar-amber divide-y divide-[var(--ivory)]/10">
        {children}
      </div>
    </div>
  )
}
