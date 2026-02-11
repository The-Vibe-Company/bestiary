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
    <>
      <style>{`
        .habitants-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .habitants-scroll::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.8);
        }
        .habitants-scroll::-webkit-scrollbar-thumb {
          background: var(--burnt-amber);
          border-radius: 2px;
        }
        .habitants-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--burnt-amber-light);
        }
      `}</style>
      <div className="w-[60%] max-w-3xl max-h-[85vh] bg-black/75 backdrop-blur border border-[var(--burnt-amber)]/50 rounded-l-2xl rounded-r-lg overflow-hidden">
        <div className="max-h-[85vh] overflow-y-scroll habitants-scroll divide-y divide-[var(--ivory)]/10 pr-1">
          {children}
        </div>
      </div>
    </>
  )
}
