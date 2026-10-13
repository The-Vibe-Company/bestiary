import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style de la page Bêtes, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/betes/page.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("la page Bêtes (US-0810)", () => {
  const mobile = CSS.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("range l'effectif en cartes, autant par ligne que la largeur en tient : la peinture, le nom et la Rareté, puis l'effectif à droite", () => {
    expect(regle(".especes")).toContain("grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));");
    expect(regle(".especes")).toContain("list-style: none;");
    expect(regle(".espece")).toMatch(/grid-template-areas:\s*"peinture peinture"\s*"identite effectif";/);
    expect(regle(".espece")).toContain("grid-template-columns: minmax(0, 1fr) auto;");
    expect(regle(".effectif")).toContain("font-variant-numeric: tabular-nums;");
  });

  it("tient sans défilement de côté sur un téléphone : deux cartes par ligne, le nom passe à la ligne", () => {
    expect(regle(".especes", mobile)).toContain("grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));");
    expect(regle(".espece")).toContain("min-width: 0;");
    expect(regle(".identite")).toContain("flex-wrap: wrap;");
    expect(regle(".nom")).toContain("overflow-wrap: anywhere;");
    expect(CSS).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
  });

  it("commence à la marge des autres écrans, sans colonne étroite au milieu", () => {
    expect(regle(".page")).toContain("padding: 16px 18px 28px;");
    expect(regle(".page")).not.toMatch(/max-width|margin: 0 auto/);
  });

  it("se touche au pouce et se voit au clavier", () => {
    expect(regle(".espece:focus-visible")).toContain("outline: 2px solid var(--cuivre-clair);");
  });

  it("met chaque groupe de Blessés sur sa propre ligne, sous le nom et la Rareté, sans déborder (US-0952)", () => {
    expect(regle(".blesses")).toMatch(/flex-basis: 100%;[^}]*min-width: 0;/);
    expect(regle(".blesses")).toContain("overflow-wrap: anywhere;");
  });
});

describe("la page Bêtes vide (US-0811)", () => {
  const mobile = CSS.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("prend toute la largeur et presque toute la hauteur de l'écran, comme la Réserve vide", () => {
    expect(regle(".aucune")).not.toContain("max-width");
    expect(regle(".aucune")).toContain("min-height: clamp(320px, calc(var(--hauteur-utile) - 104px), 640px);");
    expect(regle(".aucune", mobile)).toContain("min-height: 0;");
  });

  it("met le bouton « Envoyer une Expédition » au pouce : 44 px de haut, toute la largeur sur mobile", () => {
    expect(regle(".envoyer")).toContain("min-height: 44px;");
    expect(regle(".envoyer")).toContain("cursor: pointer;");
    expect(regle(".envoyer:focus-visible")).toContain("outline: 2px solid var(--cuivre-clair);");
    expect(regle(".envoyer", mobile)).toMatch(/display: flex;[^}]*width: 100%;/);
  });
});
