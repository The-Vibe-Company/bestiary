'use client'

import { GiTwoCoins, GiSpellBook, GiPerson } from 'react-icons/gi'
import { Tooltip } from '@/components/ui/tooltip'

interface UserResourceBarProps {
  username: string
  userResources: {
    or: number
    savoir: number
  }
}

export function UserResourceBar({ username, userResources }: UserResourceBarProps) {
  return (
    <div className="h-10 bg-black/80 backdrop-blur-sm border border-[var(--ivory)]/20 rounded-xl px-6">
      <div className="h-full flex items-center justify-center gap-6">
        {/* Username */}
        <div className="flex items-center gap-1.5">
          <GiPerson size={18} className="text-[var(--burnt-amber)]" />
          <span className="text-sm font-bold font-[family-name:var(--font-title)] tracking-wider text-[var(--burnt-amber)]">
            {username}
          </span>
        </div>

        <div className="w-px h-5 bg-[var(--ivory)]/30" />

        {/* Gold */}
        <Tooltip label="Or">
          <div className="flex items-center gap-1.5">
            <GiTwoCoins size={20} style={{ color: '#FFD700' }} />
            <span className="text-sm font-bold" style={{ color: '#FFD700' }}>
              {userResources.or}
            </span>
          </div>
        </Tooltip>

        {/* Knowledge */}
        <Tooltip label="Savoir">
          <div className="flex items-center gap-1.5">
            <GiSpellBook size={20} style={{ color: '#9370DB' }} />
            <span className="text-sm font-bold" style={{ color: '#9370DB' }}>
              {userResources.savoir}
            </span>
          </div>
        </Tooltip>
      </div>
    </div>
  )
}
