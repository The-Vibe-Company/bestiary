// Pour les essais sur base : l'attaque qu'une Bête trop forte ferait à une Expédition (US-0943), calculée comme le jeu la
// calcule (src/expeditions/rencontres.ts), pour attendre sa fuite (US-0945) ou choisir une Expédition qu'elle épargne.
import type { Pool, PoolClient } from "pg";
import { chanceDAttaqueParHeure, instantDeLAttaque, type Regime } from "@/expeditions/attaque";
import { hasardsDeLAttaqueDUneBeteDeNaissance } from "@/monde/betes-de-naissance";
import { hasardsDeLAttaque } from "@/monde/betes-sauvages";

/** Une Bête telle que ses tirages la désignent : sa Case, son Espèce, et son numéro sur la Case ou sa ligne de naissance. */
export type BeteQuiAttaque = { caseId: number; especeId: string; numero?: number | null; beteDeNaissanceId?: number | null };

/**
 * L'instant où la Bête `bete`, trop forte pour l'escorte de l'Expédition `expeditionId`, l'attaquerait, toutes deux sur
 * sa Case de `debut` (leur Rencontre) à `fin` (exclue, le départ de l'une ou de l'autre) ; null si elle ne l'attaque pas.
 */
export async function attaqueTiree(
  base: Pool | PoolClient,
  { caseId, especeId, numero = null, beteDeNaissanceId = null }: BeteQuiAttaque,
  expeditionId: number,
  ensemble: { debut: Date; fin: Date },
): Promise<Date | null> {
  const { rows } = await base.query<{ q: number; r: number; graine: string; regime: Regime }>(
    "select c.q, c.r, m.graine, (select regime from espece where id = $2) as regime from case_du_monde c join monde m on m.id = c.monde_id where c.id = $1",
    [caseId, especeId],
  );
  const { q, r, graine, regime } = rows[0];
  const hasards = (heure: number) =>
    numero !== null
      ? hasardsDeLAttaque({ graine: Number(graine), q, r }, numero, expeditionId, heure)
      : hasardsDeLAttaqueDUneBeteDeNaissance(Number(graine), beteDeNaissanceId!, expeditionId, heure);
  return instantDeLAttaque(ensemble, chanceDAttaqueParHeure(regime), hasards);
}

/**
 * Efface une Expédition que l'essai vient de lancer, avant que le temps ne la fasse vivre : son retour programmé, puis
 * elle-même ; ses explorateurs redeviennent libres, son escorte n'est plus sortie. Pour en lancer une autre, avec ses
 * propres tirages, quand une Bête l'attaquerait.
 */
export async function effacerLExpedition(base: Pool | PoolClient, expeditionId: number): Promise<void> {
  await base.query("delete from evenement where element = 'territoire' and type = 'retour_expedition' and donnees->>'expedition' = $1::text", [expeditionId]);
  await base.query("delete from expedition where id = $1", [expeditionId]);
}

/** Une Bête sauvage ordinaire telle que l'essai la connaît : son numéro, son Espèce, sa Rareté et sa présence sur la Case. */
type BeteDeLaCase = { numero: number; especeId: string; rareteId: string; arrivee: Date; depart: Date };

/**
 * Si l'Expédition `expeditionId`, présente sur la Case `caseId` pendant `sejour`, n'est attaquée par aucune des Bêtes
 * `betes` plus rares que communes, trop fortes pour une escorte de communes ou pour une Expédition sans escorte : chacune
 * pendant le temps où elles sont ensemble sur la Case. Une commune la suit, et n'attaque jamais.
 */
export async function epargneePar(
  base: Pool | PoolClient,
  caseId: number,
  betes: readonly BeteDeLaCase[],
  expeditionId: number,
  sejour: { debut: Date; fin: Date },
): Promise<boolean> {
  for (const b of betes.filter((x) => x.rareteId !== "commune")) {
    const ensemble = { debut: b.arrivee > sejour.debut ? b.arrivee : sejour.debut, fin: b.depart < sejour.fin ? b.depart : sejour.fin };
    if (ensemble.debut < ensemble.fin && (await attaqueTiree(base, { caseId, especeId: b.especeId, numero: b.numero }, expeditionId, ensemble))) return false;
  }
  return true;
}
