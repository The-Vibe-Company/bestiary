import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style du bloc « Élever », lue telle qu'elle est écrite. */
const ELEVER = readFileSync(join(process.cwd(), "src/app/jeu/reserve/[espece]/BlocElever.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte`. */
const regle = (selecteur: string, texte: string) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,="]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("choisir la quantité (US-0813)", () => {
  const auPouce = ELEVER.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("au pouce sur un téléphone : « − », « + » et « Max » ont 44 px de surface, le champ 44 px de haut", () => {
    // Plus forts que le pas en grand du kit (.pasGrand .pasBouton) et que son bouton sur un téléphone (.bouton:not(.discret)).
    expect(regle(".quantite .pas .pasBouton", auPouce)).toMatch(/width: 44px;[^}]*height: 44px;/);
    expect(regle(".quantite .reglage > .max", auPouce)).toMatch(/min-width: 44px;[^}]*min-height: 44px;/);
    expect(regle(".champ", auPouce)).toContain("height: 44px;");
  });

  it("écrit la quantité en 16 px au moins, pour que l'iPhone ne zoome pas, et la montre au clavier", () => {
    expect(regle(".champ", ELEVER)).toContain("font-size: 16px;");
    expect(regle(".champ:focus-visible", ELEVER)).toContain("outline: 2px solid var(--cuivre-clair);");
  });

  it("tient sans défilement de côté : le champ cède de sa largeur, rien n'a de largeur fixe plus grande que l'écran", () => {
    expect(regle(".champ", ELEVER)).toMatch(/flex: 0 1 96px;[^}]*min-width: 0;/);
    expect(regle(".quantite", ELEVER)).toContain("grid-template-columns: minmax(0, 1fr);");
    // Le pas du kit est fixe (flex: none) et son nombre a 40 px au moins : ici, l'un et l'autre cèdent.
    expect(regle(".quantite .pas", ELEVER)).toMatch(/flex: 0 1 auto;[^}]*min-width: 0;/);
    expect(regle(".quantite .pas .pasBouton", ELEVER)).toContain("flex: none;");
    expect(regle(".quantite .pas .champ", ELEVER)).toContain("min-width: 0;");
    expect(ELEVER).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
  });

  it("dit une quantité refusée par le bord du pas et le message, en braise, sans couleur écrite en clair", () => {
    expect(regle('.pas:has(.champ[aria-invalid="true"])', ELEVER)).toContain("border-color: var(--braise-filet);");
    expect(regle(".refus", ELEVER)).toContain("color: var(--braise);");
    expect(ELEVER).not.toMatch(/oklch|#[0-9a-f]{3,8}\b|rgb\(/i);
  });
});
