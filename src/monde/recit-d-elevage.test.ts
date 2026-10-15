import { describe, expect, it } from "vitest";
import { FIN_D_ELEVAGE, recitDElevage } from "./recit-d-elevage";

describe("le Récit d'un Élevage fini (US-0817)", () => {
  const instant = new Date("2026-10-15T12:00:00Z");

  it("annonce les Bêtes qui ont rejoint l'effectif, à l'instant de la dernière naissance", () => {
    expect(recitDElevage(3, "Poule", instant)).toEqual({ titre: FIN_D_ELEVAGE, texte: "3 Bêtes de Poule ont rejoint votre effectif.", survenuLe: instant });
    expect(FIN_D_ELEVAGE).toBe("Élevage terminé");
  });

  it("élide devant une voyelle : « d'Aigle », mais « de Poule » et « de Hibou »", () => {
    expect(recitDElevage(2, "Aigle", instant).texte).toBe("2 Bêtes d'Aigle ont rejoint votre effectif.");
    expect(recitDElevage(1, "Élan", instant).texte).toBe("1 Bête d'Élan a rejoint votre effectif.");
    expect(recitDElevage(2, "Hibou", instant).texte).toBe("2 Bêtes de Hibou ont rejoint votre effectif.");
  });

  it("dit une Bête seule au singulier, et un grand nombre à la française", () => {
    expect(recitDElevage(1, "Souris grise", instant).texte).toBe("1 Bête de Souris grise a rejoint votre effectif.");
    expect(recitDElevage(1200, "Poule", instant).texte).toBe("1 200 Bêtes de Poule ont rejoint votre effectif.");
  });
});
