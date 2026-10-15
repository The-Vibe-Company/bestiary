// Ce que les Stocks paient d'un Élevage, et ce qui manque (US-0813, US-0816), tels que le bloc « Élever » les calcule à
// chaque instant et que le lancement les dit, dans les mêmes mots. Sans rien du serveur : le bloc s'en sert dans le
// navigateur.

/**
 * US-0816 : un Stock qui paie l'Élevage d'une Espèce, tel que la barre du haut le lit (US-0213) : sa quantité exacte, sa
 * limite, ce qu'il produit et ce que l'Entretien y prend par heure, en texte ; le bloc le fait monter comme elle.
 */
export type StockQuiPaie = { quantite: string; limite: string; parHeure: string; entretienParHeure: string };

/** US-0816 : le début de ce que disent le bloc et le lancement quand la Nourriture manque. */
const IL_MANQUE = "Il manque ";

/**
 * US-0816 : « Il manque 680 Viande ou Végétaux. » : la Nourriture qui manque, `manque`, à l'unité supérieure (au millionième
 * près d'abord : une poussière de calcul ne compte pas, une fraction qui manque manque tout de même), à la française et
 * sans coupure, dans la Nourriture du régime de l'Espèce, telle que la fiche ou la base la nomme (`nourriture`).
 */
export function ilManque(manque: number, nourriture: string): string {
  const unites = Math.ceil(Math.round(manque * 1e6) / 1e6);
  return `${IL_MANQUE}${new Intl.NumberFormat("fr-FR").format(unites).replace(/\s/g, " ")} ${nourriture}.`;
}

/** US-0816 : vrai quand un refus du lancement dit ce qui manque (ilManque). */
export const estUnManque = (refus: string | null) => refus !== null && refus.startsWith(IL_MANQUE);

/**
 * US-0813 : le plus grand nombre entier de Bêtes qu'une Nourriture `disponible` paie au coût `cout` d'une Bête : ce que
 * « Max » propose. Aucune pour un coût nul, qui ne borne rien (aucune Espèce du jeu). Au milliardième près : 100 de
 * Nourriture pour une Bête de 10 en paient 10, malgré les décimales du calcul.
 */
export function betesPayables(disponible: number, cout: number): number {
  if (cout <= 0) return 0;
  return Math.max(0, Math.floor(disponible / cout + 1e-9));
}
