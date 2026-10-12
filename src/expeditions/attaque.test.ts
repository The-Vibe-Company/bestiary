import { describe, expect, it } from "vitest";
import { hasardsDeLAttaqueDUneBeteDeNaissance } from "@/monde/betes-de-naissance";
import { type HasardsDeLAttaque, hasardsDeLAttaque } from "@/monde/betes-sauvages";
import { graineDuMonde } from "@/monde/couronne";
import { CHANCE_D_ATTAQUE_PAR_HEURE } from "@/reglages";
import { chanceDAttaqueParHeure, instantDeLAttaque, type Regime } from "./attaque";

const HEURE_MS = 3_600_000;
/** L'instant du jeu `heures` heures après une origine quelconque. */
const h = (heures: number) => new Date(Date.UTC(2026, 9, 9) + heures * HEURE_MS);
/** Une Bête et une Expédition ensemble sur la Case de `de` à `a` heures. */
const ensemble = (de: number, a: number) => ({ debut: h(de), fin: h(a) });
/** Des hasards écrits d'avance, heure par heure passée ensemble : la Bête attaque aux heures de `attaques`, au moment dit. */
const hasards =
  (attaques: Record<number, number> = {}) =>
  (heure: number): HasardsDeLAttaque =>
    heure in attaques ? { attaque: 0, moment: attaques[heure] } : { attaque: 0.999, moment: 0.5 };

/** Les régimes, de la Bête la moins agressive à la plus agressive. */
const REGIMES: Regime[] = ["herbivore", "omnivore", "carnivore"];
/** Les Expéditions et les Bêtes d'une simulation, assez pour que la part des attaques s'écarte de moins d'un point de sa chance. */
const PAIRES = 20_000;

/**
 * La part, en pourcentage, de `PAIRES` paires d'une Bête sauvage et d'une Expédition, ensemble sur la Case pendant
 * `heures` heures, où la Bête, d'un régime de chance `chance`, attaque : chaque paire avec ses propres tirages.
 */
function partDesAttaques(graine: number, chance: number, heures: number): number {
  let attaques = 0;
  for (let i = 0; i < PAIRES; i++) {
    const laCase = { graine, q: i % 17, r: -(i % 13) };
    if (instantDeLAttaque(ensemble(0, heures), chance, (heure) => hasardsDeLAttaque(laCase, 4_900_000 + i, 1 + (i % 101), heure))) attaques++;
  }
  return (100 * attaques) / PAIRES;
}

describe("la chance d'attaque de la Bête trop forte (US-0943)", () => {
  it("telle quelle pour un omnivore, doublée pour un carnivore, divisée par deux pour un herbivore", () => {
    expect(chanceDAttaqueParHeure("omnivore")).toBe(CHANCE_D_ATTAQUE_PAR_HEURE);
    expect(chanceDAttaqueParHeure("carnivore")).toBe(2 * CHANCE_D_ATTAQUE_PAR_HEURE);
    expect(chanceDAttaqueParHeure("herbivore")).toBe(CHANCE_D_ATTAQUE_PAR_HEURE / 2);
  });

  it("vaut 10 % par heure passée ensemble (valeur provisoire)", () => {
    expect(CHANCE_D_ATTAQUE_PAR_HEURE).toBe(0.1);
  });
});

describe("l'instant de l'attaque (US-0943)", () => {
  it("une Bête qui ne tire jamais son attaque n'attaque pas : l'Expédition finit son séjour", () => {
    expect(instantDeLAttaque(ensemble(10, 16), 0.1, hasards())).toBeNull();
  });

  it("attaque pendant la première heure passée ensemble où son tirage tombe, au moment tiré dans cette heure", () => {
    expect(instantDeLAttaque(ensemble(10, 16), 0.1, hasards({ 2: 0.25 }))).toEqual(h(12.25));
    expect(instantDeLAttaque(ensemble(10, 16), 0.1, hasards({ 0: 0 }))).toEqual(h(10));
  });

  it("les heures se comptent depuis la Rencontre, pas sur l'horloge", () => {
    expect(instantDeLAttaque({ debut: h(10.4), fin: h(16) }, 0.1, hasards({ 1: 0.5 }))).toEqual(h(11.9));
  });

  it("n'attaque qu'une fois : seule la première heure tirée compte", () => {
    expect(instantDeLAttaque(ensemble(10, 16), 0.1, hasards({ 1: 0.9, 3: 0.1, 4: 0 }))).toEqual(h(11.9));
  });

  it("le tirage d'une heure attaque sous la chance, jamais à la chance ni au-dessus", () => {
    const pile = (attaque: number) => () => ({ attaque, moment: 0 });
    expect(instantDeLAttaque(ensemble(10, 11), 0.1, pile(0.0999))).toEqual(h(10));
    expect(instantDeLAttaque(ensemble(10, 11), 0.1, pile(0.1))).toBeNull();
    expect(instantDeLAttaque(ensemble(10, 11), 0.2, pile(0.1))).toEqual(h(10));
  });

  it("une heure entamée ne compte que tant qu'elles sont ensemble : un moment tiré après leur séparation n'amène aucune attaque", () => {
    expect(instantDeLAttaque(ensemble(10, 12.5), 0.1, hasards({ 2: 0.4 }))).toEqual(h(12.4));
    expect(instantDeLAttaque(ensemble(10, 12.5), 0.1, hasards({ 2: 0.6 }))).toBeNull();
    expect(instantDeLAttaque(ensemble(10, 12.5), 0.1, hasards({ 2: 0.5 }))).toBeNull();
  });

  it("ne tire que les heures commencées ensemble, et aucune quand elles ne se croisent pas", () => {
    const tirees: number[] = [];
    const notees = (heure: number) => (tirees.push(heure), { attaque: 0.999, moment: 0 });
    expect(instantDeLAttaque(ensemble(10, 13), 0.1, notees)).toBeNull();
    expect(tirees).toEqual([0, 1, 2]);
    expect(instantDeLAttaque(ensemble(10, 10), 1, notees)).toBeNull();
    expect(tirees).toEqual([0, 1, 2]);
  });
});

describe("les tirages de l'attaque (US-0943)", () => {
  const graine = graineDuMonde("Essai de l'attaque (US-0943)");
  const ici = { graine, q: 7, r: -3 };

  it("ne dépendent que du Monde, de la Bête, de l'Expédition et de l'heure passée ensemble", () => {
    expect(hasardsDeLAttaque(ici, 4_900_123, 42, 3)).toEqual(hasardsDeLAttaque({ ...ici }, 4_900_123, 42, 3));
    const autres = [
      hasardsDeLAttaque({ ...ici, graine: graineDuMonde("Un autre Monde (US-0943)") }, 4_900_123, 42, 3),
      hasardsDeLAttaque({ ...ici, q: 8 }, 4_900_123, 42, 3),
      hasardsDeLAttaque(ici, 4_900_124, 42, 3),
      hasardsDeLAttaque(ici, 4_900_123, 43, 3),
      hasardsDeLAttaque(ici, 4_900_123, 42, 4),
    ];
    for (const autre of autres) expect(autre).not.toEqual(hasardsDeLAttaque(ici, 4_900_123, 42, 3));
    expect(hasardsDeLAttaqueDUneBeteDeNaissance(graine, 12, 42, 3)).toEqual(hasardsDeLAttaqueDUneBeteDeNaissance(graine, 12, 42, 3));
    expect(hasardsDeLAttaqueDUneBeteDeNaissance(graine, 12, 42, 4)).not.toEqual(hasardsDeLAttaqueDUneBeteDeNaissance(graine, 12, 42, 3));
  });

  it("ensemble pendant une heure, la Bête attaque à sa chance, à un point près, selon son régime", () => {
    for (const regime of REGIMES) {
      const chance = chanceDAttaqueParHeure(regime);
      const part = partDesAttaques(graine, chance, 1);
      expect({ regime, ecart: Math.abs(part - 100 * chance) <= 1 }).toEqual({ regime, ecart: true });
    }
  });

  it("ensemble pendant six heures, elle attaque d'autant plus souvent, une heure après l'autre, et le carnivore plus que l'herbivore", () => {
    const parts = REGIMES.map((regime) => {
      const chance = chanceDAttaqueParHeure(regime);
      const part = partDesAttaques(graine, chance, 6);
      expect({ regime, ecart: Math.abs(part - 100 * (1 - (1 - chance) ** 6)) <= 1 }).toEqual({ regime, ecart: true });
      return part;
    });
    expect(parts).toEqual([...parts].sort((a, b) => a - b));
  });

  it("le moment de l'attaque tombe n'importe où dans l'heure", () => {
    const moments = Array.from({ length: 4_000 }, (_, i) => hasardsDeLAttaque(ici, 4_900_000 + i, 7, i % 6).moment);
    const quarts = [0, 1, 2, 3].map((quart) => moments.filter((m) => Math.floor(m * 4) === quart).length / moments.length);
    for (const part of quarts) expect(Math.abs(part - 0.25)).toBeLessThan(0.03);
  });
});
