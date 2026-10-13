// Les fuites d'une Case (US-0945) : une Expédition attaquée par une Bête trop forte (US-0943) fuit à l'instant de sa
// première attaque, et quitte la Case pour tous : les Expéditions des autres Territoires ne l'y trouvent plus, même
// avant que son propre Territoire ne soit rattrapé. Chaque Territoire calcule donc les fuites de toute la Case, de la même
// façon et des mêmes faits (lus en base par src/expeditions/fuites-des-cases.ts) : les Bêtes, les horaires et les escortes
// fixés au départ, les tirages, les fuites déjà écrites, et l'instant jusqu'où chaque Territoire est calculé (avant lui,
// une fuite de ses Expéditions serait écrite, comme src/expeditions/fuite.ts l'écrit) ; d'où les mêmes fuites, quel que
// soit l'ordre des rattrapages.
//
// Les tirages d'une attaque ne dépendent que de la Bête, de l'Expédition et de l'heure comptée depuis leur Rencontre
// (instantDeLAttaque) : l'instant qu'ils promettent est fixé d'avance, et l'attaque n'a lieu que si elles sont encore
// ensemble à cet instant, la Bête ni partie ni en train de suivre une autre Expédition (US-0934), l'Expédition pas
// encore en fuite. Les attaques promises se tiennent ou non dans l'ordre du temps : une fuite ne change la présence de
// son Expédition qu'à partir de son instant, donc rien de ce qui la précède. Côté serveur comme dans le navigateur.
import type { HasardsDeLAttaque } from "@/monde/betes-sauvages";
import { type BeteDisputee, type ExpeditionSurLaCase, lExpeditionSuivie, vueLe } from "./apprivoisement";
import { instantDeLAttaque } from "./attaque";

/**
 * US-0945 : une Expédition présente sur la Case, de son arrivée à son départ (exclu), rappel du joueur et fuite déjà
 * écrite compris, avec la force de son escorte : son Territoire, si sa fuite est déjà écrite (enFuite), et l'instant
 * jusqu'où ses attaques sont connues (connuesJusqua) : avant lui, aucune ne l'a fait fuir sans être écrite.
 */
export type ExpeditionDeLaCase = ExpeditionSurLaCase & { territoireId: number; enFuite: boolean; connuesJusqua: Date };

/**
 * US-0945 : une Bête de la Case, telle qu'elle peut attaquer : son Espèce, la chance d'attaque de son régime par heure
 * (chanceDAttaqueParHeure) et ses tirages pour chaque Expédition ; le Territoire d'une Bête de naissance (US-0975), à
 * qui seul elle se montre, null pour une Bête sauvage ordinaire, que tous voient.
 */
export type BeteDeLaCase = BeteDisputee & {
  especeId: string;
  territoireId: number | null;
  chance: number;
  hasards: (expeditionId: number, heure: number) => HasardsDeLAttaque;
};

/** US-0945 : l'attaque qui met une Expédition en fuite : l'Expédition, la Bête et l'instant (`le`). */
export type AttaqueDeLaCase = { expeditionId: number; caseId: number; numero: number | null; beteDeNaissanceId: number | null; especeId: string; le: Date };

/**
 * US-0945 : les fuites des Expéditions `expeditions` d'une Case, de tous les Territoires, et les attaques qui les causent
 * (plusieurs Bêtes peuvent attaquer la même au même instant : une seule fuite). Une Expédition fuit à sa première
 * attaque tenue : celle d'une Bête qu'elle voit sans la suivre, trop forte pour elle, encore sur la Case à l'instant que
 * promettent leurs tirages, et qui n'a suivi aucune autre Expédition avant cet instant ; celles d'une Expédition déjà en
 * fuite, ou tombées avant l'instant jusqu'où ses attaques sont connues, ne comptent pas. Seulement avant `jusqua` : les
 * Bêtes et les Expéditions qui comptent après n'y sont pas forcément.
 */
export function fuitesDeLaCase(
  expeditions: readonly ExpeditionDeLaCase[],
  betes: readonly BeteDeLaCase[],
  jusqua: Date,
): { fuites: Map<number, Date>; attaques: AttaqueDeLaCase[] } {
  const visibles = (b: BeteDeLaCase) => expeditions.filter((x) => b.territoireId === null || x.territoireId === b.territoireId);
  // Les attaques promises par les tirages, tant que la Bête et l'Expédition sont toutes deux sur la Case.
  const promises: { x: ExpeditionDeLaCase; b: BeteDeLaCase; rang: number; le: Date }[] = [];
  for (const [rang, b] of betes.entries()) {
    for (const x of visibles(b)) {
      const vue = x.enFuite ? null : vueLe(b, x);
      if (!vue) continue;
      const fin = new Date(Math.min(b.depart.getTime(), x.depart.getTime()));
      const le = instantDeLAttaque({ debut: vue, fin }, b.chance, (heure) => b.hasards(x.id, heure));
      if (le && le >= x.connuesJusqua && le < jusqua) promises.push({ x, b, rang, le });
    }
  }
  promises.sort((p, q) => p.le.getTime() - q.le.getTime() || p.x.id - q.x.id || p.rang - q.rang);

  const fuites = new Map<number, Date>();
  const attaques: AttaqueDeLaCase[] = [];
  // Instant après instant : la présence de chacune, jusqu'aux fuites tenues avant cet instant.
  const presentes = (b: BeteDeLaCase) =>
    visibles(b).map((y) => {
      const fuite = fuites.get(y.id);
      return { ...y, depart: fuite && fuite < y.depart ? fuite : y.depart };
    });
  for (let i = 0; i < promises.length; ) {
    const { le } = promises[i];
    let j = i;
    while (j < promises.length && promises[j].le.getTime() === le.getTime()) j++;
    const tenues = promises.slice(i, j).filter(({ x, b }) => {
      if (fuites.has(x.id)) return false;
      // La Bête a suivi une Expédition avant l'attaque, ou suit celle-ci : elle n'attaque pas.
      const suivie = lExpeditionSuivie(b, presentes(b));
      return !suivie || (suivie.expeditionId !== x.id && le.getTime() < suivie.le.getTime());
    });
    for (const { x, b } of tenues) {
      attaques.push({ expeditionId: x.id, caseId: b.caseId, numero: b.numero, beteDeNaissanceId: b.beteDeNaissanceId, especeId: b.especeId, le });
    }
    for (const { x } of tenues) fuites.set(x.id, le);
    i = j;
  }
  return { fuites, attaques };
}
