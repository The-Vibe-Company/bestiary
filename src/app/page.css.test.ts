import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style de l'accueil, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/page.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("l'accueil tient dans le premier écran d'un ordinateur", () => {
  const telephone = CSS.match(/@media \(max-width: 820px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("donne à la scène la hauteur de l'écran, moins le panneau des espèces dessous : tout tient sans défiler", () => {
    expect(regle(".accueil")).toContain("--vignette: clamp(");
    expect(regle(".scene")).toMatch(/min-height: clamp\(\d+px, calc\(var\(--hauteur-utile\) - var\(--vignette\) - [^)]*\), 720px\);/);
  });

  it("règle la hauteur des peintures du panneau sur celle de l'écran, sur un ordinateur", () => {
    expect(regle(".galerie .vignette")).toContain("height: var(--vignette);");
  });

  it("garde sur un téléphone l'ordre de lecture : le Monde, la devise, les entrées, puis les espèces, leurs peintures carrées", () => {
    expect(regle(".scene", telephone)).toContain("display: block;");
    expect(regle(".galerie .vignette", telephone)).toMatch(/aspect-ratio: 1;[^}]*height: auto;/);
  });
});
