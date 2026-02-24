import { neonAuth } from '@neondatabase/auth/next/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { VillageNameModal } from '@/components/village/village-name-modal'
import { getVillage } from '@/lib/game/village/get-village'
import { getNotifications, getUnreadCount } from '@/lib/game/notifications/get-notifications'

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

  // Fetch notifications if the player has a village
  const [notifications, unreadCount] = village
    ? await Promise.all([
        getNotifications(village.id),
        getUnreadCount(village.id),
      ])
    : [[], 0]

  // Serialize dates for the client component
  const serializedNotifications = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }))

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <Header
        notifications={serializedNotifications}
        unreadCount={unreadCount}
      />
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {/* Show modal if village exists but has no name */}
      {village && !village.name && <VillageNameModal />}
    </div>
  )
}
