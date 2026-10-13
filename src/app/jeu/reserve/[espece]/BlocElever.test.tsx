// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// L'action serveur d'un Élevage demandé (actions.test.ts, actions.db.test.ts) : ici, ce que le bloc en montre.
const actions = vi.hoisted(() => ({ elever: vi.fn<(avant: { refus: string | null }, formulaire: FormData) => Promise<{ refus: string | null }>>(async () => ({ refus: null })) }));
vi.mock("./actions", () => actions);

import { BlocElever } from "./BlocElever";

/** US-0822 : les Places de l'Habitat du Foyer, telles que la fiche les donne au bloc. */
const PLACES = { occupees: 21, total: 500 };
/** US-0813 : les Bêtes que les Stocks permettent de payer, ce que « Max » propose. */
const MAX = 7;

describe("le bloc « Élever » de la fiche d'une Espèce (US-0812)", () => {
  afterEach(() => {
    cleanup();
    actions.elever.mockReset();
  });

  /** Le bloc, sous son titre « Élever ». */
  const bloc = () => screen.getByRole("heading", { name: "Élever" }).closest("section")!;

  it("propose un bloc titré « Élever », que l'on peut viser d'un lien (#elever)", () => {
    render(<BlocElever especeId="poule" places={PLACES} max={MAX} eleveur="Brune" />);
    expect(document.getElementById("elever")?.contains(bloc())).toBe(true);
  });

  it("y met le bouton « Élever » pour l'Espèce de la fiche, grisé tant que l'Élevage ne se lance pas encore (US-0815)", () => {
    render(<BlocElever especeId="poule" places={PLACES} max={MAX} eleveur="Brune" />);
    const bouton = within(bloc()).getByRole("button", { name: "Élever" });
    expect((bouton as HTMLButtonElement).disabled).toBe(true);
    const formulaire = bouton.closest("form")!;
    expect(new FormData(formulaire).get("espece")).toBe("poule");
  });

  it("n'ajoute aucune phrase : le titre, les Places de l'Habitat du Foyer (US-0822), l'éleveur libre (US-0843), la quantité (US-0813) et le bouton", () => {
    render(<BlocElever especeId="poule" places={PLACES} max={MAX} eleveur="Brune" />);
    expect(bloc().textContent).toBe("ÉleverPlaces : 21 / 500Éleveur : BruneQuantité−+MaxÉlever");
  });

  it("montre le même compteur de Places que la page Bêtes, au-dessus du bouton (US-0822)", () => {
    render(<BlocElever especeId="poule" places={{ occupees: 620, total: 500 }} max={MAX} eleveur="Brune" />);
    const compteur = within(bloc()).getByText("Places :", { exact: false });
    expect(compteur.textContent).toBe("Places : 620 / 500");
    expect(compteur.compareDocumentPosition(within(bloc()).getByRole("button", { name: "Élever" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("dit, juste sous le bouton, pourquoi le jeu refuse une demande arrivée par un autre chemin", async () => {
    actions.elever.mockResolvedValue({ refus: "Pas d'Élevage sans Couple réuni." });
    render(<BlocElever especeId="poule" places={PLACES} max={MAX} eleveur="Brune" />);
    // Le bouton est grisé : la demande arrive autrement, le formulaire envoyé tel quel.
    fireEvent.submit(within(bloc()).getByRole("button", { name: "Élever" }).closest("form")!);
    const refus = await screen.findByRole("alert");
    expect(refus.textContent).toBe("Pas d'Élevage sans Couple réuni.");
    expect(within(bloc()).getByRole("button", { name: "Élever" }).getAttribute("aria-describedby")).toBe(refus.id);
    expect(actions.elever.mock.lastCall?.[1].get("espece")).toBe("poule");
  });
});

describe("choisir combien de Bêtes élever (US-0813)", () => {
  afterEach(() => {
    cleanup();
    actions.elever.mockReset();
  });

  const champ = () => screen.getByLabelText("Quantité") as HTMLInputElement;
  const bouton = (nom: string | RegExp) => screen.getByRole("button", { name: nom }) as HTMLButtonElement;
  const raison = () => screen.queryByRole("alert");

  it("propose un champ de quantité, à 1 d'abord, des boutons « − » et « + », et « Max » ; la quantité part avec la demande", () => {
    render(<BlocElever especeId="poule" places={PLACES} max={MAX} eleveur="Brune" />);
    expect(champ().value).toBe("1");
    expect(bouton("Une Bête de moins").textContent).toBe("−");
    expect(bouton("Une Bête de plus").textContent).toBe("+");
    expect(bouton("Max")).toBeTruthy();
    expect(new FormData(champ().form!).get("quantite")).toBe("1");
    expect(raison()).toBeNull();
  });

  it("« + » ajoute une Bête, « − » en ôte une, jamais sous 1", async () => {
    const u = userEvent.setup();
    render(<BlocElever especeId="poule" places={PLACES} max={MAX} eleveur="Brune" />);
    expect(bouton("Une Bête de moins").disabled).toBe(true);
    await u.click(bouton("Une Bête de plus"));
    await u.click(bouton("Une Bête de plus"));
    expect(champ().value).toBe("3");
    await u.click(bouton("Une Bête de moins"));
    expect(champ().value).toBe("2");
    await u.click(bouton("Une Bête de moins"));
    expect(champ().value).toBe("1");
    expect(bouton("Une Bête de moins").disabled).toBe(true);
  });

  it("dit aux lecteurs d'écran la quantité que « − », « + » ou « Max » donnent, la main restant sur le bouton ; rien quand on l'écrit", async () => {
    const u = userEvent.setup();
    render(<BlocElever especeId="poule" places={PLACES} max={MAX} eleveur="Brune" />);
    const annonce = () => screen.getByRole("status").textContent;
    expect(annonce()).toBe("");
    await u.click(bouton("Une Bête de plus"));
    expect(annonce()).toBe("Quantité : 2");
    await u.click(bouton("Max"));
    expect(annonce()).toBe("Quantité : 7");
    await u.type(champ(), "0");
    expect(annonce()).toBe("");
  });

  it("ne prend pas plus de neuf chiffres, la plus grande quantité qui se lit", async () => {
    const u = userEvent.setup();
    render(<BlocElever especeId="poule" places={PLACES} max={MAX} eleveur="Brune" />);
    await u.clear(champ());
    await u.type(champ(), "1234567890");
    expect(champ().value).toBe("123456789");
    expect(raison()).toBeNull();
  });

  it("« Max » donne le plus grand nombre de Bêtes que les Stocks de Nourriture permettent de payer", async () => {
    const u = userEvent.setup();
    render(<BlocElever especeId="poule" places={PLACES} max={MAX} eleveur="Brune" />);
    await u.click(bouton("Max"));
    expect(champ().value).toBe("7");
  });

  it("ni « + » ni « Max » ne vont au-delà de la plus grande quantité qui se lit", async () => {
    const u = userEvent.setup();
    render(<BlocElever especeId="poule" places={PLACES} max={5_000_000_000} eleveur="Brune" />);
    await u.click(bouton("Max"));
    expect(champ().value).toBe("999999999");
    expect(bouton("Une Bête de plus").disabled).toBe(true);
    expect(raison()).toBeNull();
  });

  it("« Max » reste grisé quand les Stocks ne paient pas une seule Bête", () => {
    render(<BlocElever especeId="poule" places={PLACES} max={0} eleveur="Brune" />);
    expect(bouton("Max").disabled).toBe(true);
  });

  it("refuse une quantité nulle, négative ou non entière avec un message clair, lié au champ", async () => {
    const u = userEvent.setup();
    render(<BlocElever especeId="poule" places={PLACES} max={MAX} eleveur="Brune" />);
    for (const texte of ["0", "-2", "2,5", "deux"]) {
      await u.clear(champ());
      await u.type(champ(), texte);
      expect(raison()?.textContent).toBe("La quantité doit être un nombre entier, d'au moins 1.");
      expect(champ().getAttribute("aria-invalid")).toBe("true");
      expect(champ().getAttribute("aria-describedby")).toBe(raison()?.id);
    }
    // Corrigée, le message s'en va.
    await u.clear(champ());
    await u.type(champ(), "4");
    expect(raison()).toBeNull();
    expect(champ().getAttribute("aria-invalid")).toBeNull();
    // Vidé, le champ ne gronde pas pendant qu'on le récrit, mais le dit quand on le quitte.
    await u.clear(champ());
    expect(raison()).toBeNull();
    await u.tab();
    expect(raison()?.textContent).toBe("La quantité doit être un nombre entier, d'au moins 1.");
    // « + » repart d'une quantité valable.
    await u.clear(champ());
    await u.type(champ(), "0");
    await u.click(bouton("Une Bête de plus"));
    expect(champ().value).toBe("1");
  });
});

describe("un éleveur libre pour lancer l'Élevage (US-0843)", () => {
  afterEach(() => {
    cleanup();
    actions.elever.mockReset();
  });

  const bloc = () => screen.getByRole("heading", { name: "Élever" }).closest("section")!;
  const boutonElever = () => within(bloc()).getByRole("button", { name: "Élever" }) as HTMLButtonElement;

  it("dit quel éleveur libre s'en occupera, sous les Places", () => {
    render(<BlocElever especeId="poule" places={PLACES} max={MAX} eleveur="Brune" />);
    const ligne = within(bloc()).getByText("Éleveur :", { exact: false });
    expect(ligne.textContent).toBe("Éleveur : Brune");
    expect(within(bloc()).queryByRole("link", { name: "Habitants" })).toBeNull();
    expect(boutonElever().getAttribute("aria-describedby")).toBeNull();
  });

  it("sans éleveur libre, grise « Élever » et dit pourquoi, avec un lien vers la page Habitants ; l'Élevage reste proposé", () => {
    render(<BlocElever especeId="poule" places={PLACES} max={MAX} eleveur={null} />);
    expect(bloc().textContent).toBe("ÉleverPlaces : 21 / 500Aucun éleveur libre. HabitantsQuantité−+MaxÉlever");
    const lien = within(bloc()).getByRole("link", { name: "Habitants" });
    expect(lien.getAttribute("href")).toBe("/jeu/habitants");
    const raison = lien.closest("p")!;
    expect(boutonElever().disabled).toBe(true);
    expect(boutonElever().getAttribute("aria-describedby")).toBe(raison.id);
    expect(raison.id).not.toBe("");
  });

  it("lie aussi le refus du serveur au bouton, à côté de la raison", async () => {
    actions.elever.mockResolvedValue({ refus: "Aucun éleveur libre." });
    render(<BlocElever especeId="poule" places={PLACES} max={MAX} eleveur={null} />);
    fireEvent.submit(boutonElever().closest("form")!);
    const refus = await screen.findByRole("alert");
    const raison = within(bloc()).getByRole("link", { name: "Habitants" }).closest("p")!;
    expect(boutonElever().getAttribute("aria-describedby")?.split(" ")).toEqual([raison.id, refus.id]);
  });
});

