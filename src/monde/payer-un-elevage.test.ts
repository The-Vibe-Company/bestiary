import { describe, expect, it } from "vitest";
import { betesPayables, estUnManque, ilManque } from "./payer-un-elevage";

describe("ce qui manque pour payer un Élevage (US-0816)", () => {
  it("dit la Nourriture qui manque, à l'unité supérieure, dans la Nourriture du régime, à la française", () => {
    expect(ilManque(240, "Viande ou Végétaux")).toBe("Il manque 240 Viande ou Végétaux.");
    // Une fraction de Nourriture qui manque manque tout de même : une unité ; un millionième aussi.
    expect(ilManque(0.25, "Viande")).toBe("Il manque 1 Viande.");
    expect(ilManque(0.000001, "Viande")).toBe("Il manque 1 Viande.");
    expect(ilManque(1234.5, "Végétaux")).toBe("Il manque 1\u00a0235 Végétaux.");
  });

  it("ne compte pas une poussière de calcul pour une unité de plus", () => {
    // 0,1 × 400 vaut 40,000000000000004 en virgule flottante : il manque 40, pas 41.
    expect(ilManque(0.1 * 400, "Viande")).toBe("Il manque 40 Viande.");
  });

  it("reconnaît un refus qui dit ce qui manque, et lui seul", () => {
    expect(estUnManque(ilManque(12, "Viande"))).toBe(true);
    expect(estUnManque("Aucun éleveur libre.")).toBe(false);
    expect(estUnManque(null)).toBe(false);
  });
});

describe("les Bêtes que la Nourriture paie, ce que « Max » propose (US-0813)", () => {
  it("donne le plus grand nombre entier de Bêtes que la Nourriture paie, aucune sans de quoi en payer une", () => {
    expect(betesPayables(100, 10)).toBe(10);
    expect(betesPayables(150, 10)).toBe(15);
    expect(betesPayables(9.99, 10)).toBe(0);
    // Juste assez, au calcul près : 0,3 × 3 vaut 0,8999999999999999.
    expect(betesPayables(0.1 * 3 * 3, 0.9)).toBe(1);
    // Un coût nul ne borne rien : rien n'est proposé.
    expect(betesPayables(100, 0)).toBe(0);
  });
});
