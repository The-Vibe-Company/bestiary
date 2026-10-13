import { describe, expect, it } from "vitest";
import { lireUneQuantite, QUANTITE_LA_PLUS_GRANDE, QUANTITE_REFUSEE } from "./quantite";

describe("la quantité de Bêtes à élever (US-0813)", () => {
  it("lit un nombre entier de Bêtes, d'au moins 1", () => {
    expect(lireUneQuantite("1")).toBe(1);
    expect(lireUneQuantite("12")).toBe(12);
    expect(lireUneQuantite(" 3 ")).toBe(3);
  });

  it("refuse une quantité nulle, négative ou non entière, et tout ce qui n'est pas un nombre", () => {
    for (const texte of ["0", "00", "-2", "2.5", "2,5", "1e3", "", " ", "deux", "+3", "99999999999999999999"]) expect(lireUneQuantite(texte)).toBeNull();
  });

  it("lit jusqu'à la plus grande quantité, pas au-delà", () => {
    expect(lireUneQuantite(String(QUANTITE_LA_PLUS_GRANDE))).toBe(QUANTITE_LA_PLUS_GRANDE);
    expect(lireUneQuantite(String(QUANTITE_LA_PLUS_GRANDE + 1))).toBeNull();
  });

  it("le dit clairement", () => {
    expect(QUANTITE_REFUSEE).toBe("La quantité doit être un nombre entier, d'au moins 1.");
  });
});
