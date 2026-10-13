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

  // Les feuilles de style de la barre et des formes, leur partie tablette et téléphone, et les déclarations d'une règle.
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");
  const feuille = () => lire("src/components/BarreHaut.module.css");
  const tablette = (css: string) => css.slice(css.indexOf("@media (max-width: 1023px) {"));
  const regleDe = (texte: string, selecteur: string) =>
    texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

  it("garde la navigation en haut sur toutes les tailles : rien au pied de l'écran, la page commence sous la barre (US-0302)", () => {
    const formes = lire("src/styles/formes.css");
    expect(formes).toContain("--hauteur-utile: calc(100dvh - var(--hauteur-barre) - var(--hauteur-onglets) - var(--bord-bas));");
    expect(formes).toMatch(/:root \{[^}]*--hauteur-onglets: 0px;/);
    expect(lire("src/app/globals.css")).toMatch(/body:has\(\[data-onglets\]\) \{[^}]*padding-top: var\(--hauteur-barre\);/);
    const css = feuille();
    expect(css).not.toMatch(/\.navigation \{[^}]*bottom: /);
    // Sur un téléphone, la rangée des onglets est dans la barre, sous les Stocks : sa hauteur vient de formes.css.
    expect(regleDe(tablette(css), ".barre:has(.navigation) .navigation")).toContain("grid-area: onglets;");
    expect(formes).toMatch(/@media \(max-width: 1023px\) \{\s*:root:has\(\[data-onglets\]\) \{[^}]*--hauteur-nav: 58px;/);
  });

  it("dans le jeu, est la barre de la maquette : fixe en haut, d'un bord à l'autre, un dégradé sarcelle sur un filet de cuivre", () => {
    const jeu = regleDe(feuille(), ".barre:has(.navigation)");
    expect(jeu).toContain("position: fixed;");
    expect(jeu).toContain("border-bottom: 1px solid var(--filet-cuivre);");
    expect(jeu).toContain("background: linear-gradient(180deg, var(--barre-haut), var(--barre-bas));");
    // Le blason, le nom, la navigation, puis les Stocks tout à droite ; les rangées dessous ; la famine au pied.
    expect(jeu).toMatch(/grid-template-areas:\s*"logo chef nav \. stocks"\s*"bande bande bande bande bande"\s*"onglets onglets onglets onglets onglets"\s*"alerte alerte alerte alerte alerte";/);
  });

  it("sous 1 200 px, passe les Stocks en rangée sous le blason, le nom et les onglets (US-0324)", () => {
    expect(lire("src/styles/formes.css")).toMatch(/@media \(min-width: 1024px\) and \(max-width: 1199px\) \{\s*:root:has\(\[data-bande-ressources\]\) \{\s*--hauteur-bande: 52px;/);
    const css = feuille();
    const moyen = css.slice(css.indexOf("@media (min-width: 1024px) and (max-width: 1199px)"));
    expect(regleDe(moyen, ".barre:has(.navigation) .ressources")).toContain("grid-area: bande;");
  });

  it("sur un téléphone, pose six onglets égaux sous les Stocks, le médaillon au-dessus du nom (US-0324, US-0417, US-0901, US-0801)", () => {
    const mobile = tablette(feuille());
    expect(regleDe(mobile, ".entrees")).toContain("grid-template-columns: repeat(6, minmax(0, 1fr));");
    const entree = regleDe(mobile, ".entree");
    expect(entree).toContain("flex-direction: column;");
    // 65 px par place sur 390 px : le nom en 11,5 px, pour que « Expéditions », « Habitants » et son point y tiennent.
    expect(entree).toContain("font-size: 11.5px;");
    // 53 px par place sur 320 px : le nom en 10,5 px, un peu resserré.
    const petit = feuille().slice(feuille().indexOf("@media (max-width: 380px) {"));
    expect(regleDe(petit, ".entree")).toMatch(/font-size: 10\.5px;[^}]*letter-spacing: -0\.02em;/);
  });

  it("marque l'entrée affichée en crème, d'un trait de cuivre dessous et d'un losange : jamais la couleur seule", () => {
    const css = feuille();
    expect(regleDe(css, '.entree[aria-current="page"]')).toContain("color: var(--creme);");
    expect(regleDe(css, '.entree[aria-current="page"]::after')).toContain("height: 2px;");
    expect(regleDe(css, '.entree[aria-current="page"] .libelle::after')).toContain("rotate(45deg)");
    // Son médaillon seul prend l'anneau vif et sa lueur.
    expect(regleDe(css, '.entree[aria-current="page"]::before')).toContain("box-shadow: var(--anneau-medaillon-vif);");
  });

  it("distingue l'entrée « Expéditions », l'action du jeu, sans la faire paraître choisie : ni son nom en couleur, ni la lueur", () => {
    const css = feuille();
    expect(regleDe(css, ".entree[data-principale]")).toBe("");
    expect(regleDe(css, ".entree[data-principale]::before")).toContain("box-shadow: var(--anneau-medaillon-action);");
    expect(lire("src/styles/formes.css")).toMatch(/--anneau-medaillon-action: [^;]*var\(--cuivre\)[^;]*;/);
    expect(lire("src/styles/formes.css").match(/--anneau-medaillon-action: ([^;]*);/)?.[1]).not.toContain("--cuivre-lueur");
  });

  it("pose le médaillon de chaque entrée sur son disque sombre, sans le fondre, l'anneau autour", () => {
    const medaillon = regleDe(feuille(), ".entree::before");
    expect(medaillon).toContain("background: var(--icone) 50% 50% / 84% no-repeat, var(--fond-disque);");
    expect(medaillon).not.toContain("background-blend-mode");
    expect(medaillon).toContain("box-shadow: var(--anneau-medaillon);");
  });

  it("sur un téléphone, met le compteur d'Habitants sur la ligne du blason, et les quatre Stocks d'un bord à l'autre dessous (US-0304)", () => {
    const mobile = tablette(feuille());
    expect(regleDe(mobile, ".barre:has(.navigation) .ressources")).toContain("display: contents;");
    expect(regleDe(mobile, ".habitants")).toContain("grid-area: compteur;");
    const groupes = regleDe(mobile, ".groupes");
    expect(groupes).toContain("grid-area: bande;");
    // Quatre Stocks également espacés : un Stock, un écart, un Stock… ; chaque famille sur trois colonnes.
    expect(groupes).toContain("grid-template-columns: auto 1fr auto 1fr auto 1fr auto;");
    expect(regleDe(mobile, ".groupe")).toContain("grid-template-columns: subgrid;");
  });

  it("montre le solde horaire sous la quantité, sur ordinateur comme sur un téléphone, et la rangée des Stocks grandit d'autant (US-0319)", () => {
    const css = feuille();
    // Jamais caché : sous la quantité, l'icône à gauche des deux.
    expect(css).not.toMatch(/\.solde \{[^}]*display: none/);
    expect(css).toMatch(/grid-template-areas: "icone quantite plein" "icone solde solde";/);
    expect(css).toMatch(/\n\.solde \{[^}]*grid-area: solde;/);
    expect(lire("src/styles/formes.css")).toMatch(/@media \(max-width: 1023px\) \{[^@]*:root:has\(\[data-bande-ressources\]\) \{\s*--hauteur-bande: 51px;/);
  });

  describe("l'avertissement « famine imminente » (US-0321)", () => {
    const css = feuille();
    const formes = lire("src/styles/formes.css");
    const regle = (selecteur: string, texte = css) => regleDe(texte, selecteur);

    it("est une bande sous les pièces du haut et la rangée des Stocks, d'un bord à l'autre, au pouce", () => {
      expect(regle(".barre")).toContain("grid-template-rows: var(--hauteur-ligne) var(--hauteur-bande) var(--hauteur-nav) var(--hauteur-alerte);");
      const famine = regle(".famine");
      expect(famine).toContain("grid-area: alerte;");
      expect(famine).toContain("justify-content: center;");
      expect(famine).toContain("min-height: 44px;");
    });

    it("fait grandir la barre de sa hauteur, pour que la page et les en-têtes collés restent justes dessous", () => {
      expect(formes).toMatch(/:root \{[^}]*--hauteur-alerte: 0px;/);
      expect(formes).toContain("--hauteur-barre: calc(var(--hauteur-ligne) + var(--hauteur-bande) + var(--hauteur-nav) + var(--hauteur-alerte) + var(--bord-haut));");
      expect(formes).toMatch(/\n:root:has\(\[data-alerte-famine\]\) \{\s*--hauteur-alerte: 46px;/);
      // Sur un téléphone, sur deux lignes : la bande grandit d'autant.
      expect(formes).toMatch(/@media \(max-width: 540px\) \{\s*:root:has\(\[data-alerte-famine\]\) \{\s*--hauteur-alerte: 60px;/);
    });

    it("prend la braise, son texte lisible, sans clignoter, sur ordinateur comme sur un téléphone", () => {
      const famine = regle(".famine");
      expect(famine).toContain("border-top: 1px solid var(--braise-filet);");
      expect(famine).toContain("color: var(--parchemin);");
      expect(regle(".titreFamine")).toContain("color: var(--braise);");
      expect(regle(".titreFamine")).toContain("font-weight: var(--graisse-titre);");
      expect(css).not.toMatch(/animation|@keyframes/);
      expect(css).not.toMatch(/\.famine[^{]*\{[^}]*display: none/);
      expect(regle(".famine:focus-visible")).toContain("outline: 2px solid var(--cuivre-clair);");
    });
  });

  it("sur un téléphone, ouvre le détail d'une ressource dans un panneau en bas de l'écran, avec un bouton « Fermer » de 44 px (US-0319)", () => {
    const css = feuille();
    const mobile = tablette(css);
    expect(mobile).toMatch(/\.bulle,[^{]*\{[^}]*position: fixed;[^}]*right: 0;[^}]*bottom: calc\(var\(--hauteur-onglets\) \+ var\(--bord-bas\)\);[^}]*left: 0;/);
    // Seul un toucher l'ouvre : ni le survol ni le clavier ne font monter le panneau.
    expect(mobile).toMatch(/\.ressource:not\(\[data-ouverte\]\) \.bulle \{[^}]*visibility: hidden;/);
    expect(mobile).toMatch(/\.ressource\[data-ouverte\] \.bulle \{[^}]*pointer-events: auto;/);
    expect(mobile).toMatch(/\.fermer \{[^}]*display: block;[^}]*min-height: 44px;/);
    // Sur ordinateur, la bulle reste une bulle, sans bouton.
    expect(css.slice(0, css.indexOf("@media (max-width: 1023px) {"))).toMatch(/\.fermer \{\s*display: none;/);
  });
});
