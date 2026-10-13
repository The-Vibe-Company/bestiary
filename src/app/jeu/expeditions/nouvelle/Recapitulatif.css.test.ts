import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style du récapitulatif, lue telle qu'elle est écrite. */
const RECAP = readFileSync(join(process.cwd(), "src/app/jeu/expeditions/nouvelle/Recapitulatif.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte`. */
const regle = (selecteur: string, texte: string) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("le récapitulatif sur un téléphone (US-0910)", () => {
  const mobile = RECAP.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("reste visible en bas de l'écran pendant qu'on compose, au-dessus des onglets, sans jamais dépasser l'écran", () => {
    const recap = regle(".recap", mobile);
    expect(recap).toContain("position: sticky;");
    expect(recap).toContain("bottom: calc(var(--hauteur-onglets) + var(--bord-bas) + 12px);");
    expect(recap).toContain("max-height: calc(var(--hauteur-utile) - 24px);");
    // Déplié, seul ce qu'il dit défile : le titre, son bouton et « Partir » restent en vue.
    expect(recap).toMatch(/display: flex;[^}]*flex-direction: column;/);
    expect(regle(".defilant", RECAP)).toContain("min-height: 0;");
    expect(regle(".defilant", mobile)).toContain("overflow-y: auto;");
    // Sur ordinateur, il reste à sa place, à côté de ce qu'on compose.
    expect(regle(".recap", RECAP)).not.toContain("position");
  });

  it("ne cache jamais ce que le clavier atteint : la page garde au bas de l'écran la place du récapitulatif replié", () => {
    expect(regle(":global(html):has(.recap)", mobile)).toContain("scroll-padding-bottom: calc(var(--hauteur-onglets) + var(--bord-bas) + 176px);");
  });

  it("y est replié sur l'heure de retour prévue et le départ : son bouton, au pouce, déplie tout, sans rien cacher dessous", () => {
    expect(regle(".recap:not(.deplie) .peinture,\n  .recap:not(.deplie) .lignes,\n  .recap:not(.deplie) .frise,\n  .recap:not(.deplie) .manger", mobile)).toContain("display: none;");
    expect(regle(".recap:not(.deplie) .retourPrevu", mobile)).toContain("padding: 0 30px 0 0;");
    expect(regle(".deplier", mobile)).toMatch(/width: 44px;[^}]*height: 44px;/);
    expect(regle(".deplier", mobile)).toContain("cursor: pointer;");
    expect(regle(".deplier:focus-visible", mobile)).toContain("outline: 2px solid var(--cuivre-clair);");
    // Sur ordinateur, tout se lit : rien à déplier.
    expect(regle(".deplier", RECAP)).toContain("display: none;");
  });

  it("tient sans défilement de côté : rien n'y a de largeur fixe plus grande que l'écran, ses lignes dans la largeur qui reste", () => {
    expect(RECAP).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
    expect(regle(".lignes", RECAP)).toContain("grid-template-columns: auto minmax(0, 1fr);");
  });
});
