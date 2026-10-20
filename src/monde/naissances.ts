// Les naissances d'un Élevage (US-0817) : les Bêtes d'un Élevage lancé (src/monde/lancer-un-elevage.ts) naissent l'une
// après l'autre, chacune après la durée d'Élevage de l'Espèce, pendant que le temps avance (src/temps/regles.ts), le
// joueur présent ou absent. Côté serveur uniquement.
import "server-only";
import type { PoolClient } from "pg";
import { faireEntrerDansLEffectif } from "./effectif";
import { recitDElevage } from "./recit-d-elevage";
import { ecrireUnRecit } from "./recits";

/** Le nombre de k impairs de 1 à n : les femelles des n premières naissances, qui alternent en commençant par une femelle. */
const impairs = (n: number) => Math.floor((n + 1) / 2);

/**
 * US-0817 : fait naître les Bêtes des Élevages du Territoire entre les instants du jeu `depuis` (exclu) et `jusqua`
 * (inclus), et rien d'autre : la k-ième Bête d'un Élevage naît à son lancement plus k fois la durée d'Élevage d'une Bête,
 * fixée au lancement, pour k de 1 à sa quantité. Chacune entre aussitôt dans l'effectif de son Espèce ; les naissances
 * alternent, une femelle, un mâle, une femelle… (tranché au plus simple). Rien ne se retient de plus en base : les
 * naissances se lisent de l'heure, et le temps découpé autrement donne les mêmes, chacune une fois.
 *
 * Quand la dernière naît, l'Élevage est fini : un Récit le dit, à l'instant de cette naissance (recitDElevage), et
 * l'éleveur redevient libre (habitant.espece_elevee) ; le temps qui avance s'arrête à cet instant (prochaineFinDElevage). Aucune limite de Places : les Bêtes nées s'ajoutent, même au-delà
 * de ce que l'Habitat offre (US-0825 bloquera l'Élevage, au lancement). Dans la transaction du temps qui avance.
 * US-0819 : l'éleveur dont la file continue (un autre de ses Élevages finit plus tard) reste à l'Élevage : le suivant
 * part à cet instant même.
 */
export async function faireNaitreLesBetes(client: PoolClient, territoireId: number, depuis: Date, jusqua: Date): Promise<void> {
  // Les naissances déjà faites en `depuis`, et celles faites en `jusqua`, comptées en secondes exactes (numeric).
  const { rows } = await client.query<{
    id: number;
    especeId: string;
    nom: string;
    eleveurId: number | null;
    quantite: number;
    avant: string;
    apres: string;
    fin: Date;
  }>(
    `select e.id, e.espece_id as "especeId", es.nom, e.eleveur_id as "eleveurId", e.quantite,
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
  for (const { id, especeId, nom, eleveurId, quantite, avant, apres, fin } of rows) {
    const [deja, faites] = [Number(avant), Number(apres)];
    if (faites <= deja) continue;
    const femelles = impairs(faites) - impairs(deja);
    await faireEntrerDansLEffectif(client, territoireId, [
      { especeId, sexe: "femelle", nombre: femelles },
      { especeId, sexe: "male", nombre: faites - deja - femelles },
    ]);
    if (faites < quantite) continue;
    await ecrireUnRecit(client, territoireId, recitDElevage(quantite, nom, fin));
    if (eleveurId !== null) {
      await client.query(
        `update habitant set espece_elevee = null where id = $1 and espece_elevee = $2
           and not exists (select 1 from elevage x where x.eleveur_id = $1 and x.id <> $3 and x.lance_le + (x.quantite::float8 * x.duree_minutes) * interval '1 minute' > $4)`,
        [eleveurId, especeId, id, fin],
      );
    }
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

