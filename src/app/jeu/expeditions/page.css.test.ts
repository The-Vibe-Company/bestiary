import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Les feuilles de style de la liste des Expéditions en cours, de son panneau et du kit, lues telles qu'elles sont écrites. */
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");
const CSS = lire("src/app/jeu/expeditions/page.module.css");
const PANNEAU = lire("src/app/jeu/expeditions/PanneauDeLExpedition.module.css");
const KIT = lire("src/components/kit.module.css");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("la liste des Expéditions en cours sur un téléphone (US-0911, US-0918)", () => {
  const mobile = CSS.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("tient sans défilement de côté : rien n'y a de largeur fixe plus grande que l'écran", () => {
    expect(regle(".page", mobile)).toContain("padding: 12px;");
    expect(CSS).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
  });

  it("range les Expéditions côte à côte, autant que la largeur en tient, et une par rangée sur un téléphone", () => {
    expect(regle(".expeditions")).toMatch(/display: grid;[^}]*grid-template-columns: repeat\(auto-fill, minmax\(min\(100%, 420px\), 1fr\)\);/);
  });

  it("sans Expédition, met le bouton pour en préparer une au pouce : 44 px de haut, toute la largeur sur mobile, et se voit au clavier", () => {
    expect(regle(".preparer")).toContain("min-height: 44px;");
    expect(regle(".preparer")).toContain("cursor: pointer;");
    // Un bouton du kit : il se voit au clavier.
    expect(regle(".bouton:focus-visible", KIT)).toContain("outline: 2px solid var(--cuivre-clair);");
    expect(regle(".preparer", mobile)).toMatch(/display: flex;[^}]*width: 100%;/);
  });
});

describe("le panneau d'une Expédition en cours sur un téléphone (US-0918)", () => {
  const mobile = PANNEAU.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("sur ordinateur, se lit tout entier : rien à déplier", () => {
    expect(regle(".deplier", PANNEAU)).toContain("display: none;");
  });

  it("replié, tient sur son paysage et sa frise : le détail attend qu'on le déplie", () => {
    expect(regle(".panneau:not(.deplie) .detail", mobile)).toContain("display: none;");
  });

  it("se déplie d'un toucher n'importe où sur son paysage, au pouce, et montre où est le clavier", () => {
    expect(regle(".deplier", mobile)).toMatch(/position: absolute;[^}]*inset: 0;[^}]*display: block;/);
    expect(regle(".deplier", mobile)).toContain("cursor: pointer;");
    expect(regle(".deplier:focus-visible", mobile)).toContain("outline: 2px solid var(--cuivre-clair);");
  });

  it("tourne son chevron sans animation quand le joueur réduit les animations", () => {
    const reduit = PANNEAU.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(regle(".fleche", reduit)).toContain("transition: none;");
  });

  it("tient sans défilement de côté : rien n'y a de largeur fixe plus grande que l'écran, la destination se plie", () => {
    expect(PANNEAU).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
    expect(regle(".destination", PANNEAU)).toContain("overflow-wrap: anywhere;");
    expect(regle(".cles", PANNEAU)).toContain("grid-template-columns: auto minmax(0, 1fr);");
  });
});

describe("« Rappeler » (US-0920)", () => {
  const mobile = PANNEAU.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("se touche au pouce sur un téléphone : 44 px de haut", () => {
    expect(regle(".pied > .rappeler", mobile)).toContain("min-height: 44px;");
  });

  it("se grise le temps que le serveur réponde, et ne se touche plus : un bouton du kit", () => {
    expect(regle(".bouton:disabled:not(.principal)", KIT)).toContain("cursor: not-allowed;");
  });
});
