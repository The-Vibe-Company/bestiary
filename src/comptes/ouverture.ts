// L'entrée du jeu (créer un compte, se connecter) : visible en local et sur les prévisualisations
// dès maintenant ; en production, seulement quand Antoine décide d'ouvrir le jeu.

/**
 * Passe à true le jour où Antoine décide d'ouvrir le jeu au public, à la main (ADR 0008) ; il faut
 * aussi que les e-mails partent (The-Vibe-Company/bestiary#58). Jusque-là : « Ouverture prochaine ».
 */
export const COMPTES_OUVERTS_EN_PRODUCTION = false;

/** Vrai si la page d'accueil montre l'entrée du jeu, et si les pages d'inscription et de connexion répondent. */
export function entreeDuJeuOuverte(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV !== "production" || COMPTES_OUVERTS_EN_PRODUCTION;
}
