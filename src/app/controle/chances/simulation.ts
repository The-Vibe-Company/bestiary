// US-0968 : la simulation des chances : un grand nombre de Rencontres disputées entre des Expéditions de forces données,
// jugées par le vrai tirage du jeu (lExpeditionSuivie, US-0963), pour vérifier que chacune l'emporte à proportion de la
// force de son escorte. Un calcul pur, par les fonctions mêmes du jeu : rien n'est lu ni écrit en base.
import { type BeteDisputee, COMMUNE, type ExpeditionSurLaCase, lExpeditionSuivie } from "@/expeditions/apprivoisement";
import { SIMULATION_DES_CHANCES_RENCONTRES, SIMULATION_DES_CHANCES_TOLERANCE_POINTS } from "@/reglages";

/** L'instant des Rencontres simulées : le tirage n'en dépend pas, seulement de la Bête (sa Case et son numéro). */
const INSTANT = new Date(0);
const HEURE_MS = 3_600_000;

/** Une escorte simulée : sa force, ses victoires, et sa part des victoires, obtenue et attendue, en pourcentages. */
export type PartDUneEscorte = { force: number; victoires: number; obtenue: number; attendue: number; horsTolerance: boolean };

export type SimulationDesChances = { forces: number[]; rencontres: number; tolerance: number; parts: PartDUneEscorte[]; reussie: boolean };

/**
 * US-0968 : la Rencontre disputée numéro `i` : une Bête commune, à portée de toutes, différente à chaque Rencontre (une
 * autre Case ou un autre numéro, d'où son propre tirage), et les Expéditions d'escortes de forces `forces`, arrivées sur sa
 * Case à l'instant même de son apparition, numérotées dans cet ordre.
 */
export function rencontreSimulee(i: number, forces: readonly number[]): { bete: BeteDisputee; expeditions: ExpeditionSurLaCase[] } {
  const sur = { arrivee: INSTANT, depart: new Date(INSTANT.getTime() + HEURE_MS) };
  return {
    bete: { ...sur, force: 0, rareteId: COMMUNE, caseId: 1 + (i % 1000), numero: Math.floor(i / 1000), beteDeNaissanceId: null },
    expeditions: forces.map((escorte, k) => ({ id: k + 1, ...sur, escorte })),
  };
}

/**
 * US-0968 : `rencontres` Rencontres disputées entre des Expéditions d'escortes de forces `forces`, jugées chacune par le
 * tirage du jeu (lExpeditionSuivie) : les victoires de chaque escorte, et leur part à côté de la part attendue, la force de
 * l'escorte rapportée à celle de toutes ; sans escorte, aucune chance face à une escortée, et chances égales quand aucune
 * n'en a (US-0963). Le contrôle échoue si une part obtenue s'écarte de plus de `tolerance` points de sa part attendue. Les
 * mêmes Bêtes à chaque fois : un même jeu de forces donne toujours le même résultat.
 */
export function simulerLesChances({
  forces,
  rencontres = SIMULATION_DES_CHANCES_RENCONTRES,
  tolerance = SIMULATION_DES_CHANCES_TOLERANCE_POINTS,
}: {
  forces: number[];
  rencontres?: number;
  tolerance?: number;
}): SimulationDesChances {
  const victoires = forces.map(() => 0);
  for (let i = 0; i < rencontres; i++) {
    const { bete, expeditions } = rencontreSimulee(i, forces);
    victoires[lExpeditionSuivie(bete, expeditions)!.expeditionId - 1]++;
  }
  const total = forces.reduce((n, f) => n + f, 0);
  const parts = forces.map((force, k) => {
    const attendue = total === 0 ? 100 / forces.length : (100 * force) / total;
    const obtenue = (100 * victoires[k]) / rencontres;
    return { force, victoires: victoires[k], obtenue, attendue, horsTolerance: Math.abs(obtenue - attendue) > tolerance };
  });
  return { forces, rencontres, tolerance, parts, reussie: parts.every((p) => !p.horsTolerance) };
}

/**
 * US-0968 : les forces des escortes saisies, « 1, 3 » ou « 2 5 9 » : de 2 à 8 nombres entiers positifs ou nuls, d'au plus
 * neuf chiffres ; sinon une erreur qui le dit.
 */
export function lireDesForces(texte: string): number[] {
  const morceaux = texte.trim().split(/[\s,;]+/).filter(Boolean);
  if (morceaux.length < 2 || morceaux.length > 8 || !morceaux.every((m) => /^\d{1,9}$/.test(m))) {
    throw new Error(`De 2 à 8 forces, des nombres entiers positifs ou nuls séparés par des virgules, pas « ${texte.trim()} ».`);
  }
  return morceaux.map(Number);
}
