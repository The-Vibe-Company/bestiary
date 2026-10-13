// La fuite (US-0945) : après un combat (US-0944), l'Expédition abandonne son séjour et rentre aussitôt au Foyer, comme
// rappelée en séjour (US-0920) : son retour dure le temps de l'aller (src/expeditions/phase.ts), avec tous ses
// explorateurs, jamais blessés ni tués, et les Bêtes de son escorte qui restent ; attaquée sans escorte, elle fuit de même,
// sans rien perdre. Sa fuite s'écrit comme un rappel, à l'instant de l'attaque, marquée en fuite (expedition.en_fuite), et
// son retour au Foyer est avancé à sa nouvelle heure, que le mécanisme du temps applique à son instant exact. Elle
// s'écrit au rattrapage du Territoire de l'Expédition ; les autres Territoires de la Case ne l'attendent pas : ils la
// calculent eux-mêmes, des mêmes faits (src/expeditions/fuites-de-la-case.ts, lue en base par src/expeditions/fuites-des-cases.ts),
// et ne la trouvent plus sur la Case après sa fuite, quel que soit l'ordre des rattrapages ; les récits et les Bêtes
// repérées lisent la même présence. Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import type { HorairesDUneExpedition } from "./phase";
import { deplacerLeRetour } from "./retour";

/** US-0945 : une Expédition qui fuit, et l'instant de l'attaque qui la met en fuite. */
export type Fuite = { expeditionId: number; le: Date };

/**
 * US-0945 : met en fuite chacune des Expéditions `fuites`, à l'instant de son attaque : elle fait demi-tour (rappelee_le),
 * en fuite, et son retour au Foyer est avancé (deplacerLeRetour). Une Expédition déjà rentrée, ou qui avait déjà fait
 * demi-tour avant, n'a pas à fuir ; un rappel du joueur plus tardif, écrit avant que l'attaque ne soit retenue, cède à
 * la fuite. Dans la transaction du mécanisme du temps, juste après retenirLesRencontres (src/temps/regles.ts).
 */
export async function mettreEnFuite(base: Pool | PoolClient, fuites: readonly Fuite[]): Promise<void> {
  // L'une après l'autre : sur le client d'une transaction, deux requêtes ne partent pas à la fois.
  for (const { expeditionId, le } of fuites) {
    const { rows } = await base.query<HorairesDUneExpedition & { territoireId: number }>(
      `update expedition set rappelee_le = $2, en_fuite = true
       where id = $1 and rentree_le is null and (rappelee_le is null or rappelee_le > $2)
       returning territoire_id as "territoireId", part_le as "partLe", trajet_minutes as "trajetMinutes", sejour_minutes as "sejourMinutes",
         rappelee_le as "rappeleeLe"`,
      [expeditionId, le],
    );
    if (!rows[0]) continue;
    const { territoireId, ...horaires } = rows[0];
    await deplacerLeRetour(base, territoireId, expeditionId, horaires);
  }
}
