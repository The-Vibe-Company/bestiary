import { describe, expect, it } from "vitest";
import { estUnRecitDeGuerison, recitDeGuerison } from "./recit-de-guerison";

describe("le Récit d'une guérison de Blessés (US-0954)", () => {
  const instant = new Date(Date.UTC(2031, 0, 11, 12));

  it("compte les Blessés guéris dans le titre et les nomme Espèce par Espèce, dans l'ordre donné, daté de la guérison", () => {
    expect(
      recitDeGuerison(
        [
          { nom: "Souris grise", nombre: 2 },
          { nom: "Pigeon biset", nombre: 1 },
        ],
        instant,
      ),
    ).toEqual({ titre: "3 Blessés ont guéri", texte: "De nouveau valides : Souris grise (2) et Pigeon biset (1).", survenuLe: instant });
    expect(
      recitDeGuerison(
        [
          { nom: "Souris grise", nombre: 2 },
          { nom: "Pigeon biset", nombre: 1 },
          { nom: "Poule", nombre: 4 },
        ],
        instant,
      ).texte,
    ).toBe("De nouveau valides : Souris grise (2), Pigeon biset (1) et Poule (4).");
  });

  it("au singulier, un seul Blessé", () => {
    expect(recitDeGuerison([{ nom: "Pigeon biset", nombre: 1 }], instant)).toEqual({
      titre: "1 Blessé a guéri",
      texte: "De nouveau valide : Pigeon biset (1).",
      survenuLe: instant,
    });
  });

  it("se reconnaît à son titre, et aucun autre Récit ne lui ressemble", () => {
    expect(["1 Blessé a guéri", "3 Blessés ont guéri", "12 Blessés ont guéri"].every(estUnRecitDeGuerison)).toBe(true);
    expect(
      ["Retour d'Expédition", "Fin de la Famine", "Ines a rejoint le Territoire", "3 Voyageurs ont repris la route", "Blessés ont guéri"].some(
        estUnRecitDeGuerison,
      ),
    ).toBe(false);
  });
});
