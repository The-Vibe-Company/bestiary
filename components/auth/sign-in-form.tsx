"use client";

import { signIn } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="seal" className="w-full" isLoading={pending}>
      SE CONNECTER
    </Button>
  );
}

export function SignInForm() {
  const [state, formAction] = useFormState(signIn, null);

  return (
    <form action={formAction} className="space-y-6">
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
        <div className="p-4 text-sm bg-[var(--burnt-amber)]/20 border border-[var(--burnt-amber)] border-opacity-40 rounded text-[var(--burnt-amber-light)]">
          {state.error}
        </div>
      )}

      <SubmitButton />

      <p className="text-center text-sm text-[var(--ivory-dark)] font-[family-name:var(--font-body)]">
        Pas encore de compte ?{" "}
        <Link
          href="/sign-up"
          className="text-[var(--burnt-amber)] hover:text-[var(--burnt-amber-light)] transition-colors"
        >
          S'inscrire
        </Link>
      </p>
    </form>
  );
}
