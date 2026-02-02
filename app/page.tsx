import Link from 'next/link'
import Image from 'next/image'

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/assets/landing.png)' }}
      />

      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/30"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-6 bg-black/80">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            {/* Logo/Title */}
            <h1 className="text-5xl md:text-6xl font-bold font-[family-name:var(--font-title)] text-white" style={{
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
            }}>
              BESTIARY
            </h1>

            {/* Auth Buttons */}
            <div className="flex gap-4">
              <Link href="/sign-in">
                <button className="px-6 py-3 text-lg font-bold font-[family-name:var(--font-heading)] border-2 border-[#f97316] rounded-lg text-[#f97316] hover:bg-[#f97316] hover:text-white transition-all shadow-lg hover:shadow-xl backdrop-blur-sm cursor-pointer">
                  CONNEXION
                </button>
              </Link>
              <Link href="/sign-up">
                <button className="px-6 py-3 text-lg font-bold font-[family-name:var(--font-heading)] bg-[#10b981] rounded-lg text-white hover:bg-[#059669] transition-all shadow-lg hover:shadow-xl backdrop-blur-sm cursor-pointer">
                  INSCRIPTION
                </button>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content - Centered Play Button */}
        <main className="flex-1 flex items-center justify-center">
          <Link href="/sign-up">
            <button className="group px-16 py-8 text-3xl md:text-4xl font-bold font-[family-name:var(--font-title)] bg-black/80 rounded-2xl text-white hover:bg-black/90 transition-all hover:scale-110 active:scale-105 cursor-pointer border-2 border-white/30 hover:border-white/50">
              <span className="flex items-center gap-4">
                <span className="text-5xl">🐾</span>
                JOUER
              </span>
            </button>
          </Link>
        </main>
      </div>
    </div>
  )
}
