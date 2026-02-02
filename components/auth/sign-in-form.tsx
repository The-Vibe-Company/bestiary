'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { signIn } from '@/app/actions/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="primary" className="w-full" isLoading={pending}>
      Se connecter
    </Button>
  )
}

export function SignInForm() {
  const [state, formAction] = useFormState(signIn, null)

  return (
    <form action={formAction} className="space-y-4">
      <Input
        type="email"
        name="email"
        label="Email"
        placeholder="votre@email.com"
        required
        autoComplete="email"
      />

      <Input
        type="password"
        name="password"
        label="Mot de passe"
        placeholder="••••••••"
        required
        autoComplete="current-password"
      />

      {state?.error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg">
          {state.error}
        </div>
      )}

      <SubmitButton />

      <p className="text-center text-sm text-gray-600">
        Pas encore de compte ?{' '}
        <Link href="/sign-up" className="text-[#10b981] hover:text-[#059669] font-medium">
          S'inscrire
        </Link>
      </p>
    </form>
  )
}
