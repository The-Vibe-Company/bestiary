import { describe, expect, it } from "vitest";
import { ilManque } from "./nourriture-manquante";

describe("ce qui manque pour payer un Élevage (US-0816)", () => {
  it("dit la Nourriture qui manque, à l'unité supérieure, dans la Nourriture du régime, à la française", () => {
    expect(ilManque(240, "Viande ou Végétaux")).toBe("Il manque 240 Viande ou Végétaux.");
    // Une fraction de Nourriture qui manque manque tout de même : une unité.
    expect(ilManque(0.25, "Viande")).toBe("Il manque 1 Viande.");
    expect(ilManque(1234.5, "Végétaux")).toBe("Il manque 1 235 Végétaux.");
  });
});
