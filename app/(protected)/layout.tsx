import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/sign-in')
  }

  return <>{children}</>
}
