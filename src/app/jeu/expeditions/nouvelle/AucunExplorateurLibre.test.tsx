// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { peinturesPrioritaires } from "@/test/images";
import { AucunExplorateurLibre } from "./AucunExplorateurLibre";

afterEach(cleanup);

/** Le message, dans son bloc Explorateurs. */
const bloc = () => screen.getByRole("heading", { name: "Explorateurs" }).closest("section")!;
/** Ses textes, dans l'ordre de la lecture. */
const textes = () => bloc().innerHTML.replace(/<[^>]+>/g, "|").split("|").filter(Boolean);
/** Le lien vers la page Habitants. */
const lien = () => screen.getByRole("link", { name: "Donner le Métier d'explorateur" });

describe("aucun explorateur libre (US-0903)", () => {
  it("sans aucun explorateur, le dit, sans redire la règle, et mène à la page Habitants pour donner ce Métier", () => {
    render(<AucunExplorateurLibre total={0} prochainRetour={null} />);
    expect(textes()).toEqual(["Explorateurs", "Aucun explorateur", "Donner le Métier d'explorateur"]);
    expect(lien().getAttribute("href")).toBe("/jeu/habitants");
  });

  it("charge d'abord ses explorateurs peints : c'est l'écran", () => {
    const { container } = render(<AucunExplorateurLibre total={0} prochainRetour={null} />);
    expect(peinturesPrioritaires(container.innerHTML)).toEqual(["accueil/explorateurs.webp"]);
  });

  it("quand tous les explorateurs sont déjà partis, donne l'heure du prochain retour, dans le fuseau du joueur", () => {
    // Une valeur simulée : le retour se lit sur base (src/expeditions/depart.db.test.ts).
    const retour = new Date("2026-10-09T12:05:00Z");
    render(<AucunExplorateurLibre total={3} prochainRetour={retour} />);
    expect(textes()).toEqual(["Explorateurs", "Tous les explorateurs sont déjà partis", "Prochain retour le ", "9 octobre à 14:05", "Donner le Métier d'explorateur"]);
    expect(screen.getByText("9 octobre à 14:05").closest("time")!.getAttribute("dateTime")).toBe("2026-10-09T12:05:00.000Z");
  });

  it("mène aussi à la page Habitants quand tous sont partis, pour en nommer un autre", () => {
    render(<AucunExplorateurLibre total={3} prochainRetour={new Date("2026-10-10T22:30:00Z")} />);
    expect(textes()).toContain("11 octobre à 00:30");
    expect(lien().getAttribute("href")).toBe("/jeu/habitants");
  });

  it("sans heure de retour connue, dit seulement que tous sont partis", () => {
    render(<AucunExplorateurLibre total={2} prochainRetour={null} />);
    expect(textes()).toEqual(["Explorateurs", "Tous les explorateurs sont déjà partis", "Donner le Métier d'explorateur"]);
  });
});
