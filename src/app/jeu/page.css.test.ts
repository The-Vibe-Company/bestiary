import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style de l'écran du Foyer, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/page.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("le bloc « Bêtes » du Foyer (US-0810)", () => {
  it("tient sur une ligne : « Bêtes » d'un côté, le total de l'autre", () => {
    expect(regle(".lienBetes > section")).toContain("display: flex;");
    expect(regle(".lienBetes > section")).toContain("justify-content: space-between;");
    expect(regle(".lienBetes h2")).toContain("margin-bottom: 0;");
  });

  it("se pose dans la colonne du Foyer, sous la production", () => {
    expect(regle(".page .production")).toContain("order: 1;");
    expect(regle(".lienBetes")).toContain("order: 2;");
  });
});

describe("le bloc « Élevages » du Foyer (US-0818)", () => {
  it("se pose dans la colonne du Foyer, sous les Bêtes", () => {
    expect(regle(".page .elevages")).toContain("order: 3;");
  });

  it("tient chaque Élevage sur une ligne : le médaillon, l'Espèce et son éleveur, qui cèdent de leur largeur, puis les Bêtes nées", () => {
    expect(regle(".ligneElevage")).toContain("grid-template-columns: 34px minmax(0, 1fr) auto;");
    expect(regle(".neesElevage")).toContain("font-variant-numeric: tabular-nums;");
    expect(regle(".ligneElevage:focus-visible")).toContain("outline: 2px solid var(--cuivre-clair);");
  });

  it("n'écrit aucune couleur en clair : les jetons du kit seulement", () => {
    expect(CSS).not.toMatch(/oklch|#[0-9a-f]{3,8}\b|rgb\(/i);
  });
});
