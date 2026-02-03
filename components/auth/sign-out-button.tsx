'use client'

import { authClient } from '@/lib/auth/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function SignOutButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  async function handleSignOut() {
    setIsLoading(true)
    try {
      await authClient.signOut()
      router.push('/sign-in')
      router.refresh()
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleSignOut}
      variant="ethereal"
      isLoading={isLoading}
    >
      SE DÉCONNECTER
    </Button>
  )
}
