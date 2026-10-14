// Le lancement d'un Élevage (US-0815) : ce que fait le bouton « Élever ». Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { coutDUneBeteElevee, dureeDUneBeteEleveeMinutes, nourritureQuiPaie } from "./cout-d-elevage";
import type { Regime } from "./effectif";
import { ELEVAGE_SANS_COUPLE, ELEVAGE_SANS_ELEVEUR, elevageAcquis } from "./elevage";
import { ELEVEUR_LIBRE_EN_SQL } from "./etat-habitant";

/** US-0815 : le refus d'un Élevage d'une Espèce qui a déjà le sien en cours : une Espèce n'a qu'un éleveur à la fois (US-0844). */
export const ELEVAGE_DEJA_EN_COURS = "Un Élevage de cette Espèce est déjà en cours.";

/** US-0815 : le refus d'un Élevage que la Nourriture du régime de l'Espèce ne paie pas ; US-0816 dira ce qui manque. */
export const NOURRITURE_MANQUANTE = "Pas assez de Nourriture pour cet Élevage.";

/** US-0815 : un Élevage lancé, ce que le joueur en lit (combien de Bêtes, et l'éleveur qui s'en occupe), ou son refus. */
export type Lancement = { lance: { quantite: number; eleveur: string } } | { refus: string };

/** Un lancement refusé : rien n'est retenu, rien n'est payé, et le joueur lit pourquoi. */
class Refus extends Error {}

/**
 * US-0815 : lance l'Élevage de `quantite` Bêtes de l'Espèce `especeId` au Territoire, à `instant`, l'heure du jeu du clic.
 * Tout se relit ici, au moment de payer, d'où que vienne la demande : le Couple réuni (US-0812), aucun autre Élevage de
 * l'Espèce en cours (une Espèce n'a qu'un éleveur à la fois, US-0844), un éleveur libre (US-0843), et la Nourriture du
 * régime de l'Espèce (US-0813). L'éleveur, le premier libre par prénom, est pris d'une seule requête qui relit qu'il est
 * toujours éleveur et libre, et part à l'Élevage (habitant.espece_elevee) ; le coût total (US-0814) part aussitôt des
 * Stocks, sur le plus fourni d'abord pour un omnivore, puis sur l'autre ; l'Élevage est retenu, avec sa quantité, la
 * durée d'une Bête et ce qu'il a coûté, à l'heure du clic. Les naissances viendront avec US-0817.
 *
 * Tout tient dans une transaction : un lancement refusé ne retient rien et ne fait rien payer. Le Territoire y est tenu
 * d'abord, comme pour le départ d'une Expédition (US-0911) : deux lancements envoyés au même instant (un double clic)
 * passent l'un après l'autre, et le second relit ce que le premier a pris : un seul Élevage, payé une fois.
 */
export async function lancerUnElevage(pool: Pool, territoireId: number, especeId: string, quantite: number, instant: Date): Promise<Lancement> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select 1 from territoire where id = $1 for no key update", [territoireId]);
    const lance = await lancer(client, territoireId, especeId, quantite, instant);
    await client.query("commit");
    return { lance };
  } catch (erreur) {
    await client.query("rollback").catch(() => {});
    if (erreur instanceof Refus) return { refus: erreur.message };
    throw erreur;
  } finally {
    client.release();
  }
}

/** US-0815 : le lancement, dans la transaction de lancerUnElevage ; un Refus l'annule. */
async function lancer(client: PoolClient, territoireId: number, especeId: string, quantite: number, instant: Date): Promise<{ quantite: number; eleveur: string }> {
  if (!Number.isInteger(quantite) || quantite < 1) throw new Error(`Quantité d'Élevage impossible : ${quantite}.`);
  if (!(await elevageAcquis(client, territoireId, especeId))) throw new Refus(ELEVAGE_SANS_COUPLE);
  const { rowCount: enCours } = await client.query("select 1 from habitant where territoire_id = $1 and espece_elevee = $2", [territoireId, especeId]);
  if (enCours) throw new Refus(ELEVAGE_DEJA_EN_COURS);

  // L'éleveur libre, pris et tenu d'une seule requête : un changement de Métier envoyé au même instant attend, puis relit.
  const { rows: pris } = await client.query<{ id: number; prenom: string }>(
    `update habitant set espece_elevee = $2
     where id = (select id from habitant where territoire_id = $1 and ${ELEVEUR_LIBRE_EN_SQL} order by prenom, id limit 1 for update)
       and ${ELEVEUR_LIBRE_EN_SQL}
     returning id, prenom`,
    [territoireId, especeId],
  );
  if (!pris[0]) throw new Refus(ELEVAGE_SANS_ELEVEUR);

  const { rows: especes } = await client.query<{ regime: Regime; entretienParHeure: number; taille: number }>(
    `select regime, entretien_par_heure as "entretienParHeure", taille from espece where id = $1`,
    [especeId],
  );
  const { regime, entretienParHeure, taille } = especes[0];
  const cout = coutDUneBeteElevee(entretienParHeure) * quantite;
  await payer(client, territoireId, nourritureQuiPaie(regime), cout);

  await client.query(
    `insert into elevage (territoire_id, espece_id, eleveur_id, quantite, duree_minutes, cout, lance_le) values ($1, $2, $3, $4, $5, $6, $7)`,
    [territoireId, especeId, pris[0].id, quantite, dureeDUneBeteEleveeMinutes(taille), cout, instant],
  );
  return { quantite, eleveur: pris[0].prenom };
}

/**
 * US-0815 : retire `cout` des Stocks `ressources` du Territoire, le plus fourni d'abord, puis l'autre ; refuse, sans rien
 * retirer, quand ils n'y suffisent pas ensemble : aucun Stock ne descend sous zéro (US-0816). Un Stock qui repasse sous
 * sa limite n'est plus plein (US-0228). Les Stocks sont tenus jusqu'à la fin du lancement.
 */
async function payer(client: PoolClient, territoireId: number, ressources: string[], cout: number): Promise<void> {
  const { rows } = await client.query<{ assez: boolean }>(
    `with tenus as materialized (
       select quantite from stock where territoire_id = $1 and ressource_id = any($2::text[]) for update
     )
     select coalesce(sum(quantite), 0) >= $3::numeric as assez from tenus`,
    [territoireId, ressources, cout],
  );
  if (!rows[0].assez) throw new Refus(NOURRITURE_MANQUANTE);
  await client.query(
    `with ordre as (
       select ressource_id, quantite,
         coalesce(sum(quantite) over (order by quantite desc, ressource_id rows between unbounded preceding and 1 preceding), 0) as avant
       from stock where territoire_id = $1 and ressource_id = any($2::text[])
     ),
     paie as (select ressource_id, least(quantite, greatest(0, $3::numeric - avant)) as pris from ordre)
     update stock s set
       quantite = s.quantite - p.pris,
       plein_depuis = case when s.quantite - p.pris < s.limite then null else s.plein_depuis end
     from paie p
     where s.territoire_id = $1 and s.ressource_id = p.ressource_id and p.pris > 0`,
    [territoireId, ressources, cout],
  );
}
