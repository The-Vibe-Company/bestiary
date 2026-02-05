"use client";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function getErrorMessage(error: { code?: string; message?: string } | null): string {
  if (!error) return "Une erreur est survenue";

  // Try matching by error code first
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_PASSWORD":
    case "USER_NOT_FOUND":
      return "Email ou mot de passe incorrect";
    case "INVALID_EMAIL":
      return "Format d'email invalide";
    case "EMAIL_NOT_VERIFIED":
      return "Veuillez vérifier votre email avant de vous connecter";
  }

  // Fallback to matching by English message (for thrown errors)
  const message = error.message?.toLowerCase() || "";
  if (message.includes("invalid email or password") || message.includes("invalid password") || message.includes("user not found")) {
    return "Email ou mot de passe incorrect";
  }
  if (message.includes("invalid email")) {
    return "Format d'email invalide";
  }
  if (message.includes("email not verified")) {
    return "Veuillez vérifier votre email avant de vous connecter";
  }

  return error.message || "Une erreur est survenue";
}

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;

      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(getErrorMessage(result.error));
      } else {
        router.push("/village");
        router.refresh();
      }
    } catch (err: unknown) {
      // Handle errors thrown by authClient (e.g., network errors or API errors)
      if (err && typeof err === 'object' && ('code' in err || 'message' in err)) {
        setError(getErrorMessage(err as { code?: string; message?: string }));
      } else {
        setError("Une erreur inattendue est survenue. Veuillez réessayer.");
      }
    } finally {
      setPending(false);
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
