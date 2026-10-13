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
