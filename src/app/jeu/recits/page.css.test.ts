import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style de la page Récits, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/recits/page.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) =>
  texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("le résumé en tête du récit (US-0941)", () => {
  it("se lit sur la ligne du récit, sous son titre et sa date, à droite de son médaillon", () => {
    expect(regle(".resume")).toContain("grid-area: resume;");
    expect(regle(".entete:has(.resume)")).toMatch(/grid-template-areas:\s*"medaillon titre nouveau"\s*"medaillon quand quand"\s*"medaillon resume resume";/);
  });

  it("passe à la ligne sur un téléphone entre deux faits, sans déborder", () => {
    expect(regle(".resume")).toContain("min-width: 0;");
    expect(regle(".resume")).toContain("display: flex;");
    expect(regle(".resume")).toContain("flex-wrap: wrap;");
    expect(regle(".fait")).toContain("min-width: 0;");
    expect(regle(".fait")).toContain("overflow-wrap: anywhere;");
  });
});

describe("la liste et le Récit ouvert (US-0324)", () => {
  const ordinateur = CSS.match(/@media \(min-width: 1024px\) and \(min-height: 600px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
  const telephone = CSS.match(/@media \(max-width: 760px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("garde caché un Récit replié", () => {
    expect(regle(".lecture[hidden]")).toContain("display: none;");
  });

  it("sur ordinateur, tient dans la hauteur de l'écran : la liste défile seule, le Récit ouvert reste en vue à sa droite", () => {
    expect(regle(".page", ordinateur)).toContain("height: var(--hauteur-utile);");
    expect(regle(".recits", ordinateur)).toContain("overflow-y: auto;");
    expect(regle(".lecture", ordinateur)).toContain("position: absolute;");
    expect(regle(".lecture", ordinateur)).toContain("overflow-y: auto;");
    // Ni sa ligne ni la liste ne le contiennent : il se pose sur le panneau, à droite de la liste.
    expect(regle(".recit[data-ouvert]", ordinateur)).toContain("position: static;");
    expect(regle(".lecture", ordinateur)).toContain("inset: 0 0 0 var(--liste);");
  });

  it("sur un téléphone, met les faits d'un retour et sa frise l'un sous l'autre", () => {
    expect(regle(".trajet")).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);");
    expect(regle(".trajet", telephone)).toContain("grid-template-columns: minmax(0, 1fr);");
  });

  it("ne laisse déborder ni un titre, ni un fait, ni un texte", () => {
    for (const selecteur of [".titreRecit", ".faits li", ".texte", ".puce", ".titreLecture"]) expect(regle(selecteur)).toContain("overflow-wrap: anywhere;");
  });
});
