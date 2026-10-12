// L'attaque de la Bête trop forte (US-0943) : une Bête que l'Expédition voit sans l'avoir à portée (US-0942) reste sur sa
// Case et, tant que toutes deux y sont, peut s'en prendre à l'Expédition : une chance par heure passée ensemble
// (CHANCE_D_ATTAQUE_PAR_HEURE), selon son régime (décidé le 2026-10-09). Chaque heure, comptée depuis leur Rencontre, a
// ses tirages, fonction de la graine du Monde, de la Bête, de l'Expédition et de l'heure (src/monde/betes-sauvages.ts) :
// la même attaque, au même instant, en direct, au rattrapage ou par la tâche planifiée. Chaque Bête attaque au plus une
// fois chaque Expédition qu'elle voit ; plusieurs Bêtes trop fortes peuvent attaquer la même, chacune à son tour, jusqu'à
// ce que la fuite (US-0945) mette fin au séjour à la première. Celle qui n'attaque pas laisse l'Expédition finir son séjour
// normalement. Les Rencontres l'appliquent et la retiennent à son instant (src/expeditions/rencontres.ts), pour le combat
// (US-0944). Côté serveur comme dans le navigateur.
import type { regime } from "@/db/schema";
import type { HasardsDeLAttaque } from "@/monde/betes-sauvages";
import { CHANCE_D_ATTAQUE_PAR_HEURE } from "@/reglages";

const HEURE_MS = 3_600_000;

/** Le régime d'une Espèce (donnees/especes.yaml), celui de la base : un régime ajouté là sans sa chance ici ne compile pas. */
export type Regime = (typeof regime.enumValues)[number];

/** US-0943 : ce que le régime fait de la chance d'attaque : un carnivore est plus agressif, un herbivore moins (décidé le 2026-10-09). */
const SELON_LE_REGIME: Record<Regime, number> = { carnivore: 2, omnivore: 1, herbivore: 0.5 };

/**
 * US-0943 : la chance qu'a une Bête trop forte du régime `regime` d'attaquer l'Expédition pendant une heure passée
 * ensemble : CHANCE_D_ATTAQUE_PAR_HEURE, doublée pour un carnivore, divisée par deux pour un herbivore, telle quelle pour
 * un omnivore.
 */
export function chanceDAttaqueParHeure(regime: Regime): number {
  return CHANCE_D_ATTAQUE_PAR_HEURE * SELON_LE_REGIME[regime];
}

/**
 * US-0943 : l'instant où une Bête trop forte attaque l'Expédition, ensemble sur la Case de `debut`, leur Rencontre, à
 * `fin` (exclue), quand l'une ou l'autre s'en va. Heure après heure, comptées depuis `debut` (0 pour la première), ses
 * tirages (`hasards`) disent si elle attaque pendant cette heure, quand `attaque` tombe sous `chance`, et à quel moment :
 * une heure entamée ne compte que tant qu'elles sont ensemble, et un moment tiré après leur séparation n'amène aucune
 * attaque. Seule la première compte : null si elle n'attaque pas.
 */
export function instantDeLAttaque({ debut, fin }: { debut: Date; fin: Date }, chance: number, hasards: (heure: number) => HasardsDeLAttaque): Date | null {
  for (let heure = 0, depuis = debut.getTime(); depuis < fin.getTime(); heure++, depuis += HEURE_MS) {
    const { attaque, moment } = hasards(heure);
    if (attaque >= chance) continue;
    const instant = depuis + Math.floor(moment * HEURE_MS);
    return instant < fin.getTime() ? new Date(instant) : null;
  }
  return null;
}
