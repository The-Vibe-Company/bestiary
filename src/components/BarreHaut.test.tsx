import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarreHaut } from "./BarreHaut";

describe("barre du haut", () => {
  it("est l'en-tête de la page", () => {
    expect(renderToStaticMarkup(<BarreHaut />)).toMatch(/^<header[^>]*>/);
  });

  it("sans actions, n'affiche que le nom du jeu", () => {
    const text = renderToStaticMarkup(<BarreHaut />).replace(/<[^>]*>/g, "");
    expect(text).toBe("Bestia");
  });

  it("montre à droite les actions que la page lui donne", () => {
    const html = renderToStaticMarkup(<BarreHaut actions={<button type="button">Ourse</button>} />);
    expect(html).toMatch(/Bestia.*<button type="button">Ourse<\/button><\/header>$/);
  });

  it("sur mobile, pose la navigation en onglets en bas de l'écran, et la page s'arrête au-dessus (US-0302)", () => {
    const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");
    const formes = lire("src/styles/formes.css");
    expect(formes).toContain("--hauteur-utile: calc(100dvh - var(--hauteur-barre) - var(--hauteur-onglets) - var(--bord-bas));");
    expect(formes).toMatch(/@media \(max-width: 820px\) \{[^@]*:root:has\(\[data-onglets\]\) \{\s*--hauteur-onglets: \d+px;/);
    expect(lire("src/app/globals.css")).toMatch(/body \{[^}]*padding: [^;]*calc\(var\(--hauteur-onglets\) \+ var\(--bord-bas\)\)/);
    expect(lire("src/components/BarreHaut.module.css")).toMatch(/@media \(max-width: 820px\) \{[\s\S]*\.navigation \{[^}]*position: fixed;[^}]*bottom: 0;[^}]*var\(--bord-bas\)/);
  });

  it("sur un petit écran d'ordinateur, sous 1 490 px depuis la sixième entrée (US-0901, US-0801), passe les ressources en bande sous la barre, la navigation restant en haut (US-0324)", () => {
    const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");
    expect(lire("src/styles/formes.css")).toMatch(/@media \(max-width: 1489px\) \{\s*:root:has\(\[data-bande-ressources\]\) \{\s*--hauteur-bande: 44px;/);
    const css = lire("src/components/BarreHaut.module.css");
    const petit = css.slice(css.indexOf("@media (min-width: 821px) and (max-width: 1489px)"), css.indexOf("@media (max-width: 820px)"));
    expect(petit).not.toBe("");
    expect(petit).toMatch(/\.ressources \{[^}]*grid-column: 1 \/ -1;[^}]*grid-row: 2;/);
    expect(petit).not.toMatch(/\.navigation/);
  });

  it("sur mobile, pose six onglets en bas de l'écran : Foyer, Carte, Expéditions, Réserve, Habitants, Récits (US-0324, US-0417, US-0901, US-0801)", () => {
    const css = readFileSync(join(process.cwd(), "src/components/BarreHaut.module.css"), "utf8");
    const mobile = css.slice(css.indexOf("@media (max-width: 820px)"));
    // À parts égales, sauf un nom qui n'y tiendrait pas : 1fr ne descend pas sous la largeur de son contenu.
    expect(mobile).toMatch(/\.entrees \{[^}]*grid-template-columns: repeat\(6, 1fr\);/);
    // 53 px en moyenne sur 320 px : le nom en 11 px, un peu resserré, et la pastille serrée, pour que « Expéditions »,
    // « Réserve », « Habitants » et son point, « Récits » et « 99+ » y tiennent (US-0801).
    expect(mobile).toMatch(/\.entree \{[^}]*font-size: 11px;[^}]*letter-spacing: -0\.02em;/);
    expect(mobile).toMatch(/\.pastille \{[^}]*margin-left: 2px;[^}]*padding: 0 4px;[^}]*font-size: 11px;/);
    // Le trait de l'entrée affichée souligne son nom, pas la pastille des Récits non lus.
    expect(css).toMatch(/\.entree\[aria-current="page"\] \.libelle \{[^}]*text-decoration: underline/);
  });

  it("sur mobile, range les quatre ressources puis le compteur d'Habitants en colonnes égales : cinq sur la bande (US-0304)", () => {
    const css = readFileSync(join(process.cwd(), "src/components/BarreHaut.module.css"), "utf8");
    const mobile = css.slice(css.indexOf("@media (max-width: 820px)"));
    expect(mobile).toMatch(/\.ressources \{[^}]*grid-auto-columns: minmax\(0, 1fr\);[^}]*grid-auto-flow: column;/);
    expect(mobile).toMatch(/\.groupes \{[^}]*grid-column: span 4;/);
    // Le compteur, séparé des ressources du même trait que les deux groupes entre eux.
    expect(mobile).toMatch(/\.groupe \+ \.groupe,\s*\.groupes \+ \.habitants \{[^}]*background: linear-gradient/);
  });

  it("montre le solde horaire sous la quantité sur mobile, sur une troisième ligne de la bande, qui grandit d'autant (US-0319)", () => {
    const css = readFileSync(join(process.cwd(), "src/components/BarreHaut.module.css"), "utf8");
    const mobile = css.slice(css.indexOf("@media (max-width: 820px)"));
    // Jamais caché : à côté de la quantité dès 821 px, dessous sur mobile.
    expect(css).not.toMatch(/\.solde \{[^}]*display: none/);
    expect(mobile).toMatch(/grid-template-areas: "icone" "quantite" "solde";/);
    expect(mobile).toMatch(/\.solde \{[^}]*grid-area: solde;/);
    expect(readFileSync(join(process.cwd(), "src/styles/formes.css"), "utf8")).toMatch(/@media \(max-width: 820px\) \{\s*:root:has\(\[data-bande-ressources\]\) \{\s*--hauteur-bande: 56px;/);
  });

  describe("l'avertissement « famine imminente » (US-0321)", () => {
    const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");
    const css = lire("src/components/BarreHaut.module.css");
    const formes = lire("src/styles/formes.css");
    /** Les déclarations d'une règle, dans `texte` (toute la feuille de la barre par défaut). */
    const regle = (selecteur: string, texte = css) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

    it("est une bande toute la largeur au bas de la barre, sous la ligne et sous la bande des ressources", () => {
      expect(regle(".barre")).toContain("grid-template-rows: var(--hauteur-ligne) var(--hauteur-bande) var(--hauteur-alerte);");
      const famine = regle(".famine");
      expect(famine).toContain("grid-column: 1 / -1;");
      expect(famine).toContain("grid-row: 3;");
      // Collée aux bords de l'écran, comme la bande des ressources ; son texte reste à l'écart de l'encoche.
      expect(famine).toMatch(/margin: 0 calc\(-1 \* max\(20px, var\(--bord-droit\)\)\) 0 calc\(-1 \* max\(20px, var\(--bord-gauche\)\)\);/);
      expect(regle(".famine", css.slice(css.indexOf("@media (max-width: 820px)")))).toMatch(/margin: 0 calc\(-1 \* max\(12px, var\(--bord-droit\)\)\)/);
    });

    it("fait grandir la barre de sa hauteur, pour que la page et les en-têtes collés restent justes dessous", () => {
      expect(formes).toMatch(/:root \{[^}]*--hauteur-alerte: 0px;/);
      expect(formes).toContain("--hauteur-barre: calc(var(--hauteur-ligne) + var(--hauteur-bande) + var(--hauteur-alerte) + var(--bord-haut));");
      expect(formes).toMatch(/\n:root:has\(\[data-alerte-famine\]\) \{\s*--hauteur-alerte: 36px;/);
      // Sur un téléphone, sur deux lignes : la bande grandit d'autant.
      expect(formes).toMatch(/@media \(max-width: 540px\) \{\s*:root:has\(\[data-alerte-famine\]\) \{\s*--hauteur-alerte: 52px;/);
    });

    it("prend la couleur d'alerte, un texte clair et lisible, sans clignoter, sur ordinateur comme sur mobile", () => {
      const famine = regle(".famine");
      expect(famine).toContain("background: var(--mauvais);");
      expect(famine).toContain("color: var(--blanc-chaud);");
      expect(regle(".titreFamine")).toContain("font-weight: var(--graisse-titre);");
      expect(css).not.toMatch(/animation|@keyframes/);
      expect(css).not.toMatch(/\.famine[^{]*\{[^}]*display: none/);
      expect(regle(".famine:focus-visible")).toContain("outline: 2px solid var(--ivoire);");
    });
  });

  it("sur mobile, ouvre le détail d'une ressource dans un panneau en bas de l'écran, au-dessus des onglets, avec un bouton « Fermer » de 44 px (US-0319)", () => {
    const css = readFileSync(join(process.cwd(), "src/components/BarreHaut.module.css"), "utf8");
    const mobile = css.slice(css.indexOf("@media (max-width: 820px)"));
    expect(mobile).toMatch(/\.bulle,[^{]*\{[^}]*position: fixed;[^}]*right: 0;[^}]*bottom: calc\(var\(--hauteur-onglets\) \+ var\(--bord-bas\)\);[^}]*left: 0;/);
    // Seul un toucher l'ouvre : ni le survol ni le clavier ne font monter le panneau.
    expect(mobile).toMatch(/\.ressource:not\(\[data-ouverte\]\) \.bulle \{[^}]*visibility: hidden;/);
    expect(mobile).toMatch(/\.ressource\[data-ouverte\] \.bulle \{[^}]*pointer-events: auto;/);
    expect(mobile).toMatch(/\.fermer \{[^}]*display: block;[^}]*min-height: 44px;/);
    // Sur ordinateur, la bulle reste une bulle, sans bouton.
    expect(css.slice(0, css.indexOf("@media (max-width: 820px)"))).toMatch(/\.fermer \{\s*display: none;/);
  });
});
