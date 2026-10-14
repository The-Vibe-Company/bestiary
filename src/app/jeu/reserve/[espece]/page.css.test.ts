import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style de la fiche d'une Espèce, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/reserve/[espece]/page.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("la fiche d'une Espèce (US-0803)", () => {
  const mobile = CSS.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("tient sans défilement de côté : rien n'y a de largeur fixe plus grande que l'écran", () => {
    expect(regle(".page", mobile)).toContain("padding: 12px;");
    expect(CSS).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
  });

  it("sur un téléphone couché, montre l'illustration en entier, pas plus haute que la place sous la barre", () => {
    const couche = CSS.match(/@media \(max-height: 500px\) and \(orientation: landscape\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(regle(".illustration", couche)).toContain("width: min(480px, calc(var(--hauteur-utile) - 48px));");
    expect(regle(".fiche", couche)).toContain("grid-template-columns: auto minmax(0, 1fr);");
  });

  it("met « Fermer » au pouce : 44 px de haut, avec un contour au clavier", () => {
    expect(regle(".fermer")).toContain("min-height: 44px;");
    expect(regle(".fermer:focus-visible")).toContain("outline: 2px solid var(--cuivre-clair);");
  });

  it("pose l'illustration à côté du nom, au-dessus sur un téléphone tenu droit", () => {
    const etroit = CSS.match(/@media \(max-width: 600px\) and \(orientation: portrait\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    // 480 px au plus, et jamais plus de 55 % de la fiche : entre 601 et 820 px, le nom garde sa colonne.
    expect(regle(".fiche")).toMatch(/grid-template-columns: minmax\(0, min\(480px, 55%\)\) minmax\(0, 1fr\);/);
    expect(regle(".fiche", etroit)).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(regle(".fiche", mobile)).toBe("");
  });

  it("range les caractéristiques en deux colonnes, nom et valeur, les valeurs en chiffres de même largeur (US-0804)", () => {
    expect(regle(".caracteristiques")).toContain("grid-template-columns: max-content minmax(0, 1fr);");
    expect(regle(".caracteristiques dd")).toContain("font-variant-numeric: tabular-nums;");
  });

  it("sur un téléphone couché, met « Fermer » en haut à droite, toujours à vue (US-0804)", () => {
    const couche = CSS.match(/@media \(max-height: 500px\) and \(orientation: landscape\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(regle(".fiche", couche)).toContain('grid-template-areas: "illustration fermer" "illustration entete";');
    expect(regle(".fermer", couche)).toContain("justify-self: end;");
  });

  it("met le pictogramme du Biome devant son nom, le nom de la ligne à sa hauteur (US-0806)", () => {
    expect(regle(".caracteristiques > .habitat > dd:not(.explication)")).toMatch(/display: flex;[^}]*align-items: center;/);
    expect(regle(".caracteristiques > .habitat > *")).toContain("align-self: center;");
    // Les autres lignes gardent leurs noms et leurs valeurs sur une même ligne d'écriture.
    expect(regle(".caracteristiques")).toContain("align-items: baseline;");
  });
});

describe("comprendre une caractéristique de la fiche (US-0807)", () => {
  it("son nom se touche : un pointillé de cuivre le souligne, plein une fois ouvert, et un contour au clavier", () => {
    expect(regle(".terme")).toContain("text-decoration: underline dotted var(--cuivre);");
    expect(CSS).toMatch(/\n\.terme\[aria-expanded="true"\] \{\s*text-decoration-style: solid;/);
    expect(regle(".terme:focus-visible")).toContain("outline: 2px solid var(--cuivre-clair);");
    // Sa cible déborde le texte sans bouger la ligne.
    expect(regle(".terme")).toMatch(/margin: -5px -4px;[^}]*padding: 5px 4px;/);
  });

  it("son explication prend toute la largeur de la liste, et ne se voit pas tant qu'elle est fermée", () => {
    expect(regle(".entete .explication")).toContain("grid-column: 1 / -1;");
    expect(regle(".entete .explication[hidden]")).toContain("display: none;");
    // La liste garde sa largeur, ouverte ou non ; la ligne du Biome ne règle pas son explication.
    expect(regle(".caracteristiques")).toContain("justify-self: stretch;");
    expect(CSS).not.toMatch(/\.habitat > dd \{/);
  });

  it("l'étiquette de l'effectif, un bouton, a sa cible de 24 px de haut au moins", () => {
    expect(regle(".effectif > .terme")).toMatch(/margin: -7px -4px;[^}]*padding: 7px 4px;/);
  });

  it("le bouton qui la referme a sa cible et son contour au clavier", () => {
    expect(regle(".fermerExplication")).toMatch(/width: 32px;[^}]*height: 32px;/);
    expect(regle(".fermerExplication:focus-visible")).toContain("outline: 2px solid var(--cuivre-clair);");
  });
});
