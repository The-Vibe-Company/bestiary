"use client";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await authClient.signUp.email({
      email,
      password,
      name: username,
    });

    if (result.error) {
      setError(result.error.message || "Une erreur est survenue");
      setPending(false);
    } else {
      router.push("/home");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      {error && (
        <div className="p-4 text-sm bg-[var(--burnt-amber)]/20 border border-[var(--burnt-amber)] border-opacity-40 rounded text-[var(--burnt-amber-light)]">
          {error}
        </div>
      )}

      <Button type="submit" variant="seal" className="w-full" isLoading={pending}>
        S'INSCRIRE
      </Button>

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
