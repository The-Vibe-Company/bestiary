import { describe, expect, it } from "vitest";
import { JOURS_D_ENTRETIEN_PAR_BETE_ELEVEE } from "@/reglages";
import { betesPayables, coutDUneBeteElevee, nourritureQuiPaie } from "./cout-d-elevage";

describe("ce que coûte une Bête élevée, et combien les Stocks en paient (US-0813)", () => {
  it("coûte autant de Nourriture que son Entretien pendant les jours des réglages", () => {
    expect(JOURS_D_ENTRETIEN_PAR_BETE_ELEVEE).toBeGreaterThan(0);
    expect(coutDUneBeteElevee(5)).toBe(5 * 24 * JOURS_D_ENTRETIEN_PAR_BETE_ELEVEE);
    expect(coutDUneBeteElevee(0.167)).toBeCloseTo(0.167 * 24 * JOURS_D_ENTRETIEN_PAR_BETE_ELEVEE, 9);
  });

  it("se paie dans la Nourriture de son régime : la Viande pour un carnivore, les Végétaux pour un herbivore, l'une ou l'autre pour un omnivore", () => {
    expect(nourritureQuiPaie("carnivore")).toEqual(["viande"]);
    expect(nourritureQuiPaie("herbivore")).toEqual(["vegetaux"]);
    expect(nourritureQuiPaie("omnivore")).toEqual(["viande", "vegetaux"]);
  });

  it("donne le plus grand nombre entier de Bêtes que les Stocks de cette Nourriture permettent de payer", () => {
    const stocks = { viande: 100, vegetaux: 50 };
    const jour = 24 * JOURS_D_ENTRETIEN_PAR_BETE_ELEVEE;
    // Une Bête qui coûte 10 : 10 avec la Viande seule, 5 avec les Végétaux seuls, 15 avec les deux.
    expect(betesPayables(stocks, { regime: "carnivore", entretienParHeure: 10 / jour })).toBe(10);
    expect(betesPayables(stocks, { regime: "herbivore", entretienParHeure: 10 / jour })).toBe(5);
    expect(betesPayables(stocks, { regime: "omnivore", entretienParHeure: 10 / jour })).toBe(15);
    // Pas même une Bête : aucune.
    expect(betesPayables({ viande: 9.99, vegetaux: 0 }, { regime: "carnivore", entretienParHeure: 10 / jour })).toBe(0);
    // Une Espèce sans Entretien n'a pas de coût qui borne l'Élevage : rien n'est proposé.
    expect(betesPayables(stocks, { regime: "omnivore", entretienParHeure: 0 })).toBe(0);
  });
});
