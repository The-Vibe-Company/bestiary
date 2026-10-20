// Le lancement d'un Élevage (US-0815) : ce que fait le bouton « Élever ». US-0819 : et l'ajout d'un Élevage à la file de
// l'éleveur de l'Espèce, « Ajouter à la file ». Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { ELEVAGES_PAR_FILE_AU_PLUS } from "@/reglages";
import { coutDUneBeteElevee, dureeDUneBeteEleveeMinutes, nourritureQuiPaie } from "./cout-d-elevage";
import type { Regime } from "./effectif";
import { ELEVAGE_SANS_COUPLE, ELEVAGE_SANS_ELEVEUR, elevageAcquis } from "./elevage";
import { ELEVEUR_LIBRE_EN_SQL } from "./etat-habitant";
import { ilManque } from "./payer-un-elevage";
import { FILE_PLEINE } from "./suivi-d-elevage";

/**
 * US-0815 : le refus d'un Élevage d'une Espèce qui a déjà le sien en cours : une Espèce n'a qu'un éleveur à la fois
 * (US-0844). US-0819 : sauf à l'ajouter à la file, ce que la demande dit (`enFile`).
 */
export const ELEVAGE_DEJA_EN_COURS = "Un Élevage de cette Espèce est déjà en cours.";

/**
 * US-0815 : un Élevage lancé, ce que le joueur en lit (combien de Bêtes, et l'éleveur qui s'en occupe), ou son refus.
 * US-0819 : `enFile`, quand il a pris place dans la file de l'éleveur, derrière l'Élevage en cours.
 */
export type Lancement = { lance: { quantite: number; eleveur: string; enFile: boolean } } | { refus: string };

/** Un lancement refusé : rien n'est retenu, rien n'est payé, et le joueur lit pourquoi. */
class Refus extends Error {}

/**
 * US-0815 : lance l'Élevage de `quantite` Bêtes de l'Espèce `especeId` au Territoire, à `instant`, l'heure du jeu du clic.
 * Tout se relit ici, au moment de payer, d'où que vienne la demande : le Couple réuni (US-0812), aucun autre Élevage de
 * l'Espèce en cours (une Espèce n'a qu'un éleveur à la fois, US-0844), un éleveur libre (US-0843), et la Nourriture du
 * régime de l'Espèce (US-0813). L'éleveur, le premier libre par prénom, est pris d'une seule requête qui relit qu'il est
 * toujours éleveur et libre, et part à l'Élevage (habitant.espece_elevee) ; le coût total (US-0814) part aussitôt des
 * Stocks, sur le plus fourni d'abord pour un omnivore, puis sur l'autre ; l'Élevage est retenu, avec sa quantité, la
 * durée d'une Bête et ce qu'il a coûté, à l'heure du clic (US-0817 : jamais avant l'instant jusqu'où le temps du
 * Territoire est calculé, qu'un rattrapage passé juste avant a pu porter au-delà du clic ; ses naissances, src/monde/naissances.ts).
 *
 * Tout tient dans une transaction : un lancement refusé ne retient rien et ne fait rien payer. Le Territoire y est tenu
 * d'abord, comme pour le départ d'une Expédition (US-0911) : deux lancements envoyés au même instant (un double clic)
 * passent l'un après l'autre, et le second relit ce que le premier a pris : un seul Élevage, payé une fois.
 *
 * US-0819 : pendant l'Élevage de l'Espèce, une demande qui le dit (`enFile`, le bouton « Ajouter à la file ») ajoute
 * l'Élevage à la file de son éleveur : payé aussitôt, confié au même éleveur, il part à la fin du dernier de la file,
 * sans temps mort (son `lance_le`, fixé ici : rien d'autre ne se retient). ELEVAGES_PAR_FILE_AU_PLUS par file, celui en
 * cours compris : au-delà, refus (FILE_PLEINE). Sans Élevage en cours, la même demande lance l'Élevage comme une autre.
 * Une demande qui ne le dit pas est refusée pendant l'Élevage, comme avant (ELEVAGE_DEJA_EN_COURS) : un double clic sur
 * « Élever » ne fait pas une file.
 */
export async function lancerUnElevage(pool: Pool, territoireId: number, especeId: string, quantite: number, instant: Date, enFile = false): Promise<Lancement> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    // US-0817 : le Territoire tenu, et l'instant jusqu'où son temps est calculé, à la milliseconde supérieure : un Élevage ne
    // démarre jamais avant, sans quoi ses premières naissances tomberaient dans un temps déjà passé.
    const { rows } = await client.query<{ calcule: Date }>(
      `select date_trunc('milliseconds', calcule_jusqu_a)
         + case when calcule_jusqu_a > date_trunc('milliseconds', calcule_jusqu_a) then interval '1 millisecond' else interval '0' end as calcule
       from territoire where id = $1 for no key update`,
      [territoireId],
    );
    const depart = rows[0] && rows[0].calcule.getTime() > instant.getTime() ? rows[0].calcule : instant;
    const lance = await lancer(client, territoireId, especeId, quantite, depart, enFile);
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
async function lancer(
  client: PoolClient,
  territoireId: number,
  especeId: string,
  quantite: number,
  instant: Date,
  enFile: boolean,
): Promise<{ quantite: number; eleveur: string; enFile: boolean }> {
  if (!Number.isInteger(quantite) || quantite < 1) throw new Error(`Quantité d'Élevage impossible : ${quantite}.`);
  if (!(await elevageAcquis(client, territoireId, especeId))) throw new Refus(ELEVAGE_SANS_COUPLE);
  // US-0819 : l'éleveur qui s'occupe déjà de l'Espèce, tenu : la file est la sienne, et deux ajouts au même instant s'y
  // rangent l'un derrière l'autre.
  const { rows: occupes } = await client.query<{ id: number; prenom: string }>(
    "select id, prenom from habitant where territoire_id = $1 and espece_elevee = $2 order by id limit 1 for no key update",
    [territoireId, especeId],
  );
  const occupe = occupes[0];
  if (occupe && !enFile) throw new Refus(ELEVAGE_DEJA_EN_COURS);
  let debut = instant;
  if (occupe) {
    // Sa file : ses Élevages de l'Espèce qui ne sont pas finis à l'instant ; le nouveau partira à la fin du dernier.
    const { rows: file } = await client.query<{ combien: number; fin: Date | null }>(
      `select count(*)::int as combien, max(lance_le + (quantite::float8 * duree_minutes) * interval '1 minute') as fin
       from elevage where eleveur_id = $1 and espece_id = $2
         and lance_le + (quantite::float8 * duree_minutes) * interval '1 minute' > $3`,
      [occupe.id, especeId, instant],
    );
    if (file[0].combien >= ELEVAGES_PAR_FILE_AU_PLUS) throw new Refus(FILE_PLEINE);
    if (file[0].fin !== null && file[0].fin.getTime() > debut.getTime()) debut = file[0].fin;
  }

  // L'éleveur libre, pris et tenu d'une seule requête : un changement de Métier envoyé au même instant attend, puis relit.
  const { rows: pris } = occupe
    ? { rows: [occupe] }
    : await client.query<{ id: number; prenom: string }>(
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
    [territoireId, especeId, pris[0].id, quantite, dureeDUneBeteEleveeMinutes(taille), cout, debut],
  );
  return { quantite, eleveur: pris[0].prenom, enFile: occupe !== undefined };
}

/**
 * US-0815 : retire `cout` des Stocks `ressources` du Territoire, le plus fourni d'abord, puis l'autre ; refuse, sans rien
 * retirer, quand ils n'y suffisent pas ensemble : aucun Stock ne descend sous zéro. US-0816 : le refus dit ce qui manque,
 * dans la Nourriture du régime, nommée comme les Ressources (« Il manque 12 Viande ou Végétaux. ») : les Stocks ont pu
 * baisser entre l'affichage et le clic. Un Stock qui repasse sous sa limite n'est plus plein (US-0228). Les Stocks sont
 * tenus jusqu'à la fin du lancement.
 */
async function payer(client: PoolClient, territoireId: number, ressources: string[], cout: number): Promise<void> {
  const { rows } = await client.query<{ manque: string; nourriture: string }>(
    `with tenus as materialized (
       select quantite from stock where territoire_id = $1 and ressource_id = any($2::text[]) for update
     )
     select ($3::numeric - coalesce(sum(quantite), 0))::text as manque,
       (select string_agg(nom, ' ou ' order by ordre) from ressource where id = any($2::text[])) as nourriture
     from tenus`,
    [territoireId, ressources, cout],
  );
  const manque = Number(rows[0].manque);
  if (manque > 0) throw new Refus(ilManque(manque, rows[0].nourriture));
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
