import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Medaillon } from "./Medaillon";

describe("médaillon peint", () => {
  it("pose l'icône sur son disque, à la taille demandée, servie en petit par Next", () => {
    const html = renderToStaticMarkup(<Medaillon src="/illustrations/metiers/chasseur.webp" taille="lg" />);
    expect(html).toMatch(/^<span class="[^"]+" aria-hidden="true"><img alt=""[^>]*width="44" height="44"/);
    expect(html).toContain("metiers%2Fchasseur.webp");
  });

  it("ne sert qu'aux yeux sans texte, et se lit quand il en a un", () => {
    expect(renderToStaticMarkup(<Medaillon src="/illustrations/ressources/bois.webp" />)).toContain('aria-hidden="true"');
    const parlant = renderToStaticMarkup(<Medaillon src="/illustrations/ressources/bois.webp" alt="Bois" />);
    expect(parlant).not.toContain("aria-hidden");
    expect(parlant).toContain('alt="Bois"');
  });

  it("montre un emplacement vide sans illustration", () => {
    expect(renderToStaticMarkup(<Medaillon taille="sm" />)).toMatch(/^<span class="[^"]+" aria-hidden="true"><\/span>$/);
  });
});
