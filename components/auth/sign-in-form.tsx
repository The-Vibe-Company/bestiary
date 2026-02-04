"use client";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await authClient.signIn.email({
      email,
      password,
    });

    if (result.error) {
      setError("Email ou mot de passe incorrect");
      setPending(false);
    } else {
      router.push("/village");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      {error && (
        <div className="p-4 text-sm bg-[var(--burnt-amber)]/20 border border-[var(--burnt-amber)] border-opacity-40 rounded text-[var(--burnt-amber-light)]">
          {error}
        </div>
      )}

      <Button type="submit" variant="seal" className="w-full" isLoading={pending}>
        SE CONNECTER
      </Button>

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
