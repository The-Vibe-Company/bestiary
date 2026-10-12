import { ABREGER_A_PARTIR_DE } from "@/reglages";

const entiers = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const dixiemes = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
/** L'espace fine que donne le français est presque invisible dans la police du jeu : une espace insécable la remplace. */
const insecable = (texte: string) => texte.replace(/ /g, " ");

/**
 * Une quantité telle que le joueur la lit : un nombre entier, arrondi vers le bas pour ne jamais
 * promettre ce qu'il n'a pas, les milliers séparés par une espace (12 500, US-0203). À partir de
 * ABREGER_A_PARTIR_DE, il s'abrège en milliers puis en millions (US-0206), toujours arrondi vers le
 * bas : une décimale sous 10, aucune au-delà (123 k, 1,2 M, 12 M).
 */
export function quantiteAffichee(quantite: string | number): string {
  const n = Math.floor(Number(quantite));
  if (n < ABREGER_A_PARTIR_DE) return insecable(entiers.format(n));
  const [unite, lettre] = n < 1_000_000 ? [1_000, "k"] : [1_000_000, "M"];
  const enDixiemes = Math.floor(n / (unite / 10));
  const abrege = enDixiemes < 100 ? dixiemes.format(enDixiemes / 10) : entiers.format(Math.floor(n / unite));
  return insecable(`${abrege} ${lettre}`);
}

/**
 * Une quantité exacte, fractions comprises, pour la page de contrôle (US-0208) : la valeur en base,
 * sans les zéros inutiles, à la française (1 234,4).
 */
export function quantiteExacte(quantite: string): string {
  const [entiers, decimales = ""] = quantite.split(".");
  const partieEntiere = insecable(BigInt(entiers).toLocaleString("fr-FR"));
  const fraction = decimales.replace(/0+$/, "");
  return fraction ? `${partieEntiere},${fraction}` : partieEntiere;
}

/** US-0212 : une production horaire, arrondie vers le bas au dixième : « 14,5 ». */
export function productionHoraire(parHeure: string | number): string {
  return insecable(dixiemes.format(Math.floor(Number(parHeure) * 10) / 10));
}

/** US-0212 : la production horaire telle que la barre l'affiche : « +14,5/h ». */
export const productionAffichee = (parHeure: string | number) => `+${productionHoraire(parHeure)}/h`;

/** US-0319 : le solde horaire d'un Stock, sa production moins l'Entretien pris sur lui, compté en millionièmes pour rester exact. */
export function soldeHoraire(parHeure: string | number, entretienParHeure: string | number): number {
  return (Math.round(Number(parHeure) * 1_000_000) - Math.round(Number(entretienParHeure) * 1_000_000)) / 1_000_000;
}

/** Un solde arrondi vers le bas au dixième : un Stock qui baisse, même d'un rien, ne s'affiche jamais à zéro. */
const auDixiemeInferieur = (solde: number) => Math.floor(solde * 10) / 10;

/** US-0319 : le solde horaire tel que la barre l'affiche : « +5/h », « −3/h » (un vrai signe moins), « 0/h ». */
export function soldeAffiche(solde: number): string {
  const arrondi = auDixiemeInferieur(solde);
  if (arrondi === 0) return "0/h";
  return `${arrondi > 0 ? "+" : "−"}${insecable(dixiemes.format(Math.abs(arrondi)))}/h`;
}

/** US-0319 : le solde horaire tel qu'un lecteur d'écran le dit : « 5 par heure », « moins 3 par heure ». */
export function soldeEnMots(solde: number): string {
  const arrondi = auDixiemeInferieur(solde);
  return `${arrondi < 0 ? "moins " : ""}${insecable(dixiemes.format(Math.abs(arrondi)))} par heure`;
}

const centiemes = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** US-0214 : une quantité détaillée, arrondie vers le bas au centième : « 1 234,56 ». */
export function quantiteDetaillee(quantite: string | number): string {
  return insecable(centiemes.format(Math.floor(Number(quantite) * 100) / 100));
}

const caracteristiques = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 });

/**
 * US-0804 : une caractéristique d'une Espèce telle que sa fiche l'écrit : la valeur enregistrée, sans arrondi vers le
 * bas ni abréviation, à la française (14 953, 87,5), les milliers séparés d'une espace insécable.
 */
export function caracteristiqueAffichee(valeur: number): string {
  return insecable(caracteristiques.format(valeur));
}
