// L'Apprivoisement (US-0934) : une Bête sauvage qu'une Expédition voit sur sa Case (US-0932) et qu'elle a à portée la
// suit, sans combat, depuis l'instant où elle la voit : aucune Bête de l'escorte n'y est blessée ni tuée. Passé cet
// instant, la Bête a quitté sa Case : personne d'autre ne peut plus la rencontrer ; à cet instant même, toutes les
// Expéditions présentes la voient encore (US-0962). Elle suit la première Expédition qui la voit et l'a à portée, tous
// Territoires confondus ; US-0963 : quand plusieurs l'ont à portée dès ce même instant, une seule l'emporte, tirée au
// sort à chances proportionnelles à la force de chaque escorte. Le tirage ne dépend que de la Bête et de données fixées
// au départ (horaires, escorte, force) : il a lieu une fois pour toutes, le même quel que soit le Territoire rattrapé en
// premier. Les Rencontres (src/expeditions/rencontres.ts) l'appliquent. Côté serveur comme dans le navigateur.
import { hacher } from "@/monde/couronne";

/** US-0934 : la Rareté des Bêtes toujours à portée. */
export const COMMUNE = "commune";

/** US-0963 : le tirage propre au choix de l'Expédition que suit une Bête disputée, à part de ceux de ses apparitions. */
const TIRAGE_DE_LA_SUITE = 9;

/** US-0934 : une Bête sur sa Case, de son arrivée à son départ (exclu), avec la force de son Espèce (US-0905) et sa Rareté. */
export type BeteSurLaCase = { arrivee: Date; depart: Date; force: number; rareteId: string };

/**
 * US-0934 : une Expédition sur la Case de la Bête, de son arrivée à son départ (exclu), avec la force de son escorte
 * (US-0905), null sans escorte.
 */
export type ExpeditionSurLaCase = { id: number; arrivee: Date; depart: Date; escorte: number | null };

/**
 * US-0934 : une Bête est à portée d'une Expédition quand la force de son escorte, `escorte`, est au moins égale à la
 * sienne, celle de son Espèce ; une Bête commune l'est toujours. US-0935 : même d'une Expédition sans escorte (null),
 * dont la force est nulle ; une Bête plus rare n'est jamais à portée de celle-ci, même de force nulle, et reste sur sa Case.
 */
export function aPortee(escorte: number | null, bete: Pick<BeteSurLaCase, "force" | "rareteId">): boolean {
  if (bete.rareteId === COMMUNE) return true;
  return escorte !== null && escorte >= bete.force;
}

/**
 * US-0942 : la force qui manque à l'escorte `escorte` pour avoir la Bête `bete` à portée : l'écart entre la force de son
 * Espèce et celle de l'escorte, nulle sans escorte (null) ; aucune quand elle l'a à portée (aPortee).
 */
export function forceQuiManque(escorte: number | null, bete: Pick<BeteSurLaCase, "force" | "rareteId">): number {
  return aPortee(escorte, bete) ? 0 : bete.force - (escorte ?? 0);
}

/**
 * US-0932 : l'instant où l'Expédition `x` voit la Bête `bete` : dès qu'elles sont toutes deux sur la Case, à l'apparition
 * de la Bête ou à l'arrivée de l'Expédition, si aucune n'en est partie ; null si elles ne s'y croisent pas.
 */
export function vueLe(bete: Pick<BeteSurLaCase, "arrivee" | "depart">, x: Pick<ExpeditionSurLaCase, "arrivee" | "depart">): Date | null {
  const instant = Math.max(bete.arrivee.getTime(), x.arrivee.getTime());
  return instant < Math.min(bete.depart.getTime(), x.depart.getTime()) ? new Date(instant) : null;
}

/**
 * US-0963 : une Bête sur sa Case telle que se tire au sort l'Expédition qu'elle suit : sa Case, et son numéro sur la Case
 * (une Bête sauvage ordinaire) ou sa ligne (une Bête de naissance), l'autre restant null.
 */
export type BeteDisputee = BeteSurLaCase & { caseId: number; numero: number | null; beteDeNaissanceId: number | null };

/**
 * US-0963 : le rang, parmi les escortes `escortes` (null : sans escorte), de celle que désigne le hasard `hasard`, de 0 à
 * 1 : chacune avec une chance proportionnelle à sa force ; sans escorte, ou faite d'Espèces sans arme, une Expédition n'a
 * aucune chance face à une escorte qui a de la force ; quand aucune n'en a, toutes ont la même chance.
 */
export function tirerAuSort(escortes: readonly (number | null)[], hasard: number): number {
  const forces = escortes.map((f) => f ?? 0);
  const total = forces.reduce((somme, f) => somme + f, 0);
  if (total === 0) return Math.min(Math.floor(hasard * escortes.length), escortes.length - 1);
  let cumul = 0;
  for (const [rang, force] of forces.entries()) {
    cumul += force;
    if (hasard * total < cumul) return rang;
  }
  // Une erreur d'arrondi au bout du cumul : la dernière qui a de la force.
  return forces.findLastIndex((f) => f > 0);
}

/**
 * US-0934 : l'Expédition que la Bête suit, parmi `expeditions`, celles de sa Case, et l'instant où elle la suit : la
 * première qui la voit et l'a à portée, à cet instant. US-0963 : quand plusieurs la voient et l'ont à portée dès ce même
 * instant, une seule l'emporte, tirée au sort à chances proportionnelles à la force de chaque escorte (tirerAuSort) ; une
 * Expédition pour qui la Bête est trop forte n'y participe pas (décidé le 2026-10-12). Le hasard du tirage vient de la Bête
 * seule (sa Case et son numéro, ou sa ligne de Bête de naissance), et les Expéditions s'y rangent par identifiant : le
 * même résultat à chaque calcul, dans quelque ordre qu'elles viennent. null : aucune, la Bête reste sur sa Case jusqu'à
 * son départ. US-0936 : une Bête à la fois : chaque Bête est jugée à part, à sa Rencontre, et un Apprivoisement n'amène
 * qu'elle ; l'Expédition suivie poursuit son séjour jusqu'à son terme, où d'autres Bêtes peuvent encore la suivre, une
 * par Rencontre (décidé le 2026-10-09). Ses Rencontres se lisent dans l'ordre des apparitions (rencontresDUneExpedition).
 */
export function lExpeditionSuivie(bete: BeteDisputee, expeditions: readonly ExpeditionSurLaCase[]): { expeditionId: number; le: Date } | null {
  const aPorteeLe = expeditions.flatMap((x) => {
    const le = vueLe(bete, x);
    return le && aPortee(x.escorte, bete) ? [{ x, le }] : [];
  });
  if (aPorteeLe.length === 0) return null;
  const le = new Date(Math.min(...aPorteeLe.map((v) => v.le.getTime())));
  const enLice = aPorteeLe
    .filter((v) => v.le.getTime() === le.getTime())
    .map((v) => v.x)
    .sort((x, y) => x.id - y.id);
  const hasard = hacher(bete.caseId, bete.numero ?? 0, bete.beteDeNaissanceId ?? 0, TIRAGE_DE_LA_SUITE);
  return { expeditionId: enLice[tirerAuSort(enLice.map((x) => x.escorte), hasard)].id, le };
}
