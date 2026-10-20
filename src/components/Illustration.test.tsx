import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { peinturesPrioritaires } from "@/test/images";
import { Illustration, IllustrationManquante } from "./Illustration";

const DOSSIER = join(__dirname, "../../public/illustrations");

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? fichiers(path) : [path];
  });
}

describe("illustrations", () => {
  it("passent par l'optimiseur de Next, à la taille de l'écran", () => {
    const html = renderToStaticMarkup(
      <Illustration chemin="prototype/biomes/forest-1.webp" alt="Une forêt" ratio="3 / 2" sizes="(max-width: 820px) 100vw, 50vw" />,
    );
    expect(html).toContain('alt="Une forêt"');
    expect(html).toContain('sizes="(max-width: 820px) 100vw, 50vw"');
    expect(html).toMatch(/srcSet="\/_next\/image\?url=%2Fillustrations%2Fprototype%2Fbiomes%2Fforest-1\.webp&amp;w=\d+/);
    expect(html).toContain("aspect-ratio:3 / 2");
  });

  it("chargent tout de suite, avant le reste, la peinture principale d'un écran ; les autres en approchant de l'écran", () => {
    const principale = renderToStaticMarkup(<Illustration chemin="accueil/plateau.webp" alt="Le plateau" prioritaire />);
    expect(peinturesPrioritaires(principale)).toEqual(["accueil/plateau.webp"]);
    expect(principale).toContain('loading="eager"');
    const autre = renderToStaticMarkup(<Illustration chemin="accueil/plateau.webp" alt="Le plateau" />);
    expect(peinturesPrioritaires(autre)).toEqual([]);
    expect(autre).toContain('loading="lazy"');
  });

  it("ont un visuel de remplacement : la tête de loup", () => {
    expect(renderToStaticMarkup(<IllustrationManquante />)).toMatch(/^<svg viewBox="0 0 48 48"[^>]*><path d="M6 6/);
  });

  it("sont rangées dans public/illustrations, en formats web légers", () => {
    const lourds = fichiers(DOSSIER).filter(
      (file) => !/\.(webp|avif|png|svg)$/.test(file) || statSync(file).size > 600 * 1024,
    );
    expect(lourds.map((file) => relative(DOSSIER, file))).toEqual([]);
    expect(fichiers(DOSSIER).length).toBeGreaterThanOrEqual(93);
  });
});
