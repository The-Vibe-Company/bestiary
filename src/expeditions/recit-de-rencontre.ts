// Le récit de Rencontre (US-0940) : le Récit du retour d'une Expédition (src/expeditions/recit-de-retour.ts) retient, sous
// son texte, chaque Bête qu'elle a vue sur sa Case (US-0932), à l'heure où elle l'a vue, et ce qu'il en advint :
// apprivoisée, avec son sexe (US-0934, US-0937) ; trop forte pour son escorte, restée sur sa Case, avec la force qui lui
// manquait (US-0942) ; ou repartie à la fin de sa durée (US-0926), avant que l'Expédition ne quitte la Case, à l'heure
// de son départ (US-0950). Une Bête vue qui n'a pas suivi l'Expédition était trop forte pour son escorte : à portée, elle
// aurait suivi la première Expédition qui la voyait (lExpeditionSuivie) ; ou bien elle en suivait une autre, à l'instant
// même où elle l'a vue (US-0962), et en est partie. US-0964 : partie avec une autre Expédition, elle a été emmenée : le
// récit le dit, sans nommer le chef qui l'a emportée. La page Récits les montre avec l'illustration et la Rareté de leur
// Espèce. Côté serveur uniquement.
import "server-only";
import type { PoolClient } from "pg";
import type { Sexe } from "@/monde/betes-sauvages";
import type { Coordonnees } from "@/monde/hex";
import type { IssueDUneRencontre, RencontreRacontee } from "@/monde/recits";
import { PRESENCE_D_UNE_BETE_HEURES } from "@/reglages";
import { type BeteDisputee, type ExpeditionSurLaCase, forceQuiManque, lExpeditionSuivie } from "./apprivoisement";
import { expeditionsPresentesApresLesFuites } from "./fuites-des-cases";
import { forcesDesEscortes, forcesDesEspeces, type Rencontre } from "./rencontres";

/** US-0926 : combien de temps une Bête sauvage reste sur sa Case, en millisecondes du jeu. */
const PRESENCE_MS = PRESENCE_D_UNE_BETE_HEURES * 3_600_000;

/**
 * US-0940 : ce qu'il advint de la Bête d'une Rencontre : apprivoisée, elle a suivi l'Expédition ; sinon, trop forte pour son
 * escorte, elle est repartie si elle a quitté sa Case (`depart`) avant la fin du séjour de l'Expédition (`finDuSejour`),
 * et restée sur sa Case si elle y était encore jusqu'au bout. Sans départ connu (null), elle est restée. US-0964 : partie
 * en suivant une autre Expédition (`emmenee`), elle a été emmenée.
 */
export function issueDUneRencontre(apprivoisee: boolean, depart: Date | null, finDuSejour: Date, emmenee = false): IssueDUneRencontre {
  if (apprivoisee) return "apprivoisee";
  if (depart === null || depart >= finDuSejour) return "restee";
  return emmenee ? "emmenee" : "repartie";
}

/**
 * US-0940 : l'instant où la Bête `bete`, vue sans qu'elle suive, quitte sa Case : à la fin de sa durée, ou plus tôt si elle
 * suit une autre Expédition de sa Case (`expeditions`, de tous les Territoires), la première qui l'a à portée
 * (lExpeditionSuivie). La règle même des Rencontres, sur des horaires et des escortes fixés au départ : le même instant
 * quel que soit le Territoire rattrapé en premier, que celui de l'autre Expédition ait déjà retenu son départ ou non.
 * US-0964 : `emmenee`, elle est partie en suivant une autre Expédition, et non à la fin de sa durée.
 */
export function departDUneBete(bete: BeteDisputee, expeditions: readonly ExpeditionSurLaCase[]): { le: Date; emmenee: boolean } {
  const suivie = lExpeditionSuivie(bete, expeditions);
  return suivie && suivie.le < bete.depart ? { le: suivie.le, emmenee: true } : { le: bete.depart, emmenee: false };
}

/**
 * US-0940 : les Rencontres `vues` de l'Expédition `expeditionId` (rencontresDUneExpedition), telles que son Récit les
 * retient, dans le même ordre, celui des apparitions : son séjour sur sa Case, `sejour`, dit si chaque Bête qui ne l'a pas
 * suivie en est repartie avant elle, et (US-0950) à quel instant ; restée, la force qui manquait à son escorte
 * (forceQuiManque). Aucune sans séjour.
 * Appelée au retour, dans sa transaction : le Territoire est calculé jusque-là, ses Rencontres sont toutes retenues.
 * US-0949 : une Bête sauvage restée, sa Case (`laCase`, celle de l'Expédition) et son numéro sur sa Case, pour que le
 * récit mène à elle tant qu'elle y est.
 */
export async function rencontresARaconter(
  client: PoolClient,
  expeditionId: number,
  vues: readonly Rencontre[],
  sejour: { debut: Date; fin: Date } | null,
  laCase: Coordonnees,
): Promise<RencontreRacontee[]> {
  if (vues.length === 0 || !sejour) return [];
  // L'une après l'autre : sur le client d'une transaction, deux requêtes ne partent pas à la fois.
  const sexes = await sexesDesApprivoisees(client, expeditionId);
  const restees = await betesRestees(client, expeditionId, vues);
  return vues.map((r) => {
    const restee = restees.get(r.id);
    const issue = issueDUneRencontre(r.apprivoisee, restee?.depart ?? null, sejour.fin, restee?.emmenee);
    return {
      especeId: r.especeId,
      vueLe: r.vueLe,
      issue,
      ...((issue === "repartie" || issue === "emmenee") && restee ? { repartieLe: restee.depart } : {}),
      sexe: sexes.get(r.id) ?? null,
      nouvelleEspece: r.nouvelleEspece,
      ...(issue === "restee" && restee?.manque ? { manque: restee.manque } : {}),
      ...(issue === "restee" && r.numero !== null ? { laCase, numero: r.numero } : {}),
    };
  });
}

/**
 * US-0940 : une Bête vue qui n'a pas suivi l'Expédition : l'instant où elle a quitté sa Case, la force qui manquait à
 * l'escorte (US-0942), et (US-0964) si elle est partie en suivant une autre Expédition.
 */
type BeteRestee = { depart: Date; manque: number; emmenee: boolean };

/** US-0937 : le sexe de chaque Bête apprivoisée lors d'une Rencontre de l'Expédition `expeditionId`, par Rencontre. */
async function sexesDesApprivoisees(client: PoolClient, expeditionId: number): Promise<Map<number, Sexe>> {
  const { rows } = await client.query<{ id: number; sexe: Sexe }>("select id, sexe from rencontre where expedition_id = $1 and apprivoisee", [expeditionId]);
  return new Map(rows.map((r) => [r.id, r.sexe]));
}

/**
 * US-0940 : pour chaque Bête sauvage des Rencontres `vues` qui n'a pas suivi l'Expédition `expeditionId`, par Rencontre :
 * l'instant où elle a quitté sa Case (departDUneBete), parmi les Expéditions de sa Case pendant toute sa présence, et la
 * force qui manquait à l'escorte (US-0942). US-0962 : une Bête de naissance, commune, suit toujours la première
 * Expédition qui la voit (US-0975) : vue sans la suivre, elle en suivait une autre au même instant, et en est partie
 * aussitôt. US-0964 : et si elle est partie en suivant une autre Expédition (`emmenee`). US-0945 : une Expédition en fuite
 * n'est plus sur la Case après sa fuite, même d'un Territoire pas encore rattrapé. Aucune lecture si toutes ont suivi.
 */
async function betesRestees(client: PoolClient, expeditionId: number, vues: readonly Rencontre[]): Promise<Map<number, BeteRestee>> {
  const parties = new Map(vues.filter((r) => !r.apprivoisee && r.numero === null).map((r) => [r.id, { depart: r.vueLe, manque: 0, emmenee: true }]));
  const restees = vues
    .filter((r) => !r.apprivoisee && r.numero !== null)
    .map((r) => ({ ...r, finDePresence: new Date(r.apparueLe.getTime() + PRESENCE_MS) }));
  if (restees.length === 0) return parties;
  const caseId = restees[0].caseId;
  const depuis = new Date(Math.min(...restees.map((r) => r.apparueLe.getTime())));
  const jusqua = new Date(Math.max(...restees.map((r) => r.finDePresence.getTime())));
  const presentes = (await expeditionsPresentesApresLesFuites(client, [caseId], depuis, jusqua)).get(caseId)!;
  const escortes = await forcesDesEscortes(client, [...new Set([expeditionId, ...presentes.map((x) => x.id)])]);
  const forces = await forcesDesEspeces(client, [...new Set(restees.map((r) => r.especeId))]);
  const expeditions = presentes.map((x) => ({ id: x.id, arrivee: x.arrivee, depart: x.depart, escorte: escortes.get(x.id) ?? null }));
  return new Map([
    ...parties,
    ...restees.map((r): [number, BeteRestee] => {
      const bete = { ...r, arrivee: r.apparueLe, depart: r.finDePresence, force: forces.get(r.especeId)! };
      const { le, emmenee } = departDUneBete(bete, expeditions);
      return [r.id, { depart: le, manque: forceQuiManque(escortes.get(expeditionId) ?? null, bete), emmenee }];
    }),
  ]);
}
