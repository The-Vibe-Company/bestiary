// Le Couple réuni (US-0956) : dès que l'effectif d'une Espèce sans Couple compte un mâle et une femelle au Foyer, ils
// forment son Couple, sans action du joueur : tous deux quittent l'effectif et partent à l'abri, en Réserve (table
// couple), d'où ils ne combattent plus et ne sortent plus ; les autres Bêtes de l'Espèce restent dans l'effectif, et
// l'Espèce passe « Couple réuni » au Bestiaire. Un seul Couple par Espèce : il ne se défait pas, et aucun second ne se
// forme. La page de la Réserve les montre (US-0801, US-0802). US-0958 : le récit du retour qui le réunit l'annonce
// (recitsDuTerritoire, src/monde/recits.ts), et le menu du chef compte les Couples réunis. Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { inscrireAuBestiaire } from "@/bestiaire/bestiaire";
import { BETES_SORTIES } from "./effectif";
import { ELEVAGE_ACQUIS } from "./elevage";

/** US-0956 : le Couple réuni d'une Espèce, et l'instant du jeu où il l'a été. */
export type CoupleReuni = { especeId: string; reuniLe: Date };

/**
 * US-0956 : à l'instant du jeu `le`, réunit le Couple de chaque Espèce du Territoire qui n'en a pas encore et dont
 * l'effectif compte un mâle et une femelle au Foyer : l'un et l'autre quittent l'effectif pour la Réserve, et l'Espèce
 * passe « Couple réuni » au Bestiaire (inscrireAuBestiaire). Rend les Espèces dont le Couple vient d'être réuni.
 * US-0957 : leur Élevage est dès lors acquis, pour toujours (src/monde/elevage.ts), et c'est lui qui dit qu'une Espèce a
 * déjà son Couple.
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
       where e.territoire_id = $1 and not ${ELEVAGE_ACQUIS}
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
 * US-0956 : les Couples réunis du Territoire, du premier au dernier ; la Réserve les montre avec leur Espèce
 * (couplesEnReserve, US-0802). Aucun tant qu'il n'en a réuni aucun. L'Élevage d'une Espèce se demande à elevageAcquis
 * (US-0957). US-0958 : l'annonce au récit les lit avec les Récits (recitsDuTerritoire).
 */
export async function couplesDuTerritoire(base: Pool | PoolClient, territoireId: number): Promise<CoupleReuni[]> {
  const { rows } = await base.query<CoupleReuni>(
    `select espece_id as "especeId", reuni_le as "reuniLe" from couple where territoire_id = $1 order by reuni_le, espece_id`,
    [territoireId],
  );
  return rows;
}

/**
 * US-0958 : le nombre de Couples réunis du Territoire, que le menu du chef montre dans la barre du haut ; il n'augmente que
 * d'un à chaque Couple, puisqu'un Couple ne se défait pas, et servira au classement principal (étape 60).
 */
export async function nombreDeCouples(base: Pool | PoolClient, territoireId: number): Promise<number> {
  const { rows } = await base.query<{ nombre: number }>("select count(*)::int as nombre from couple where territoire_id = $1", [territoireId]);
  return rows[0].nombre;
}

/** US-0802 : un Couple de la Réserve, tel que sa page le montre : son Espèce, son illustration (null : aucune) et sa Rareté. */
export type CoupleEnReserve = { especeId: string; nom: string; illustration: string | null; rarete: { id: string; nom: string } };

/**
 * US-0802 : les Couples de la Réserve du Territoire, du premier réuni au dernier, comme couplesDuTerritoire, avec ce que
 * la page en montre de leur Espèce. Ceux de ce seul Territoire : un joueur ne voit jamais la Réserve d'un autre.
 */
export async function couplesEnReserve(base: Pool | PoolClient, territoireId: number): Promise<CoupleEnReserve[]> {
  return lireLaReserve(base, territoireId, null);
}

/**
 * US-0803 : le Couple de l'Espèce `especeId` dans la Réserve du Territoire, tel que la fiche de l'Espèce le montre ; null
 * si le joueur n'a pas réuni ce Couple, qu'un autre l'ait réuni ou non.
 */
export async function coupleEnReserve(base: Pool | PoolClient, territoireId: number, especeId: string): Promise<CoupleEnReserve | null> {
  return (await lireLaReserve(base, territoireId, especeId))[0] ?? null;
}

/** US-0802, US-0803 : les Couples de la Réserve du Territoire avec leur Espèce, tous ou celui d'une seule Espèce. */
async function lireLaReserve(base: Pool | PoolClient, territoireId: number, especeId: string | null): Promise<CoupleEnReserve[]> {
  const { rows } = await base.query<CoupleEnReserve>(
    `select c.espece_id as "especeId", es.nom, es.illustration, json_build_object('id', r.id, 'nom', r.nom) as rarete
     from couple c join espece es on es.id = c.espece_id join rarete r on r.id = es.rarete_id
     where c.territoire_id = $1 and ($2::text is null or c.espece_id = $2) order by c.reuni_le, c.espece_id`,
    [territoireId, especeId],
  );
  return rows;
}
