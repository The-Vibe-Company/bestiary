import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style de la fiche d'une Case, et son composant, lus tels qu'ils sont écrits. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/carte/FicheDeLaCase.module.css"), "utf8");
const TSX = readFileSync(join(process.cwd(), "src/app/jeu/carte/FicheDeLaCase.tsx"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("la fiche d'une Case à l'écran (US-0428)", () => {
  it("flotte sur ordinateur en haut à gauche de la carte, sous les pièces du haut, à hauteur du bouton de la légende, qui est à droite", () => {
    const fiche = regle(".fiche");
    expect(fiche).toContain("position: absolute;");
    expect(fiche).toContain("top: calc(var(--hauteur-barre) + 12px);");
    expect(fiche).toContain("left: calc(12px + var(--bord-gauche));");
    // Un panneau du kit, son filet et ses coins de cuivre, qui défile s'il dépasse la carte.
    expect(fiche).toMatch(/max-height: calc\(100% - var\(--hauteur-barre\) - 24px\);[^}]*overflow-y: auto;/);
    expect(TSX).toContain("className={`${kit.panneau} ${styles.fiche}`}");
    expect(fiche).toContain("background: var(--panneau);");
  });
});

describe("la fiche d'une Case sur mobile (US-0431)", () => {
  const mobile = CSS.match(/@media \(max-width: 820px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("s'ouvre comme la légende dans un panneau en bas, au-dessus des onglets, sur moins de la moitié de la carte", () => {
    const fiche = regle(".fiche", mobile);
    expect(fiche).toMatch(/position: fixed;[^}]*top: auto;[^}]*right: 0;[^}]*bottom: calc\(var\(--hauteur-onglets\) \+ var\(--bord-bas\)\);[^}]*left: 0;/);
    expect(fiche).toMatch(/width: auto;[^}]*max-width: none;[^}]*max-height: calc\(0\.45 \* var\(--hauteur-utile\)\);/);
    // Comme les pièces posées sur la carte, à 10 px de ses bords (l'encoche d'un téléphone tourné compte).
    expect(fiche).toContain("margin: 0 max(10px, var(--bord-droit)) 10px max(10px, var(--bord-gauche));");
    // Elle se prend au doigt pour la faire glisser : ni la page ne défile, ni le texte ne se sélectionne.
    expect(fiche).toMatch(/touch-action: none;[^}]*user-select: none;/);
  });

  it("montre une poignée sur mobile seulement, et revient en douceur, sauf mouvement réduit", () => {
    expect(regle(".poignee")).toContain("display: none;");
    expect(regle(".poignee", mobile)).toContain("display: block;");
    expect(regle(".fiche", mobile)).toContain("transition: transform");
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^@]*\.fiche \{[^}]*transition: none;/);
  });
});

describe("fermer la fiche d'une Case (US-0430)", () => {
  it("a une croix de 44 px, en haut à droite de la fiche, qui se voit au clavier", () => {
    const croix = regle(".fermer");
    expect(croix).toMatch(/position: absolute;[^}]*top: 4px;[^}]*right: 4px;/);
    expect(croix).toMatch(/width: 44px;[^}]*height: 44px;/);
    expect(croix).toContain("cursor: pointer;");
    expect(regle(".fermer:focus-visible")).toContain("outline: 2px solid var(--cuivre-clair);");
  });
});

describe("envoyer une Expédition depuis la fiche d'une Case (US-0901)", () => {
  it("se touche au pouce : un bouton de 44 px de haut, toute la largeur de la fiche, qui se voit au clavier", () => {
    const envoyer = regle(".envoyer");
    expect(envoyer).toMatch(/display: flex;[^}]*min-height: 44px;/);
    expect(envoyer).toContain("width: 100%;");
    expect(envoyer).toContain("cursor: pointer;");
    expect(regle(".envoyer:focus-visible")).toContain("outline: 2px solid var(--cuivre-clair);");
  });

  it("reste à portée au pied de la fiche, même quand le panneau du mobile, plafonné, coupe ce qui le précède", () => {
    const envoyer = regle(".envoyer");
    expect(envoyer).toMatch(/position: sticky;[^}]*bottom: 0;/);
    // Le fond de la fiche autour de lui, sur l'écart qui le sépare de la ligne d'avant : le texte coupé ne le touche
    // pas, mais la croix reste au-dessus.
    expect(regle(".corps")).toMatch(/--ecart-corps: \d+px;[^}]*gap: var\(--ecart-corps\);/);
    expect(envoyer).toContain("0 0 0 var(--ecart-corps) var(--panneau);");
    expect(regle(".fermer")).toContain("z-index: 1;");
  });
});

describe("choisir la destination sur la carte (US-0907)", () => {
  it("dit le refus d'une Case d'un Territoire au pied de la fiche, à la place du bouton, dans la couleur d'alerte", () => {
    const refus = regle(".refus");
    expect(refus).toContain("color: var(--braise);");
  });

  it("garde le refus lisible au pied de la fiche, comme le bouton, quand le panneau du mobile, plafonné, coupe ce qui le précède", () => {
    const refus = regle(".refus");
    expect(refus).toMatch(/position: sticky;[^}]*bottom: 0;/);
    // Le fond de la fiche autour de lui : le texte coupé ne le touche pas.
    expect(refus).toContain("background: var(--panneau);");
    expect(refus).toContain("box-shadow: 0 0 0 var(--ecart-corps) var(--panneau);");
  });
});
