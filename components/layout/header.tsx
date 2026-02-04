'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IoHome, IoMap, IoPeople, IoFlask, IoBook } from 'react-icons/io5'
import { SignOutButton } from '@/components/auth/sign-out-button'

export function Header() {
  const pathname = usePathname()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-center">
        {/* Logo */}
        <h1 className="absolute left-6 text-3xl font-[family-name:var(--font-title)] tracking-[0.2em] text-[var(--ivory)]">
          BESTIARY
        </h1>

        {/* Navigation centrée */}
        <nav className="flex items-center gap-4">
          <Link
            href="/village"
            className={`flex items-center justify-center w-12 h-12 border-2 rounded transition-all duration-300 ${
              pathname === '/village'
                ? 'bg-[#CC7722] border-[#CC7722] text-white shadow-lg shadow-[#CC7722]/50'
                : 'border-[var(--ivory)] text-[var(--ivory)] hover:bg-[var(--burnt-amber)]/20 hover:text-[var(--burnt-amber)] hover:border-[var(--burnt-amber)] hover:scale-105 hover:shadow-md hover:shadow-[var(--burnt-amber)]/30'
            }`}
          >
            <IoHome size={24} />
          </Link>

          <Link
            href="/habitants"
            className={`flex items-center justify-center w-12 h-12 border-2 rounded transition-all duration-300 ${
              pathname === '/habitants'
                ? 'bg-[#CC7722] border-[#CC7722] text-white shadow-lg shadow-[#CC7722]/50'
                : 'border-[var(--ivory)] text-[var(--ivory)] hover:bg-[var(--burnt-amber)]/20 hover:text-[var(--burnt-amber)] hover:border-[var(--burnt-amber)] hover:scale-105 hover:shadow-md hover:shadow-[var(--burnt-amber)]/30'
            }`}
          >
            <IoPeople size={24} />
          </Link>

          <Link
            href="/research"
            className={`flex items-center justify-center w-12 h-12 border-2 rounded transition-all duration-300 ${
              pathname === '/research'
                ? 'bg-[#CC7722] border-[#CC7722] text-white shadow-lg shadow-[#CC7722]/50'
                : 'border-[var(--ivory)] text-[var(--ivory)] hover:bg-[var(--burnt-amber)]/20 hover:text-[var(--burnt-amber)] hover:border-[var(--burnt-amber)] hover:scale-105 hover:shadow-md hover:shadow-[var(--burnt-amber)]/30'
            }`}
          >
            <IoFlask size={24} />
          </Link>

          <Link
            href="/bestiary"
            className={`flex items-center justify-center w-12 h-12 border-2 rounded transition-all duration-300 ${
              pathname === '/bestiary'
                ? 'bg-[#CC7722] border-[#CC7722] text-white shadow-lg shadow-[#CC7722]/50'
                : 'border-[var(--ivory)] text-[var(--ivory)] hover:bg-[var(--burnt-amber)]/20 hover:text-[var(--burnt-amber)] hover:border-[var(--burnt-amber)] hover:scale-105 hover:shadow-md hover:shadow-[var(--burnt-amber)]/30'
            }`}
          >
            <IoBook size={24} />
          </Link>

          <Link
            href="/map"
            className={`flex items-center justify-center w-12 h-12 border-2 rounded transition-all duration-300 ${
              pathname === '/map'
                ? 'bg-[#CC7722] border-[#CC7722] text-white shadow-lg shadow-[#CC7722]/50'
                : 'border-[var(--ivory)] text-[var(--ivory)] hover:bg-[var(--burnt-amber)]/20 hover:text-[var(--burnt-amber)] hover:border-[var(--burnt-amber)] hover:scale-105 hover:shadow-md hover:shadow-[var(--burnt-amber)]/30'
            }`}
          >
            <IoMap size={24} />
          </Link>
        </nav>

        {/* Sign Out Button à droite */}
        <div className="absolute right-6">
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
