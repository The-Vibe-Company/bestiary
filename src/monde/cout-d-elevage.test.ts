import { describe, expect, it } from "vitest";
import { JOURS_D_ENTRETIEN_PAR_BETE_ELEVEE, MINUTES_D_ELEVAGE_PAR_PLACE } from "@/reglages";
import { betesPayables, coutDUneBeteElevee, dureeDUneBeteEleveeMinutes, nourritureQuiPaie } from "./cout-d-elevage";

describe("ce que coûte une Bête élevée, et combien les Stocks en paient (US-0813)", () => {
  it("coûte autant de Nourriture que son Entretien pendant les jours des réglages", () => {
    expect(JOURS_D_ENTRETIEN_PAR_BETE_ELEVEE).toBeGreaterThan(0);
    expect(coutDUneBeteElevee(5)).toBe(5 * 24 * JOURS_D_ENTRETIEN_PAR_BETE_ELEVEE);
    // US-0814 : en Nourriture entière, arrondi au-dessus : la souris (0,167 par heure) ne coûte pas 28,056, mais 29 aux réglages d'aujourd'hui.
    expect(coutDUneBeteElevee(0.167)).toBe(Math.ceil(0.167 * 24 * JOURS_D_ENTRETIEN_PAR_BETE_ELEVEE));
    expect(Number.isInteger(coutDUneBeteElevee(0.167))).toBe(true);
    // Un produit qui tombe juste ne monte pas d'une Nourriture pour une poussière de calcul (11 / 168 × 168 vaut 11,000…02).
    for (let n = 1; n <= 300; n++) expect(coutDUneBeteElevee(n / (24 * JOURS_D_ENTRETIEN_PAR_BETE_ELEVEE))).toBe(n);
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

  it("dure, pour une Bête, autant de fois MINUTES_D_ELEVAGE_PAR_PLACE qu'elle prend de Places, à la minute près, une minute au moins (US-0814)", () => {
    expect(MINUTES_D_ELEVAGE_PAR_PLACE).toBeGreaterThan(0);
    expect(dureeDUneBeteEleveeMinutes(2)).toBe(2 * MINUTES_D_ELEVAGE_PAR_PLACE);
    // La poule (31,623 Places) plus longue que le pigeon (8,556), plus long que la souris (1) : 474, 128 et 15 minutes aux réglages d'aujourd'hui.
    const [poule, pigeon, souris] = [31.623, 8.556, 1].map(dureeDUneBeteEleveeMinutes);
    expect(poule).toBe(Math.round(31.623 * MINUTES_D_ELEVAGE_PAR_PLACE));
    expect(poule).toBeGreaterThan(pigeon);
    expect(pigeon).toBeGreaterThan(souris);
    expect(dureeDUneBeteEleveeMinutes(0.001)).toBe(1);
  });
});
