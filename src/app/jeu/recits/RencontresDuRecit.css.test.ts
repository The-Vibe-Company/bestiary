import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style du récit de Rencontre, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/recits/RencontresDuRecit.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("le récit de Rencontre sur un téléphone (US-0940)", () => {
  const mobile = CSS.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("réduit les illustrations : la vignette passe de 56 à 40 px, sa colonne avec elle", () => {
    expect(regle(".vignette")).toContain("width: 56px;");
    expect(regle(".rencontre")).toContain("grid-template-columns: 56px minmax(0, 1fr);");
    expect(regle(".vignette", mobile)).toContain("width: 40px;");
    expect(regle(".rencontre", mobile)).toContain("grid-template-columns: 40px minmax(0, 1fr);");
  });

  it("ne laisse pas le texte déborder : le nom, la Rareté et ce qui s'est passé passent à la ligne", () => {
    expect(regle(".corps")).toContain("min-width: 0;");
    expect(regle(".bete")).toContain("flex-wrap: wrap;");
    expect(regle(".nom")).toContain("overflow-wrap: anywhere;");
    expect(regle(".issue")).toContain("overflow-wrap: anywhere;");
    expect(regle(".nouvelleEspece")).toContain("overflow-wrap: anywhere;");
    expect(CSS).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
  });

  it("met en avant une Bête apprivoisée ou une nouvelle Espèce sur fond citron, et l'Apprivoisement en gras", () => {
    expect(regle(".rencontre[data-en-avant]")).toContain("background: var(--citron);");
    expect(regle('.issue[data-issue="apprivoisee"]')).toContain("font-weight: var(--graisse-titre);");
  });

  it("reste replié avec le texte du Récit", () => {
    expect(regle(".rencontres[hidden]")).toContain("display: none;");
  });

  it("donne à « Revenir la chercher » une cible au doigt de 44 px, et un contour au clavier (US-0949)", () => {
    expect(regle(".revenir")).toContain("min-height: 44px;");
    expect(regle(".revenir:focus-visible")).toContain("outline: 2px solid var(--encre);");
  });
});
