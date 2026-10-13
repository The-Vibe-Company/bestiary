import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Les feuilles de style du bloc Séjour et du kit, lues telles qu'elles sont écrites. */
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");
const CSS = lire("src/app/jeu/expeditions/nouvelle/Sejour.module.css");
const KIT = lire("src/components/kit.module.css");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,"=]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("le séjour sur un téléphone (US-0906)", () => {
  const mobile = CSS.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("se choisit d'un doigt : chaque durée toute prête a 44 px de haut, la choisie pressée au cuivre plein, et se voit au clavier", () => {
    expect(regle(".prets > .pret", mobile)).toContain("min-height: 44px;");
    expect(regle(".pret")).toContain("cursor: pointer;");
    expect(regle('.segments > [aria-pressed="true"],\n.segments > [aria-checked="true"],\n.segments > :has(:checked)', KIT)).toContain("color: var(--sur-cuivre);");
    expect(regle(".segments > :has(:focus-visible),\n.segments > :focus-visible", KIT)).toContain("outline: 2px solid var(--cuivre-clair);");
  });

  it("au curseur aussi : toute la largeur, 44 px de haut, rempli de cuivre jusqu'à son losange", () => {
    expect(regle(".curseur")).toMatch(/width: 100%;[^}]*height: 44px;/);
    expect(regle(".curseur")).toContain("cursor: pointer;");
    expect(regle(".curseur:focus-visible")).toContain("outline: 2px solid var(--cuivre-clair);");
    expect(regle(".curseur::-webkit-slider-runnable-track")).toContain("calc(9px + (100% - 18px) * var(--part))");
  });

  it("tient sans défilement de côté : les quatre durées prêtes se partagent la largeur, rien n'a de largeur fixe", () => {
    expect(regle(".prets")).toContain("grid-template-columns: repeat(4, minmax(0, 1fr));");
    expect(CSS).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
  });
});
