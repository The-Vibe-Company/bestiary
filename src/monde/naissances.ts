// Les naissances d'un Élevage (US-0817) : les Bêtes d'un Élevage lancé (src/monde/lancer-un-elevage.ts) naissent l'une
// après l'autre, chacune après la durée d'Élevage de l'Espèce, pendant que le temps avance (src/temps/regles.ts), le
// joueur présent ou absent. Côté serveur uniquement.
import "server-only";
import type { PoolClient } from "pg";
import { faireEntrerDansLEffectif } from "./effectif";
import { type ElevageFini, recitDesElevages } from "./recit-d-elevage";
import { ecrireUnRecit } from "./recits";

/** US-0821 : le type de l'événement qui note chaque fin d'Élevage, et le Récit qui la dit. */
export const FIN_D_ELEVAGE_NOTEE = "fin_d_elevage";

/**
 * US-0821 : le Récit de fin d'Élevage du Territoire $1 que le joueur n'a pas encore lu, s'il y en a un : celui auquel
 * renvoie une fin d'Élevage ($2, le type de l'événement). Tenu jusqu'à la fin de la transaction, comme celui de la
 * Famine (US-0327) : ouvert par le joueur en même temps, il l'est avant ou après sa mise à jour, jamais pendant.
 */
const RECIT_D_ELEVAGE_NON_LU = `
  select r.id from recit r
  where r.territoire_id = $1 and r.lu_le is null
    and exists (
      select 1 from evenement e
      where e.element = 'territoire' and e.element_id = $1 and e.type = $2 and (e.donnees->>'recit')::int = r.id
    )
  order by r.id desc
  limit 1
  for update of r`;

/** US-0821 : les fins d'Élevage du Territoire $1 ($2) que dit le Récit $3, dans l'ordre de leurs fins. */
const FINS_DU_RECIT = `
  select (donnees->>'nombre')::int as nombre, donnees->>'espece' as espece, survient_le as fin from evenement
  where element = 'territoire' and element_id = $1 and type = $2 and (donnees->>'recit')::int = $3
  order by survient_le, id`;

/**
 * US-0821 : dit la fin d'un Élevage dans un Récit. Comme pour les départs de Famine (US-0327), si le joueur n'a pas
 * encore lu le Récit d'une fin précédente, c'est lui qui est repris : il dit toutes les fins depuis, et prend la date
 * de la dernière ; sinon, un nouveau Récit (recitDesElevages). Les Élevages finis pendant une absence se disent ainsi
 * dans un seul Récit, quel que soit le découpage du rattrapage. Chaque fin est notée en événement, qui porte son Récit.
 */
async function direLaFinDElevage(client: PoolClient, territoireId: number, fin: ElevageFini): Promise<void> {
  const { rows: notes } = await client.query<{ id: number }>(
    `insert into evenement (element, element_id, survient_le, type, donnees, traite_le)
     values ('territoire', $1, $2, $3, jsonb_build_object('nombre', $4::int, 'espece', $5::text), $2) returning id`,
    [territoireId, fin.fin, FIN_D_ELEVAGE_NOTEE, fin.nombre, fin.espece],
  );
  const { rows: nonLu } = await client.query<{ id: number }>(RECIT_D_ELEVAGE_NON_LU, [territoireId, FIN_D_ELEVAGE_NOTEE]);
  const recitId = nonLu[0]?.id ?? (await ecrireUnRecit(client, territoireId, recitDesElevages([fin])));
  await client.query("update evenement set donnees = donnees || jsonb_build_object('recit', $2::int) where id = $1", [notes[0].id, recitId]);
  if (!nonLu[0]) return;
  const { rows: fins } = await client.query<ElevageFini>(FINS_DU_RECIT, [territoireId, FIN_D_ELEVAGE_NOTEE, recitId]);
  const { titre, texte, survenuLe } = recitDesElevages(fins);
  await client.query("update recit set titre = $2, texte = $3, survenu_le = $4 where id = $1", [recitId, titre, texte, survenuLe]);
}

/** Le nombre de k impairs de 1 à n : les femelles des n premières naissances, qui alternent en commençant par une femelle. */
const impairs = (n: number) => Math.floor((n + 1) / 2);

/**
 * US-0817 : fait naître les Bêtes des Élevages du Territoire entre les instants du jeu `depuis` (exclu) et `jusqua`
 * (inclus), et rien d'autre : la k-ième Bête d'un Élevage naît à son lancement plus k fois la durée d'Élevage d'une Bête,
 * fixée au lancement, pour k de 1 à sa quantité. Chacune entre aussitôt dans l'effectif de son Espèce ; les naissances
 * alternent, une femelle, un mâle, une femelle… (tranché au plus simple). Rien ne se retient de plus en base : les
 * naissances se lisent de l'heure, et le temps découpé autrement donne les mêmes, chacune une fois.
 *
 * Quand la dernière naît, l'Élevage est fini : un Récit le dit, à l'instant de cette naissance (direLaFinDElevage, un seul
 * pour les Élevages finis tant qu'il n'est pas lu, US-0821), et l'éleveur redevient libre (habitant.espece_elevee) ; le temps qui avance s'arrête à cet instant (prochaineFinDElevage). Aucune limite de Places : les Bêtes nées s'ajoutent, même au-delà
 * de ce que l'Habitat offre (US-0825 bloquera l'Élevage, au lancement). Dans la transaction du temps qui avance.
 */
export async function faireNaitreLesBetes(client: PoolClient, territoireId: number, depuis: Date, jusqua: Date): Promise<void> {
  // Les naissances déjà faites en `depuis`, et celles faites en `jusqua`, comptées en secondes exactes (numeric).
  const { rows } = await client.query<{
    especeId: string;
    nom: string;
    eleveurId: number | null;
    quantite: number;
    avant: string;
    apres: string;
    fin: Date;
  }>(
    `select e.espece_id as "especeId", es.nom, e.eleveur_id as "eleveurId", e.quantite,
       greatest(0, floor(extract(epoch from ($2::timestamptz - e.lance_le)) / (e.duree_minutes * 60)))::text as avant,
       least(e.quantite, floor(extract(epoch from ($3::timestamptz - e.lance_le)) / (e.duree_minutes * 60)))::text as apres,
       e.lance_le + (e.quantite::float8 * e.duree_minutes) * interval '1 minute' as fin
     from elevage e join espece es on es.id = e.espece_id
     where e.territoire_id = $1
       and extract(epoch from ($2::timestamptz - e.lance_le)) < e.quantite::numeric * e.duree_minutes * 60
       and extract(epoch from ($3::timestamptz - e.lance_le)) >= e.duree_minutes * 60
     order by e.lance_le, e.id`,
    [territoireId, depuis, jusqua],
  );
  for (const { especeId, nom, eleveurId, quantite, avant, apres, fin } of rows) {
    const [deja, faites] = [Number(avant), Number(apres)];
    if (faites <= deja) continue;
    const femelles = impairs(faites) - impairs(deja);
    await faireEntrerDansLEffectif(client, territoireId, [
      { especeId, sexe: "femelle", nombre: femelles },
      { especeId, sexe: "male", nombre: faites - deja - femelles },
    ]);
    if (faites < quantite) continue;
    await direLaFinDElevage(client, territoireId, { nombre: quantite, espece: nom, fin });
    if (eleveurId !== null) await client.query("update habitant set espece_elevee = null where id = $1 and espece_elevee = $2", [eleveurId, especeId]);
  }
}

/**
 * US-0817 : l'instant de la première fin d'Élevage du Territoire entre `depuis` (exclu) et `jusqua` (inclus), celui de sa
 * dernière naissance ; null sans aucune. Le temps qui avance s'y arrête (src/temps/regles.ts) : l'éleveur, libre dès cet
 * instant, l'est aussi pour la suite du calcul (une Famine qui fait partir un Habitant libre), et le temps découpé
 * autrement donne le même résultat. Les lancements tombent à la milliseconde (lancerUnElevage), leurs fins aussi.
 */
export async function prochaineFinDElevage(client: PoolClient, territoireId: number, depuis: Date, jusqua: Date): Promise<Date | null> {
  const { rows } = await client.query<{ fin: Date | null }>(
    `select min(e.lance_le + (e.quantite::float8 * e.duree_minutes) * interval '1 minute') as fin
     from elevage e
     where e.territoire_id = $1
       and e.lance_le + (e.quantite::float8 * e.duree_minutes) * interval '1 minute' > $2
       and e.lance_le + (e.quantite::float8 * e.duree_minutes) * interval '1 minute' <= $3`,
    [territoireId, depuis, jusqua],
  );
  const fin = rows[0]?.fin ?? null;
  return fin !== null && fin.getTime() > depuis.getTime() ? fin : null;
}

