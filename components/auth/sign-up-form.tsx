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
    case "PASSWORD_TOO_SHORT":
      return "Le mot de passe est trop court (minimum 8 caractères)";
    case "PASSWORD_TOO_LONG":
      return "Le mot de passe est trop long";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Cet email est déjà utilisé";
    case "INVALID_EMAIL":
      return "Format d'email invalide";
    case "FAILED_TO_CREATE_USER":
      return "Impossible de créer le compte. Veuillez réessayer.";
  }

  // Fallback to matching by English message (for thrown errors)
  const message = error.message?.toLowerCase() || "";
  if (message.includes("password too short")) {
    return "Le mot de passe est trop court (minimum 8 caractères)";
  }
  if (message.includes("password too long")) {
    return "Le mot de passe est trop long";
  }
  if (message.includes("user already exists") || message.includes("email already")) {
    return "Cet email est déjà utilisé";
  }
  if (message.includes("invalid email")) {
    return "Format d'email invalide";
  }

  return error.message || "Une erreur est survenue";
}

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const username = formData.get("username") as string;
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;

      // Vérifier si le pseudo est déjà pris
      const checkResponse = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
      const checkData = await checkResponse.json();
      if (checkData.exists) {
        setError("Ce pseudo est déjà utilisé");
        setPending(false);
        return;
      }

      const result = await authClient.signUp.email({
        email,
        password,
        name: username,
      });

      if (result.error) {
        setError(getErrorMessage(result.error));
      } else {
        // Créer l'entrée dans la table User
        await fetch('/api/user/create', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email })
        });
        // Créer le village pour le nouvel utilisateur
        await fetch('/api/village/create', { method: 'POST', credentials: 'include' });
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
