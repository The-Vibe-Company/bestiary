import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background Image (full page, behind header) */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/assets/backgrounds/background-main.png)' }}
      />

      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/40"></div>

      {/* Header */}
      <header className="relative z-10 p-8 header-border-amber">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          {/* Logo/Title */}
          <div className="flex items-center gap-4">
            <span className="text-[var(--burnt-amber)] text-lg">◆</span>
            <h1
              className="font-[family-name:var(--font-title)] font-bold tracking-[0.2em]"
              style={{ textShadow: '0 0 30px rgba(179,123,52,0.4)' }}
            >
              <span className="text-6xl text-[var(--burnt-amber)]">B</span>
              <span className="text-4xl text-[var(--ivory)]">ESTIARY</span>
            </h1>
            <span className="text-[var(--burnt-amber)] text-lg">◆</span>
          </div>

          {/* Auth Buttons */}
          <div className="flex gap-4">
            <Link href="/sign-in">
              <Button variant="ethereal" size="lg">
                CONNEXION
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button variant="seal" size="lg">
                INSCRIPTION
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content - Centered Play Button */}
      <main className="relative z-10 flex-1 flex items-center justify-center">
        <Link href="/sign-up" className="group relative z-10 cursor-pointer">
          {/* Halo lumineux au survol */}
          <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ boxShadow: '0 0 40px 15px rgba(229,225,216,0.4), 0 0 80px 30px rgba(229,225,216,0.2)' }}></div>

          {/* Cercle extérieur (médaillon) */}
          <div className="relative w-64 h-64 rounded-full border-4 border-[var(--ivory)] border-opacity-60 flex items-center justify-center transition-all duration-500 group-hover:border-opacity-100 group-hover:scale-105 active:scale-100">

            {/* Texte central */}
            <div className="relative z-10 text-center">
              <span className="block text-5xl font-[family-name:var(--font-title)] tracking-[0.25em] text-[var(--ivory)]" style={{ textShadow: '0 0 10px rgba(229,225,216,0.5)' }}>
                JOUER
              </span>
            </div>
          </div>
        </Link>
      </main>
    </div>
  )
}
