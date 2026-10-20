import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { peinturesPrioritaires } from "@/test/images";
import PageIntrouvable, { metadata } from "./not-found";

describe("page introuvable", () => {
  const html = renderToStaticMarkup(<PageIntrouvable />);

  it("parle français", () => {
    expect(html).toContain("Page introuvable");
    expect(metadata.title).toBe("Page introuvable");
  });

  it("charge d'abord sa peinture", () => {
    expect(peinturesPrioritaires(html)).toEqual(["accueil/explorateurs.webp"]);
  });

  it("propose de revenir à l'accueil", () => {
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*>Revenir à l(&#x27;|')accueil<\/a>/);
  });
});
