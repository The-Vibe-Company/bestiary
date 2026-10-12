import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style de la Réserve, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/reserve/page.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("la Réserve sur un téléphone (US-0801)", () => {
  const mobile = CSS.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("tient sans défilement de côté : rien n'y a de largeur fixe plus grande que l'écran", () => {
    expect(regle(".page", mobile)).toContain("padding: 12px;");
    expect(CSS).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
  });

  it("donne le nombre de Couples en grand, en chiffres de même largeur", () => {
    expect(regle(".nombre")).toContain("font-size: 28px;");
    expect(regle(".nombre")).toContain("font-variant-numeric: tabular-nums;");
  });

  it("range les Couples en cartes, autant par ligne que la largeur en tient, une seule sur un téléphone (US-0802)", () => {
    expect(regle(".liste")).toContain("grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));");
    expect(regle(".liste")).toContain("list-style: none;");
  });

  it("montre les deux Bêtes d'un Couple côte à côte, à parts égales (US-0802)", () => {
    expect(regle(".betes")).toContain("grid-template-columns: 1fr 1fr;");
  });
});
