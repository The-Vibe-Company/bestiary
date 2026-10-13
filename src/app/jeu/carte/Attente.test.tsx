import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Attente } from "./Attente";

/** La feuille de style de l'attente et de l'échec de la carte, lue telle qu'elle est écrite. */
const CSS = readFileSync(join(process.cwd(), "src/app/jeu/carte/etats.module.css"), "utf8");

describe("l'attente de la carte (US-0434)", () => {
  it("se tient dans un petit panneau de verre du kit, et le dit aux lecteurs d'écran sans phrase de plus", () => {
    const html = renderToStaticMarkup(<Attente />);
    expect(html).toMatch(/^<div class="[^"]*attente[^"]*"><section class="[^"]*panneau[^"]*verre[^"]*">/);
    expect(html).toMatch(/<p role="status" class="[^"]*annonce[^"]*">Chargement de la carte<\/p>/);
    // Rien d'autre à lire : quelques Cases qui palpitent, en attendant les autres.
    expect(html.replace(/<p[^>]*>[^<]*<\/p>/g, "").replace(/<[^>]+>/g, "")).toBe("");
    expect(html.match(/<polygon/g)).toHaveLength(3);
  });

  it("couvre la place de la carte tant qu'elle n'est pas dessinée : son <canvas> n'a pas encore pris sa taille", () => {
    expect(CSS).toMatch(/\.attente \{[^}]*position: fixed;[^}]*top: var\(--hauteur-barre\);[^}]*bottom: calc\(var\(--hauteur-onglets\) \+ var\(--bord-bas\)\);/);
    // Un <canvas> n'a d'attribut width qu'une fois que la carte lui a donné sa taille, pour se dessiner.
    expect(CSS).toMatch(/main:has\(canvas\[width\]\) \.attente \{\s*display: none;\s*\}/);
  });

  it("palpite doucement, et reste immobile pour qui demande moins de mouvement", () => {
    expect(CSS).toMatch(/\.case \{[^}]*animation: [^;]+ infinite/);
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.case \{\s*animation: none;/);
  });
});
