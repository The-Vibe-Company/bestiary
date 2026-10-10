import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style de la page Récits, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/recits/page.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("le résumé en tête du récit (US-0941)", () => {
  const mobile = CSS.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("se lit sur la ligne du récit, sous son titre et sa date, la flèche à côté", () => {
    expect(regle(".resume")).toContain("grid-area: resume;");
    expect(regle(".entete:has(.resume)")).toContain(`grid-template-areas: "titre quand fleche" "resume resume fleche";`);
    expect(regle(".entete:has(.resume)", mobile)).toContain(`grid-template-areas: "titre fleche" "quand fleche" "resume fleche";`);
  });

  it("passe à la ligne sur un téléphone entre deux faits, sans déborder", () => {
    expect(regle(".resume")).toContain("min-width: 0;");
    expect(regle(".resume")).toContain("display: flex;");
    expect(regle(".resume")).toContain("flex-wrap: wrap;");
    expect(regle(".fait")).toContain("min-width: 0;");
    expect(regle(".fait")).toContain("overflow-wrap: anywhere;");
  });
});
