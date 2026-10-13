import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style des Expéditions sur la carte, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/carte/ExpeditionsSurLaCarte.module.css"), "utf8");

/** Les déclarations de la règle `selecteur`, écrite en tête de ligne. */
const regle = (selecteur: string) => CSS.match(new RegExp(`(?:^|\\n)${selecteur.replace(/[.*+?^${}()|[\]\\:="]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("le repère d'une Expédition sur la carte (US-0913)", () => {
  it("se pose par-dessus la carte, son centre là où la carte le met, sur 44 px à toucher du doigt", () => {
    const repere = regle(".repere");
    expect(repere).toMatch(/position: absolute;[^}]*top: 0;[^}]*left: 0;/);
    expect(repere).toMatch(/width: 44px;[^}]*height: 44px;[^}]*margin: -22px 0 0 -22px;/);
    expect(regle(".repere[hidden]")).toContain("display: none;");
  });

  it("laisse passer les gestes : glisser ou pincer depuis lui fait toujours glisser ou zoomer la carte, qui le reconnaît sous le doigt", () => {
    expect(regle(".repere")).toContain("pointer-events: none;");
  });

  it("est une pastille du ton de l'état « en Expédition », cernée d'Encre, cernée de crème et de cuivre quand sa fiche est ouverte, comme la Case choisie", () => {
    expect(regle(".pastille")).toMatch(/fill: var\(--ciel\);[^}]*stroke: var\(--encre\);/);
    expect(regle(".halo")).toMatch(/fill: var\(--cuivre-pale\);[^}]*stroke: var\(--cuivre\);[^}]*visibility: hidden;/);
    expect(regle('.repere[aria-expanded="true"] .halo')).toContain("visibility: visible;");
  });

  it("se voit au clavier", () => {
    expect(regle(".repere:focus-visible")).toContain("outline: 2px solid var(--cuivre-clair);");
  });
});
