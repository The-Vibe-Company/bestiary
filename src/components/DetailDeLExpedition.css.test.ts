import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style du détail d'une Expédition, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/components/DetailDeLExpedition.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne, dans `texte` (toute la feuille par défaut). */
const regle = (selecteur: string, texte = CSS) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("le détail d'une Expédition sur un téléphone (US-0918)", () => {
  const mobile = CSS.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("dit sa phase dans la puce du kit (src/components/kit.module.css), sans couleur à elle : le bleu du ciel est celui des Bêtes rares", () => {
    expect(regle(".phase")).not.toMatch(/background|color|--ciel/);
  });

  it("sur ordinateur, se lit tout entier : la destination se plie, la phase et le temps restant gardent leur place, rien à déplier", () => {
    expect(regle(".ligne")).toContain("grid-template-columns: minmax(0, 1fr) auto auto;");
    expect(regle(".destination")).toContain("overflow-wrap: anywhere;");
    expect(regle(".reste")).toContain("white-space: nowrap;");
    expect(regle(".reste")).toContain("font-variant-numeric: tabular-nums;");
    expect(regle(".deplier")).toContain("display: none;");
  });

  it("repliée, tient sur une ligne : la destination se coupe, le temps restant sans son annonce, la distance et le détail attendent qu'on la déplie", () => {
    expect(regle(".repliable .ligne", mobile)).toContain("grid-template-columns: minmax(0, 1fr) auto auto 12px;");
    expect(regle(".repliable .ligne > *", mobile)).toContain("grid-row: 1;");
    expect(regle(".repliable .annonce", mobile)).toContain("display: none;");
    expect(regle(".repliable:not(.deplie) .destination", mobile)).toMatch(/overflow: hidden;[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/);
    expect(regle(".repliable:not(.deplie) .distance,\n  .repliable:not(.deplie) .detail", mobile)).toContain("display: none;");
  });

  it("dépliée, garde la même ligne, la distance dessous sur toute la largeur", () => {
    expect(regle(".repliable .distance", mobile)).toMatch(/grid-row: 2;[^}]*grid-column: 1 \/ -1;/);
    // La distance vient après la règle du premier rang, qu'elle remplace.
    expect(mobile.indexOf(".repliable .distance {")).toBeGreaterThan(mobile.indexOf(".repliable .ligne > * {"));
  });

  it("se déplie d'un toucher n'importe où sur sa ligne, marges comprises, au pouce, et montre où est le clavier", () => {
    expect(regle(".repliable", mobile)).toContain("padding: 12px;");
    expect(regle(".repliable .ligne", mobile.slice(mobile.indexOf("Toute sa ligne")))).toContain("position: relative;");
    expect(regle(".deplier", mobile)).toContain("display: flex;");
    expect(regle(".deplier", mobile)).toContain("cursor: pointer;");
    // Le bouton couvre la ligne et la marge de la carte (padding: 12px), pas le détail déplié dessous.
    expect(regle(".deplier::after", mobile)).toMatch(/position: absolute;[^}]*inset: -12px;/);
    expect(regle(".deplier:focus-visible::after", mobile)).toContain("outline: 2px solid var(--encre);");
  });

  it("tourne son chevron sans animation quand le joueur réduit les animations", () => {
    const reduit = CSS.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(regle(".fleche", reduit)).toContain("transition: none;");
  });

  it("tient sans défilement de côté : rien n'y a de largeur fixe plus grande que l'écran", () => {
    expect(CSS).not.toMatch(/(?:^|[^-])width: \d{3,}px/);
    expect(regle(".detail > div", mobile)).toContain("grid-template-columns: 96px minmax(0, 1fr);");
  });
});

describe("le détail d'une Expédition dans une place étroite, la fiche de la carte (US-0913)", () => {
  const etroit = CSS.match(/@container \(max-width: 480px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("ne coupe pas la destination : la phase à côté d'elle, la distance puis le temps restant dessous, sur toute la largeur", () => {
    expect(regle(".ligne", etroit)).toContain("grid-template-columns: minmax(0, 1fr) auto;");
    expect(regle(".phase", etroit)).toMatch(/grid-row: 1;[^}]*grid-column: 2;/);
    expect(regle(".distance", etroit)).toMatch(/grid-row: 2;[^}]*grid-column: 1 \/ -1;/);
    expect(regle(".reste", etroit)).toMatch(/grid-row: 3;[^}]*grid-column: 1 \/ -1;/);
  });

  it("range le détail une étiquette par ligne, comme sur un téléphone", () => {
    expect(regle(".detail", etroit)).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(regle(".detail > div", etroit)).toContain("grid-template-columns: 96px minmax(0, 1fr);");
  });

  it("ne change rien hors d'un conteneur, comme dans la liste des Expéditions : seule la fiche de la carte s'en déclare un", () => {
    expect(CSS).not.toContain("container-type");
    const fiche = readFileSync(join(process.cwd(), "src/app/jeu/carte/ExpeditionsSurLaCarte.module.css"), "utf8");
    expect(fiche).toMatch(/\.detail \{[^}]*container-type: inline-size;/);
  });
});

describe("« Rappeler » (US-0920)", () => {
  const mobile = CSS.match(/@media \(max-width: 820px\), \(max-height: 500px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
  const etroit = CSS.match(/@container \(max-width: 480px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  it("se touche au pouce, discret à côté des boutons sur l'Encre, et se grise le temps que le serveur réponde", () => {
    expect(regle(".rappeler")).toContain("min-height: 44px;");
    expect(regle(".rappeler")).toContain("box-shadow: inset 0 0 0 1px var(--trait);");
    expect(regle(".rappeler")).toContain("cursor: pointer;");
    expect(regle(".rappeler:disabled")).toMatch(/color: var\(--texte-pale\);[^}]*cursor: not-allowed;/);
    expect(regle(".rappeler:focus-visible")).toContain("outline: 2px solid var(--encre);");
  });

  it("prend toute la largeur sur un téléphone et dans la fiche de la carte, et attend avec le détail qu'on déplie la ligne", () => {
    expect(regle(".rappeler", mobile)).toContain("width: 100%;");
    expect(regle(".rappeler", etroit)).toContain("width: 100%;");
    expect(regle(".repliable:not(.deplie) .rappeler", mobile)).toContain("display: none;");
  });
});
