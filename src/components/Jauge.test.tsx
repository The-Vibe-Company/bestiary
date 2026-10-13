import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Jauge } from "./Jauge";

describe("jauge de cuivre", () => {
  it("se remplit de sa part, et ne sert qu'aux yeux", () => {
    const html = renderToStaticMarkup(<Jauge valeur={3} max={4} />);
    expect(html).toMatch(/^<span class="[^"]+" aria-hidden="true">/);
    expect(html).toContain("--part:75%");
  });

  it("s'arrête pleine quand elle déborde, rayée de braise", () => {
    const pleine = renderToStaticMarkup(<Jauge valeur={30} max={26} />);
    expect(pleine).toContain("--part:100%");
    expect(pleine.match(/^<span class="([^"]+)"/)?.[1].split(" ")).toHaveLength(2);
  });

  it("montre une case par place, les prises d'abord", () => {
    const html = renderToStaticMarkup(<Jauge valeur={24} max={26} cases />);
    expect(html.match(/<i/g)).toHaveLength(26);
    expect(html.match(/<i class=/g)).toHaveLength(24);
  });

  it("redevient une barre quand les cases seraient trop fines", () => {
    expect(renderToStaticMarkup(<Jauge valeur={50} max={120} cases />)).toContain("--part:");
  });
});
