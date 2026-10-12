import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style de la fiche d'une Espèce, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/reserve/[espece]/page.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("la fiche d'une Espèce (US-0803)", () => {
  const mobile = CSS.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("tient sans défilement de côté : rien n'y a de largeur fixe plus grande que l'écran", () => {
    expect(regle(".page", mobile)).toContain("padding: 12px;");
    expect(CSS).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
  });

  it("sur un téléphone couché, montre l'illustration en entier, pas plus haute que la place sous la barre", () => {
    const couche = CSS.match(/@media \(max-height: 500px\) and \(orientation: landscape\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(regle(".illustration", couche)).toContain("width: min(480px, calc(var(--hauteur-utile) - 48px));");
    expect(regle(".fiche", couche)).toContain("grid-template-columns: auto minmax(0, 1fr);");
  });

  it("met « Fermer » au pouce : 44 px de haut, avec un contour au clavier", () => {
    expect(regle(".fermer")).toContain("min-height: 44px;");
    expect(regle(".fermer:focus-visible")).toContain("outline: 2px solid var(--encre);");
  });

  it("pose l'illustration à côté du nom, au-dessus sur un téléphone tenu droit", () => {
    const etroit = CSS.match(/@media \(max-width: 600px\) and \(orientation: portrait\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    // 480 px au plus, et jamais plus de 55 % de la fiche : entre 601 et 820 px, le nom garde sa colonne.
    expect(regle(".fiche")).toMatch(/grid-template-columns: minmax\(0, min\(480px, 55%\)\) minmax\(0, 1fr\);/);
    expect(regle(".fiche", etroit)).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(regle(".fiche", mobile)).toBe("");
  });
});
