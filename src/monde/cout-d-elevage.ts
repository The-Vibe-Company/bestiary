// Ce que coûte l'Élevage d'une Espèce (US-0813) : le coût d'une Bête élevée et la Nourriture qui le paie. US-0814 : et ce
// que dure l'Élevage d'une Bête ; le bloc dit l'un et l'autre, que le lancement retient et paie (US-0815). US-0816 : les
// Stocks qui paient, que le bloc fait monter comme la barre du haut pour dire, à chaque instant, ce que « Max » propose
// (betesPayables) et ce qui manque (src/monde/payer-un-elevage.ts). Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import type { Regime } from "./effectif";
import type { StockQuiPaie } from "./payer-un-elevage";
import { stocksDuTerritoire } from "./stocks";
import { JOURS_D_ENTRETIEN_PAR_BETE_ELEVEE, MINUTES_D_ELEVAGE_PAR_PLACE } from "@/reglages";

/** US-0813 : la Nourriture qui paie, régime par régime : un régime ajouté à la base sans la sienne ici ne compile pas. */
const NOURRITURE_DU_REGIME: Record<Regime, ("viande" | "vegetaux")[]> = { carnivore: ["viande"], herbivore: ["vegetaux"], omnivore: ["viande", "vegetaux"] };

/**
 * US-0813 : le coût en Nourriture d'une Bête élevée, un chiffre par Espèce : ce qu'elle mange pendant
 * JOURS_D_ENTRETIEN_PAR_BETE_ELEVEE jours (son Entretien, ramené à l'heure, docs/adr/0007) ; à régler en jouant.
 * US-0814 : en Nourriture entière, arrondi au-dessus (au millionième près d'abord, comme les Stocks) : le coût affiché
 * est celui qui sera payé, et « Max » ne propose que ce que les Stocks paient à ce prix.
 */
export function coutDUneBeteElevee(entretienParHeure: number): number {
  return Math.ceil(Math.round(entretienParHeure * 24 * JOURS_D_ENTRETIEN_PAR_BETE_ELEVEE * 1e6) / 1e6);
}

/**
 * US-0814 : la durée d'Élevage d'une Bête, un chiffre par Espèce : ses Places (sa taille, docs/adr/0007) fois
 * MINUTES_D_ELEVAGE_PAR_PLACE, à la minute près, une minute au moins. Les Bêtes d'un Élevage naîtront l'une après l'autre,
 * chacune après cette durée (US-0817).
 */
export function dureeDUneBeteEleveeMinutes(taille: number): number {
  return Math.max(1, Math.round(taille * MINUTES_D_ELEVAGE_PAR_PLACE));
}

/**
 * US-0813 : les Stocks qui paient l'Élevage d'une Espèce, selon son régime, comme ses Bêtes mangent : la Viande pour un
 * carnivore, les Végétaux pour un herbivore, l'une ou l'autre pour un omnivore ; le bloc le dit (US-0814), le lancement
 * le paie (US-0815, le Stock le plus fourni d'abord).
 */
export function nourritureQuiPaie(regime: Regime): ("viande" | "vegetaux")[] {
  return NOURRITURE_DU_REGIME[regime];
}

/**
 * US-0816 : les Stocks du Territoire qui paient l'Élevage d'une Espèce du régime `regime` (nourritureQuiPaie), tels que la
 * barre du haut les lit (stocksDuTerritoire) : leur quantité exacte, leur limite, leur production et l'Entretien pris
 * dessus par heure. Le bloc « Élever » les fait monter comme elle, pour dire à chaque instant ce que « Max » propose et ce
 * qui manque ; le lancement, lui, les relit au clic.
 */
export async function nourritureDuRegime(base: Pool | PoolClient, territoireId: number, regime: Regime): Promise<StockQuiPaie[]> {
  const qui = nourritureQuiPaie(regime);
  return (await stocksDuTerritoire(base, territoireId))
    .filter((s) => (qui as string[]).includes(s.id))
    .map(({ quantite, limite, parHeure, entretienParHeure }) => ({ quantite, limite, parHeure, entretienParHeure }));
}
