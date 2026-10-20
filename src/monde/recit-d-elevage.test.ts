import { describe, expect, it } from "vitest";
import { FIN_D_ELEVAGE, FINS_D_ELEVAGE, recitDElevage, recitDesElevages } from "./recit-d-elevage";

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
    // Un h muet s'élide, un y non.
    expect(recitDElevage(2, "Hirondelle rustique", instant).texte).toBe("2 Bêtes d'Hirondelle rustique ont rejoint votre effectif.");
    expect(recitDElevage(2, "Yack", instant).texte).toBe("2 Bêtes de Yack ont rejoint votre effectif.");
  });

  it("dit une Bête seule au singulier, et un grand nombre à la française", () => {
    expect(recitDElevage(1, "Souris grise", instant).texte).toBe("1 Bête de Souris grise a rejoint votre effectif.");
    expect(recitDElevage(1200, "Poule", instant).texte).toBe("1 200 Bêtes de Poule ont rejoint votre effectif.");
  });
});

describe("un seul Récit pour les Élevages finis d'une absence (US-0821)", () => {
  const souris = { nombre: 3, espece: "Souris grise", fin: new Date("2026-10-20T13:31:00Z") };
  const poule = { nombre: 2, espece: "Poule", fin: new Date("2026-10-21T01:12:00Z") };

  it("d'un seul Élevage, dit la même chose que le Récit d'US-0817", () => {
    expect(recitDesElevages([souris])).toEqual(recitDElevage(3, "Souris grise", souris.fin));
  });

  it("de plusieurs, les compte, puis les dit chacun sur sa ligne avec son heure, daté du dernier", () => {
    expect(recitDesElevages([souris, poule])).toEqual({
      titre: FINS_D_ELEVAGE,
      texte: "5 Bêtes ont rejoint votre effectif :\n3 Bêtes de Souris grise, le 20 octobre à 15:31\n2 Bêtes de Poule, le 21 octobre à 03:12",
      survenuLe: poule.fin,
    });
    expect(FINS_D_ELEVAGE).toBe("Élevages terminés");
  });

  it("écrit une Bête seule au singulier, et élide devant une voyelle, ligne par ligne", () => {
    const aigle = { nombre: 1, espece: "Aigle", fin: new Date("2026-10-21T05:00:00Z") };
    expect(recitDesElevages([souris, aigle]).texte).toBe("4 Bêtes ont rejoint votre effectif :\n3 Bêtes de Souris grise, le 20 octobre à 15:31\n1 Bête d'Aigle, le 21 octobre à 07:00");
  });
});
