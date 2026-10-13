import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Les feuilles de style de l'écran d'Expédition et du kit, lues telles qu'elles sont écrites. */
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");
const CSS = lire("src/app/jeu/expeditions/nouvelle/page.module.css");
const KIT = lire("src/components/kit.module.css");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";
/** La partie d'une feuille sous une condition `@media`. */
const sous = (condition: string, texte = CSS) => texte.match(new RegExp(`@media ${condition.replace(/[()]/g, "\\$&")} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";

describe("l'écran d'Expédition sur un téléphone (US-0901)", () => {
  const mobile = sous("(max-width: 820px), (max-height: 500px)");
  const telephone = sous("(max-width: 760px)");

  it("se fait au pouce : « Choisir sur la carte » a 44 px de haut sur mobile, et se voit au clavier (un bouton du kit)", () => {
    expect(regle(".choisir", mobile)).toContain("min-height: 44px;");
    expect(regle(".bouton", KIT)).toContain("cursor: pointer;");
    expect(regle(".bouton:focus-visible", KIT)).toContain("outline: 2px solid var(--cuivre-clair);");
  });

  it("change une destination déjà choisie d'un lien secondaire, cerné de cuivre, qui reste lisible au survol (US-0907)", () => {
    expect(regle(".bouton", KIT)).toContain("border: 1px solid var(--filet-cuivre);");
    expect(regle(".secondaire:hover", KIT)).toMatch(/border-color: var\(--cuivre\);[^}]*background: var\(--cuivre-survol\);/);
  });

  it("dit le refus d'une Case d'un Territoire dans la couleur d'alerte (US-0907)", () => {
    expect(regle(".refus")).toContain("color: var(--braise);");
  });

  it("tient sans défilement de côté : une colonne, rien n'y a de largeur fixe plus grande que l'écran", () => {
    expect(regle(".page", telephone)).toContain("padding: 12px 12px 24px;");
    expect(regle(".equipage", telephone)).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(CSS).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
    // Les deux colonnes ne viennent que sur un écran assez large.
    expect(regle(".preparation", sous("(min-width: 1024px)"))).toContain("grid-template-columns: minmax(0, 1fr) 372px;");
    expect(regle(".details > div + div")).toContain("grid-template-columns: auto minmax(0, 1fr);");
  });
});

describe("les panneaux de l'écran d'Expédition (US-0902, US-0904, US-0906, US-0909)", () => {
  it("se tiennent à l'écart les uns des autres", () => {
    expect(regle(".composition")).toContain("gap: var(--ecart);");
    expect(regle(".equipage")).toContain("gap: var(--ecart);");
    expect(regle(".preparation", sous("(min-width: 1024px)"))).toContain("column-gap: var(--ecart);");
  });

  it("posent les explorateurs et l'escorte côte à côte, et l'escorte à choisir sous les explorateurs, sur toute la largeur", () => {
    expect(regle(".equipage")).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(regle(".equipage:has(ul)")).toContain("grid-template-columns: minmax(0, 1fr);");
  });
});
