import { describe, expect, it } from "vitest";
import { PERTES_PAR_ECART_DES_FORCES } from "@/reglages";
import { partPerdue, pertesDuCombat, sexesDesPertes } from "./combat";

/** Une escorte de l'essai : `nombre` Bêtes de l'Espèce `especeId`, chacune de force `force`. */
const de = (especeId: string, force: number, nombre: number) => ({ especeId, force, nombre });

describe("le combat par la somme des forces (US-0944)", () => {
  it("oppose la force de la Bête à la simple somme des forces de l'escorte, sans règle de taille", () => {
    // Dix Bêtes de 90 ou une seule de 900 : la même escorte, les mêmes pertes en part.
    expect(partPerdue(1000, 10 * 90)).toBeCloseTo(0.1);
    expect(pertesDuCombat(1000, [de("souris", 90, 10)])).toEqual([{ especeId: "souris", nombre: 1 }]);
    expect(pertesDuCombat(1000, [de("poule", 900, 1)])).toEqual([{ especeId: "poule", nombre: 1 }]);
    // Cinq Bêtes de 90 et une de 450 : la même force de 900, la même part perdue.
    expect(pertesDuCombat(1000, [de("souris", 90, 5), de("poule", 450, 1)]).reduce((n, p) => n + p.nombre, 0)).toBe(1);
  });

  it("plus forte que l'escorte, la Bête l'emporte toujours : l'escorte perd au moins une Bête", () => {
    expect(pertesDuCombat(1000, [de("souris", 99, 10)])).toEqual([{ especeId: "souris", nombre: 1 }]);
    expect(pertesDuCombat(1_000_000, [de("souris", 473, 2)])).toEqual([{ especeId: "souris", nombre: 2 }]);
  });

  it("la part de l'escorte perdue grandit avec l'écart des forces, jusqu'à toute l'escorte", () => {
    // Une Bête de 1 000 face à dix Bêtes de plus en plus faibles.
    const perdues = [99, 90, 75, 50, 25, 10, 1].map((force) => pertesDuCombat(1000, [de("souris", force, 10)])[0].nombre);
    expect(perdues).toEqual([1, 1, 3, 5, 8, 9, 10]);
    expect(partPerdue(1000, 500)).toBeCloseTo(0.5 * PERTES_PAR_ECART_DES_FORCES);
  });

  it("l'écart compte relativement à la force de la Bête : la part perdue est l'écart des forces sur la force de la Bête", () => {
    expect(PERTES_PAR_ECART_DES_FORCES).toBe(1);
    expect(partPerdue(2000, 1500)).toBeCloseTo(0.25);
    expect(partPerdue(2000, 0)).toBe(1);
  });

  it("une escorte au moins aussi forte que la Bête ne perd rien, et une Expédition sans escorte non plus", () => {
    expect(partPerdue(1000, 1000)).toBe(0);
    expect(pertesDuCombat(1000, [de("poule", 500, 2)])).toEqual([]);
    expect(pertesDuCombat(1000, [])).toEqual([]);
    expect(pertesDuCombat(1000, [de("souris", 473, 0)])).toEqual([]);
  });

  describe("les pertes se répartissent entre les Espèces de l'escorte au prorata de leurs effectifs", () => {
    it("chaque Espèce perd la même part de ses Bêtes", () => {
      // Une Bête de 2 000 face à 6 souris et 3 poules de 100 : 900 de force, 55 % de l'escorte perdue, 5 Bêtes sur 9.
      expect(pertesDuCombat(2000, [de("souris", 100, 6), de("poule", 100, 3)])).toEqual([
        { especeId: "poule", nombre: 2 },
        { especeId: "souris", nombre: 3 },
      ]);
    });

    it("le reste va aux plus grands restes ; à égalité, à l'Espèce la plus faible, puis dans l'ordre des Espèces", () => {
      // 2 Bêtes perdues sur 4 souris et 4 poules : 1 chacune, sans reste.
      expect(pertesDuCombat(1000, [de("souris", 100, 4), de("poule", 100, 4)]).map((p) => p.nombre)).toEqual([1, 1]);
      // 1 Bête perdue sur 1 souris et 1 poule, à parts égales : la plus faible.
      expect(pertesDuCombat(1000, [de("poule", 450, 1), de("souris", 400, 1)])).toEqual([{ especeId: "souris", nombre: 1 }]);
      // À force égale, l'ordre des Espèces.
      expect(pertesDuCombat(1000, [de("souris", 400, 1), de("poule", 400, 1)])).toEqual([{ especeId: "poule", nombre: 1 }]);
      // 4 Bêtes perdues sur 1 poule, 6 souris et 3 pigeons : 0,4, 2,4 et 1,2 ; la poule et les souris ont le même reste, la
      // dernière Bête va aux souris, plus faibles, même quand le calcul en virgule les dirait différents.
      expect(pertesDuCombat(1000, [de("poule", 100, 1), de("souris", 75, 6), de("pigeon", 34, 3)])).toEqual([
        { especeId: "pigeon", nombre: 1 },
        { especeId: "souris", nombre: 3 },
      ]);
    });

    it("jamais plus de Bêtes d'une Espèce qu'elle n'en a dans l'escorte", () => {
      expect(pertesDuCombat(1_000_000, [de("souris", 473, 3), de("poule", 9457, 1)])).toEqual([
        { especeId: "poule", nombre: 1 },
        { especeId: "souris", nombre: 3 },
      ]);
    });
  });
});

describe("le sexe des Bêtes de l'escorte perdues (US-0944)", () => {
  it("l'escorte ne choisit pas le sexe : chaque Bête perdue est prise au sexe le plus nombreux de l'effectif de son Espèce", () => {
    expect(sexesDesPertes({ males: 5, femelles: 2 }, 2)).toEqual({ males: 2, femelles: 0 });
    expect(sexesDesPertes({ males: 3, femelles: 2 }, 3)).toEqual({ males: 2, femelles: 1 });
  });

  it("à égalité, un mâle", () => {
    expect(sexesDesPertes({ males: 2, femelles: 2 }, 1)).toEqual({ males: 1, femelles: 0 });
    expect(sexesDesPertes({ males: 2, femelles: 2 }, 2)).toEqual({ males: 1, femelles: 1 });
  });

  it("jamais plus de Bêtes que l'effectif n'en compte", () => {
    expect(sexesDesPertes({ males: 1, femelles: 0 }, 3)).toEqual({ males: 1, femelles: 0 });
    expect(sexesDesPertes({ males: 0, femelles: 0 }, 1)).toEqual({ males: 0, femelles: 0 });
  });
});
