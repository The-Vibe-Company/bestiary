import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/sign-in')
  }

  return (
    <>
      <Header />
      <div className="pt-[72px]">
        {children}
      </div>
    </>
  )
}
