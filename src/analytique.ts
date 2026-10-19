// La mesure d'audience (PostHog). Le navigateur l'initialise au chargement (src/instrumentation-client.ts) ;
// les pages vues, y compris celles d'une navigation interne, partent toutes seules. Le joueur connecté est
// reconnu dans la barre du haut (IdentifierJoueur), oublié à la déconnexion, et l'inscription est notée une fois.
// Ce module ne charge pas posthog-js : le relais (src/proxy.ts) s'en sert aussi.

/** La clé publique du projet PostHog « Bestia » : faite pour le navigateur, elle n'a rien de secret. */
export const CLE_POSTHOG_PUBLIQUE = "phc_uDQ2FpPcguagiZ79fUvcZmCRHUPfYxvMJPdfnRg8TpZs";

/** Le chemin du jeu par lequel passent les envois à PostHog (relayé par src/proxy.ts). */
export const RELAIS_POSTHOG = "/ingest";

export type ReglagesPostHog = { cle: string; hote: string };

/**
 * La clé et l'adresse d'envoi, ou null pour ne rien mesurer. Hors du jeu construit (next dev, tests),
 * rien n'est mesuré sans NEXT_PUBLIC_POSTHOG_KEY. Sans NEXT_PUBLIC_POSTHOG_HOST, les envois passent par
 * le relais du jeu, vers PostHog US.
 */
export function reglagesPostHog(
  env: { cle?: string; hote?: string; production: boolean } = {
    cle: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    hote: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    production: process.env.NODE_ENV === "production",
  },
): ReglagesPostHog | null {
  const cle = env.cle?.trim() || (env.production ? CLE_POSTHOG_PUBLIQUE : "");
  if (!cle) return null;
  return { cle, hote: env.hote?.trim() || RELAIS_POSTHOG };
}

/** Un jeton secret dans l'adresse d'une page : réinitialisation du mot de passe (US-0128), confirmation de l'adresse (US-0114). */
const JETON_DANS_L_ADRESSE = /\/(reinitialiser|confirmer)\/[^/?#\s"'<>]+/g;

/**
 * Vrai pour une page dont l'adresse porte un jeton secret. PostHog n'y démarre pas : il enverrait l'adresse
 * d'arrivée telle quelle avec ses drapeaux, hors de portée de before_send.
 */
export const pageAJeton = (chemin: string) => /^\/(reinitialiser|confirmer)\//.test(chemin);

/**
 * La même valeur, chaque jeton secret d'une adresse remplacé par « :jeton », jusque dans les objets (clés comprises)
 * et les listes : ces pages refusent déjà que leur adresse parte ailleurs (pas de Referer). Rien d'autre n'est touché.
 */
export function masquerLesJetons<T>(valeur: T): T {
  if (typeof valeur === "string") return valeur.replace(JETON_DANS_L_ADRESSE, "/$1/:jeton") as T;
  if (Array.isArray(valeur)) return valeur.map(masquerLesJetons) as T;
  if (valeur !== null && typeof valeur === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(valeur))) {
    return Object.fromEntries(Object.entries(valeur).map(([cle, v]) => [masquerLesJetons(cle), masquerLesJetons(v)])) as T;
  }
  return valeur;
}
