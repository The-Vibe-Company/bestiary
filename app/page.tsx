import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/assets/landing.png)' }}
      />

      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/40"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-6 bg-black/80">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            {/* Logo/Title */}
            <h1 className="text-5xl md:text-6xl font-[family-name:var(--font-title)] tracking-[0.2em] text-[var(--ivory)]" style={{
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
            }}>
              BESTIARY
            </h1>

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
        <main className="flex-1 flex items-center justify-center">
          <Link href="/sign-up" className="group relative cursor-pointer">
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
    </div>
  )
}
