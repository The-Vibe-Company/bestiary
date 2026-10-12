import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FORMATS_ESPECE, IllustrationEspece } from "./IllustrationEspece";

const souris = { nom: "Souris grise", illustration: "especes/souris.webp" };

describe("illustration d'une Espèce", () => {
  it.each(["grand", "moyen", "vignette"] as const)("existe en format %s, servi à sa taille par l'optimiseur", (format) => {
    const html = renderToStaticMarkup(<IllustrationEspece espece={souris} format={format} />);
    expect(html).toContain('alt="Souris grise"');
    expect(html).toContain(`sizes="${FORMATS_ESPECE[format]}"`);
    expect(html).toMatch(/srcSet="\/_next\/image\?url=%2Fillustrations%2Fespeces%2Fsouris\.webp&amp;w=\d+/);
  });

  it("montre la tête de loup quand l'Espèce n'a pas d'illustration", () => {
    const html = renderToStaticMarkup(<IllustrationEspece espece={{ nom: "Bête d'essai", illustration: null }} format="vignette" />);
    expect(html).not.toContain("<img");
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Bête d&#x27;essai"');
    expect(html).toMatch(/<svg viewBox="0 0 48 48"/);
  });
});
