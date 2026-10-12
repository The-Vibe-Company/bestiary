import { describe, expect, it } from "vitest";
import { lExpeditionSuivie } from "@/expeditions/apprivoisement";
import { SIMULATION_DES_CHANCES_RENCONTRES, SIMULATION_DES_CHANCES_TOLERANCE_POINTS } from "@/reglages";
import { lireDesForces, rencontreSimulee, simulerLesChances } from "./simulation";

describe("la simulation des chances (US-0968)", () => {
  it(`simule ${SIMULATION_DES_CHANCES_RENCONTRES} Rencontres disputées, chacune une Bête différente, à la tolérance de ${SIMULATION_DES_CHANCES_TOLERANCE_POINTS} points`, () => {
    const simulation = simulerLesChances({ forces: [1, 3] });
    expect(simulation.rencontres).toBe(SIMULATION_DES_CHANCES_RENCONTRES);
    expect(simulation.tolerance).toBe(SIMULATION_DES_CHANCES_TOLERANCE_POINTS);
    expect(simulation.parts.reduce((n, p) => n + p.victoires, 0)).toBe(SIMULATION_DES_CHANCES_RENCONTRES);
    // Chaque Rencontre est celle d'une autre Bête : son tirage lui est propre.
    const betes = new Set(Array.from({ length: 50 }, (_, i) => JSON.stringify(rencontreSimulee(i, [1, 3]).bete)));
    expect(betes.size).toBe(50);
  });

  it("chaque Rencontre est jugée par le vrai tirage du jeu (lExpeditionSuivie), entre des Expéditions arrivées au même instant", () => {
    const forces = [2, 5, 9];
    const simulation = simulerLesChances({ forces, rencontres: 600 });
    const victoires = forces.map(() => 0);
    for (let i = 0; i < 600; i++) {
      const { bete, expeditions } = rencontreSimulee(i, forces);
      expect(new Set(expeditions.map((x) => x.arrivee.getTime())).size).toBe(1);
      victoires[lExpeditionSuivie(bete, expeditions)!.expeditionId - 1]++;
    }
    expect(simulation.parts.map((p) => p.victoires)).toEqual(victoires);
  });

  it("avec deux escortes de forces 1 et 3, la plus faible l'emporte environ une fois sur quatre, à la tolérance près", () => {
    const { parts, reussie } = simulerLesChances({ forces: [1, 3] });
    expect(parts.map((p) => [p.force, p.attendue])).toEqual([
      [1, 25],
      [3, 75],
    ]);
    expect(Math.abs(parts[0].obtenue - 25)).toBeLessThanOrEqual(SIMULATION_DES_CHANCES_TOLERANCE_POINTS);
    expect(parts.every((p) => !p.horsTolerance)).toBe(true);
    expect(reussie).toBe(true);
  });

  it("couvre trois Expéditions ou plus : chacune l'emporte à proportion de sa force", () => {
    for (const forces of [
      [1, 2, 3],
      [1, 1, 2, 4],
      [5, 1, 1, 1, 2],
    ]) {
      const { parts, reussie } = simulerLesChances({ forces });
      const total = forces.reduce((n, f) => n + f, 0);
      expect(parts.map((p) => p.attendue)).toEqual(forces.map((f) => (100 * f) / total));
      for (const p of parts) expect(Math.abs(p.obtenue - p.attendue), `${forces} · ${p.force}`).toBeLessThanOrEqual(SIMULATION_DES_CHANCES_TOLERANCE_POINTS);
      expect(reussie).toBe(true);
    }
  });

  it("sans escorte, une Expédition n'a aucune chance face à une escortée ; sans escorte toutes, chances égales (US-0963)", () => {
    expect(simulerLesChances({ forces: [0, 4] }).parts.map((p) => [p.attendue, p.victoires === 0])).toEqual([
      [0, true],
      [100, false],
    ]);
    const egales = simulerLesChances({ forces: [0, 0, 0] });
    expect(egales.parts.map((p) => p.attendue)).toEqual([100 / 3, 100 / 3, 100 / 3]);
    expect(egales.reussie).toBe(true);
  });

  it("échoue dès qu'une part obtenue s'écarte de sa part attendue de plus que la tolérance, et la marque", () => {
    const serree = simulerLesChances({ forces: [1, 3], rencontres: 40, tolerance: 0 });
    expect(serree.reussie).toBe(false);
    expect(serree.parts.some((p) => p.horsTolerance)).toBe(true);
    for (const p of serree.parts) expect(p.horsTolerance).toBe(Math.abs(p.obtenue - p.attendue) > 0);
  });

  it("lit les forces saisies : des entiers positifs ou nuls, séparés par des virgules ou des espaces, de 2 à 8 escortes", () => {
    expect(lireDesForces("1, 3")).toEqual([1, 3]);
    expect(lireDesForces(" 2 5,9 ")).toEqual([2, 5, 9]);
    expect(lireDesForces("0,0")).toEqual([0, 0]);
    for (const faux of ["", "3", "1, -2", "1, 2.5", "abc", "1,2,3,4,5,6,7,8,9", "1, 99999999999"]) {
      expect(() => lireDesForces(faux), faux).toThrow(`De 2 à 8 forces, des nombres entiers positifs ou nuls séparés par des virgules, pas « ${faux.trim()} ».`);
    }
  });
});
