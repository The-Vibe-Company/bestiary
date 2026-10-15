// Le brouillard levé sur le chemin des Expéditions (US-0914) : là où passe une Expédition, le brouillard se lève pour son
// Territoire, Case après Case, à l'heure de son passage (passagesDUneExpedition, src/expeditions/position.ts), puis autour
// de sa destination à son arrivée. Il se lève par decouvrir (src/monde/brouillard.ts, US-0442), la seule écriture du
// brouillard : levé, il le reste pour toujours, et pour ce Territoire seulement. US-0969 : les Éclaireurs de l'Expédition
// (US-0976) l'agrandissent. Côté serveur et scripts uniquement.
import type { Pool, PoolClient } from "pg";
import { decouvrir } from "@/monde/brouillard";
import { casesDansLeRayon, type Coordonnees } from "@/monde/hex";
import {
  BROUILLARD_LEVE_AUTOUR_DE_LA_DESTINATION_CASES,
  BROUILLARD_LEVE_PAR_ECLAIREUR_CASES,
  BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES,
  BROUILLARD_LEVE_SUR_LE_CHEMIN_CASES,
} from "@/reglages";
import type { HorairesDUneExpedition } from "./phase";
import { passagesDUneExpedition } from "./position";

/** US-0914 : une Case qu'une Expédition a sortie du brouillard, et l'instant du jeu où elle l'a fait : son premier passage d'où elle la voit. */
export type CaseRevelee = Coordonnees & { le: Date };

/**
 * US-0969 : de combien de Cases les `eclaireurs` Éclaireurs d'une Expédition (US-0976, toutes Espèces ensemble) agrandissent
 * le rayon du brouillard qu'elle lève, sur son chemin comme autour de sa destination : BROUILLARD_LEVE_PAR_ECLAIREUR_CASES
 * par Éclaireur, jusqu'à BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES. Aucune sans Éclaireur.
 */
export function rayonDesEclaireurs(eclaireurs: number): number {
  return Math.min(Math.max(0, eclaireurs) * BROUILLARD_LEVE_PAR_ECLAIREUR_CASES, BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES);
}

/**
 * US-0914 : les Cases qu'une Expédition partie du `foyer` vers la `destination` a sorties du brouillard à l'instant du jeu
 * `instant`, chacune une fois, avec l'instant où elle l'a fait : chaque Case de son chemin déjà atteinte et ses voisines
 * à BROUILLARD_LEVE_SUR_LE_CHEMIN_CASES Cases ; la destination, une fois atteinte (à l'arrivée), et ses voisines à
 * BROUILLARD_LEVE_AUTOUR_DE_LA_DESTINATION_CASES Cases, Biome compris comme toute Case découverte. Rien au départ, ni tant
 * que son trajet n'est pas chiffré ; rien de neuf pendant le séjour ni au retour, qui repasse par le même chemin. US-0920 :
 * rappelée, rien de neuf après son rappel, ses passages s'arrêtant au demi-tour ; ce qu'elle a révélé le reste. Ne
 * dépend que de ses horaires et de l'instant : les mêmes Cases en direct qu'au rattrapage d'une absence. Certaines
 * peuvent manquer au Monde, au bord : decouvrir les passe. US-0969 : avec `eclaireurs` Éclaireurs, chaque rayon s'agrandit
 * de rayonDesEclaireurs Cases, au même passage.
 */
export function casesRevelees(foyer: Coordonnees, destination: Coordonnees, horaires: HorairesDUneExpedition, instant: Date, eclaireurs = 0): CaseRevelee[] {
  const enPlus = rayonDesEclaireurs(eclaireurs);
  const revelees = new Map<string, CaseRevelee>();
  for (const { case: laCase, le } of passagesDUneExpedition(foyer, destination, horaires)) {
    if (le.getTime() > instant.getTime()) break;
    const surLaDestination = laCase.q === destination.q && laCase.r === destination.r;
    const rayon = (surLaDestination ? BROUILLARD_LEVE_AUTOUR_DE_LA_DESTINATION_CASES : BROUILLARD_LEVE_SUR_LE_CHEMIN_CASES) + enPlus;
    for (const c of casesDansLeRayon(laCase, rayon)) if (!revelees.has(`${c.q},${c.r}`)) revelees.set(`${c.q},${c.r}`, { ...c, le });
  }
  return [...revelees.values()];
}

/**
 * US-0914 : lève le brouillard du Territoire là où ses Expéditions sont passées de l'instant du jeu `depuis` (exclu) à
 * `jusqua` (compris) : l'évolution continue du Territoire (src/temps/regles.ts), en direct comme au rattrapage d'une
 * absence ou par la tâche planifiée. Chaque Expédition passée sur une Case de son chemin pendant la période y découvre
 * toutes les Cases qu'elle a révélées à `jusqua` (casesRevelees) ; les autres, rien : une seule écriture par passage.
 * Découvrir une Case déjà découverte ne change rien (US-0441) : le brouillard levé ne dépend que des horaires et de
 * l'instant, jamais du découpage du temps. Une Case nouvelle revient à l'Expédition qui l'a révélée la première (la
 * première partie, à égalité), pour le Récit de son retour (casesLeveesParLExpedition). Une Expédition déjà en route
 * quand le brouillard a commencé à se lever sur les chemins lève ainsi tout son chemin à son passage suivant ; une déjà
 * arrivée garde le sien. Le chemin part du Foyer du Territoire, comme sur la carte (US-0913) ; une destination hors du
 * Monde de son Foyer (après la bascule d'un Monde) ne lève rien. US-0969 : chacune avec ses Éclaireurs (expedition_eclaireur),
 * qui agrandissent ce qu'elle lève.
 */
export async function leverLeBrouillard(client: PoolClient, territoireId: number, depuis: Date, jusqua: Date): Promise<void> {
  // Une Expédition qui passe sur une Case pendant la période est à l'aller : partie avant sa fin, arrivée après son début.
  const { rows } = await client.query<HorairesDUneExpedition & { id: number; foyer: Coordonnees; destination: Coordonnees; eclaireurs: number }>(
    `select x.id, json_build_object('q', f.q, 'r', f.r) as foyer, json_build_object('q', c.q, 'r', c.r) as destination,
       (select coalesce(sum(e.nombre), 0)::int from expedition_eclaireur e where e.expedition_id = x.id) as eclaireurs,
       x.part_le as "partLe", x.trajet_minutes as "trajetMinutes", x.sejour_minutes as "sejourMinutes", x.rappelee_le as "rappeleeLe"
     from expedition x join territoire t on t.id = x.territoire_id join case_du_monde f on f.id = t.foyer_case_id
       join case_du_monde c on c.id = x.case_id and c.monde_id = f.monde_id
     where x.territoire_id = $1 and x.part_le < $3 and x.part_le + make_interval(mins => x.trajet_minutes) > $2
     order by x.part_le, x.id`,
    [territoireId, depuis, jusqua],
  );
  // Chaque Case révélée, à la première Expédition qui l'a révélée.
  const premieres = new Map<string, { expeditionId: number; laCase: Coordonnees; le: number }>();
  for (const { id, foyer, destination, eclaireurs, ...horaires } of rows) {
    const passages = passagesDUneExpedition(foyer, destination, horaires);
    if (!passages.some(({ le }) => le.getTime() > depuis.getTime() && le.getTime() <= jusqua.getTime())) continue;
    for (const { le, ...laCase } of casesRevelees(foyer, destination, horaires, jusqua, eclaireurs)) {
      const avant = premieres.get(`${laCase.q},${laCase.r}`);
      if (!avant || le.getTime() < avant.le) premieres.set(`${laCase.q},${laCase.r}`, { expeditionId: id, laCase, le: le.getTime() });
    }
  }
  const parExpedition = Map.groupBy(premieres.values(), ({ expeditionId }) => expeditionId);
  for (const [expeditionId, cases] of parExpedition) {
    await decouvrir(client, territoireId, cases.map(({ laCase }) => laCase), expeditionId);
  }
}

/**
 * US-0914, pour le Récit du retour (US-0917) : le nombre de Cases que l'Expédition `expeditionId` a sorties du brouillard
 * de son Territoire, jusqu'où le temps du Territoire est calculé (au retour, tout son aller) : celles qu'elle a
 * découvertes la première, sans celles qui l'étaient déjà (les abords du Foyer, le chemin d'une Expédition passée avant
 * elle) ni celles qui manquent au Monde. 0 pour une Expédition inconnue.
 */
export async function casesLeveesParLExpedition(base: Pool | PoolClient, expeditionId: number): Promise<number> {
  const { rows } = await base.query<{ nombre: number }>(
    `select count(d.case_id)::int as nombre from expedition x join case_decouverte d on d.territoire_id = x.territoire_id and d.expedition_id = x.id
     where x.id = $1`,
    [expeditionId],
  );
  return rows[0].nombre;
}
