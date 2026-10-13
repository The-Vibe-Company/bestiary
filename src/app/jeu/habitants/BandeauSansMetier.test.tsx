// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

/** L'action serveur, tenue en suspens jusqu'à ce que le test la laisse finir. */
const actions = vi.hoisted(() => {
  const enCours: Array<() => void> = [];
  return {
    enCours,
    donnerUnMetier: vi.fn(() => new Promise<void>((finir) => enCours.push(finir))),
    retirerLeMetier: vi.fn(() => new Promise<void>((finir) => enCours.push(finir))),
    renvoyerUnHabitant: vi.fn(() => new Promise<void>((finir) => enCours.push(finir))),
  };
});
vi.mock("./actions", () => actions);
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

import { type HabitantAffiche, ListeDesHabitants, type MetierAuChoix } from "./ListeDesHabitants";

const METIERS: MetierAuChoix[] = [
  ["chasseur", "Chasseur"],
  ["bucheron", "Bûcheron"],
  ["mineur", "Mineur"],
].map(([id, nom]) => ({ id, nom, icone: `/illustrations/metiers/${id}.webp` }));

const HABITANTS: HabitantAffiche[] = [
  { id: 40, prenom: "Arno", metier: null, etat: "libre" },
  { id: 41, prenom: "Brune", metier: null, etat: "libre" },
  { id: 42, prenom: "Cael", metier: "Chasseur", etat: "libre" },
];

/** Les Habitants de la page : le bandeau est en tête de leur registre, compté sur les lignes mêmes. */
const page = (habitants: HabitantAffiche[]) => <ListeDesHabitants habitants={habitants} metiers={METIERS} />;

/** Laisse finir les actions en suspens : React attend qu'elles aient toutes fini pour clore leurs transitions. */
const finirLesActions = () => act(async () => actions.enCours.splice(0).forEach((finir) => finir()));

afterEach(async () => {
  await finirLesActions();
  cleanup();
  actions.donnerUnMetier.mockClear();
  actions.retirerLeMetier.mockClear();
  actions.renvoyerUnHabitant.mockClear();
});

/** Le bandeau, s'il est là, en ses morceaux de texte : le paragraphe qui porte le lien « Voir ». */
function bandeau() {
  const paragraphe = screen.queryByRole("link", { name: "Voir" })?.closest("p");
  return paragraphe ? [...paragraphe.childNodes].map((morceau) => morceau.textContent).filter(Boolean) : null;
}
/** La ligne d'un Habitant, trouvée par son prénom. */
const ligne = (prenom: string) => screen.getByRole("rowheader", { name: prenom }).closest("tr")!;
/** Ce qui est déplié sous la ligne d'un Habitant. */
const dessous = (prenom: string) => ligne(prenom).nextElementSibling as HTMLElement;
/** Déplie les Métiers de l'Habitant `prenom`, depuis sa ligne. */
async function deplier(prenom: string, metier = "Choisir un Métier") {
  await userEvent.setup().click(within(ligne(prenom)).getByRole("button", { name: metier }));
}
/** Donne le Métier `nom` à l'Habitant `prenom`, depuis sa ligne. */
async function donner(prenom: string, nom: string) {
  await deplier(prenom);
  await userEvent.setup().click(within(dessous(prenom)).getByRole("button", { name: nom }));
}

describe("le bandeau des Habitants sans Métier (US-0313)", () => {
  it("dit combien d'Habitants sont sans Métier : « 2 Habitants sans Métier »", () => {
    render(page(HABITANTS));
    expect(bandeau()).toEqual(["2 Habitants sans Métier", "Voir"]);
  });

  it("accorde le nombre : « 1 Habitant sans Métier »", () => {
    render(page([HABITANTS[0], HABITANTS[2]]));
    expect(bandeau()).toEqual(["1 Habitant sans Métier", "Voir"]);
  });

  it("se tient en tête du registre, à côté du titre « Habitants »", () => {
    render(page(HABITANTS));
    const titre = screen.getByRole("heading", { level: 1, name: "Habitants" });
    expect(titre.parentElement?.contains(screen.getByRole("link", { name: "Voir" }))).toBe(true);
  });

  it("propose « Voir », un raccourci vers la liste filtrée sur les Habitants sans Métier", () => {
    render(page(HABITANTS));
    expect(screen.getByRole("link", { name: "Voir" }).getAttribute("href")).toBe("/jeu/habitants?metier=sans");
  });

  it("n'est pas là quand tous les Habitants ont un Métier, ni sans Habitant", () => {
    render(page([HABITANTS[2], { ...HABITANTS[0], metier: "Mineur" }]));
    expect(bandeau()).toBeNull();
    expect(screen.queryByText(/sans Métier/)).toBeNull();
    cleanup();
    render(page([]));
    expect(bandeau()).toBeNull();
  });

  it("baisse dès qu'un Métier est donné depuis la liste, sans attendre l'action, et disparaît à zéro sans recharger", async () => {
    render(page(HABITANTS));
    await donner("Arno", "Bûcheron");
    // L'action n'a pas encore répondu.
    expect(actions.donnerUnMetier).toHaveBeenCalledExactlyOnceWith(40, "bucheron");
    expect(bandeau()).toEqual(["1 Habitant sans Métier", "Voir"]);
    await donner("Brune", "Mineur");
    expect(bandeau()).toBeNull();
  });

  it("suit la page relue : un Métier donné le laisse à zéro, un Métier refusé le fait revenir", async () => {
    const { rerender } = render(page(HABITANTS));
    await donner("Arno", "Bûcheron");
    rerender(page([HABITANTS[1], HABITANTS[2], { ...HABITANTS[0], metier: "Bûcheron" }]));
    await finirLesActions();
    expect(bandeau()).toEqual(["1 Habitant sans Métier", "Voir"]);
    await donner("Brune", "Mineur");
    expect(bandeau()).toBeNull();
    // L'action s'achève sans que la page ait changé : Brune reste sans Métier.
    await finirLesActions();
    expect(bandeau()).toEqual(["1 Habitant sans Métier", "Voir"]);
  });

  it("monte dès qu'un Métier est retiré depuis la liste, et revient quand il était parti (US-0311)", async () => {
    render(page(HABITANTS));
    await deplier("Cael", "Chasseur");
    await userEvent.setup().click(within(dessous("Cael")).getByRole("button", { name: "Sans Métier" }));
    expect(actions.retirerLeMetier).toHaveBeenCalledExactlyOnceWith(42);
    expect(bandeau()).toEqual(["3 Habitants sans Métier", "Voir"]);
    await finirLesActions();
    cleanup();

    render(page([{ ...HABITANTS[0], metier: "Mineur" }, HABITANTS[2]]));
    expect(bandeau()).toBeNull();
    await deplier("Arno", "Mineur");
    await userEvent.setup().click(within(dessous("Arno")).getByRole("button", { name: "Sans Métier" }));
    expect(bandeau()).toEqual(["1 Habitant sans Métier", "Voir"]);
  });

  it("baisse dès qu'un Habitant sans Métier est renvoyé depuis la liste, et disparaît avec le dernier (US-0330)", async () => {
    render(page(HABITANTS));
    const utilisateur = userEvent.setup();
    for (const prenom of ["Arno", "Brune"]) {
      await deplier(prenom);
      await utilisateur.click(within(dessous(prenom)).getByRole("button", { name: `Renvoyer ${prenom}` }));
      await utilisateur.click(within(dessous(prenom)).getByRole("button", { name: /^Confirmer le renvoi/ }));
      // L'action n'a pas encore répondu.
      expect(bandeau()).toEqual(prenom === "Arno" ? ["1 Habitant sans Métier", "Voir"] : null);
    }
    expect(actions.renvoyerUnHabitant.mock.calls).toEqual([[40], [41]]);
  });
});
