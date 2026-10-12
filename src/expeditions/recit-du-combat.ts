// Le récit du combat (US-0947) : au retour d'une Expédition attaquée par une Bête trop forte (US-0943), son Récit dit
// chaque combat (US-0944) : son heure, l'Espèce de la Bête et sa force exacte, et la force de l'escorte à cet instant
// (src/expeditions/recit-de-retour.ts) ; ses pertes, il les lit telles que les combats les ont retenues, en morts et en
// Blessés (US-0951). Le combat ne retient pas la force de l'escorte : l'escorte de départ, les attaques retenues avec
// leurs Rencontres et la règle du combat (pertesDuCombat) suffisent à la retrouver, en rejouant les combats dans l'ordre où
// ils se sont livrés (dansLOrdreDesCombats), chacun contre les survivantes du précédent, comme subirLesCombats ; une
// règle ou des Espèces changées entre le combat et le retour la donneraient un peu autre, cas rare, accepté. Côté serveur
// uniquement.
import "server-only";
import type { PoolClient } from "pg";
import { type EspeceAuCombat, pertesDuCombat } from "./combat";
import { forceDeLEscorte, forceDUneBete } from "./force";
import { dansLOrdreDesCombats } from "./pertes";

/**
 * US-0947 : un combat tel que le récit du retour le dit : la Rencontre de la Bête qui a attaqué, l'instant du combat, le
 * nom de l'Espèce de la Bête et sa force (US-0905), la force de l'escorte à cet instant, et si elle n'avait plus aucune
 * Bête (`sansEscorte`).
 */
export type CombatARaconter = { rencontreId: number; le: Date; bete: { nom: string; force: number }; escorte: number; sansEscorte: boolean };

/** US-0947 : une attaque à rejouer : sa Rencontre, son instant, le nom de l'Espèce de la Bête et sa force. */
export type AttaqueARejouer = { rencontreId: number; le: Date; nom: string; force: number };

/**
 * US-0947 : les combats des attaques `attaques`, dans l'ordre reçu, celui où ils se sont livrés, contre l'escorte `escorte`
 * de l'Expédition au départ : chacun contre les survivantes des précédents, qui ont perdu au combat (pertesDuCombat) leurs
 * mortes et leurs Blessés, hors de combat. Une escorte perdue tout entière, ou absente, ne perd plus rien.
 */
export function combatsRejoues(escorte: readonly EspeceAuCombat[], attaques: readonly AttaqueARejouer[]): CombatARaconter[] {
  const restantes = new Map(escorte.map((e) => [e.especeId, { ...e }]));
  return attaques.map(({ rencontreId, le, nom, force }) => {
    const encore = [...restantes.values()].filter((e) => e.nombre > 0);
    // La force de l'escorte au combat, avant ses pertes.
    const escorteAuCombat = forceDeLEscorte(encore);
    for (const p of pertesDuCombat(force, encore)) restantes.get(p.especeId)!.nombre -= p.nombre;
    return { rencontreId, le, bete: { nom, force }, escorte: escorteAuCombat, sansEscorte: encore.length === 0 };
  });
}

/**
 * US-0947 : les combats qu'a livrés l'Expédition `expeditionId` (combatsRejoues), dans l'ordre où ils se sont livrés,
 * depuis son escorte au départ et ses attaques retenues (US-0943) ; aucun sans attaque. Lue au retour, dans sa
 * transaction : toutes ses attaques sont retenues, et leurs combats livrés.
 */
export async function combatsDUneExpedition(client: PoolClient, expeditionId: number): Promise<CombatARaconter[]> {
  // L'une après l'autre : sur le client d'une transaction, deux requêtes ne partent pas à la fois.
  const { rows: attaques } = await client.query<{ rencontreId: number; le: Date; numero: string | null; beteDeNaissanceId: number | null; nom: string; attaque: number; vie: number }>(
    `select r.id as "rencontreId", r.attaque_le as le, r.numero, r.bete_de_naissance_id as "beteDeNaissanceId", e.nom, e.attaque, e.vie
     from rencontre r join espece e on e.id = r.espece_id
     where r.expedition_id = $1 and r.attaque_le is not null`,
    [expeditionId],
  );
  if (attaques.length === 0) return [];
  const { rows: escorte } = await client.query<{ especeId: string; attaque: number; vie: number; nombre: number }>(
    `select s.espece_id as "especeId", e.attaque, e.vie, s.nombre from expedition_escorte s join espece e on e.id = s.espece_id
     where s.expedition_id = $1 order by s.espece_id`,
    [expeditionId],
  );
  const dansLOrdre = dansLOrdreDesCombats(attaques.map((a) => ({ ...a, expeditionId, numero: a.numero === null ? null : Number(a.numero) })));
  return combatsRejoues(
    escorte.map(({ especeId, nombre, ...espece }) => ({ especeId, nombre, force: forceDUneBete(espece) })),
    dansLOrdre.map(({ rencontreId, le, nom, ...espece }) => ({ rencontreId, le, nom, force: forceDUneBete(espece) })),
  );
}
