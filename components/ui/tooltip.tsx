'use client'

import { ReactNode } from 'react'

interface TooltipProps {
  label: string
  children: ReactNode
  position?: 'top' | 'bottom'
}

export function Tooltip({ label, children, position = 'top' }: TooltipProps) {
  const isTop = position === 'top'

  return (
    <div className="relative group/tooltip">
      {children}
      <div
        className="absolute left-1/2 -translate-x-1/2 px-2.5 py-1 rounded text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 delay-200 z-50"
        style={{
          [isTop ? 'bottom' : 'top']: 'calc(100% + 6px)',
          backgroundColor: 'rgba(26, 26, 26, 0.95)',
          color: '#f5f5dc',
          border: '1px solid rgba(245, 245, 220, 0.3)',
        }}
      >
        {label}
      </div>
    </div>
  )
}
