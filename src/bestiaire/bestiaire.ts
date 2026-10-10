// Le Bestiaire d'un Territoire (US-0933) : chaque Espèce que le joueur a croisée, apprivoisée ou dont il a réuni le
// Couple, avec son état, qui ne fait qu'avancer : il ne recule jamais, même quand toutes les Bêtes de l'Espèce meurent,
// puisqu'il ne se déduit ni de l'effectif ni des Rencontres. Toute Espèce vue lors d'une Rencontre s'y inscrit
// « croisée », une seule fois, qu'elle suive l'Expédition ou non : à la première Rencontre, retenue par le mécanisme du
// temps (src/expeditions/rencontres.ts), qui la signale « Nouvelle Espèce au Bestiaire » aux récits (US-0917, US-0940).
// L'arrivée au Foyer d'une Bête apprivoisée (US-0938, src/expeditions/arrivee-au-foyer.ts) la fait avancer par
// inscrireAuBestiaire, comme le Couple réuni (US-0956, src/monde/couple.ts). La page Bestiaire arrive au jalon 10. Côté
// serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";

/** US-0933 : l'état d'une Espèce au Bestiaire, du premier au plus haut (etat_au_bestiaire, src/db/schema.ts). */
export type EtatAuBestiaire = "croisee" | "apprivoisee" | "couple_reuni";

/** US-0933 : une Espèce du Bestiaire : son état, et l'instant du jeu où le joueur l'a vue pour la première fois. */
export type EspeceAuBestiaire = { especeId: string; etat: EtatAuBestiaire; croiseeLe: Date };

/**
 * US-0933 : fait atteindre l'état `etat` à l'Espèce `especeId` au Bestiaire du Territoire, à l'instant du jeu `le`, si
 * elle n'avait pas mieux : un état plus bas ne change rien, l'état ne recule jamais. Une Espèce encore inconnue y entre,
 * croisée à cet instant, sans Rencontre qui l'ait inscrite.
 */
export async function inscrireAuBestiaire(base: Pool | PoolClient, territoireId: number, especeId: string, etat: EtatAuBestiaire, le: Date): Promise<void> {
  await base.query(
    `insert into bestiaire (territoire_id, espece_id, etat, croisee_le) values ($1, $2, $3, $4)
     on conflict (territoire_id, espece_id) do update set etat = excluded.etat where excluded.etat > bestiaire.etat`,
    [territoireId, especeId, etat, le],
  );
}

/**
 * US-0933 : inscrit « croisée » au Bestiaire du Territoire chaque Espèce que ses Expéditions ont rencontrée et qui n'y est
 * pas encore, par sa première Rencontre : la plus tôt vue, puis la plus tôt apparue (la règle de la migration 0057).
 * Appelée dès qu'une Rencontre est retenue, dans la transaction du mécanisme du temps, qui les retient dans l'ordre du
 * temps : la même Rencontre inscrit l'Espèce, en direct, au rattrapage ou par la tâche planifiée, et revoir une Espèce
 * inscrite ne change rien. Lue dans les Rencontres en base, pas dans celles qui viennent d'être retenues : une Rencontre
 * retenue sans inscription, par la version d'avant encore en ligne pendant une mise en ligne, inscrit son Espèce à la
 * Rencontre suivante, à sa vraie date.
 */
export async function inscrireLesEspecesCroisees(base: Pool | PoolClient, territoireId: number): Promise<void> {
  await base.query(
    `insert into bestiaire (territoire_id, espece_id, etat, croisee_le, rencontre_id)
     select distinct on (r.espece_id) $1, r.espece_id, 'croisee', r.vue_le, r.id
     from rencontre r join expedition x on x.id = r.expedition_id
     where x.territoire_id = $1 and not exists (select 1 from bestiaire b where b.territoire_id = $1 and b.espece_id = r.espece_id)
     order by r.espece_id, r.vue_le, r.apparue_le, r.id
     on conflict do nothing`,
    [territoireId],
  );
}

/** US-0933 : le Bestiaire du Territoire, de la première Espèce croisée à la dernière ; vide tant qu'il n'a rien rencontré. */
export async function bestiaireDuTerritoire(base: Pool | PoolClient, territoireId: number): Promise<EspeceAuBestiaire[]> {
  const { rows } = await base.query<EspeceAuBestiaire>(
    `select espece_id as "especeId", etat, croisee_le as "croiseeLe" from bestiaire where territoire_id = $1 order by croisee_le, espece_id`,
    [territoireId],
  );
  return rows;
}
