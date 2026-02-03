'use client'

import { Button } from '@/components/ui/button'

interface MapControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onHome: () => void
}

export function MapControls({ onZoomIn, onZoomOut, onReset, onHome }: MapControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <Button variant="stone" size="sm" onClick={onZoomIn}>
        +
      </Button>
      <Button variant="stone" size="sm" onClick={onZoomOut}>
        -
      </Button>
      <Button variant="ethereal" size="sm" onClick={onReset}>
        ⟲
      </Button>

      <div className="border-t border-[var(--ivory)]/20 my-2" />

      <Button variant="stone" size="sm" onClick={onHome}>
        🏠
      </Button>
    </div>
  )
}
