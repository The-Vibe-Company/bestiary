'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IoHome, IoMap } from 'react-icons/io5'

export function Header() {
  const pathname = usePathname()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-[var(--ivory)]/20">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-center">
        {/* Logo */}
        <h1 className="absolute left-6 text-3xl font-[family-name:var(--font-title)] tracking-[0.2em] text-[var(--ivory)]">
          BESTIARY
        </h1>

        {/* Navigation centrée */}
        <nav className="flex items-center gap-4">
          <Link
            href="/home"
            className={`flex items-center justify-center w-12 h-12 border-2 rounded transition-all duration-300 ${
              pathname === '/home'
                ? 'bg-[#CC7722] border-[#CC7722] text-[var(--obsidian)] shadow-lg shadow-[#CC7722]/50'
                : 'border-[var(--ivory)] text-[var(--ivory)] hover:bg-[var(--burnt-amber)]/20 hover:text-[var(--burnt-amber)] hover:border-[var(--burnt-amber)] hover:scale-105 hover:shadow-md hover:shadow-[var(--burnt-amber)]/30'
            }`}
          >
            <IoHome size={24} />
          </Link>

          <Link
            href="/map"
            className={`flex items-center justify-center w-12 h-12 border-2 rounded transition-all duration-300 ${
              pathname === '/map'
                ? 'bg-[#CC7722] border-[#CC7722] text-[var(--obsidian)] shadow-lg shadow-[#CC7722]/50'
                : 'border-[var(--ivory)] text-[var(--ivory)] hover:bg-[var(--burnt-amber)]/20 hover:text-[var(--burnt-amber)] hover:border-[var(--burnt-amber)] hover:scale-105 hover:shadow-md hover:shadow-[var(--burnt-amber)]/30'
            }`}
          >
            <IoMap size={24} />
          </Link>
        </nav>
      </div>
    </header>
  )
}
