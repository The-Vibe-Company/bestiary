import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style de la partie « Aux portes », lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/habitants/AuxPortes.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, et seule (pas à la suite d'un autre sélecteur), dans `texte`. */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?<!,)\\n\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,>]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

/** Le nombre de pixels d'une déclaration de la règle `selecteur` (« gap: 12px; »), ou NaN. */
const pixels = (selecteur: string, propriete: string, texte = CSS) => Number(regle(selecteur, texte).match(new RegExp(`\\b${propriete}: (\\d+)px;`))?.[1]);

/** Ce que dit la carte quand elle a la place : le bloc @container. */
const LARGE = CSS.slice(CSS.indexOf("@container (min-width: 320px)"));

describe("la carte d'un Voyageur aux portes (US-0332, US-0343)", () => {
  it("met chaque Voyageur dans une carte à lui, les unes sous les autres, séparées d'un filet doux", () => {
    expect(regle(".voyageurs")).toContain("display: grid;");
    expect(regle(".voyageurs")).not.toContain("grid-template-columns");
    expect(regle(".voyageur + .voyageur")).toContain("border-top: 1px solid var(--filet-cuivre-doux);");
  });

  it("pose dans la colonne étroite le portrait au-dessus, son prénom dessus, puis l'arrivée et le départ, la jauge, le Métier, ce qu'il mangera et les boutons", () => {
    expect(regle(".voyageur")).toMatch(
      /grid-template-areas:\s*"portrait portrait"\s*"arrivee depart"\s*"temps temps"\s*"metier metier"\s*"metiers metiers"\s*"entretien entretien"\s*"choix choix";/,
    );
    expect(regle(".voyageur")).toContain("grid-template-columns: minmax(0, 1fr) auto;");
    // Le prénom se pose sur le pied du portrait, en Marcellus, au-dessus de son voile.
    expect(regle(".prenom")).toMatch(/z-index: 1;[^}]*grid-area: portrait;[^}]*align-self: end;/);
    expect(regle(".prenom")).toContain("font: 400 30px / 1 var(--police-titre);");
  });

  it("met le portrait à gauche dès que la carte a la place, comme sur un téléphone, sans largeur qui pousse la page de côté", () => {
    expect(regle(".voyageurs")).toContain("container-type: inline-size;");
    expect(regle(".voyageur", LARGE)).toMatch(/grid-template-areas:\s*"portrait arrivee"\s*"portrait depart"/);
    expect(regle(".voyageur", LARGE)).toContain("grid-template-columns: clamp(112px, 30%, 180px) minmax(0, 1fr);");
    // Les Métiers dépliés prennent alors toute la largeur, sous le bouton du Métier.
    expect(regle(".voyageur:has(> .metiers)", LARGE)).toMatch(/"portrait metier"\s*"metiers metiers"/);
  });

  it("tient dans la colonne d'un grand écran : le portrait prend la hauteur qui reste, de 84 à 220 px, moins quand une phrase s'ajoute ou que plusieurs attendent", () => {
    const grand = CSS.slice(CSS.indexOf("@media (min-width: 1024px) and (min-height: 600px)"));
    expect(regle(".portrait", grand)).toContain("height: clamp(84px, calc(var(--hauteur-utile) - 600px), 220px);");
    expect(regle(".auxPortes:has(> .plusDePlace, > .famine, > .annonce) .portrait", grand)).toContain("height: clamp(84px, calc(var(--hauteur-utile) - 650px), 220px);");
    expect(regle(".voyageurs:has(> li + li) .portrait", grand)).toContain("height: 96px;");
  });

  it("ne pousse jamais la page de côté : pas d'autre largeur fixe que celle des petits signes, aucun texte qui refuse d'aller à la ligne", () => {
    // (Hors de la condition du bloc @container, qui n'impose rien.)
    for (const [, largeur] of CSS.matchAll(/(?<![\w(-])(?:min-)?width: (\d+)px/g)) expect(Number(largeur)).toBeLessThanOrEqual(14);
    expect(CSS).not.toContain("nowrap");
    // Les boutons vont à la ligne plutôt que de déborder (le kit les garde sur une ligne).
    expect(regle(".accueillir,\n.refuser")).toMatch(/min-width: 0;[^}]*white-space: normal;/);
  });
});

describe("accueillir ou refuser (US-0334, US-0336, US-0340)", () => {
  it("met « Accueillir » et « Refuser » côte à côte, au moins 36 px de haut, « Accueillir » plus large dans la colonne étroite", () => {
    expect(regle(".choix")).toMatch(/display: grid;[^}]*grid-area: choix;[^}]*grid-template-columns: minmax\(0, 1.4fr\) minmax\(0, 1fr\);/);
    expect(pixels(".choix", "gap")).toBeGreaterThanOrEqual(8);
    expect(pixels(".accueillir,\n.refuser", "min-height")).toBeGreaterThanOrEqual(36);
    expect(regle(".choix", LARGE)).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);");
  });

  it("met ce qu'il mangera juste au-dessus des boutons, pour les yeux, quand il vient après eux pour un lecteur d'écran ; la confirmation à sa place", () => {
    expect(regle(".entretien,\n.confirmation")).toContain("grid-area: entretien;");
    const zones = regle(".voyageur").match(/grid-template-areas:([^;]*);/)?.[1] ?? "";
    expect(zones.indexOf('"entretien entretien"')).toBeLessThan(zones.indexOf('"choix choix"'));
  });

  it("met « Confirmer l'accueil » dans la couleur d'alerte, qu'il garde au survol, et la phrase de la famine imminente en alerte (US-0340)", () => {
    expect(regle(".accueillir[data-confirmer]")).toMatch(/border-color: var\(--braise\);[^}]*background: var\(--braise\);[^}]*color: var\(--sur-cuivre\);/);
    expect(regle(".accueillir[data-confirmer]:hover")).toContain("background: var(--braise-claire);");
    expect(regle(".confirmation")).toMatch(/color: var\(--braise\);[^}]*font-weight: var\(--graisse-titre\);/);
  });
});

describe("le temps qui reste (US-0333)", () => {
  it("met le compte à rebours en cuivre clair, en chiffres alignés, et celui qui s'achève dans la couleur d'alerte", () => {
    expect(regle(".depart")).toMatch(/color: var\(--cuivre-clair\);[^}]*font-variant-numeric: tabular-nums;/);
    expect(regle(".depart[data-alerte]")).toContain("color: var(--braise);");
    expect(regle(".temps")).toContain("grid-area: temps;");
  });
});

describe("la partie « Aux portes », quand la place manque et pendant une Famine (US-0338, US-0341)", () => {
  it("met la phrase de la place manquante en braise, son triangle devant", () => {
    expect(regle(".annonce,\n.plusDePlace")).toMatch(/display: flex;[^}]*color: var\(--braise\);/);
  });

  it("met la phrase de la Famine en discret, comme quand personne n'attend", () => {
    expect(regle(".famine,\n.personne")).toContain("color: var(--mousse);");
  });
});

describe("la partie « Aux portes », son lien vers l'historique (US-0342)", () => {
  it("pose « Historique » à droite du titre, sur sa rangée, sa surface de toucher plus grande que lui", () => {
    expect(regle(".historique")).toMatch(/position: absolute;[^}]*top: 16px;[^}]*right: 16px;/);
    expect(regle(".historique::after")).toMatch(/position: absolute;[^}]*inset: -12px -10px;/);
    expect(regle(".historique:focus-visible")).toContain("outline: 2px solid var(--cuivre-clair);");
  });
});

describe("la partie « Aux portes », sur le kit", () => {
  it("n'écrit aucune couleur en clair, ni aucun des anciens noms : seulement ceux du kit", () => {
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|oklch\(/i);
    expect(CSS).not.toMatch(/var\(--(bloc|bloc-2|bloc-3|encre|miel|texte-2|texte-discret|texte-pale|trait|galet|mauvais|bon|sable|sable-fonce|voile|blanc-chaud)\)/);
  });
});
