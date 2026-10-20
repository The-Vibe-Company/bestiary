// Les Élevages en cours d'un Territoire (US-0818), pour les suivre : le bloc « Élever » de la fiche d'une Espèce et
// l'accueil. Où chacun en est se lit de l'heure du jeu (src/monde/suivi-d-elevage.ts). Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import type { ElevageEnCours } from "./suivi-d-elevage";

/**
 * US-0818 : les Élevages du Territoire en cours à l'heure du jeu `instant`, ceux dont la dernière Bête n'est pas née
 * (un Élevage fini reste en base, src/monde/naissances.ts), rangés par prénom de l'éleveur comme la liste des Habitants,
 * ceux dont l'éleveur n'est plus là en dernier. US-0819 : un éleveur peut en avoir plusieurs, sa file : celui en cours,
 * puis ceux qui le suivront, dans l'ordre de leur lancement (laFile, src/monde/suivi-d-elevage.ts). Une simple lecture :
 * l'heure du jeu suffit à dire où chacun en est, que le temps ait été rattrapé ou non.
 */
export async function elevagesEnCours(base: Pool | PoolClient, territoireId: number, instant: Date): Promise<ElevageEnCours[]> {
  const { rows } = await base.query<ElevageEnCours>(
    `select e.espece_id as "especeId", es.nom as espece, es.illustration, h.prenom as eleveur, e.quantite,
       e.lance_le as "lanceLe", e.duree_minutes as "dureeMinutes"
     from elevage e
       join espece es on es.id = e.espece_id
       left join habitant h on h.id = e.eleveur_id
     where e.territoire_id = $1
       and e.lance_le + (e.quantite::float8 * e.duree_minutes) * interval '1 minute' > $2
     order by h.prenom nulls last, e.lance_le, e.id`,
    [territoireId, instant],
  );
  return rows;
}
