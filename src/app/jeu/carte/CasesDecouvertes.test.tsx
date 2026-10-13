import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CasesDecouvertes } from "./CasesDecouvertes";

/** Le texte du compteur, ses espaces insécables rendues ordinaires. */
const texte = (nombre: number, total: number) =>
  renderToStaticMarkup(<CasesDecouvertes nombre={nombre} total={total} />)
    .replace(/<[^>]+>/g, "")
    .replace(/ /g, " ");

describe("compter les Cases découvertes (US-0443)", () => {
  it("dit combien de Cases le joueur a découvertes, et quelle part du Monde, au dixième de pour cent", () => {
    expect(texte(61, 10_981)).toBe("61 Cases découvertes · 0,6 % du Monde");
    expect(texte(61, 2_070)).toBe("61 Cases découvertes · 2,9 % du Monde");
    expect(texte(1_234, 2_070)).toBe("1 234 Cases découvertes · 59,6 % du Monde");
    expect(texte(2_070, 2_070)).toBe("2 070 Cases découvertes · 100,0 % du Monde");
  });

  it("accorde « Case » au singulier, et ne dit jamais 0,0 % ni 100,0 % d'un Monde qui n'est ni vierge ni découvert en entier", () => {
    expect(texte(1, 10_981)).toBe("1 Case découverte · moins de 0,1 % du Monde");
    expect(texte(10_980, 10_981)).toBe("10 980 Cases découvertes · plus de 99,9 % du Monde");
  });

  it("garde chaque nombre collé à son unité, et se déclare posé sur la carte : la flèche du Foyer ne passe pas dessous", () => {
    const html = renderToStaticMarkup(<CasesDecouvertes nombre={1_234} total={10_981} />);
    // Le nombre en crème, collé à son unité par une espace insécable, même hors de son <b>.
    expect(html).toContain("<b>1 234</b> Cases");
    expect(html).toContain("<em>11,2 %</em>");
    expect(html).toMatch(/^<p[^>]* data-sur-la-carte=""/);
    // Le nombre de Cases et la part du Monde, chacun d'un tenant (CasesDecouvertes.module.css).
    expect(html).toMatch(/<span><b>1 234<\/b> Cases découvertes<\/span> · <span><em>11,2 %<\/em> du Monde<\/span>/);
  });
});
