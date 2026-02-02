'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { signUp } from '@/app/actions/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="primary" className="w-full" isLoading={pending}>
      S'inscrire
    </Button>
  )
}

export function SignUpForm() {
  const [state, formAction] = useFormState(signUp, null)

  return (
    <form action={formAction} className="space-y-4">
      <Input
        type="text"
        name="username"
        label="Pseudo"
        placeholder="votre_pseudo"
        required
        autoComplete="username"
      />

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
        autoComplete="new-password"
      />

      {state?.error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg">
          {state.error}
        </div>
      )}

      <SubmitButton />

      <p className="text-center text-sm text-gray-600">
        Déjà un compte ?{' '}
        <Link href="/sign-in" className="text-[#10b981] hover:text-[#059669] font-medium">
          Se connecter
        </Link>
      </p>
    </form>
  )
}
