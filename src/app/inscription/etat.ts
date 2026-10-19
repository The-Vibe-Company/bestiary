/**
 * Ce que le serveur renvoie au formulaire après un envoi : les erreurs par champ (ou générale),
 * et l'adresse saisie. Jamais le mot de passe. Une fois le compte créé, son numéro, pour la mesure d'audience.
 */
export type EtatInscription = { erreurs: { email?: string; motDePasse?: string; general?: string }; email: string; cree?: boolean; compteId?: number };

export const ETAT_INITIAL: EtatInscription = { erreurs: {}, email: "" };

/** US-0111 : le message quand le réseau coupe, que le jeu plante ou ne répond pas. Jamais de détail technique. */
export const JEU_INJOIGNABLE = "Impossible de joindre Bestia, réessayez dans un instant";

/** US-0112 : le refus poli des inscriptions en rafale (et des robots), sans dire comment contourner. */
export const INSCRIPTIONS_FREINEES = "Les inscriptions sont momentanément limitées. Réessayez un peu plus tard.";

/** Le nom du champ piège, invisible pour un humain : un robot naïf le remplit. */
export const CHAMP_PIEGE = "siteWeb";
