import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Les styles de la carte du Monde (page.module.css), de ses boutons (BoutonsDeLaCarte.module.css) et de la flèche du
// Foyer (FlecheDuFoyer.module.css), à côté de leur vérification dans le navigateur simulé (CarteDuJeu.test.tsx,
// BoutonsDeLaCarte.test.tsx, FlecheDuFoyer.test.tsx).
const lire = (fichier: string) => readFileSync(join(process.cwd(), "src/app/jeu/carte", fichier), "utf8");
const css = lire("page.module.css");
const zoom = lire("BoutonsDeLaCarte.module.css");
const fleche = lire("FlecheDuFoyer.module.css");
/** Les déclarations d'une règle, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = css) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("les styles de la carte du Monde", () => {
  it("la font prendre à la main, sans rien sélectionner de la page en chemin (US-0420)", () => {
    expect(regle(".carte")).toContain("cursor: grab;");
    expect(regle(".carte")).toContain("user-select: none;");
    expect(regle(".carte:active")).toContain("cursor: grabbing;");
  });

  it("laissent la carte au doigt : glisser dessus ne fait pas défiler la page (US-0421)", () => {
    expect(regle(".carte")).toContain("touch-action: none;");
    // Ni bulle de menu ni loupe quand le doigt s'attarde sur la carte.
    expect(regle(".carte")).toContain("-webkit-touch-callout: none;");
  });

  it("montrent la carte sélectionnée au clavier d'un contour de cuivre clair, tracé dedans : la page coupe ce qui dépasse (US-0422)", () => {
    expect(regle(".carte:focus-visible")).toContain("outline: 2px solid var(--cuivre-clair);");
    expect(regle(".carte:focus-visible")).toContain("outline-offset: -2px;");
  });

  it("posent « + » et « − » l'un sur l'autre en bas à droite de la carte, au pouce sur mobile, au-dessus des onglets (US-0425)", () => {
    // La carte et ses boutons dans toute la place de la page ; les boutons par-dessus la carte.
    expect(regle(".cadre")).toContain("position: relative;");
    expect(regle(".cadre")).toContain("height: 100%;");
    const boutons = regle(".boutons", zoom);
    expect(boutons).toContain("position: absolute;");
    expect(boutons).toMatch(/right: calc\(\d+px \+ var\(--bord-droit\)\);/);
    expect(boutons).toMatch(/bottom: calc\(\d+px /);
    expect(boutons).toContain("flex-direction: column;");
    // Dans une même colonne de verre, « + » et « − » séparés d'un filet.
    expect(boutons).toContain("background: var(--fond-verre);");
    expect(regle(".filet", zoom)).toContain("height: 1px;");
    const bouton = regle(".bouton", zoom);
    expect(bouton).toContain("width: 44px;");
    expect(bouton).toContain("height: 44px;");
    expect(bouton).toContain("cursor: pointer;");
    expect(bouton).toContain("font: inherit;");
    const grise = regle(".bouton:disabled", zoom);
    expect(grise).toContain("color: var(--eteint);");
    expect(grise).toContain("cursor: default;");
    expect(regle(".bouton:focus-visible", zoom)).toContain("outline: 2px solid var(--cuivre-clair);");
  });

  it("gardent les boutons de la carte en vue au-dessus du panneau ouvert en bas sur mobile, légende ou fiche d'une Case (US-0426)", () => {
    // Chaque panneau publie sa hauteur sur la page, 0 ou rien quand il est fermé ou sur ordinateur.
    expect(regle(".boutons", zoom)).toContain("bottom: calc(12px + max(var(--hauteur-legende, 0px), var(--hauteur-fiche, 0px)));");
    // Sur un écran d'ordinateur peu haut, au-dessus du panneau flottant de la légende quand il descend jusqu'à eux.
    const legende = lire("Legende.module.css");
    expect(Number(regle(".boutons", zoom).match(/z-index: (\d+);/)?.[1])).toBeGreaterThan(Number(regle(".legende", legende).match(/z-index: (\d+);/)?.[1]));
    // Une hutte de cuivre clair pour icône, en tête de la colonne, sous un filet.
    expect(regle(".hutte", zoom)).toContain("stroke: var(--cuivre-clair);");
    expect(regle(".foyer", zoom)).toContain("border-bottom: 1px solid var(--filet-cuivre-doux);");
  });

  it("posent une petite pastille de verre cernée de cuivre, sa pointe de cuivre, à toucher du doigt, et rien quand le Foyer se voit (US-0426)", () => {
    const bouton = regle(".fleche", fleche);
    expect(bouton).toContain("position: absolute;");
    expect(bouton).toContain("width: 44px;");
    expect(bouton).toContain("height: 44px;");
    // Son centre là où la carte la pose.
    expect(bouton).toContain("margin: -22px 0 0 -22px;");
    expect(bouton).toContain("cursor: pointer;");
    expect(regle(".fleche[hidden]", fleche)).toContain("display: none;");
    expect(regle(".fleche circle", fleche)).toContain("fill: var(--verre-haut);");
    expect(regle(".fleche circle", fleche)).toContain("stroke: var(--cuivre-clair);");
    expect(regle(".fleche path", fleche)).toContain("stroke: var(--cuivre-clair);");
    expect(Number(regle(".fleche svg", fleche).match(/width: (\d+)px;/)?.[1])).toBeLessThanOrEqual(28);
  });

  it("posent le nombre de Cases découvertes en bas à gauche, à l'écart des boutons et sous la fiche, au-dessus du panneau du bas sur mobile (US-0443)", () => {
    const compteur = regle(".compteur", lire("CasesDecouvertes.module.css"));
    expect(compteur).toContain("position: absolute;");
    expect(compteur).toContain("left: calc(12px + var(--bord-gauche));");
    // À la hauteur des boutons, au-dessus du panneau ouvert en bas, comme eux.
    expect(compteur).toContain("bottom: calc(12px + max(var(--hauteur-legende, 0px), var(--hauteur-fiche, 0px)));");
    // Jamais sous la colonne des boutons : sa largeur s'arrête avant eux.
    expect(compteur).toMatch(/max-width: calc\(100% - 80px - var\(--bord-gauche\) - var\(--bord-droit\)\);/);
    // Discret, sous la fiche et la légende, et la carte se manie au travers.
    const fiche = lire("FicheDeLaCase.module.css");
    expect(Number(compteur.match(/z-index: (\d+);/)?.[1])).toBeLessThan(Number(regle(".fiche", fiche).match(/z-index: (\d+);/)?.[1]));
    expect(Number(compteur.match(/font-size: ([\d.]+)px;/)?.[1])).toBeLessThanOrEqual(14);
    expect(compteur).toContain("pointer-events: none;");
    // Faute de place, elle ne passe à la ligne qu'entre le nombre de Cases et la part du Monde.
    expect(regle(".compteur span", lire("CasesDecouvertes.module.css"))).toContain("white-space: nowrap;");
  });

  it("ne montrent sur mobile qu'un panneau en bas à la fois : la fiche d'une Case ouverte masque celui de la légende (US-0431)", () => {
    const mobile = css.match(/@media \(max-width: 820px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    // Le panneau de la légende, celui que son bouton commande, juste après lui ; la légende reste ouverte ou fermée.
    expect(regle(".page:has([data-fiche-de-la-case]) [aria-controls] + [id]", mobile)).toContain("display: none;");
  });
});
