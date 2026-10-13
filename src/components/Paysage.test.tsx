import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Paysage, peintureDuBiome } from "./Paysage";

/** L'illustration que le paysage charge, telle que l'optimiseur la demande. */
const peinture = (html: string) => decodeURIComponent(html.match(/<img[^>]*src="[^"]*url=([^&"]*)/)?.[1] ?? "");

describe("le paysage d'une destination", () => {
  it("peint le Biome de la destination, et ne sert qu'aux yeux : la page dit le Biome en mots", () => {
    const html = renderToStaticMarkup(<Paysage biome="Jungle" />);
    expect(peinture(html)).toBe("/illustrations/prototype/biomes/jungle-1.webp");
    expect(html).toMatch(/^<div class="[^"]+" aria-hidden="true"><img[^>]*alt=""/);
    expect(html).not.toContain("<svg");
  });

  it("a une peinture pour chaque Biome, et pour chaque eau par sa variante", () => {
    for (const biome of ["Prairie", "Forêt", "Jungle", "Savane", "Désert", "Montagne", "Toundra", "Banquise", "Eau", "Lac", "Rivière", "Côte", "Mer"]) {
      expect([biome, peintureDuBiome(biome)]).toEqual([biome, expect.stringMatching(/^prototype\/biomes\/[a-z]+-\d\.webp$/)]);
    }
    // Un Biome que la liste n'a pas encore : la prairie, plutôt qu'un trou.
    expect(peintureDuBiome("Marais")).toBe(peintureDuBiome("Prairie"));
  });

  it("sous le brouillard, perd la terre dans la brume, avec le « ? » d'une Case à découvrir, sans un mot de plus", () => {
    const html = renderToStaticMarkup(<Paysage brume />);
    expect(peinture(html)).toBe("/illustrations/prototype/biomes/plains-2.webp");
    expect(html).toContain("<svg");
    expect(html.replace(/<[^>]+>/g, "")).toBe("");
  });

  it("prend la peinture que la page lui donne, sous la brume comme sans elle", () => {
    expect(peinture(renderToStaticMarkup(<Paysage brume peinture="prototype/misc/expedition.webp" />))).toBe("/illustrations/prototype/misc/expedition.webp");
    expect(peinture(renderToStaticMarkup(<Paysage peinture="prototype/misc/expedition.webp" />))).toBe("/illustrations/prototype/misc/expedition.webp");
  });
});
