// L'Élevage d'une Espèce (US-0957) : acquis dès que son Couple est réuni (US-0956, src/monde/couple.ts), et pour
// toujours. Il ne se lit que dans le Couple, qui ne se défait jamais et ne quitte pas la Réserve : ni dans l'effectif, dont
// toutes les Bêtes de l'Espèce peuvent mourir, ni dans le sexe de ses Bêtes, qui ne compte plus. La seule façon, pour le
// reste du code, de demander si l'Élevage d'une Espèce est acquis ; le bloc « Élever » (US-0812) refuse l'Élevage d'une
// Espèce sans Couple. US-0843 : et l'éleveur libre que demande son lancement. Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { ELEVEUR_LIBRE_EN_SQL } from "./etat-habitant";

/**
 * US-0957 : vrai quand l'Élevage de l'Espèce est acquis au Territoire, dès son Couple réuni et à jamais (expression sur
 * `e`, une ligne qui porte `territoire_id` et `espece_id`, comme BETES_SORTIES dans src/monde/effectif.ts).
 */
export const ELEVAGE_ACQUIS = `exists (select 1 from couple c where c.territoire_id = e.territoire_id and c.espece_id = e.espece_id)`;

/** US-0957 : l'Élevage de l'Espèce `especeId` est-il acquis au Territoire ? */
export async function elevageAcquis(base: Pool | PoolClient, territoireId: number, especeId: string): Promise<boolean> {
  const { rows } = await base.query<{ acquis: boolean }>(
    `select ${ELEVAGE_ACQUIS} as acquis from (select $1::int as territoire_id, $2::text as espece_id) e`,
    [territoireId, especeId],
  );
  return rows[0].acquis;
}

/**
 * US-0812 : ce que dit le jeu quand on lui demande l'Élevage d'une Espèce dont le joueur n'a pas réuni le Couple, par le
 * bouton « Élever » ou par tout autre chemin.
 */
export const ELEVAGE_SANS_COUPLE = "Pas d'Élevage sans Couple réuni.";

/**
 * US-0843 : ce que dit le jeu quand on lance l'Élevage d'une Espèce sans éleveur libre au Territoire : le bloc « Élever »
 * sous son bouton grisé, l'action à toute demande. L'Élevage, lui, reste acquis.
 */
export const ELEVAGE_SANS_ELEVEUR = "Aucun éleveur libre.";

/**
 * US-0843 : l'éleveur libre du Territoire, qui s'occupera du prochain Élevage : un Habitant au Métier d'éleveur qui ne
 * s'occupe d'aucun autre Élevage (habitant.espece_elevee, posée au lancement, US-0815) ; le premier par prénom, comme la
 * liste des Habitants les range ; null quand il n'y en a aucun. Une simple lecture, sans verrou, pour le bloc et les refus
 * d'avance : le lancement (lancer-un-elevage.ts, US-0815) prend son éleveur d'une seule requête qui relit tout, pour
 * qu'un changement de Métier envoyé au même instant ne le laisse pas, Chasseur, à l'Élevage.
 */
export async function eleveurLibre(base: Pool | PoolClient, territoireId: number): Promise<{ id: number; prenom: string } | null> {
  const { rows } = await base.query<{ id: number; prenom: string }>(
    `select id, prenom from habitant
     where territoire_id = $1 and ${ELEVEUR_LIBRE_EN_SQL}
     order by prenom, id limit 1`,
    [territoireId],
  );
  return rows[0] ?? null;
}
