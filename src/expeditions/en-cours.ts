// Les Expéditions en cours d'un Territoire (US-0911), et leur détail (US-0918). Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { type Fiche, type FicheInconnue, ficheDUneCase } from "@/monde/fiche";
import { type HorairesDUneExpedition, type Phase, phaseDUneExpedition } from "./phase";

/** US-0918 : une Espèce de l'escorte d'une Expédition, et ses Bêtes parties. */
export type EspeceDeLEscorte = { id: string; nom: string; nombre: number };

/**
 * US-0911 : une Expédition en cours : sa destination, telle que le joueur la voit (US-0907), et sa phase. US-0918 : et son
 * détail : ses horaires, d'où se lisent en direct sa phase et son temps restant (src/expeditions/phase.ts), les prénoms
 * de ses explorateurs et son escorte (aucune Espèce : sans escorte).
 */
export type ExpeditionEnCours = HorairesDUneExpedition & {
  id: number;
  destination: Fiche | FicheInconnue;
  phase: Phase;
  explorateurs: string[];
  escorte: EspeceDeLEscorte[];
};

/**
 * US-0911 : les Expéditions en cours du Territoire, de la première partie à la dernière, à l'instant du jeu `instant` :
 * chacune avec sa destination, son Biome « inconnu » tant que la Case est sous le brouillard, et sa phase. Une
 * Expédition qui vient de partir est à l'aller. US-0918 : avec son détail, la même lecture pour la liste et pour la
 * carte (US-0913) : ses horaires, ses explorateurs, dans l'ordre de leur arrivée au Foyer, et son escorte, Espèce par
 * Espèce, de la plus commune à la plus rare puis par nom, comme l'écran d'Expédition les propose (US-0904). US-0916 : une
 * Expédition rentrée au Foyer n'est plus en cours ; d'ici là, son heure passée, elle est « de retour ». US-0920 : ses
 * horaires disent aussi son rappel, d'où se lisent son demi-tour et son retour avancé. US-0944 : son escorte, sans les
 * Bêtes perdues au combat.
 */
export async function expeditionsEnCours(base: Pool | PoolClient, territoireId: number, instant: Date): Promise<ExpeditionEnCours[]> {
  const { rows } = await base.query<HorairesDUneExpedition & { id: number; q: number; r: number; explorateurs: string[]; escorte: EspeceDeLEscorte[] }>(
    `select x.id, c.q, c.r, x.part_le as "partLe", x.trajet_minutes as "trajetMinutes", x.sejour_minutes as "sejourMinutes",
       x.rappelee_le as "rappeleeLe",
       array(select h.prenom from habitant h where h.expedition_id = x.id order by h.id) as explorateurs,
       coalesce((
         select json_agg(json_build_object('id', es.id, 'nom', es.nom, 'nombre', s.nombre - s.perdues) order by r.rang, es.nom)
         from expedition_escorte s join espece es on es.id = s.espece_id join rarete r on r.id = es.rarete_id
         where s.expedition_id = x.id and s.nombre > s.perdues
       ), '[]') as escorte
     from expedition x join case_du_monde c on c.id = x.case_id
     where x.territoire_id = $1 and x.rentree_le is null
     order by x.part_le, x.id`,
    [territoireId],
  );
  const expeditions: ExpeditionEnCours[] = [];
  for (const { id, q, r, explorateurs, escorte, ...horaires } of rows) {
    const destination = await ficheDUneCase(base, territoireId, { q, r });
    if (destination) expeditions.push({ id, destination, phase: phaseDUneExpedition(horaires, instant), ...horaires, explorateurs, escorte });
  }
  return expeditions;
}
