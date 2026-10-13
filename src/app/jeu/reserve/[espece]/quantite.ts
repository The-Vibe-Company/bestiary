// US-0813 : la quantité de Bêtes à élever, telle que le bloc « Élever » la lit et que l'action la relit : un nombre entier
// d'au moins 1. Sans rien du serveur : le bloc s'en sert dans le navigateur.

/** US-0813 : ce que disent le bloc et l'action d'une quantité nulle, négative ou non entière. */
export const QUANTITE_REFUSEE = "La quantité doit être un nombre entier, d'au moins 1.";

/** US-0813 : la plus grande quantité qui se lit (neuf chiffres) : « + » et « Max » ne vont pas au-delà. */
export const QUANTITE_LA_PLUS_GRANDE = 999_999_999;

/** US-0813 : la quantité écrite `texte`, un nombre entier de Bêtes d'au moins 1 (« 12 ») ; null pour tout le reste. */
export function lireUneQuantite(texte: string): number | null {
  const propre = texte.trim();
  if (!/^\d{1,9}$/.test(propre)) return null;
  const quantite = Number(propre);
  return quantite >= 1 ? quantite : null;
}
