import { neonAuth } from '@neondatabase/auth/next/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session } = await neonAuth()

  if (!session) {
    redirect('/sign-in')
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <Header />
      {/* pt-[72px] accounts for the fixed header */}
      <div className="flex-1 overflow-hidden pt-[72px]">
        {children}
      </div>
    </div>
  )
}
