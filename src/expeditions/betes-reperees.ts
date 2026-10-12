// Les Bêtes repérées (US-0948) : une Bête trop forte pour l'escorte qui l'a vue reste sur sa Case (US-0942) ; au retour de
// cette Expédition, la carte du joueur porte un repère sur sa Case, avec son Espèce et jusqu'à quand elle devrait rester,
// pour qu'il n'oublie pas de revenir la chercher (US-0949). Seul le joueur dont une Expédition l'a vue la repère, et
// seulement une fois cette Expédition rentrée. Le repère s'en va avec la Bête : à la fin de sa durée (US-0926), ou dès
// qu'elle a suivi une autre Expédition (US-0934), sans qu'aucun récit le dise (décidé le 2026-10-09). Rien ne s'écrit :
// tout se relit des Rencontres retenues, des apparitions et des Expéditions présentes sur sa Case. Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { betesSauvagesDesCases } from "@/monde/betes-sauvages";
import type { Coordonnees } from "@/monde/hex";
import { PRESENCE_D_UNE_BETE_HEURES } from "@/reglages";
import { lExpeditionSuivie } from "./apprivoisement";
import { forceDUneBete } from "./force";
import { expeditionsPresentesSurLesCases } from "./presence";
import { forcesDesEscortes } from "./rencontres";

/**
 * US-0948 : une Bête repérée : sa première Rencontre avec le joueur (id), sa Case, son Espèce et son nom, la force d'une
 * Bête de cette Espèce (US-0905), et l'instant du jeu jusqu'auquel elle devrait rester sur sa Case (son départ, exclu) :
 * ce qu'il faudra pour revenir la chercher (US-0949).
 */
export type BeteReperee = { id: number; laCase: Coordonnees; especeId: string; espece: string; force: number; jusquA: Date };

/**
 * US-0948 : les Bêtes que les Expéditions du Territoire, rentrées à l'instant du jeu `instant`, ont vues sans qu'elles les
 * suivent, encore sur leur Case à cet instant, chacune une fois, dans l'ordre où le joueur les a vues : sur une Case
 * libre du Monde de son Foyer, sa présence se lit comme celle de toute Bête sauvage (betesSauvagesDesCases, avec les
 * Bêtes emmenées, bete_partie). Une Bête emmenée par l'Expédition d'un Territoire pas encore mis à l'heure n'a pas encore
 * laissé sa trace en base : comme les Rencontres (src/expeditions/rencontres.ts), l'Expédition qu'elle a suivie se
 * recalcule parmi toutes celles présentes sur sa Case depuis son apparition (lExpeditionSuivie), d'où le même repère quel
 * que soit l'ordre des rattrapages. Seules les Bêtes sauvages ordinaires : une Bête de naissance, commune, suit toujours
 * l'Expédition qui la voit (US-0935).
 */
export async function betesReperees(base: Pool | PoolClient, territoireId: number, instant: Date): Promise<BeteReperee[]> {
  const { rows } = await base.query<{
    id: number;
    caseId: number;
    q: number;
    r: number;
    numero: string;
    especeId: string;
    espece: string;
    rareteId: string;
    attaque: number;
    vie: number;
  }>(
    `select distinct on (x.case_id, r.numero) r.id, x.case_id as "caseId", c.q, c.r, r.numero, r.espece_id as "especeId",
       e.nom as espece, e.rarete_id as "rareteId", e.attaque, e.vie
     from rencontre r join expedition x on x.id = r.expedition_id join espece e on e.id = r.espece_id
       join case_du_monde c on c.id = x.case_id
       join territoire t on t.id = x.territoire_id join case_du_monde f on f.id = t.foyer_case_id
     where x.territoire_id = $1 and x.rentree_le <= $2 and not r.apprivoisee and r.numero is not null
       and r.apparue_le > $2 - make_interval(hours => $3) and c.monde_id = f.monde_id
     order by x.case_id, r.numero, r.id`,
    [territoireId, instant, PRESENCE_D_UNE_BETE_HEURES],
  );
  if (rows.length === 0) return [];
  const caseIds = [...new Set(rows.map((b) => b.caseId))];
  const juste = new Date(instant.getTime() + 1);
  // L'une après l'autre, comme les Rencontres : sur le client d'une transaction, deux requêtes ne partent pas à la fois.
  const presentes = await betesSauvagesDesCases(base, caseIds, instant, juste);
  const betes = rows.flatMap((b) => {
    const bete = presentes.get(b.caseId)!.find((p) => p.numero === Number(b.numero));
    return bete ? [{ ...b, arrivee: bete.arrivee, depart: bete.depart, force: forceDUneBete(b) }] : [];
  });
  if (betes.length === 0) return [];
  const depuis = new Date(Math.min(...betes.map((b) => b.arrivee.getTime())));
  const expeditions = await expeditionsPresentesSurLesCases(base, caseIds, depuis, juste);
  const escortes = await forcesDesEscortes(base, [...new Set([...expeditions.values()].flat().map((x) => x.id))]);
  return betes
    // Toutes les Expéditions lues sont arrivées au plus tard à cet instant : celle que la Bête suivrait l'a déjà emmenée.
    .filter((b) => {
      const rivales = expeditions.get(b.caseId)!.map((x) => ({ id: x.id, arrivee: x.arrivee, depart: x.depart, escorte: escortes.get(x.id) ?? null }));
      return lExpeditionSuivie(b, rivales) === null;
    })
    .sort((a, b) => a.id - b.id)
    .map((b) => ({ id: b.id, laCase: { q: b.q, r: b.r }, especeId: b.especeId, espece: b.espece, force: b.force, jusquA: b.depart }));
}
