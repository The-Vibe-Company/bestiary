import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style de l'annonce du Couple réuni, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/recits/AnnonceDuCouple.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("l'annonce du Couple réuni sur un téléphone (US-0958)", () => {
  const telephone = CSS.match(/@media \(max-width: 540px\) and \(orientation: portrait\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("tient sur un seul écran : l'illustration, aussi large que l'annonce, laisse sous elle la place de son nom dans la hauteur utile", () => {
    // US-0812 : la place de « Couple réuni », d'un nom sur deux lignes et du bouton « Élever ».
    expect(regle(".couple", telephone)).toContain("--cote: min(100%, max(96px, calc(var(--hauteur-utile) - 214px)));");
    expect(regle(".couple", telephone)).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(regle(".illustration", telephone)).toContain("width: var(--cote);");
  });

  it("ne passe l'illustration au-dessus du nom qu'en portrait : un téléphone couché la garde à côté, bornée par la hauteur utile", () => {
    expect(CSS.match(/@media [^{]*\{/g)).toEqual(["@media (max-width: 540px) and (orientation: portrait) {"]);
  });

  it("garde l'illustration sous la hauteur utile sur un écran bas, à côté de son nom", () => {
    expect(regle(".couple")).toContain("--cote: min(220px, calc(var(--hauteur-utile) - 48px));");
    expect(regle(".couple")).toContain("grid-template-columns: var(--cote) minmax(0, 1fr);");
  });

  it("ne déborde jamais de côté : le nom passe à la ligne, aucune largeur fixe", () => {
    expect(regle(".couple")).toContain("min-width: 0;");
    expect(regle(".legende")).toContain("min-width: 0;");
    expect(regle(".espece")).toContain("overflow-wrap: anywhere;");
    expect(regle(".etiquette")).toContain("max-width: 100%;");
    expect(CSS).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
  });

  it("met le lien « Élever » au pouce : 44 px de haut, avec un contour au clavier (US-0812)", () => {
    expect(regle(".elever")).toContain("min-height: 44px;");
    expect(regle(".elever:focus-visible")).toContain("outline: 2px solid var(--citron);");
  });
});
