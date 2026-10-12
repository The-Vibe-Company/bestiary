import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlacesDeLHabitat } from "./PlacesDeLHabitat";

/** Le texte du compteur, ses balises ôtées. */
const texte = (html: string) => html.replace(/<[^>]+>/g, "");

describe("le compteur des Places de l'Habitat du Foyer (US-0822)", () => {
  it("dit « Places : occupées / total », les nombres en gras", () => {
    const html = renderToStaticMarkup(<PlacesDeLHabitat occupees={21} total={500} />);
    expect(texte(html)).toBe("Places : 21 / 500");
    expect(html).toMatch(/<strong[^>]*>21 \/ 500<\/strong>/);
  });

  it("compte une Place entamée comme prise : la somme des tailles arrondie à la Place entière supérieure", () => {
    expect(texte(renderToStaticMarkup(<PlacesDeLHabitat occupees={20.112} total={500} />))).toBe("Places : 21 / 500");
    expect(texte(renderToStaticMarkup(<PlacesDeLHabitat occupees={894} total={500} />))).toBe("Places : 894 / 500");
  });

  it("écrit les grands nombres à la française, sans couper un nombre en fin de ligne", () => {
    expect(texte(renderToStaticMarkup(<PlacesDeLHabitat occupees={12_819} total={1_500} />))).toBe("Places : 12 819 / 1 500");
  });

  it("dit aussi quand les Bêtes prennent plus de Places que l'Habitat n'en offre", () => {
    expect(texte(renderToStaticMarkup(<PlacesDeLHabitat occupees={620} total={500} />))).toBe("Places : 620 / 500");
  });
});
