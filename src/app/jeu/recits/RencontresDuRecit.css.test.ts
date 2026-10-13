import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style du récit de Rencontre, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/recits/RencontresDuRecit.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) =>
  texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("le récit de Rencontre, en cartes (US-0940)", () => {
  const telephone = CSS.match(/@media \(max-width: 760px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("met la peinture à gauche d'une Bête seule, au-dessus de son texte quand elles sont plusieurs ou sur un téléphone", () => {
    expect(regle(".rencontre")).toContain("grid-template-columns: minmax(200px, 38%) minmax(0, 1fr);");
    expect(regle(".rencontres[data-plusieurs] .rencontre")).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(regle(".rencontre", telephone)).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(regle(".rencontre", telephone)).toContain("grid-template-rows: 190px auto;");
  });

  it("ne laisse pas le texte déborder : le nom, la Rareté et ce qui s'est passé passent à la ligne", () => {
    expect(regle(".corps")).toContain("min-width: 0;");
    expect(regle(".bete")).toContain("flex-wrap: wrap;");
    expect(regle(".nom")).toContain("overflow-wrap: anywhere;");
    expect(regle(".issue")).toContain("overflow-wrap: anywhere;");
    expect(regle(".nouvelleEspece")).toContain("overflow-wrap: anywhere;");
    expect(regle(".nouvelleEspece")).toContain("height: auto;");
    expect(CSS).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
  });

  it("met en avant une Bête apprivoisée ou une nouvelle Espèce d'un filet de cuivre plus vif, l'Apprivoisement en parchemin", () => {
    expect(regle(".rencontre")).toContain("border: 1px solid var(--filet-cuivre);");
    expect(regle(".rencontre[data-en-avant]")).toContain("border-color: var(--anneau-cuivre-fort);");
    expect(regle(".issue")).toContain("color: var(--mousse);");
    expect(regle('.issue[data-issue="apprivoisee"]')).toContain("color: var(--parchemin);");
  });

  it("donne à « Revenir la chercher » une cible au doigt de 44 px, et un contour au clavier (US-0949)", () => {
    expect(regle(".revenir")).toContain("min-height: 44px;");
    expect(regle(".revenir:focus-visible")).toContain("outline: 2px solid var(--cuivre-clair);");
  });
});
