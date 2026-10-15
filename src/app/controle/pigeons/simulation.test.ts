import { describe, expect, it } from "vitest";
import { vueProlongee } from "@/expeditions/vue-des-eclaireurs";
import { sejourDUneExpedition } from "@/expeditions/phase";
import {
  MINUTES_DE_VUE_PAR_ECLAIREUR,
  PRESENCE_D_UNE_BETE_HEURES,
  SIMULATION_DES_PIGEONS_ECART_MINIMAL_POURCENT,
  SIMULATION_DES_PIGEONS_EXPEDITIONS,
} from "@/reglages";
import { ECLAIREURS_SIMULES, expeditionSimulee, rencontresVues, simulerLesPigeons } from "./simulation";

const MINUTE_MS = 60_000;
const HEURE_MS = 60 * MINUTE_MS;

describe("la simulation des pigeons éclaireurs (US-0974)", () => {
  it("simule des Expéditions identiques, avec ou sans pigeons : la même destination, les mêmes horaires", () => {
    const a = expeditionSimulee(17);
    expect(expeditionSimulee(17)).toEqual(a);
    expect(a.horaires.sejourMinutes).toBe(4 * 60);
    expect(a.horaires.trajetMinutes).toBeGreaterThan(0);
    // D'une Expédition à la suivante, une autre Case, un autre moment : la période est longue.
    const b = expeditionSimulee(18);
    expect(b.destination).not.toEqual(a.destination);
    expect(b.horaires.partLe.getTime()).toBeGreaterThan(a.horaires.partLe.getTime());
  });

  it("compte les Rencontres comme le jeu : chaque Bête que l'Expédition voit pendant son séjour (vueLe), ses Éclaireurs la gardant en vue plus longtemps", () => {
    const { horaires } = expeditionSimulee(0);
    const sejour = sejourDUneExpedition(horaires)!;
    const presente = (arrivee: number) => ({ arrivee: new Date(arrivee), depart: new Date(arrivee + PRESENCE_D_UNE_BETE_HEURES * HEURE_MS) });
    const debut = sejour.debut.getTime();
    const betes = [
      presente(debut - PRESENCE_D_UNE_BETE_HEURES * HEURE_MS + 30 * MINUTE_MS), // encore là à l'arrivée
      presente(debut - PRESENCE_D_UNE_BETE_HEURES * HEURE_MS - 10 * MINUTE_MS), // partie 10 min avant l'arrivée
      presente(debut - PRESENCE_D_UNE_BETE_HEURES * HEURE_MS - 50 * MINUTE_MS), // partie 50 min avant l'arrivée
      presente(sejour.fin.getTime() + MINUTE_MS), // arrivée après le séjour
    ];
    expect(rencontresVues(betes, sejour, 0)).toBe(1);
    expect(rencontresVues(betes, sejour, 1)).toBe(2);
    expect(rencontresVues(betes, sejour, 3)).toBe(3);
    expect(vueProlongee(3)).toBe(3 * MINUTES_DE_VUE_PAR_ECLAIREUR * MINUTE_MS);
  });

  it(
    "sur une longue période, celles avec pigeons font mesurablement plus de Rencontres, et révèlent plus de Cases",
    () => {
      const s = simulerLesPigeons();
      expect(s.expeditions).toBe(SIMULATION_DES_PIGEONS_EXPEDITIONS);
      expect(s.ecartMinimal).toBe(SIMULATION_DES_PIGEONS_ECART_MINIMAL_POURCENT);
      expect(s.sans.rencontres).toBeGreaterThan(1000);
      expect(s.lignes.map((l) => l.eclaireurs)).toEqual(ECLAIREURS_SIMULES);
      for (const l of s.lignes) {
        expect(l.rencontres, `${l.eclaireurs} Éclaireurs`).toBeGreaterThan(s.sans.rencontres);
        expect(l.ecart).toBeCloseTo((100 * (l.rencontres - s.sans.rencontres)) / s.sans.rencontres, 10);
        expect(l.ecart).toBeGreaterThanOrEqual(s.ecartMinimal);
        expect(l.casesEnPlus).toBeGreaterThan(0);
      }
      // Plus de pigeons, plus de Rencontres et de Cases, jusqu'aux plafonds.
      for (let i = 1; i < s.lignes.length; i++) {
        expect(s.lignes[i].rencontres).toBeGreaterThanOrEqual(s.lignes[i - 1].rencontres);
        expect(s.lignes[i].casesEnPlus).toBeGreaterThanOrEqual(s.lignes[i - 1].casesEnPlus);
      }
      expect(s.reussie).toBe(true);
    },
    60_000,
  );

  it("échoue, et dit où, quand l'écart reste sous le minimum", () => {
    const s = simulerLesPigeons({ expeditions: 500, ecartMinimal: 1000 });
    expect(s.reussie).toBe(false);
    expect(s.lignes.every((l) => l.sousLEcart)).toBe(true);
  });
});
