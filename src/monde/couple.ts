// Le Couple réuni (US-0956) : dès que l'effectif d'une Espèce sans Couple compte un mâle et une femelle au Foyer, ils
// forment son Couple, sans action du joueur : tous deux quittent l'effectif et partent à l'abri, en Réserve (table
// couple), d'où ils ne combattent plus et ne sortent plus ; les autres Bêtes de l'Espèce restent dans l'effectif, et
// l'Espèce passe « Couple réuni » au Bestiaire. Un seul Couple par Espèce : il ne se défait pas, et aucun second ne se
// forme. La page de la Réserve arrive à l'étape 33, l'annonce au récit avec US-0958. Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { inscrireAuBestiaire } from "@/bestiaire/bestiaire";
import { BETES_SORTIES } from "./effectif";

/** US-0956 : le Couple réuni d'une Espèce, et l'instant du jeu où il l'a été. */
export type CoupleReuni = { especeId: string; reuniLe: Date };

/**
 * US-0956 : à l'instant du jeu `le`, réunit le Couple de chaque Espèce du Territoire qui n'en a pas encore et dont
 * l'effectif compte un mâle et une femelle au Foyer : l'un et l'autre quittent l'effectif pour la Réserve, et l'Espèce
 * passe « Couple réuni » au Bestiaire (inscrireAuBestiaire). Rend les Espèces dont le Couple vient d'être réuni.
 *
 * L'effectif ne gagne une Bête au Foyer qu'au retour d'une Expédition : la Bête apprivoisée qui la suit y entre
 * (US-0938), et les Bêtes de son escorte n'en sont plus sorties (US-0916). Appelée par rentrerAuFoyer après les deux,
 * dans la transaction du temps qui avance : le même Couple, au même instant, en direct, au rattrapage ou par la tâche
 * planifiée.
 *
 * Les Bêtes d'une escorte en cours ne sont pas au Foyer (BETES_SORTIES). L'escorte ne choisit pas le sexe : le Couple ne
 * se forme que si un mâle et une femelle y sont sûrement, quelles que soient les Bêtes sorties, soit plus de mâles que de
 * Bêtes sorties de l'Espèce, et plus de femelles ; sinon au retour de l'escorte, qui repasse par ici. Jamais une Bête
 * sortie n'entre en Réserve ; mais faute de connaître leur sexe, le Couple peut attendre ce retour alors que son mâle et
 * sa femelle sont déjà au Foyer (deux mâles, dont un sorti, puis une femelle) : US-0960 dira mieux les absents.
 */
export async function reunirLesCouples(client: PoolClient, territoireId: number, le: Date): Promise<string[]> {
  const { rows } = await client.query<{ especeId: string }>(
    `with a_reunir as (
       select e.espece_id
       from effectif e
       where e.territoire_id = $1 and not exists (select 1 from couple c where c.territoire_id = $1 and c.espece_id = e.espece_id)
       group by e.territoire_id, e.espece_id
       having coalesce(sum(e.nombre) filter (where e.sexe = 'male'), 0) > (${BETES_SORTIES})
         and coalesce(sum(e.nombre) filter (where e.sexe = 'femelle'), 0) > (${BETES_SORTIES})
     ),
     reunis as (
       insert into couple (territoire_id, espece_id, reuni_le) select $1, espece_id, $2 from a_reunir
       on conflict do nothing
       returning espece_id
     ),
     en_reserve as (
       update effectif e set nombre = e.nombre - 1 from reunis r where e.territoire_id = $1 and e.espece_id = r.espece_id
     )
     select espece_id as "especeId" from reunis order by espece_id`,
    [territoireId, le],
  );
  // L'une après l'autre : sur le client d'une transaction, deux requêtes ne partent pas à la fois.
  for (const { especeId } of rows) await inscrireAuBestiaire(client, territoireId, especeId, "couple_reuni", le);
  return rows.map((r) => r.especeId);
}

/**
 * US-0956 : les Couples réunis du Territoire, du premier au dernier : ce que liront l'annonce au récit (US-0958),
 * l'Élevage (US-0957) et la Réserve (étape 33). Aucun tant qu'il n'en a réuni aucun.
 */
export async function couplesDuTerritoire(base: Pool | PoolClient, territoireId: number): Promise<CoupleReuni[]> {
  const { rows } = await base.query<CoupleReuni>(
    `select espece_id as "especeId", reuni_le as "reuniLe" from couple where territoire_id = $1 order by reuni_le, espece_id`,
    [territoireId],
  );
  return rows;
}
