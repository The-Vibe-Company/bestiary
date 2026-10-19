// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// L'action serveur d'un Élevage demandé (actions.test.ts, actions.db.test.ts) : ici, ce que le bloc en montre.
type Etat = { refus: string | null; lance?: { quantite: number; eleveur: string } };
const actions = vi.hoisted(() => ({ elever: vi.fn<(avant: Etat, formulaire: FormData) => Promise<Etat>>(async () => ({ refus: null })) }));
vi.mock("./actions", () => actions);
// US-0818 : la page relue après chaque naissance d'un Élevage en cours.
const routeur = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routeur }));

import { BlocElever } from "./BlocElever";

/** US-0822 : les Places de l'Habitat du Foyer, telles que la fiche les donne au bloc. */
const PLACES = { occupees: 21, total: 500 };
/**
 * US-0816 : les Stocks qui paient l'Élevage (`quantite` de Nourriture en tout), sans production ni Entretien : ils ne
 * bougent pas avec le temps.
 */
const stocks = (quantite: number) => [{ quantite: String(quantite), limite: "1e18", parHeure: "0", entretienParHeure: "0" }];
/** US-0813 : de quoi payer sept poules (840 chacune), pas une de plus : « Max » propose 7. */
const NOURRITURE = stocks(6_000);
/** US-0814 : ce que coûte et ce que dure l'Élevage d'une poule, Bête par Bête (840 Nourriture, 7 h 54), tel que la fiche le donne. */
const POULE_ELEVEE = { cout: 840, nourriture: "Viande ou Végétaux", dureeMinutes: 474 };
/** US-0814 : l'heure du jeu à l'ouverture de la fiche : midi à Paris. */
const MAINTENANT = new Date("2026-10-13T10:00:00Z");

describe("le bloc « Élever » de la fiche d'une Espèce (US-0812)", () => {
  afterEach(() => {
    cleanup();
    actions.elever.mockReset();
  });

  /** Le bloc, sous son titre « Élever ». */
  const bloc = () => screen.getByRole("heading", { name: "Élever" }).closest("section")!;

  it("propose un bloc titré « Élever », que l'on peut viser d'un lien (#elever)", () => {
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    expect(document.getElementById("elever")?.contains(bloc())).toBe(true);
  });

  it("y met le bouton « Élever » pour l'Espèce de la fiche, actif avec un éleveur libre et une quantité valable (US-0815)", () => {
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    const bouton = within(bloc()).getByRole("button", { name: "Élever" });
    expect((bouton as HTMLButtonElement).disabled).toBe(false);
    const formulaire = bouton.closest("form")!;
    expect(new FormData(formulaire).get("espece")).toBe("poule");
  });

  it("n'ajoute aucune phrase : le titre, les Places de l'Habitat du Foyer (US-0822), l'éleveur libre (US-0843), la quantité (US-0813), le coût et la durée (US-0814) et le bouton", () => {
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    expect(bloc().textContent).toBe("ÉleverPlaces : 21 / 500Éleveur : BruneQuantité−+MaxCoût840 Viande ou VégétauxDurée par Bête7 h 54Durée totale7 h 54Dernière Bête13 octobre à 19:54Élever");
  });

  it("montre le même compteur de Places que la page Bêtes, au-dessus du bouton (US-0822)", () => {
    render(<BlocElever especeId="poule" places={{ occupees: 620, total: 500 }} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    const compteur = within(bloc()).getByText("Places :", { exact: false });
    expect(compteur.textContent).toBe("Places : 620 / 500");
    expect(compteur.compareDocumentPosition(within(bloc()).getByRole("button", { name: "Élever" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("dit, juste sous le bouton, pourquoi le jeu refuse une demande arrivée par un autre chemin", async () => {
    actions.elever.mockResolvedValue({ refus: "Pas d'Élevage sans Couple réuni." });
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
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
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    expect(champ().value).toBe("1");
    expect(bouton("Une Bête de moins").textContent).toBe("−");
    expect(bouton("Une Bête de plus").textContent).toBe("+");
    expect(bouton("Max")).toBeTruthy();
    expect(new FormData(champ().form!).get("quantite")).toBe("1");
    expect(raison()).toBeNull();
  });

  it("« + » ajoute une Bête, « − » en ôte une, jamais sous 1", async () => {
    const u = userEvent.setup();
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
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
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    // La sortie de la quantité, à côté de la région de l'Élevage lancé (US-0815).
    const annonce = () => screen.getAllByRole("status").find((r) => r.tagName === "OUTPUT")!.textContent;
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
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    await u.clear(champ());
    await u.type(champ(), "1234567890");
    expect(champ().value).toBe("123456789");
    expect(raison()).toBeNull();
  });

  it("« Max » donne le plus grand nombre de Bêtes que les Stocks de Nourriture permettent de payer", async () => {
    const u = userEvent.setup();
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    await u.click(bouton("Max"));
    expect(champ().value).toBe("7");
  });

  it("ni « + » ni « Max » ne vont au-delà de la plus grande quantité qui se lit", async () => {
    const u = userEvent.setup();
    render(<BlocElever especeId="poule" places={PLACES} nourriture={stocks(5_000_000_000 * 840)} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    await u.click(bouton("Max"));
    expect(champ().value).toBe("999999999");
    expect(bouton("Une Bête de plus").disabled).toBe(true);
    expect(raison()).toBeNull();
  });

  it("« Max » reste grisé quand les Stocks ne paient pas une seule Bête", () => {
    render(<BlocElever especeId="poule" places={PLACES} nourriture={stocks(0)} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    expect(bouton("Max").disabled).toBe(true);
  });

  it("refuse une quantité nulle, négative ou non entière avec un message clair, lié au champ", async () => {
    const u = userEvent.setup();
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
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
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    const ligne = within(bloc()).getByText("Éleveur :", { exact: false });
    expect(ligne.textContent).toBe("Éleveur : Brune");
    expect(within(bloc()).queryByRole("link", { name: "Habitants" })).toBeNull();
    expect(boutonElever().getAttribute("aria-describedby")).toBeNull();
  });

  it("sans éleveur libre, grise « Élever » et dit pourquoi, avec un lien vers la page Habitants ; l'Élevage reste proposé", () => {
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur={null} elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    expect(bloc().textContent).toBe(
      "ÉleverPlaces : 21 / 500Aucun éleveur libre. HabitantsQuantité−+MaxCoût840 Viande ou VégétauxDurée par Bête7 h 54Durée totale7 h 54Dernière Bête13 octobre à 19:54Élever",
    );
    const lien = within(bloc()).getByRole("link", { name: "Habitants" });
    expect(lien.getAttribute("href")).toBe("/jeu/habitants");
    const raison = lien.closest("p")!;
    expect(boutonElever().disabled).toBe(true);
    expect(boutonElever().getAttribute("aria-describedby")).toBe(raison.id);
    expect(raison.id).not.toBe("");
  });

  it("lie aussi le refus du serveur au bouton, à côté de la raison", async () => {
    actions.elever.mockResolvedValue({ refus: "Aucun éleveur libre." });
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur={null} elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    fireEvent.submit(boutonElever().closest("form")!);
    const refus = await screen.findByRole("alert");
    const raison = within(bloc()).getByRole("link", { name: "Habitants" }).closest("p")!;
    expect(boutonElever().getAttribute("aria-describedby")?.split(" ")).toEqual([raison.id, refus.id]);
  });
});

describe("voir le coût et la durée d'un Élevage (US-0814)", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    actions.elever.mockReset();
  });

  const bloc = () => screen.getByRole("heading", { name: "Élever" }).closest("section")!;
  /** La valeur d'une ligne du coût et de la durée, par son libellé. */
  const valeur = (libelle: string) => within(bloc()).getByText(libelle, { selector: "dt" }).nextElementSibling!.textContent;
  const bouton = (nom: string) => screen.getByRole("button", { name: nom }) as HTMLButtonElement;
  const champ = () => screen.getByLabelText("Quantité") as HTMLInputElement;

  it("affiche le coût total en Nourriture, la durée d'une Bête, la durée totale et l'heure où naîtra la dernière Bête, au-dessus du bouton", () => {
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    expect(valeur("Coût")).toBe("840 Viande ou Végétaux");
    expect(valeur("Durée par Bête")).toBe("7 h 54");
    expect(valeur("Durée totale")).toBe("7 h 54");
    // Midi à Paris, plus 7 h 54.
    expect(valeur("Dernière Bête")).toBe("13 octobre à 19:54");
    const lignes = within(bloc()).getByText("Coût", { selector: "dt" }).closest("dl")!;
    expect(lignes.compareDocumentPosition(within(bloc()).getByRole("button", { name: "Élever" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("met à jour le coût et la durée à chaque changement de quantité : « + », « − », « Max », ou la quantité écrite", async () => {
    const u = userEvent.setup();
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    await u.click(bouton("Une Bête de plus"));
    expect(valeur("Coût")).toBe("1\u00a0680 Viande ou Végétaux");
    expect(valeur("Durée totale")).toBe("15 h 48");
    expect(valeur("Dernière Bête")).toBe("14 octobre à 03:48");
    await u.click(bouton("Max"));
    expect(valeur("Coût")).toBe("5\u00a0880 Viande ou Végétaux");
    expect(valeur("Durée totale")).toBe("2 j 7 h");
    await u.clear(champ());
    await u.type(champ(), "3");
    expect(valeur("Coût")).toBe("2\u00a0520 Viande ou Végétaux");
    await u.click(bouton("Une Bête de moins"));
    expect(valeur("Coût")).toBe("1\u00a0680 Viande ou Végétaux");
    // La durée d'une Bête, elle, ne bouge pas.
    expect(valeur("Durée par Bête")).toBe("7 h 54");
  });

  it("ne chiffre rien d'une quantité refusée", async () => {
    const u = userEvent.setup();
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    await u.clear(champ());
    await u.type(champ(), "0");
    expect([valeur("Coût"), valeur("Durée totale"), valeur("Dernière Bête")]).toEqual(["—", "—", "—"]);
    expect(valeur("Durée par Bête")).toBe("7 h 54");
  });

  it("dit le coût d'une Bête fois la quantité, tel qu'il sera payé, dans la Nourriture du régime", async () => {
    const u = userEvent.setup();
    const souris = { cout: 29, nourriture: "Viande ou Végétaux", dureeMinutes: 15 };
    render(<BlocElever especeId="souris" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={souris} maintenant={MAINTENANT} />);
    expect(valeur("Coût")).toBe("29 Viande ou Végétaux");
    await u.clear(champ());
    await u.type(champ(), "10");
    expect(valeur("Coût")).toBe("290 Viande ou Végétaux");
    expect(valeur("Durée totale")).toBe("2 h 30");
    cleanup();
    render(<BlocElever especeId="chasseur" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={{ cout: 84, nourriture: "Viande", dureeMinutes: 30 }} maintenant={MAINTENANT} />);
    expect(valeur("Coût")).toBe("84 Viande");
  });

  it("donne l'année de la dernière Bête quand elle n'est pas celle d'aujourd'hui", async () => {
    const u = userEvent.setup();
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    await u.clear(champ());
    // 1 200 poules de 7 h 54 : 395 jours, jusqu'au 12 novembre de l'an prochain (midi à Paris, à l'heure d'hiver, 11 h).
    await u.type(champ(), "1200");
    expect(valeur("Dernière Bête")).toBe("12 novembre 2027 à 11:00");
    expect(valeur("Durée totale")).toBe("395 j");
  });

  it("ne se trompe pas d'heure pour une quantité immense : la dernière Bête, hors du calendrier, n'est pas datée", async () => {
    const u = userEvent.setup();
    render(<BlocElever especeId="poule" places={PLACES} nourriture={stocks(5_000_000_000 * 840)} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    await u.click(bouton("Max"));
    expect(valeur("Dernière Bête")).toBe("—");
    expect(valeur("Coût")).toBe("839\u00a0999\u00a0999\u00a0160 Viande ou Végétaux");
  });

  it("fait avancer l'heure de la dernière Bête avec l'heure du jeu, à son rythme", async () => {
    vi.useFakeTimers();
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} vitesse={60} />);
    expect(valeur("Dernière Bête")).toBe("13 octobre à 19:54");
    // Une minute réelle, une heure de jeu.
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(valeur("Dernière Bête")).toBe("13 octobre à 20:54");
  });
});

describe("lancer l'Élevage (US-0815)", () => {
  afterEach(() => {
    cleanup();
    actions.elever.mockReset();
  });

  const bloc = () => screen.getByRole("heading", { name: "Élever" }).closest("section")!;
  const boutonElever = () => within(bloc()).getByRole("button", { name: "Élever" }) as HTMLButtonElement;
  const champ = () => screen.getByLabelText("Quantité") as HTMLInputElement;

  it("envoie l'Espèce et la quantité choisie, et dit l'Élevage lancé et son éleveur", async () => {
    const u = userEvent.setup();
    actions.elever.mockResolvedValue({ refus: null, lance: { quantite: 3, eleveur: "Brune" } });
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    await u.clear(champ());
    await u.type(champ(), "3");
    await u.click(boutonElever());
    const dit = await within(bloc()).findByText("Élevage lancé : 3 Bêtes, confié à Brune.");
    // Dit aux lecteurs d'écran dans une région toujours là ; la page relue montre l'Élevage en cours (US-0818).
    expect(dit.getAttribute("role")).toBe("status");
    const envoye = actions.elever.mock.lastCall![1];
    expect([envoye.get("espece"), envoye.get("quantite")]).toEqual(["poule", "3"]);
  });

  it("garde la région de l'Élevage lancé dans le bloc, vide tant que rien n'est lancé", () => {
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    const regions = within(bloc()).getAllByRole("status").filter((r) => r.tagName === "P");
    expect(regions.map((r) => r.textContent)).toEqual([""]);
  });

  it("grise « Élever » d'une quantité refusée, et pendant l'envoi : un double clic n'envoie qu'une demande", async () => {
    const u = userEvent.setup();
    let finir: (etat: { refus: string | null }) => void = () => {};
    actions.elever.mockImplementation(() => new Promise((f) => (finir = f)));
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    await u.clear(champ());
    await u.type(champ(), "0");
    expect(boutonElever().disabled).toBe(true);
    await u.clear(champ());
    await u.type(champ(), "2");
    expect(boutonElever().disabled).toBe(false);
    await u.dblClick(boutonElever());
    expect(boutonElever().disabled).toBe(true);
    expect(actions.elever).toHaveBeenCalledOnce();
    await act(async () => finir({ refus: null }));
    expect(boutonElever().disabled).toBe(false);
  });
});

describe("refuser un Élevage faute de Nourriture (US-0816)", () => {
  afterEach(() => {
    cleanup();
    actions.elever.mockReset();
  });

  const bloc = () => screen.getByRole("heading", { name: "Élever" }).closest("section")!;
  const boutonElever = () => within(bloc()).getByRole("button", { name: "Élever" }) as HTMLButtonElement;
  const bouton = (nom: string) => screen.getByRole("button", { name: nom }) as HTMLButtonElement;
  /** Ce qui manque, dit au-dessus du bouton (ni le refus du serveur, une alerte, ni son annonce, dans la sortie de la quantité). */
  const manque = () => within(bloc()).queryAllByText(/^Il manque/).find((p) => p.tagName === "P" && p.getAttribute("role") !== "alert") ?? null;

  it("grise « Élever » tant que la Nourriture manque pour la quantité choisie, et dit ce qui manque", async () => {
    const u = userEvent.setup();
    render(<BlocElever especeId="poule" places={PLACES} nourriture={stocks(1000)} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    // Une poule (840) se paie avec 1 000.
    expect(boutonElever().disabled).toBe(false);
    expect(manque()).toBeNull();
    await u.click(bouton("Une Bête de plus"));
    // Deux (1 680) ne se paient pas : il en manque 680.
    expect(boutonElever().disabled).toBe(true);
    expect(manque()?.textContent).toBe("Il manque 680 Viande ou Végétaux.");
    expect(boutonElever().getAttribute("aria-describedby")).toBe(manque()!.id);
    await u.click(bouton("Une Bête de moins"));
    expect(boutonElever().disabled).toBe(false);
    expect(manque()).toBeNull();
  });

  it("compte une fraction de Nourriture qui manque comme une unité entière", () => {
    render(<BlocElever especeId="poule" places={PLACES} nourriture={stocks(839.5)} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    expect(manque()?.textContent).toBe("Il manque 1 Viande ou Végétaux.");
    expect(boutonElever().disabled).toBe(true);
  });

  it("ne redit pas aux lecteurs d'écran un refus faute de Nourriture une fois la quantité changée, même en y revenant", async () => {
    const u = userEvent.setup();
    actions.elever.mockResolvedValue({ refus: "Il manque 680 Viande ou Végétaux." });
    render(<BlocElever especeId="poule" places={PLACES} nourriture={stocks(1_000)} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    await u.click(bouton("Une Bête de plus"));
    fireEvent.submit(boutonElever().closest("form")!);
    const sortie = () => screen.getAllByRole("status").find((r) => r.tagName === "OUTPUT")!.textContent;
    await vi.waitFor(() => expect(sortie()).toBe("Il manque 680 Viande ou Végétaux."));
    await u.click(bouton("Une Bête de plus"));
    await u.click(bouton("Une Bête de moins"));
    expect(sortie()).toBe("Quantité : 2");
  });

  it("faute de Nourriture au clic (les Stocks ont baissé), le dit à l'instant au-dessus du bouton, et aux lecteurs d'écran à l'arrivée du refus", async () => {
    actions.elever.mockResolvedValue({ refus: "Il manque 740 Viande ou Végétaux." });
    render(<BlocElever especeId="poule" places={PLACES} nourriture={stocks(100)} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    fireEvent.submit(boutonElever().closest("form")!);
    const sortie = () => screen.getAllByRole("status").find((r) => r.tagName === "OUTPUT")!.textContent;
    await vi.waitFor(() => expect(sortie()).toBe("Il manque 740 Viande ou Végétaux."));
    // Une seule fois à l'écran : la ligne de ce qui manque, à jour ; pas d'alerte en plus.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(manque()?.textContent).toBe("Il manque 740 Viande ou Végétaux.");
    expect(boutonElever().getAttribute("aria-describedby")).toBe(manque()!.id);
  });

  it("dit toutes les raisons au bouton : l'éleveur qui manque, la Nourriture qui manque, puis le refus du serveur", async () => {
    actions.elever.mockResolvedValue({ refus: "Aucun éleveur libre." });
    render(<BlocElever especeId="poule" places={PLACES} nourriture={stocks(100)} eleveur={null} elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    fireEvent.submit(boutonElever().closest("form")!);
    const refus = await screen.findByRole("alert");
    const raison = within(bloc()).getByRole("link", { name: "Habitants" }).closest("p")!;
    expect(boutonElever().getAttribute("aria-describedby")?.split(" ")).toEqual([raison.id, manque()!.id, refus.id]);
  });

  it("laisse « Élever » actif quand la Nourriture paie tout juste la quantité choisie", () => {
    render(<BlocElever especeId="poule" places={PLACES} nourriture={stocks(840)} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    expect(boutonElever().disabled).toBe(false);
    expect(manque()).toBeNull();
    cleanup();
    // Un millionième de moins : il manque 1.
    render(<BlocElever especeId="poule" places={PLACES} nourriture={stocks(839.999999)} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    expect(manque()?.textContent).toBe("Il manque 1 Viande ou Végétaux.");
  });

  it("fait monter les Stocks comme la barre du haut, au rythme du jeu : « Élever » s'active dès qu'ils suffisent, et « Max » suit", async () => {
    vi.useFakeTimers();
    try {
      // 800 de Végétaux qui montent de 100 par heure, sans Entretien : la poule (840) se paie 24 minutes de jeu plus tard.
      const montants = [{ quantite: "800", limite: "1000", parHeure: "100", entretienParHeure: "0" }];
      render(<BlocElever especeId="poule" places={PLACES} nourriture={montants} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} vitesse={60} />);
      expect(manque()?.textContent).toBe("Il manque 40 Viande ou Végétaux.");
      expect(boutonElever().disabled).toBe(true);
      expect(bouton("Max").disabled).toBe(true);
      // 30 secondes réelles, 30 minutes de jeu : 850.
      await act(async () => vi.advanceTimersByTime(30_000));
      expect(manque()).toBeNull();
      expect(boutonElever().disabled).toBe(false);
      expect(bouton("Max").disabled).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ne garde le refus du serveur que pour sa demande : la quantité changée, ou la demande renvoyée, il s'efface", async () => {
    const u = userEvent.setup();
    let finir: (etat: { refus: string | null }) => void = () => {};
    actions.elever.mockResolvedValueOnce({ refus: "Aucun éleveur libre." });
    render(<BlocElever especeId="poule" places={PLACES} nourriture={stocks(10_000)} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    await u.click(bouton("Une Bête de plus"));
    await u.click(boutonElever());
    expect((await screen.findByRole("alert")).textContent).toBe("Aucun éleveur libre.");
    // Une autre quantité : ce refus ne vaut plus.
    await u.click(bouton("Une Bête de plus"));
    expect(screen.queryByRole("alert")).toBeNull();
    // Même revenue à la quantité refusée : la réponse valait pour la demande d'avant.
    await u.click(bouton("Une Bête de moins"));
    expect(screen.queryByRole("alert")).toBeNull();
    // Renvoyée et refusée de nouveau, le refus se dit ; renvoyée encore, il s'efface pendant l'envoi.
    actions.elever.mockResolvedValueOnce({ refus: "Aucun éleveur libre." });
    await u.click(boutonElever());
    expect((await screen.findByRole("alert")).textContent).toBe("Aucun éleveur libre.");
    actions.elever.mockImplementationOnce(() => new Promise((f) => (finir = f)));
    await u.click(boutonElever());
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => finir({ refus: null }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ne compte pas une poussière de calcul pour de la Nourriture qui manque", () => {
    // 839,9999999999999 : 840 au millionième près, de quoi payer une poule.
    render(<BlocElever especeId="poule" places={PLACES} nourriture={stocks(839.9999999999999)} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    expect(manque()).toBeNull();
    expect(boutonElever().disabled).toBe(false);
  });
});

describe("suivre l'Élevage en cours (US-0818)", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    actions.elever.mockReset();
    routeur.refresh.mockReset();
  });

  const MINUTE = 60_000;
  /**
   * Trois poules confiées à Hael, lancées 500 minutes avant l'ouverture de la fiche (une poule toutes les 474 minutes) :
   * la première est née, la deuxième naît 448 minutes après l'ouverture (7 h 28), la dernière 922 minutes après, le
   * 14 octobre à 03:22 à Paris.
   */
  const POULES = { especeId: "poule", espece: "Poule", illustration: null, eleveur: "Hael", quantite: 3, lanceLe: new Date(MAINTENANT.getTime() - 500 * MINUTE), dureeMinutes: 474 };
  const bloc = () => screen.getByRole("heading", { name: "Élever" }).closest("section")!;
  /** L'Élevage en cours, sous son titre. */
  const suivi = () => screen.getByRole("region", { name: "Élevage en cours" });
  /** La valeur de la ligne `libelle` de l'Élevage en cours. */
  const valeur = (libelle: string) => within(suivi()).getByText(libelle).nextElementSibling?.textContent;

  it("montre l'Élevage en cours de l'Espèce à la place de la quantité et du bouton : son éleveur, les Bêtes nées sur la quantité, le temps avant la prochaine et l'heure de la dernière", () => {
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} elevageEnCours={POULES} maintenant={MAINTENANT} />);
    expect(bloc().textContent).toBe("ÉleverPlaces : 21 / 500Élevage en coursÉleveurHaelBêtes nées1 / 3Prochaine Bêtedans 7 h 28Dernière Bête14 octobre à 03:22");
    expect(within(bloc()).queryByRole("button")).toBeNull();
    expect(within(bloc()).queryByLabelText("Quantité")).toBeNull();
  });

  it("ne dit plus « Aucun éleveur libre. » quand l'éleveur est pris par l'Élevage en cours", () => {
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur={null} elevage={POULE_ELEVEE} elevageEnCours={POULES} maintenant={MAINTENANT} />);
    expect(bloc().textContent).not.toContain("Aucun éleveur libre.");
    expect(valeur("Éleveur")).toBe("Hael");
  });

  it("dit « Aucun » quand l'éleveur de l'Élevage n'est plus là", () => {
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur={null} elevage={POULE_ELEVEE} elevageEnCours={{ ...POULES, eleveur: null }} maintenant={MAINTENANT} />);
    expect(valeur("Éleveur")).toBe("Aucun");
  });

  it("fait avancer le décompte et les naissances sans recharger, au rythme du jeu, et dit la même chose une fois la page relue", async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur={null} elevage={POULE_ELEVEE} elevageEnCours={POULES} maintenant={MAINTENANT} vitesse={60} />,
    );
    // Une minute réelle, une heure de jeu.
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(valeur("Prochaine Bête")).toBe("dans 6 h 28");
    expect(valeur("Bêtes nées")).toBe("1 / 3");
    // La deuxième poule naît : la suivante est attendue dans 7 h 54.
    await act(async () => vi.advanceTimersByTime(388_000));
    expect(valeur("Bêtes nées")).toBe("2 / 3");
    expect(valeur("Prochaine Bête")).toBe("dans 7 h 54");
    expect(valeur("Dernière Bête")).toBe("14 octobre à 03:22");
    // La page relue à la même heure du jeu, ou ouverte ailleurs : le même Élevage, au même point.
    rerender(
      <BlocElever
        especeId="poule"
        places={PLACES}
        nourriture={NOURRITURE}
        eleveur={null}
        elevage={POULE_ELEVEE}
        elevageEnCours={POULES}
        maintenant={new Date(MAINTENANT.getTime() + 448 * MINUTE)}
        vitesse={60}
      />,
    );
    expect([valeur("Bêtes nées"), valeur("Prochaine Bête"), valeur("Dernière Bête")]).toEqual(["2 / 3", "dans 7 h 54", "14 octobre à 03:22"]);
  });

  it("une fois la dernière née, n'attend plus de Bête, le temps que la page relue rende le bloc", async () => {
    vi.useFakeTimers();
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur={null} elevage={POULE_ELEVEE} elevageEnCours={POULES} maintenant={MAINTENANT} vitesse={60} />);
    await act(async () => vi.advanceTimersByTime(922_000));
    expect([valeur("Bêtes nées"), valeur("Prochaine Bête")]).toEqual(["3 / 3", "—"]);
  });

  it("relit la page une seconde réelle après chaque naissance, pour l'effectif, les Places, et l'éleveur libre à la fin", async () => {
    vi.useFakeTimers();
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur={null} elevage={POULE_ELEVEE} elevageEnCours={POULES} maintenant={MAINTENANT} vitesse={60} />);
    // La deuxième poule naît 448 minutes de jeu après l'ouverture : 448 secondes réelles.
    await act(async () => vi.advanceTimersByTime(448_999));
    expect(routeur.refresh).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(routeur.refresh).toHaveBeenCalledOnce();
  });

  it("ne relit rien sans Élevage en cours", async () => {
    vi.useFakeTimers();
    render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Brune" elevage={POULE_ELEVEE} maintenant={MAINTENANT} vitesse={60} />);
    await act(async () => vi.advanceTimersByTime(24 * 60 * MINUTE));
    expect(routeur.refresh).not.toHaveBeenCalled();
  });

  /** Le bloc tel que la page le donne, avec ou sans Élevage en cours (`enCours`) : la page relue n'a que cela de changé. */
  const bloc0 = (enCours: typeof POULES | null, eleveur: string | null = "Hael") => (
    <BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur={eleveur} elevage={POULE_ELEVEE} elevageEnCours={enCours} maintenant={MAINTENANT} />
  );
  /** La région du lancement, pour les lecteurs d'écran. */
  const dit = () => within(bloc()).getAllByRole("status").find((r) => r.tagName === "P")?.textContent;

  it("un refus suivi de l'Élevage lancé ailleurs : la main va au suivi, et le refus ne revient pas avec le formulaire, à la fin", async () => {
    const u = userEvent.setup();
    actions.elever.mockResolvedValue({ refus: "Un Élevage de cette Espèce est déjà en cours." });
    const { rerender } = render(bloc0(null));
    await u.click(within(bloc()).getByRole("button", { name: "Élever" }));
    // La page relue par l'action : l'Élevage lancé depuis un autre appareil est en cours.
    rerender(bloc0({ ...POULES, lanceLe: MAINTENANT }, null));
    expect(document.activeElement).toBe(suivi());
    expect(within(bloc()).queryByRole("alert")).toBeNull();
    // Fini, la page relue rend le formulaire, sans le refus d'avant ni rien d'annoncé.
    rerender(bloc0(null));
    expect(within(bloc()).getByRole("button", { name: "Élever" })).toBeTruthy();
    expect(within(bloc()).queryByRole("alert")).toBeNull();
    expect(dit()).toBe("");
  });

  it("à la fin de l'Élevage lancé, le formulaire revient sans redire « Élevage lancé », et un Élevage lancé ailleurs ensuite n'emporte pas la main", async () => {
    const u = userEvent.setup();
    actions.elever.mockResolvedValue({ refus: null, lance: { quantite: 3, eleveur: "Hael" } });
    const { rerender } = render(bloc0(null));
    await u.click(within(bloc()).getByRole("button", { name: "Élever" }));
    rerender(bloc0({ ...POULES, lanceLe: MAINTENANT }, null));
    expect(dit()).toBe("Élevage lancé : 3 Bêtes, confié à Hael.");
    rerender(bloc0(null));
    expect(dit()).toBe("");
    // Le joueur lit autre chose ; un autre appareil lance un Élevage, que la page relue montre.
    const ailleurs = document.createElement("button");
    document.body.append(ailleurs);
    ailleurs.focus();
    rerender(bloc0({ ...POULES, lanceLe: MAINTENANT }, null));
    expect(document.activeElement).toBe(ailleurs);
    expect(dit()).toBe("");
    ailleurs.remove();
  });

  it("n'emporte pas la main vers un Élevage lancé ailleurs après un refus d'ici resté sous le formulaire", async () => {
    const u = userEvent.setup();
    actions.elever.mockResolvedValue({ refus: "Pas d'Élevage sans Couple réuni." });
    const { rerender } = render(bloc0(null));
    await u.click(within(bloc()).getByRole("button", { name: "Élever" }));
    await within(bloc()).findByRole("alert");
    // Plus tard, le joueur est ailleurs ; un autre appareil lance l'Élevage, que la page relue montre.
    const ailleurs = document.createElement("button");
    document.body.append(ailleurs);
    ailleurs.focus();
    rerender(bloc0({ ...POULES, lanceLe: MAINTENANT }, null));
    expect(document.activeElement).toBe(ailleurs);
    ailleurs.remove();
  });

  it("n'emporte pas la main vers un Élevage lancé ailleurs, quand rien n'a été demandé d'ici", () => {
    const { rerender } = render(bloc0(null));
    const ailleurs = document.createElement("button");
    document.body.append(ailleurs);
    ailleurs.focus();
    rerender(bloc0({ ...POULES, lanceLe: MAINTENANT }, null));
    expect(document.activeElement).toBe(ailleurs);
    ailleurs.remove();
  });

  it("une fois l'Élevage lancé, la page relue le montre en cours, la main y va, et les lecteurs d'écran l'entendent", async () => {
    const u = userEvent.setup();
    actions.elever.mockResolvedValue({ refus: null, lance: { quantite: 3, eleveur: "Hael" } });
    const { rerender } = render(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur="Hael" elevage={POULE_ELEVEE} maintenant={MAINTENANT} />);
    await u.click(within(bloc()).getByRole("button", { name: "Élever" }));
    await within(bloc()).findByText("Élevage lancé : 3 Bêtes, confié à Hael.");
    // La page relue par l'action : Hael n'est plus libre, l'Élevage est en cours.
    rerender(<BlocElever especeId="poule" places={PLACES} nourriture={NOURRITURE} eleveur={null} elevage={POULE_ELEVEE} elevageEnCours={{ ...POULES, lanceLe: MAINTENANT }} maintenant={MAINTENANT} />);
    expect(document.activeElement).toBe(suivi());
    expect(within(bloc()).getAllByRole("status").find((r) => r.tagName === "P")?.textContent).toBe("Élevage lancé : 3 Bêtes, confié à Hael.");
    expect(valeur("Bêtes nées")).toBe("0 / 3");
  });
});
