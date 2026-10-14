// La Famine d'un Territoire (US-0325) : le manque de Nourriture pour payer l'Entretien. Le mécanisme du temps la
// tient à jour (PRODUIRE, src/monde/production.ts), et fait partir des Habitants tant qu'elle dure (US-0326), ce
// qu'un Récit raconte (US-0327), comme sa fin (US-0328). Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { LIBRE_EN_SQL } from "./etat-habitant";
import { ecrireUnRecit, type NouveauRecit } from "./recits";

/**
 * US-0326 : un départ de Famine, noté dans la table evenement comme un événement du Territoire déjà traité à son
 * instant, avec le prénom et le Métier (son nom, null sans Métier) de l'Habitant parti. Il n'est pas programmé : le
 * calcul du temps le trouve en chemin (PRODUIRE) et l'applique aussitôt ; la table en garde la trace, comme des
 * départs de Voyageurs (US-0337). US-0327 : ses données renvoient aussi au Récit qui le dit.
 */
export const DEPART_DE_FAMINE = "depart_de_famine";

/** US-0327 : le fuseau des heures dites dans les Récits, comme sur la page Récits, en attendant celui de chaque joueur. */
const FUSEAU = "Europe/Paris";

/**
 * US-0921 : un Habitant resté au Foyer, qui peut s'en aller en Famine (condition sur la table habitant) : un explorateur
 * absent ne part pas. Le départ (FAIRE_PARTIR) et le calcul qui le programme (PRODUIRE) le lisent tous deux ici.
 * US-0815 : un éleveur à l'Élevage ne part pas non plus : son Élevage continue, la Famine passée (US-0834). C'est la
 * règle de l'Habitant libre (LIBRE_EN_SQL), celle qui verrouille aussi son Métier.
 */
export const AU_FOYER = LIBRE_EN_SQL;

/**
 * US-0326 : l'Habitant du Territoire $1 qui s'en va à l'instant $2 : un sans Métier d'abord, puis le dernier arrivé
 * (le plus grand identifiant : les Habitants sont numérotés à leur arrivée) ; jamais le dernier Habitant. Il est
 * effacé, et son départ noté ($3, le type de l'événement). US-0921 : il est choisi parmi ceux restés au Foyer ; les
 * explorateurs absents restent des Habitants du Territoire, et comptent pour qu'il en garde toujours un.
 */
const FAIRE_PARTIR = `
  with parti as (
    delete from habitant
    where id = (select id from habitant where territoire_id = $1 and ${AU_FOYER} order by metier is not null, id desc limit 1)
      and (select count(*) from habitant where territoire_id = $1) > 1
    returning prenom, metier
  )
  insert into evenement (element, element_id, survient_le, type, donnees, traite_le)
  select 'territoire', $1, $2::timestamptz, $3, jsonb_build_object('prenom', parti.prenom, 'metier', m.nom), $2::timestamptz
  from parti left join metier m on m.id = parti.metier
  returning id, donnees->>'prenom' as prenom, donnees->>'metier' as metier, survient_le as "partiLe"`;

/**
 * US-0327 : le Récit de Famine du Territoire $1 que le joueur n'a pas encore lu, s'il y en a un : celui auquel renvoie
 * un départ de Famine ($2, le type de l'événement). Il est tenu jusqu'à la fin de la transaction : ouvert par le
 * joueur en même temps, il l'est avant ou après sa mise à jour, jamais pendant.
 */
const RECIT_DE_FAMINE_NON_LU = `
  select r.id from recit r
  where r.territoire_id = $1 and r.lu_le is null
    and exists (
      select 1 from evenement e
      where e.element = 'territoire' and e.element_id = $1 and e.type = $2 and (e.donnees->>'recit')::int = r.id
    )
  order by r.id desc
  limit 1
  for update of r`;

/** US-0327 : les départs de Famine du Territoire $1 ($2) que dit le Récit $3, dans leur ordre. */
const DEPARTS_DU_RECIT = `
  select donnees->>'prenom' as prenom, donnees->>'metier' as metier, survient_le as "partiLe" from evenement
  where element = 'territoire' and element_id = $1 and type = $2 and (donnees->>'recit')::int = $3
  order by survient_le, id`;

/** US-0327 : un départ de Famine tel que son Récit le dit : le prénom, le Métier (null sans Métier) et l'heure du jeu. */
export type DepartDeFamine = { prenom: string; metier: string | null; partiLe: Date };

/**
 * US-0326 : faute de Nourriture, un Habitant quitte le Territoire à l'instant `instant` (en texte, à la microseconde :
 * une heure pile après le début de la Famine, ou après le départ précédent). Le nombre d'Habitants, l'Entretien et
 * les effectifs par Métier baissent aussitôt. Appelée par produire, dans la transaction du temps qui avance.
 *
 * US-0327 : un Récit le dit. Comme pour les départs de Voyageurs (US-0337), si le joueur n'a pas encore lu celui d'un
 * départ précédent, c'est lui qui est repris : il dit tous les départs depuis, et prend la date du dernier ; sinon,
 * un nouveau Récit. Les départs d'une absence se disent ainsi ensemble, quel que soit le découpage du rattrapage.
 */
export async function faireRepartirUnHabitant(client: PoolClient, territoireId: number, instant: string): Promise<void> {
  const { rows: partis } = await client.query<DepartDeFamine & { id: number }>(FAIRE_PARTIR, [territoireId, instant, DEPART_DE_FAMINE]);
  const parti = partis[0];
  if (!parti) return;
  const { rows: nonLu } = await client.query<{ id: number }>(RECIT_DE_FAMINE_NON_LU, [territoireId, DEPART_DE_FAMINE]);
  const recitId = nonLu[0]?.id ?? (await ecrireUnRecit(client, territoireId, recitDesDeparts([parti])));
  await client.query("update evenement set donnees = donnees || jsonb_build_object('recit', $2::int) where id = $1", [parti.id, recitId]);
  if (!nonLu[0]) return;
  const { rows: departs } = await client.query<DepartDeFamine>(DEPARTS_DU_RECIT, [territoireId, DEPART_DE_FAMINE, recitId]);
  const { titre, texte, survenuLe } = recitDesDeparts(departs);
  await client.query("update recit set titre = $2, texte = $3, survenu_le = $4 where id = $1", [recitId, titre, texte, survenuLe]);
}

/** US-0327 : l'heure d'un départ, dans le fuseau du joueur : « 8 octobre à 14:05 ». */
const quand = (instant: Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: FUSEAU }).format(instant);

/** US-0327 : « Lumi, Bûcheron », « Ines, sans Métier ». */
const quiEtQuelMetier = (depart: DepartDeFamine) => `${depart.prenom}, ${depart.metier ?? "sans Métier"}`;

/** US-0327 : ce que le Récit rappelle, à chaque départ. */
const SORTIR_DE_LA_FAMINE = "Pour sortir de la Famine : produire plus de Nourriture ou nourrir moins de bouches.";

/**
 * US-0327 : le Récit des départs de Famine, dans l'ordre où ils sont survenus, daté du dernier : « Lumi a quitté le
 * Territoire », et, à plusieurs, « 3 Habitants ont quitté le Territoire », chacun sur sa ligne, avec son Métier et
 * son heure ; puis comment sortir de la Famine. Comme pour l'accueil, la phrase ne donne de genre à personne.
 */
export function recitDesDeparts(departs: DepartDeFamine[]): NouveauRecit {
  const dernier = departs.at(-1)!;
  if (departs.length === 1) {
    return {
      titre: `${dernier.prenom} a quitté le Territoire`,
      texte: `Faute de Nourriture, ${quiEtQuelMetier(dernier)}, a quitté le Territoire le ${quand(dernier.partiLe)}.\n\n${SORTIR_DE_LA_FAMINE}`,
      survenuLe: dernier.partiLe,
    };
  }
  return {
    titre: `${departs.length} Habitants ont quitté le Territoire`,
    texte: [
      `Faute de Nourriture, ${departs.length} Habitants ont quitté le Territoire :`,
      ...departs.map((depart) => `${quiEtQuelMetier(depart)}, le ${quand(depart.partiLe)}`),
      "",
      SORTIR_DE_LA_FAMINE,
    ].join("\n"),
    survenuLe: dernier.partiLe,
  };
}

/**
 * US-0327 : le Récit des départs de Famine que le joueur n'a pas encore lu, et le nombre d'Habitants qu'il dit partis ;
 * null s'il n'y en a pas. Pour le bandeau du Foyer, au retour.
 */
export async function departsNonLus(base: Pool | PoolClient, territoireId: number): Promise<{ recitId: number; habitants: number } | null> {
  const { rows } = await base.query<{ recitId: number; habitants: number }>(
    `select r.id as "recitId", count(*)::int as habitants
     from recit r join evenement e on e.element = 'territoire' and e.element_id = $1 and e.type = $2 and (e.donnees->>'recit')::int = r.id
     where r.territoire_id = $1 and r.lu_le is null
     group by r.id order by r.id desc limit 1`,
    [territoireId, DEPART_DE_FAMINE],
  );
  return rows[0] ?? null;
}

/** US-0327 : « 1 Habitant est parti pendant votre absence », « 3 Habitants sont partis pendant votre absence ». */
export function departsPendantLAbsence(habitants: number): string {
  return habitants > 1 ? `${habitants} Habitants sont partis pendant votre absence` : `${habitants} Habitant est parti pendant votre absence`;
}

/**
 * US-0328 : les départs de Famine du Territoire $1 ($2) depuis le début de la Famine ($3) jusqu'à sa fin ($4), et sa
 * durée, en heures de jeu ; avec l'instant de la fin, pour le Récit.
 */
const BILAN_DE_LA_FAMINE = `
  select count(e.id)::int as departs, extract(epoch from $4::timestamptz - $3::timestamptz) / 3600 as heures, $4::timestamptz as fin
  from (select 1) une_ligne
    left join evenement e on e.element = 'territoire' and e.element_id = $1 and e.type = $2
      and e.survient_le > $3::timestamptz and e.survient_le <= $4::timestamptz`;

/**
 * US-0328 : la Famine du Territoire, commencée à `debut`, a fini à l'instant `fin` (en texte ou en Date, à la
 * microseconde), la Nourriture payant de nouveau l'Entretien : un départ qui l'a ramené sous la production, ou de la
 * Nourriture ajoutée. Les départs ont cessé, et les Habitants partis ne reviennent pas ; un Récit dit sa durée et le
 * total des départs. Appelée par produire, dans la transaction du temps qui avance, qui a déjà remis l'état retenu
 * à null.
 */
export async function finirLaFamine(client: PoolClient, territoireId: number, debut: string, fin: Date | string): Promise<void> {
  const { rows } = await client.query<{ departs: number; heures: string; fin: Date }>(BILAN_DE_LA_FAMINE, [territoireId, DEPART_DE_FAMINE, debut, fin]);
  await ecrireUnRecit(client, territoireId, recitDeFinDeFamine(Number(rows[0].heures), rows[0].departs, rows[0].fin));
}

/**
 * US-0328 : la durée d'une Famine, arrondie à la minute en dessous : « moins d'une minute », « 45 min », « 2 h 05 »,
 * puis en jours et heures au-delà de 48 h, comme le temps que tiendra la Nourriture : « 2 j 5 h ».
 */
function dureeDeLaFamine(heures: number): string {
  const minutes = Math.floor(Math.round(heures * 3_600_000_000) / 60_000_000);
  if (minutes < 1) return "moins d'une minute";
  if (minutes < 60) return `${minutes} min`;
  const [entieres, reste] = [Math.floor(minutes / 60), minutes % 60];
  if (entieres <= 48) return reste === 0 ? `${entieres} h` : `${entieres} h ${String(reste).padStart(2, "0")}`;
  return entieres % 24 === 0 ? `${entieres / 24} j` : `${Math.floor(entieres / 24)} j ${entieres % 24} h`;
}

/**
 * US-0328 : le Récit de la fin de la Famine, daté de sa fin : « Fin de la Famine », sa durée et le total des départs
 * qu'elle a causés.
 */
export function recitDeFinDeFamine(heures: number, departs: number, fin: Date): NouveauRecit {
  const partis =
    departs === 0
      ? "aucun Habitant n'a quitté le Territoire"
      : departs === 1
        ? "1 Habitant a quitté le Territoire"
        : `${departs} Habitants ont quitté le Territoire`;
  return {
    titre: "Fin de la Famine",
    texte: `La Nourriture paie de nouveau l'Entretien. La Famine a duré ${dureeDeLaFamine(heures)} ; ${partis}.`,
    survenuLe: fin,
  };
}

/**
 * US-0325 : depuis combien d'heures de jeu le Territoire est en Famine, à l'instant jusqu'où il est calculé, celui de
 * ses Stocks ; null hors Famine.
 */
export async function famineDepuis(base: Pool | PoolClient, territoireId: number): Promise<number | null> {
  const { rows } = await base.query<{ heures: string | null }>(
    "select extract(epoch from calcule_jusqu_a - famine_depuis) / 3600 as heures from territoire where id = $1",
    [territoireId],
  );
  return rows[0]?.heures == null ? null : Number(rows[0].heures);
}
