import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Le format le plus léger que le navigateur accepte.
    formats: ["image/avif", "image/webp"],
    // Seules les illustrations du jeu passent par l'optimiseur, sans paramètres d'adresse.
    localPatterns: [{ pathname: "/illustrations/**", search: "" }],
  },
  // US-0412 : le contrôle du Monde lit à la demande les voisinages interdits des Biomes, dans les données du jeu.
  // US-0931 : la simulation des Raretés lit de même les Raretés et leurs chances par Anneau.
  outputFileTracingIncludes: {
    "/controle/monde": ["./donnees/biomes.yaml"],
    "/controle/raretes": ["./donnees/raretes.yaml", "./donnees/raretes-par-anneau.yaml"],
  },
  // La mesure d'audience passe par le jeu (/ingest, relayé par src/proxy.ts vers PostHog US) : PostHog appelle
  // certaines adresses avec une barre finale, qu'il ne faut pas retirer par une redirection.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
