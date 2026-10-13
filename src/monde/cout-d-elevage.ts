// Ce que coûte l'Élevage d'une Espèce (US-0813) : le coût d'une Bête élevée, la Nourriture qui le paie, et le plus grand
// nombre de Bêtes que les Stocks permettent de payer, que « Max » propose dans le bloc « Élever ». US-0814 : et ce que dure
// l'Élevage d'une Bête ; le bloc dit l'un et l'autre, qui se paieront au lancement (US-0815). Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import type { Regime } from "./effectif";
import { JOURS_D_ENTRETIEN_PAR_BETE_ELEVEE, MINUTES_D_ELEVAGE_PAR_PLACE } from "@/reglages";

/** La Nourriture en Stock au Territoire, Viande et Végétaux, en quantités exactes. */
export type NourritureDisponible = { viande: number; vegetaux: number };

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
 * carnivore, les Végétaux pour un herbivore, l'une ou l'autre pour un omnivore. Tranché au plus simple en attendant
 * US-0814, qui le dira, et US-0815, qui le paiera.
 */
export function nourritureQuiPaie(regime: Regime): ("viande" | "vegetaux")[] {
  return NOURRITURE_DU_REGIME[regime];
}

/**
 * US-0813 : le plus grand nombre entier de Bêtes de l'Espèce que les Stocks de sa Nourriture permettent de payer : ce que
 * « Max » propose. Aucune pour une Espèce sans Entretien, dont aucun coût ne borne l'Élevage (aucune Espèce du jeu).
 */
export function betesPayables(stocks: NourritureDisponible, espece: { regime: Regime; entretienParHeure: number }): number {
  const cout = coutDUneBeteElevee(espece.entretienParHeure);
  if (cout <= 0) return 0;
  const disponible = nourritureQuiPaie(espece.regime).reduce((somme, ressource) => somme + stocks[ressource], 0);
  // Au milliardième près : 100 de Viande pour une Bête de 10 en paient 10, malgré les décimales du calcul.
  return Math.max(0, Math.floor(disponible / cout + 1e-9));
}

/** US-0813 : ce que « Max » propose pour l'Espèce `especeId` au Territoire, d'après ses Stocks à l'instant. */
export async function maxAElever(base: Pool | PoolClient, territoireId: number, especeId: string): Promise<number> {
  const { rows } = await base.query<{ regime: Regime; entretienParHeure: number; viande: string | null; vegetaux: string | null }>(
    `select es.regime, es.entretien_par_heure as "entretienParHeure",
       (select s.quantite from stock s where s.territoire_id = $1 and s.ressource_id = 'viande') as viande,
       (select s.quantite from stock s where s.territoire_id = $1 and s.ressource_id = 'vegetaux') as vegetaux
     from espece es where es.id = $2`,
    [territoireId, especeId],
  );
  if (rows.length === 0) return 0;
  const { regime, entretienParHeure, viande, vegetaux } = rows[0];
  return betesPayables({ viande: Number(viande ?? 0), vegetaux: Number(vegetaux ?? 0) }, { regime, entretienParHeure });
}
