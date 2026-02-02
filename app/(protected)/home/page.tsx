import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { SignOutButton } from '@/components/auth/sign-out-button'

export default async function HomePage() {
  const session = await getSession()

  if (!session) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[var(--obsidian)] to-black">
      <div className="relative">
        {/* Parchemin background */}
        <div className="absolute inset-0 -m-12 vellum-effect rounded-lg"></div>

        {/* Username */}
        <h1 className="relative z-10 text-7xl font-[family-name:var(--font-title)] tracking-[0.2em] text-[var(--ivory)] mb-8 px-12 py-8">
          {session.username}
        </h1>
      </div>

      <SignOutButton />
    </div>
  )
}
