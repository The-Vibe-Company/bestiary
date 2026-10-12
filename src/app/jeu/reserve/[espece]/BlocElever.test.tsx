// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// L'action serveur d'un Élevage demandé (actions.test.ts, actions.db.test.ts) : ici, ce que le bloc en montre.
const actions = vi.hoisted(() => ({ elever: vi.fn<(avant: { refus: string | null }, formulaire: FormData) => Promise<{ refus: string | null }>>(async () => ({ refus: null })) }));
vi.mock("./actions", () => actions);

import { BlocElever } from "./BlocElever";

/** US-0822 : les Places de l'Habitat du Foyer, telles que la fiche les donne au bloc. */
const PLACES = { occupees: 21, total: 500 };

describe("le bloc « Élever » de la fiche d'une Espèce (US-0812)", () => {
  afterEach(() => {
    cleanup();
    actions.elever.mockReset();
  });

  /** Le bloc, sous son titre « Élever ». */
  const bloc = () => screen.getByRole("heading", { name: "Élever" }).closest("section")!;

  it("propose un bloc titré « Élever », que l'on peut viser d'un lien (#elever)", () => {
    render(<BlocElever especeId="poule" places={PLACES} />);
    expect(document.getElementById("elever")?.contains(bloc())).toBe(true);
  });

  it("y met le bouton « Élever » pour l'Espèce de la fiche, grisé tant que l'Élevage ne se lance pas encore (US-0815)", () => {
    render(<BlocElever especeId="poule" places={PLACES} />);
    const bouton = within(bloc()).getByRole("button", { name: "Élever" });
    expect((bouton as HTMLButtonElement).disabled).toBe(true);
    const formulaire = bouton.closest("form")!;
    expect(new FormData(formulaire).get("espece")).toBe("poule");
  });

  it("n'ajoute aucune phrase : le titre, les Places de l'Habitat du Foyer (US-0822) et le bouton", () => {
    render(<BlocElever especeId="poule" places={PLACES} />);
    expect(bloc().textContent).toBe("ÉleverPlaces : 21 / 500Élever");
  });

  it("montre le même compteur de Places que la page Bêtes, au-dessus du bouton (US-0822)", () => {
    render(<BlocElever especeId="poule" places={{ occupees: 620, total: 500 }} />);
    const compteur = within(bloc()).getByText("Places :", { exact: false });
    expect(compteur.textContent).toBe("Places : 620 / 500");
    expect(compteur.compareDocumentPosition(within(bloc()).getByRole("button", { name: "Élever" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("dit, juste sous le bouton, pourquoi le jeu refuse une demande arrivée par un autre chemin", async () => {
    actions.elever.mockResolvedValue({ refus: "Pas d'Élevage sans Couple réuni." });
    render(<BlocElever especeId="poule" places={PLACES} />);
    // Le bouton est grisé : la demande arrive autrement, le formulaire envoyé tel quel.
    fireEvent.submit(within(bloc()).getByRole("button", { name: "Élever" }).closest("form")!);
    const refus = await screen.findByRole("alert");
    expect(refus.textContent).toBe("Pas d'Élevage sans Couple réuni.");
    expect(within(bloc()).getByRole("button", { name: "Élever" }).getAttribute("aria-describedby")).toBe(refus.id);
    expect(actions.elever.mock.lastCall?.[1].get("espece")).toBe("poule");
  });
});
