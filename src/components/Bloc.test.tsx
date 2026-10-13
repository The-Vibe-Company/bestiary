import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Bloc } from "./Bloc";

describe("panneau orné", () => {
  it("affiche son titre au-dessus du contenu", () => {
    const html = renderToStaticMarkup(
      <Bloc titre="Réserve">
        <p>Un Couple de souris</p>
      </Bloc>,
    );
    expect(html).toMatch(/^<section[^>]*><h2[^>]*>Réserve<\/h2><p>Un Couple de souris<\/p><\/section>$/);
  });

  it("se passe de titre", () => {
    const html = renderToStaticMarkup(<Bloc>Contenu seul</Bloc>);
    expect(html).not.toContain("<h2");
    expect(html).toContain("Contenu seul");
  });

  it("accepte n'importe quel contenu", () => {
    const html = renderToStaticMarkup(
      <Bloc titre="Foyer" plein>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/foyer.jpg" alt="Le Foyer" />
        <ul>
          <li>Bois</li>
        </ul>
      </Bloc>,
    );
    expect(html).toContain('<img src="/foyer.jpg" alt="Le Foyer"/>');
    expect(html).toContain("<li>Bois</li>");
  });

  it("prend une teinte du prototype", () => {
    const html = renderToStaticMarkup(<Bloc teinte="menthe" titre="Apprivoiser">x</Bloc>);
    expect(html).toMatch(/^<section class="[^"]+ [^"]+"/);
  });

  it("pose une action à droite de son titre, sur la même rangée", () => {
    const html = renderToStaticMarkup(
      <Bloc titre="Aux portes" action={<button type="button">Historique</button>}>
        <p>Sael</p>
      </Bloc>,
    );
    expect(html).toMatch(/^<section[^>]*><div[^>]*><h2[^>]*>Aux portes<\/h2><button type="button">Historique<\/button><\/div><p>Sael<\/p><\/section>$/);
  });

  it("met son titre en Marcellus pour un panneau qui porte le nom de l'écran", () => {
    const etiquette = renderToStaticMarkup(<Bloc titre="Habitants">x</Bloc>).match(/<h2 class="([^"]+)"/)?.[1];
    const serif = renderToStaticMarkup(<Bloc titre="Habitants" serif>x</Bloc>).match(/<h2 class="([^"]+)"/)?.[1];
    expect(serif).toBeTruthy();
    expect(serif).not.toBe(etiquette);
  });
});
