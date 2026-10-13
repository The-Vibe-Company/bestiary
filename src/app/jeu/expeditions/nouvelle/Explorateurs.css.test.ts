import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Les feuilles de style du bloc Explorateurs, du départ et du kit, lues telles qu'elles sont écrites. */
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");
const EXPLORATEURS = lire("src/app/jeu/expeditions/nouvelle/Explorateurs.module.css");
const PARTIR = lire("src/app/jeu/expeditions/nouvelle/Partir.module.css");
const KIT = lire("src/components/kit.module.css");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte`. */
const regle = (selecteur: string, texte: string) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("choisir les explorateurs sur un téléphone (US-0902)", () => {
  const mobile = EXPLORATEURS.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("se fait au pouce : « − » et « + » font 44 px de côté, et se voient au clavier (le pas du kit)", () => {
    expect(regle(".lignes .choix > .plusMoins", mobile)).toMatch(/width: 44px;[^}]*height: 44px;/);
    expect(regle(".pasBouton", KIT)).toContain("cursor: pointer;");
    expect(regle(".pasBouton:focus-visible", KIT)).toContain("outline: 2px solid var(--cuivre-clair);");
  });

  it("part au pouce : « Partir » a 50 px de haut, toute la largeur, et grisé ne se touche pas (le bouton principal du kit)", () => {
    expect(regle(".large", KIT)).toMatch(/width: 100%;[^}]*min-height: 50px;/);
    expect(regle(".principal:disabled,\n.principal[aria-disabled=\"true\"]", KIT)).toContain("cursor: not-allowed;");
    expect(regle(".bouton:focus-visible", KIT)).toContain("outline: 2px solid var(--cuivre-clair);");
  });

  it("tient sans défilement de côté : rien n'y a de largeur fixe plus grande que l'écran, le départ à l'écart de ce qu'il suit", () => {
    for (const css of [EXPLORATEURS, PARTIR]) expect(css).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
    expect(regle(".lignes > div", EXPLORATEURS)).toContain("grid-template-columns: minmax(0, 1fr) auto;");
    expect(regle(".depart", PARTIR)).toContain("margin-top: 14px;");
  });
});
