// Ce qui manque pour payer un Élevage (US-0816), tel que le bloc « Élever » et le lancement le disent, dans les mêmes mots.
// Sans rien du serveur : le bloc s'en sert dans le navigateur.

/**
 * US-0816 : « Il manque 680 Viande ou Végétaux. » : la Nourriture qui manque, `manque`, à l'unité supérieure (une fraction
 * qui manque manque tout de même), à la française et sans coupure, dans la Nourriture du régime de l'Espèce, telle que la
 * fiche la nomme (`nourriture`).
 */
export function ilManque(manque: number, nourriture: string): string {
  const unites = Math.ceil(Math.round(manque * 1e6) / 1e6);
  return `Il manque ${new Intl.NumberFormat("fr-FR").format(unites).replace(/\s/g, " ")} ${nourriture}.`;
}
