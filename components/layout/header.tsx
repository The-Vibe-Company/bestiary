'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GiWell, GiVillage, GiFarmer, GiScrollUnfurled, GiPawPrint, GiTreasureMap } from 'react-icons/gi'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { Tooltip } from '@/components/ui/tooltip'
import type { IconType } from 'react-icons'

const NAV_ITEMS: { href: string; icon: IconType; label: string }[] = [
  { href: '/place', icon: GiWell, label: 'Place du Village' },
  { href: '/village', icon: GiVillage, label: 'Village' },
  { href: '/habitants', icon: GiFarmer, label: 'Habitants' },
  { href: '/research', icon: GiScrollUnfurled, label: 'Laboratoire' },
  { href: '/bestiary', icon: GiPawPrint, label: 'Bestiaire' },
  { href: '/map', icon: GiTreasureMap, label: 'Carte' },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 stone-texture-translucent header-border-amber">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Left: Illuminated Logo */}
        <Link href="/place" className="flex items-center gap-2.5">
          <span className="text-[var(--burnt-amber)] text-xs">◆</span>
          <h1
            className="font-[family-name:var(--font-title)] font-bold tracking-[0.2em]"
            style={{ textShadow: '0 0 20px rgba(179,123,52,0.3)' }}
          >
            <span className="text-2xl text-[var(--burnt-amber)]">B</span>
            <span className="text-lg text-[var(--ivory)]">ESTIARY</span>
          </h1>
          <span className="text-[var(--burnt-amber)] text-xs">◆</span>
        </Link>

        {/* Center: Navigation */}
        <nav className="flex items-center gap-3">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Tooltip key={href} label={label} position="bottom">
              <Link
                href={href}
                className={`flex items-center justify-center w-12 h-12 border-2 rounded-full transition-all duration-300 ${
                  pathname === href
                    ? 'bg-[#CC7722] border-[#CC7722] text-white shadow-lg shadow-[#CC7722]/50'
                    : 'border-[var(--ivory)] text-[var(--ivory)] hover:bg-[var(--burnt-amber)]/20 hover:text-[var(--burnt-amber)] hover:border-[var(--burnt-amber)] hover:scale-105 hover:shadow-md hover:shadow-[var(--burnt-amber)]/30'
                }`}
              >
                <Icon size={24} />
              </Link>
            </Tooltip>
          ))}
        </nav>

        {/* Right: Sign Out */}
        <SignOutButton />
      </div>
    </header>
  )
}
