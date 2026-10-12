import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { PastilleRarete } from "./PastilleRarete";

/** Les six Raretés du jeu, de la plus banale à la plus rare (donnees/raretes.yaml). */
const RARETES = parse(readFileSync(join(process.cwd(), "donnees/raretes.yaml"), "utf8")) as { id: string; nom: string }[];
const CSS = readFileSync(join(process.cwd(), "src/components/PastilleRarete.module.css"), "utf8");
const PALETTE = readFileSync(join(process.cwd(), "src/styles/palette.css"), "utf8");

describe("la pastille d'une Rareté (US-0803)", () => {
  it("dit le nom de la Rareté, et la marque pour ses couleurs", () => {
    expect(renderToStaticMarkup(<PastilleRarete rarete={{ id: "peu_commune", nom: "Peu commune" }} />)).toMatch(/<span[^>]*data-rarete="peu_commune"[^>]*>Peu commune<\/span>/);
  });

  it("donne à chacune des six Raretés son propre repère : un fond et un texte qu'aucune autre ne partage", () => {
    expect(RARETES.map((r) => r.id)).toEqual(["commune", "peu_commune", "rare", "epique", "legendaire", "mythique"]);
    const couleurs = RARETES.map(({ id }) => {
      const regle = CSS.match(new RegExp(`\\.pastille\\[data-rarete="${id}"\\] \\{([^}]*)\\}`))?.[1] ?? "";
      const jeton = (propriete: string) => regle.match(new RegExp(`${propriete}: var\\((--[a-z-]+)\\);`))?.[1];
      // Chaque jeton de Rareté renvoie à une couleur de la palette.
      const valeur = (nom: string | undefined) => PALETTE.match(new RegExp(`${nom}: ([^;]+);`))?.[1];
      return `${valeur(jeton("background"))} / ${valeur(jeton("color"))}`;
    });
    expect(couleurs.every((c) => !c.includes("undefined"))).toBe(true);
    expect(new Set(couleurs).size).toBe(6);
  });
});
