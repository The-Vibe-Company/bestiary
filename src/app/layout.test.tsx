import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import couleurs from "./couleurs-app.json";

// next/font ne tourne qu'avec Next, et la barre du haut a ses propres essais : ici, seul compte ce qui entoure la page.
vi.mock("@/styles/fonts", () => ({ polices: "polices" }));
vi.mock("@/components/BarreHaut", () => ({ BarreHaut: () => null }));

import ControleLayout from "./controle/layout";
import RootLayout, { viewport } from "./layout";

/** Une feuille de style, lue telle qu'elle est écrite, sans ses commentaires. */
const feuille = (fichier: string) => readFileSync(join(process.cwd(), fichier), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Les déclarations des règles `selecteur`, écrit en tête de ligne, dans `css`, mises bout à bout. */
const regle = (css: string, selecteur: string) =>
  [...css.matchAll(new RegExp(`(?:^|\\n)${selecteur.replace(/[.*+?^${}()|[\]\\:,]/g, "\\$&")} \\{([^}]*)\\}`, "g"))].map((m) => m[1]).join("");

describe("aucun fond blanc avant le jeu", () => {
  it("pose le fond sombre dans le HTML de départ, sur <html>, avant toute feuille de style", () => {
    const html = renderToStaticMarkup(RootLayout({ children: <main />, actions: null } as Parameters<typeof RootLayout>[0]) as ReactElement);
    expect(html).toMatch(/<html lang="fr" class="polices" style="background-color:var\(--fond-de-page, (#[0-9a-f]{6})\)">/);
    expect(html.match(/--fond-de-page, (#[0-9a-f]{6})/)?.[1]).toBe(couleurs.abysse);
  });

  it("dit au navigateur, dans le HTML de départ, que la page est sombre : ses fonds par défaut, sa barre", () => {
    expect(viewport).toMatchObject({ colorScheme: "dark", themeColor: couleurs.encre });
  });

  it("garde ce fond, la sarcelle la plus sombre, une fois les feuilles chargées : partout, sauf au contrôle, resté clair", () => {
    const globals = feuille("src/app/globals.css");
    expect(regle(globals, "html")).toContain("--fond-de-page: var(--sarcelle-abysse);");
    expect(regle(globals, "html:has([data-controle])")).toMatch(/--fond-de-page: var\(--fond\);\s*color-scheme: light;/);
    expect(regle(feuille("src/styles/palette.css"), ":root")).toMatch(/^\s*color-scheme: dark;/);
  });

  it("marque les pages du contrôle, pour qu'elles restent claires", () => {
    expect(renderToStaticMarkup(<ControleLayout>{<main>Contrôle</main>}</ControleLayout>)).toBe('<div data-controle="">' + "<main>Contrôle</main></div>");
  });

  it("sur les pages d'entrée aussi, montre le panneau sombre à la place d'une peinture le temps qu'elle arrive", () => {
    expect(regle(feuille("src/app/globals.css"), "main[data-entree]")).toContain("--bloc-3: var(--panneau-releve);");
    // Le cadre d'une illustration prend --bloc-3 : dans le jeu, il est déjà le panneau sombre.
    expect(regle(feuille("src/components/Illustration.module.css"), ".cadre")).toContain("background: var(--bloc-3);");
  });
});
