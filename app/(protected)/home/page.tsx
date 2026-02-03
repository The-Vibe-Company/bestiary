import { neonAuth } from '@neondatabase/auth/next/server'
import { redirect } from 'next/navigation'
import { SignOutButton } from '@/components/auth/sign-out-button'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function HomePage() {
  const { session, user } = await neonAuth()

  if (!session || !user) {
    redirect('/sign-in')
  }

  const displayName = user.name || user.email

  return (
    <div className="min-h-[calc(100vh-72px)] flex flex-col items-center justify-center bg-gradient-to-b from-[var(--obsidian)] to-black">
      <div className="relative">
        {/* Parchemin background */}
        <div className="absolute inset-0 -m-12 vellum-effect rounded-lg"></div>

        {/* Username */}
        <h1 className="relative z-10 text-7xl font-[family-name:var(--font-title)] tracking-[0.2em] text-[var(--ivory)] mb-8 px-12 py-8">
          {displayName}
        </h1>
      </div>

      <div className="flex flex-col gap-4 mt-8">
        <Link href="/map">
          <Button variant="ethereal" size="lg">
            Explorer la carte du monde
          </Button>
        </Link>

        <SignOutButton />
      </div>
    </div>
  )
}
