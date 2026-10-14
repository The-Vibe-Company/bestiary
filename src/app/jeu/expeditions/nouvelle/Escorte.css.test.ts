import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Les feuilles de style du bloc Escorte et du kit, lues telles qu'elles sont écrites. */
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");
const ESCORTE = lire("src/app/jeu/expeditions/nouvelle/Escorte.module.css");
const KIT = lire("src/components/kit.module.css");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte`. */
const regle = (selecteur: string, texte: string) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("choisir l'escorte sur un téléphone (US-0904)", () => {
  const mobile = ESCORTE.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
  const portrait = ESCORTE.match(/@media \(max-width: 560px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("se fait au pouce : « − », « + », « Toutes » et « Aucune » ont 44 px de surface, et se voient au clavier", () => {
    expect(regle(".choix .bouton", mobile)).toMatch(/width: 44px;[^}]*height: 44px;/);
    expect(regle(".paire > .mot", mobile)).toMatch(/min-width: 44px;[^}]*min-height: 44px;/);
    expect(regle(".pasBouton", KIT)).toContain("cursor: pointer;");
    expect(regle(".pasBouton:focus-visible", KIT)).toContain("outline: 2px solid var(--cuivre-clair);");
    expect(regle(".bouton:focus-visible", KIT)).toContain("outline: 2px solid var(--cuivre-clair);");
  });

  it("tient sans défilement de côté : rien n'y a de largeur fixe plus grande que l'écran, et en portrait les choix passent sous le nom", () => {
    expect(ESCORTE).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
    expect(regle(".espece", ESCORTE)).toContain("grid-template-columns: 38px minmax(0, 1fr) auto;");
    expect(regle(".choix", ESCORTE)).toContain("flex-wrap: wrap;");
    expect(regle(".espece", portrait)).toContain("grid-template-columns: 38px minmax(0, 1fr);");
    expect(regle(".choix", portrait)).toContain("grid-column: 1 / -1;");
  });
});

describe("la force de l'escorte (US-0905)", () => {
  it("se lit sous les Espèces, d'un filet, comme les lignes des autres panneaux : le libellé, puis le total, dans la largeur qui reste", () => {
    expect(regle(".force", ESCORTE)).toContain("grid-template-columns: auto minmax(0, 1fr);");
    expect(regle(".force", ESCORTE)).toContain("border-top: 1px solid var(--filet-cuivre-doux);");
    expect(regle(".force dt", ESCORTE)).toContain("color: var(--mousse);");
    expect(regle(".total", ESCORTE)).toMatch(/font: var\(--graisse-titre\)[^}]*font-variant-numeric: tabular-nums;/);
  });

  it("US-0976 : les Éclaireurs se choisissent au pouce comme l'escorte, juste sous elle, et sous le nom en portrait", () => {
    const mobile = ESCORTE.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    const portrait = ESCORTE.match(/@media \(max-width: 560px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(mobile).toMatch(/\.eclaireurs \.bouton,\s*\.choix \.bouton \{[^}]*width: 44px;[^}]*height: 44px;/);
    expect(regle(".eclaireurs", ESCORTE)).toContain("grid-column: 3;");
    expect(regle(".eclaireurs", portrait)).toContain("grid-column: 1 / -1;");
    expect(regle(".role", ESCORTE)).toContain("color: var(--mousse);");
  });
});
