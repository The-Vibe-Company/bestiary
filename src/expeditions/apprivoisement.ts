// L'Apprivoisement (US-0934) : une Bête sauvage qu'une Expédition voit sur sa Case (US-0932) et qu'elle a à portée la
// suit, sans combat, depuis l'instant où elle la voit : aucune Bête de l'escorte n'y est blessée ni tuée. Passé cet
// instant, la Bête a quitté sa Case : personne d'autre ne peut plus la rencontrer ; à cet instant même, toutes les
// Expéditions présentes la voient encore (US-0962). Elle suit la première Expédition qui la voit et l'a à portée, tous
// Territoires confondus, à égalité d'instant celle de plus petit identifiant (décidé le 2026-10-09) : des données toutes
// fixées au départ (horaires, escorte, force), d'où le même choix quel que soit le Territoire rattrapé en premier. US-0963
// partagera les Bêtes entre plusieurs Expéditions, à chances proportionnelles à leur force. Les Rencontres
// (src/expeditions/rencontres.ts) l'appliquent. Côté serveur comme dans le navigateur.

/** US-0934 : la Rareté des Bêtes toujours à portée. */
export const COMMUNE = "commune";

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
 * US-0934 : l'Expédition que la Bête suit, parmi `expeditions`, celles de sa Case, et l'instant où elle la suit : la
 * première qui la voit et l'a à portée, à cet instant ; à égalité, celle de plus petit identifiant. null : aucune, la Bête
 * reste sur sa Case jusqu'à son départ. US-0936 : une Bête à la fois : chaque Bête est jugée à part, à sa Rencontre, et un
 * Apprivoisement n'amène qu'elle ; l'Expédition suivie poursuit son séjour jusqu'à son terme, où d'autres Bêtes peuvent
 * encore la suivre, une par Rencontre (décidé le 2026-10-09). Ses Rencontres se lisent dans l'ordre des apparitions
 * (rencontresDUneExpedition).
 */
export function lExpeditionSuivie(bete: BeteSurLaCase, expeditions: readonly ExpeditionSurLaCase[]): { expeditionId: number; le: Date } | null {
  let suivie: { expeditionId: number; le: Date } | null = null;
  for (const x of expeditions) {
    const le = vueLe(bete, x);
    if (!le || !aPortee(x.escorte, bete)) continue;
    if (!suivie || le < suivie.le || (le.getTime() === suivie.le.getTime() && x.id < suivie.expeditionId)) suivie = { expeditionId: x.id, le };
  }
  return suivie;
}
