"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { mesureActive } from "./mesure-active";

/** Le joueur connecté, reconnu par la mesure d'audience : à la connexion comme au retour d'une session. */
export function IdentifierJoueur({ id, email, nom }: { id: number; email: string; nom: string | null }) {
  useEffect(() => {
    if (mesureActive()) posthog.identify(String(id), nom ? { email, name: nom } : { email });
  }, [id, email, nom]);
  return null;
}
