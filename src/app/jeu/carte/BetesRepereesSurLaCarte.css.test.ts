import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style des Bêtes repérées sur la carte, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/carte/BetesRepereesSurLaCarte.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne. */
const regle = (selecteur: string) => CSS.match(new RegExp(`(?:^|\\n)${selecteur.replace(/[.*+?^${}()|[\]\\:="]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("le repère d'une Bête repérée sur la carte (US-0948)", () => {
  it("se pose par-dessus la carte, son centre là où la carte le met, sur 44 px à toucher du doigt", () => {
    const repere = regle(".repere");
    expect(repere).toMatch(/position: absolute;[^}]*top: 0;[^}]*left: 0;/);
    expect(repere).toMatch(/width: 44px;[^}]*height: 44px;[^}]*margin: -22px 0 0 -22px;/);
    expect(regle(".repere[hidden]")).toContain("display: none;");
  });

  it("laisse passer les gestes : glisser ou pincer depuis lui fait toujours glisser ou zoomer la carte, qui le reconnaît sous le doigt", () => {
    expect(regle(".repere")).toContain("pointer-events: none;");
  });

  it("est une pastille pêche cernée d'Encre, autre que le ciel des Expéditions, cernée de citron quand sa fiche est ouverte", () => {
    expect(regle(".pastille")).toMatch(/fill: var\(--peche\);[^}]*stroke: var\(--encre\);/);
    expect(regle(".empreinte")).toContain("fill: var(--encre);");
    expect(regle(".halo")).toMatch(/fill: var\(--citron\);[^}]*visibility: hidden;/);
    expect(regle('.repere[aria-expanded="true"] .halo')).toContain("visibility: visible;");
  });

  it("se voit au clavier", () => {
    expect(regle(".repere:focus-visible")).toContain("outline: 2px solid var(--encre);");
  });
});
