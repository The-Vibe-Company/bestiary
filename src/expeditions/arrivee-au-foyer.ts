// L'arrivée au Foyer des Bêtes apprivoisées (US-0938) : la Bête qui suit une Expédition depuis son Apprivoisement
// (src/expeditions/apprivoisement.ts) arrive au Foyer avec elle, à son retour (src/expeditions/retour.ts). Jusque-là,
// elle ne fait pas partie de l'escorte (décidé le 2026-10-09) : l'escorte reste celle du départ (expedition_escorte),
// dont la force ne change pas, et elle n'est pas dans l'effectif ; aucun combat ne peut donc la perdre. Au retour, elle
// entre dans l'effectif de son Espèce avec son sexe (US-0937), et peut partir en escorte dès l'Expédition suivante ;
// US-0956 : sauf si elle réunit, au même instant, le Couple de son Espèce (src/monde/couple.ts) : elle part alors en
// Réserve. Côté serveur uniquement.
import "server-only";
import type { PoolClient } from "pg";
import { inscrireAuBestiaire } from "@/bestiaire/bestiaire";
import { faireEntrerDansLEffectif } from "@/monde/effectif";
import { betesQuiSuivent } from "./sexe";

/**
 * US-0938 : à l'instant du jeu `le` de son retour au Foyer, les Bêtes qui suivent l'Expédition `expeditionId` entrent
 * dans l'effectif du Territoire, chacune avec son sexe, et l'Espèce de chacune passe « apprivoisée » au Bestiaire si elle
 * n'avait pas mieux (inscrireAuBestiaire : l'état ne recule jamais). Appelée par rentrerAuFoyer, dans la transaction du
 * temps qui avance, une seule fois par Expédition : le même résultat en direct, au rattrapage ou par la tâche planifiée.
 */
export async function accueillirLesBetesQuiSuivent(client: PoolClient, territoireId: number, expeditionId: number, le: Date): Promise<void> {
  const betes = await betesQuiSuivent(client, expeditionId);
  await faireEntrerDansLEffectif(client, territoireId, betes);
  // L'une après l'autre : sur le client d'une transaction, deux requêtes ne partent pas à la fois.
  for (const especeId of new Set(betes.map((b) => b.especeId))) await inscrireAuBestiaire(client, territoireId, especeId, "apprivoisee", le);
}
