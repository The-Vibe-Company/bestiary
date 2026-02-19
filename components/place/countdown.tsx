'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface CountdownProps {
  targetDate: Date
}

function formatTimeRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function Countdown({ targetDate }: CountdownProps) {
  const router = useRouter()
  const target = new Date(targetDate).getTime()

  // Start with null to avoid hydration mismatch (server vs client time drift)
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const compute = () => Math.max(0, Math.ceil((target - Date.now()) / 1000))

    // Set initial value on mount (client-only)
    setRemaining(compute())

    const interval = setInterval(() => {
      const diff = compute()
      setRemaining(diff)

      if (diff <= 0) {
        clearInterval(interval)
        router.refresh()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [target, router])

  return (
    <span className="inline-block min-w-[5ch] text-center tabular-nums font-mono tracking-wide text-[var(--burnt-amber)]">
      {remaining !== null ? formatTimeRemaining(remaining) : '…'}
    </span>
  )
}
