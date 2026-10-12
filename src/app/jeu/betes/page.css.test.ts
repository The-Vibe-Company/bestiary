import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style de la page Bêtes, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/betes/page.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("la page Bêtes (US-0810)", () => {
  const mobile = CSS.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("range chaque Espèce sur une ligne : la vignette, le nom et la Rareté, puis l'effectif à droite", () => {
    expect(regle(".espece")).toContain("grid-template-columns: 56px minmax(0, 1fr) auto;");
    expect(regle(".vignette")).toContain("width: 56px;");
    expect(regle(".effectif")).toContain("font-variant-numeric: tabular-nums;");
  });

  it("tient sans défilement de côté sur un téléphone : la vignette se réduit, le nom passe à la ligne", () => {
    expect(regle(".espece", mobile)).toContain("grid-template-columns: 44px minmax(0, 1fr) auto;");
    expect(regle(".vignette", mobile)).toContain("width: 44px;");
    expect(regle(".espece")).toContain("min-width: 0;");
    expect(regle(".identite")).toContain("flex-wrap: wrap;");
    expect(regle(".nom")).toContain("overflow-wrap: anywhere;");
    expect(CSS).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
  });

  it("se touche au pouce et se voit au clavier", () => {
    expect(regle(".espece:focus-visible")).toContain("outline: 2px solid var(--encre);");
  });
});

describe("la page Bêtes vide (US-0811)", () => {
  const mobile = CSS.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("met le bouton « Envoyer une Expédition » au pouce : 44 px de haut, toute la largeur sur mobile", () => {
    expect(regle(".envoyer")).toContain("min-height: 44px;");
    expect(regle(".envoyer")).toContain("cursor: pointer;");
    expect(regle(".envoyer:focus-visible")).toContain("outline: 2px solid var(--encre);");
    expect(regle(".envoyer", mobile)).toMatch(/display: flex;[^}]*width: 100%;/);
  });
});
