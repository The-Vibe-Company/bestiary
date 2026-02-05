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
          width: 10px;
          background: rgba(0, 0, 0, 0.4);
        }
        .habitants-scroll::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
        }
        .habitants-scroll::-webkit-scrollbar-thumb {
          background: var(--burnt-amber);
          border-radius: 5px;
        }
        .habitants-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--burnt-amber-light);
        }
      `}</style>
      <div className="w-[60%] max-w-3xl max-h-[70vh] bg-black/75 backdrop-blur border border-[var(--burnt-amber)]/50 rounded-l-2xl rounded-r-lg flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-scroll habitants-scroll divide-y divide-[var(--ivory)]/10">
          {children}
        </div>
      </div>
    </>
  )
}
