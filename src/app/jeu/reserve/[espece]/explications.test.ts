import { describe, expect, it } from "vitest";
import { EXPLICATIONS } from "./explications";

describe("l'explication de chaque caractéristique de la fiche d'une Espèce (US-0807)", () => {
  it("couvre l'effectif et chaque caractéristique de la fiche, dans l'ordre de la fiche", () => {
    expect(Object.keys(EXPLICATIONS)).toEqual(["Effectif", "Attaque", "Vie", "Vitesse", "Charge", "Taille", "Régime", "Entretien", "Habitat", "Rôle"]);
  });

  it("tient en une phrase : une majuscule au début, un seul point, à la fin", () => {
    for (const [nom, phrase] of Object.entries(EXPLICATIONS)) {
      expect(phrase, nom).toMatch(/^[A-ZÀ-Ý][^.!?]*\.$/);
      expect(phrase.length, nom).toBeLessThanOrEqual(140);
    }
  });

  it("dit, pour la charge, ce qu'une Bête peut porter (l'exemple de la story)", () => {
    expect(EXPLICATIONS.Charge).toBe("Ce qu'une Bête peut porter.");
  });
});
