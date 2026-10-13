import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La feuille de style du registre des Habitants, lue telle qu'elle est écrite. */
const REGISTRE = readFileSync(join(process.cwd(), "src/app/jeu/habitants/ListeDesHabitants.module.css"), "utf8");

describe("l'état d'un éleveur à l'Élevage dans le registre (US-0843)", () => {
  it("passe à la ligne plutôt que de couper l'Espèce qu'il élève quand le registre se resserre", () => {
    // Le mot de l'état (composant Etat) ne se coupe pas chez lui ; ici, il peut passer à la ligne.
    expect(REGISTRE).toMatch(/\n\.etat > span \{\s*white-space: normal;\s*\}/);
  });
});
