import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Etat } from "./Etat";

describe("état d'un Habitant", () => {
  it("dit son mot après un point qui ne sert qu'aux yeux : jamais la couleur seule", () => {
    expect(renderToStaticMarkup(<Etat etat="libre" />).replace(/<[^>]+>/g, "")).toBe("libre");
    expect(renderToStaticMarkup(<Etat etat="expedition" />).replace(/<[^>]+>/g, "")).toBe("en Expédition");
    expect(renderToStaticMarkup(<Etat etat="libre" />)).toMatch(/<i class="[^"]+" aria-hidden="true"><\/i>libre/);
  });

  it("prend le mot que la page lui donne", () => {
    expect(renderToStaticMarkup(<Etat etat="expedition">en Expédition, rentre dans 2 h</Etat>)).toContain("rentre dans 2 h");
  });
});
