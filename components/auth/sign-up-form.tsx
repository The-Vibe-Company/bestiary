"use client";

import { signUp } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="seal" className="w-full" isLoading={pending}>
      S'INSCRIRE
    </Button>
  );
}

export function SignUpForm() {
  const [state, formAction] = useFormState(signUp, null);

  return (
    <form action={formAction} className="space-y-6">
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
        <div className="p-4 text-sm bg-[var(--burnt-amber)]/20 border border-[var(--burnt-amber)] border-opacity-40 rounded text-[var(--burnt-amber-light)]">
          {state.error}
        </div>
      )}

      <SubmitButton />

      <p className="text-center text-sm text-[var(--ivory-dark)] font-[family-name:var(--font-body)]">
        Déjà un compte ?{" "}
        <Link
          href="/sign-in"
          className="text-[var(--burnt-amber)] hover:text-[var(--burnt-amber-light)] transition-colors"
        >
          Se connecter
        </Link>
      </p>
    </form>
  );
}
