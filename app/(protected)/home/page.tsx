import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { SignOutButton } from '@/components/auth/sign-out-button'

export default async function HomePage() {
  const session = await getSession()

  if (!session) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black">
      <h1 className="text-6xl font-bold text-white font-[family-name:var(--font-title)] mb-8">
        {session.username}
      </h1>
      <SignOutButton />
    </div>
  )
}
