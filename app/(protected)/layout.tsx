import { neonAuth } from '@neondatabase/auth/next/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { VillageNameModal } from '@/components/village/village-name-modal'
import { getVillage } from '@/lib/game/village/get-village'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session } = await neonAuth()

  if (!session) {
    redirect('/sign-in')
  }

  const village = await getVillage(session.userId)

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <Header />
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {/* Show modal if village exists but has no name */}
      {village && !village.name && <VillageNameModal />}
    </div>
  )
}
