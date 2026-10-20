// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENTRETIEN_HABITANT_PAR_HEURE, VOYAGEUR_ALERTE_MINUTES, VOYAGEUR_ATTEND_HEURES } from "@/reglages";

/** Les actions serveur, tenues en suspens jusqu'à ce que le test les laisse finir, avec ce qu'elles rendent. */
const actions = vi.hoisted(() => {
  const enCours: Array<(rendu?: unknown) => void> = [];
  return {
    enCours,
    accueillirUnVoyageur: vi.fn(() => new Promise<unknown>((finir) => enCours.push(finir))),
    refuserUnVoyageur: vi.fn(() => new Promise<unknown>((finir) => enCours.push(finir))),
  };
});
vi.mock("./actions-aux-portes", () => actions);

import { AuxPortes, type VoyageurAffiche } from "./AuxPortes";

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
/** L'heure du jeu à l'affichage. */
const MAINTENANT = new Date("2026-10-07T18:00:00Z");
/** US-0338 : la place qui reste au Foyer, de 5 places pour 3 Habitants. */
const LIBRES = 2;
/** Un Voyageur arrivé il y a `ms` millisecondes de jeu, qui repart VOYAGEUR_ATTEND_HEURES heures après son arrivée. */
const voyageur = (id: number, prenom: string, ms: number): VoyageurAffiche => {
  const arriveLe = new Date(MAINTENANT.getTime() - ms);
  return { id, prenom, arriveLe, departLe: new Date(arriveLe.getTime() + VOYAGEUR_ATTEND_HEURES * HEURE) };
};
/** Un Voyageur à qui il reste `ms` millisecondes de jeu avant son départ. */
const partantDans = (id: number, prenom: string, ms: number) => voyageur(id, prenom, VOYAGEUR_ATTEND_HEURES * HEURE - ms);

const partie = () => screen.getByRole("heading", { name: "Aux portes" }).closest("section")!;
/** Les morceaux de chaque ligne, le prénom, depuis quand, puis le compte à rebours, sans ses boutons (US-0334). */
const morceaux = () => within(partie()).queryAllByRole("listitem").map((li) => [...li.querySelectorAll(":scope > span")]);
/** Le texte de chaque ligne, ses morceaux séparés par « · ». */
const lignes = () => morceaux().map((m) => m.map((e) => e.textContent).join(" · "));
/** Le compte à rebours de chaque ligne. */
const comptes = () => morceaux().map((m) => m[2].textContent);
/** Les comptes à rebours dans la couleur d'alerte. */
const enAlerte = () => morceaux().map((m) => m[2].hasAttribute("data-alerte"));
/** Les prénoms aux portes, dans l'ordre des lignes. */
const prenoms = () => morceaux().map((m) => m[0].textContent);
/** US-0334 : la ligne d'un Voyageur, trouvée par son prénom. */
const ligne = (prenom: string) => within(partie()).getByText(prenom).closest("li")!;

/**
 * Laisse finir les actions en suspens, chacune rendant `rendu` : React attend qu'elles aient toutes fini pour clore
 * leurs transitions.
 */
const finirLesActions = (rendu?: unknown) => act(async () => actions.enCours.splice(0).forEach((finir) => finir(rendu)));

afterEach(async () => {
  await finirLesActions();
  cleanup();
  vi.useRealTimers();
  actions.accueillirUnVoyageur.mockClear();
  actions.refuserUnVoyageur.mockClear();
});

describe("les Voyageurs aux portes (US-0332)", () => {
  /** Le prénom et depuis quand, sans le compte à rebours (US-0333). */
  const debuts = () => lignes().map((l) => l.split(" · ").slice(0, 2).join(" · "));

  it("forment une partie « Aux portes », titrée comme les autres blocs", () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={[]} maintenant={MAINTENANT} />);
    expect(within(partie()).getByRole("heading", { level: 2 }).textContent).toBe("Aux portes");
  });

  it("y sont chacun sur une ligne, dans l'ordre de la lecture, du premier arrivé au dernier : son prénom, et depuis quand il attend", () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={[voyageur(3, "Arno", 5 * HEURE), voyageur(1, "Brune", 2 * HEURE + 20 * MINUTE), voyageur(2, "Cael", 12 * MINUTE)]} maintenant={MAINTENANT} />);
    expect(debuts()).toEqual(["Arno · arrivé il y a 5 h", "Brune · arrivé il y a 2 h", "Cael · arrivé il y a 12 min"]);
  });

  it.each([
    [30_000, "arrivé à l'instant"],
    [MINUTE, "arrivé il y a 1 min"],
    [59 * MINUTE + 59_000, "arrivé il y a 59 min"],
    [HEURE, "arrivé il y a 1 h"],
    [11 * HEURE + 59 * MINUTE, "arrivé il y a 11 h"],
  ])("disent depuis quand ils attendent, en heures du jeu : %i ms, « %s »", (ms, depuis) => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={[voyageur(1, "Arno", ms)]} maintenant={MAINTENANT} />);
    expect(debuts()).toEqual([`Arno · ${depuis}`]);
  });

  it("laissent, quand personne n'attend, « Personne aux portes pour l'instant. », sans liste vide", () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={[]} maintenant={MAINTENANT} />);
    expect([...partie().children].map((e) => [e.tagName, e.textContent])).toEqual([
      ["H2", "Aux portes"],
      // US-0342 : le lien vers l'historique, en tête de la partie.
      ["A", "Historique"],
      ["P", "Personne aux portes pour l'instant."],
    ]);
  });

});

describe("l'historique des Voyageurs (US-0342)", () => {
  it("s'ouvre par un lien « Historique », en tête de la partie, juste après son titre, qui mène aux Voyageurs passés", () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    const lien = within(partie()).getByRole("link", { name: "Historique" });
    expect(lien.getAttribute("href")).toBe("/jeu/habitants/voyageurs");
    expect([...partie().children].slice(0, 2)).toEqual([within(partie()).getByRole("heading", { name: "Aux portes" }), lien]);
  });

  it("garde le lien quand personne n'attend, et quand la place manque", () => {
    const { rerender } = render(<AuxPortes placesLibres={LIBRES} voyageurs={[]} maintenant={MAINTENANT} />);
    expect(within(partie()).getByRole("link", { name: "Historique" })).toBeTruthy();
    rerender(<AuxPortes placesLibres={0} voyageurs={TROIS} maintenant={MAINTENANT} />);
    expect(within(partie()).getByRole("link", { name: "Historique" })).toBeTruthy();
  });
});

/** Trois Voyageurs aux portes, du premier arrivé au dernier. */
const TROIS = [voyageur(70, "Ines", 3 * HEURE), voyageur(71, "Joran", 2 * HEURE), voyageur(72, "Ilda", 20 * MINUTE)];

describe("accueillir un Voyageur (US-0334)", () => {
  it("met sur la ligne de chaque Voyageur un bouton « Accueillir », qui dit pour un lecteur d'écran qui il accueille", () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    for (const { prenom } of TROIS) {
      const bouton = within(ligne(prenom)).getByRole("button", { name: `Accueillir ${prenom}` });
      expect(bouton.textContent).toBe("Accueillir");
      expect(bouton.getAttribute("type")).toBe("button");
    }
    expect(actions.accueillirUnVoyageur).not.toHaveBeenCalled();
  });

  it("toucher « Accueillir » retire aussitôt la ligne, sans attendre l'action, qui reçoit le Voyageur", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    await userEvent.setup().click(within(ligne("Joran")).getByRole("button", { name: "Accueillir Joran" }));
    expect(actions.accueillirUnVoyageur).toHaveBeenCalledExactlyOnceWith(71, null);
    // L'action n'a pas encore répondu : la ligne est déjà partie, les autres restent dans leur ordre.
    expect(prenoms()).toEqual(["Ines", "Ilda"]);
  });

  it("laisse « Personne aux portes pour l'instant. » dès que le dernier Voyageur est accueilli", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={[TROIS[0]]} maintenant={MAINTENANT} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Accueillir Ines" }));
    expect(within(partie()).queryByRole("list")).toBeNull();
    expect(within(partie()).getByText("Personne aux portes pour l'instant.")).toBeTruthy();
  });

  it("ne remontre pas la ligne une fois la page relue, qui ne compte plus le Voyageur aux portes", async () => {
    const { rerender } = render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    await userEvent.setup().click(within(ligne("Ines")).getByRole("button", { name: "Accueillir Ines" }));
    rerender(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS.slice(1)} maintenant={new Date(MAINTENANT.getTime() + 2_000)} />);
    await finirLesActions();
    expect(prenoms()).toEqual(["Joran", "Ilda"]);
  });

  it("laisse la page relue faire foi quand le Voyageur n'a pas été accueilli", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    await userEvent.setup().click(within(ligne("Ines")).getByRole("button", { name: "Accueillir Ines" }));
    expect(prenoms()).toEqual(["Joran", "Ilda"]);
    // L'action s'achève sans que la page ait changé : Ines attend toujours.
    await finirLesActions();
    expect(prenoms()).toEqual(["Ines", "Joran", "Ilda"]);
  });

  it("accueille plusieurs Voyageurs à la suite, sans attendre que le premier accueil réponde", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(within(ligne("Ines")).getByRole("button", { name: "Accueillir Ines" }));
    await utilisateur.click(within(ligne("Ilda")).getByRole("button", { name: "Accueillir Ilda" }));
    expect(actions.accueillirUnVoyageur.mock.calls).toEqual([[70, null], [72, null]]);
    expect(prenoms()).toEqual(["Joran"]);
  });
});

describe("donner un Métier dès l'accueil (US-0335)", () => {
  /** Les huit Métiers, dans leur ordre, chacun avec son icône. */
  const METIERS = [
    ["explorateur", "Explorateur"],
    ["chasseur", "Chasseur"],
    ["cueilleur", "Cueilleur"],
    ["bucheron", "Bûcheron"],
    ["mineur", "Mineur"],
    ["chercheur", "Chercheur"],
    ["batisseur", "Bâtisseur"],
    ["eleveur", "Éleveur"],
  ].map(([id, nom]) => ({ id, nom, icone: `/illustrations/metiers/${id}.webp` }));
  /** Le bouton qui déplie les Métiers sur la ligne d'un Voyageur. */
  const deplier = (prenom: string) => within(ligne(prenom)).getAllByRole("button").find((b) => b.hasAttribute("aria-expanded"))!;
  /** Les Métiers dépliés sous la ligne d'un Voyageur. */
  const auChoix = (prenom: string) => {
    const groupe = within(ligne(prenom)).queryByRole("group");
    return groupe ? within(groupe).getAllByRole("button") : [];
  };
  /** Choisit le Métier `nom` sur la ligne du Voyageur `prenom`. */
  async function choisir(prenom: string, nom: string) {
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier(prenom));
    await utilisateur.click(within(ligne(prenom)).getByRole("button", { name: nom }));
  }

  it("met sur la ligne de chaque Voyageur, au-dessus d'« Accueillir », le Métier qu'il aura : « Sans Métier » par défaut, à la flèche du choix d'un Métier", () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} metiers={METIERS} />);
    for (const { prenom } of TROIS) {
      const bouton = deplier(prenom);
      expect([bouton.textContent, bouton.getAttribute("aria-expanded"), bouton.getAttribute("type")]).toEqual(["Sans Métier", "false", "button"]);
      expect(bouton.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
      expect(within(ligne(prenom)).getAllByRole("button").map((b) => b.textContent)).toEqual(["Sans Métier", "Accueillir", "Refuser"]);
    }
    // Un lecteur d'écran entend aussi de qui il s'agit, et ce que dit le bouton.
    expect(TROIS.map(({ prenom }) => deplier(prenom).getAttribute("aria-label"))).toEqual([
      "Métier d'Ines : Sans Métier",
      "Métier de Joran : Sans Métier",
      "Métier d'Ilda : Sans Métier",
    ]);
  });

  it("déplie sous le bouton les huit Métiers, chacun un bouton à son icône muette et à son nom, sans « Sans Métier » tant qu'aucun n'est choisi", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} metiers={METIERS} />);
    await userEvent.setup().click(deplier("Joran"));
    expect(deplier("Joran").getAttribute("aria-expanded")).toBe("true");
    const groupe = within(ligne("Joran")).getByRole("group", { name: "Métier de Joran" });
    expect(deplier("Joran").getAttribute("aria-controls")).toBe(groupe.id);
    expect(auChoix("Joran").map((b) => [b.textContent, b.querySelector("img")?.getAttribute("alt"), b.getAttribute("aria-pressed")])).toEqual(
      METIERS.map((m) => [m.nom, "", "false"]),
    );
    // Entre le bouton du Métier et « Accueillir ».
    expect(deplier("Joran").nextElementSibling).toBe(groupe);
    expect(groupe.nextElementSibling?.contains(within(ligne("Joran")).getByRole("button", { name: "Accueillir Joran" }))).toBe(true);
    expect(auChoix("Ines")).toEqual([]);
  });

  it("toucher un Métier le choisit, sans accueillir personne : le bouton le montre, le dépliant se referme, et la main revient au bouton", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} metiers={METIERS} />);
    await choisir("Joran", "Chasseur");
    expect(actions.accueillirUnVoyageur).not.toHaveBeenCalled();
    expect(prenoms()).toEqual(["Ines", "Joran", "Ilda"]);
    expect([deplier("Joran").textContent, deplier("Joran").getAttribute("aria-label"), deplier("Joran").getAttribute("aria-expanded")]).toEqual([
      "Chasseur",
      "Métier de Joran : Chasseur",
      "false",
    ]);
    expect(auChoix("Joran")).toEqual([]);
    expect(document.activeElement).toBe(deplier("Joran"));
    // Les autres lignes gardent le leur.
    expect([deplier("Ines").textContent, deplier("Ilda").textContent]).toEqual(["Sans Métier", "Sans Métier"]);
  });

  it("« Accueillir » accueille avec le Métier choisi ; sans choix, le Voyageur arrive sans Métier", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await choisir("Joran", "Bûcheron");
    await utilisateur.click(within(ligne("Joran")).getByRole("button", { name: "Accueillir Joran" }));
    await utilisateur.click(within(ligne("Ines")).getByRole("button", { name: "Accueillir Ines" }));
    expect(actions.accueillirUnVoyageur.mock.calls).toEqual([
      [71, "bucheron"],
      [70, null],
    ]);
    expect(prenoms()).toEqual(["Ilda"]);
  });

  it("change d'avis : le Métier choisi est pressé et hors d'atteinte, un autre le remplace, et « Sans Métier », en dernier, le retire", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await choisir("Ilda", "Mineur");
    await utilisateur.click(deplier("Ilda"));
    expect(auChoix("Ilda").map((b) => [b.textContent, b.getAttribute("aria-pressed"), (b as HTMLButtonElement).disabled])).toEqual([
      ...METIERS.map((m) => [m.nom, m.nom === "Mineur" ? "true" : "false", m.nom === "Mineur"]),
      ["Sans Métier", null, false],
    ]);
    await utilisateur.click(within(ligne("Ilda")).getByRole("button", { name: "Éleveur" }));
    expect(deplier("Ilda").textContent).toBe("Éleveur");
    await utilisateur.click(deplier("Ilda"));
    await utilisateur.click(within(within(ligne("Ilda")).getByRole("group")).getByRole("button", { name: "Sans Métier" }));
    expect(deplier("Ilda").textContent).toBe("Sans Métier");
    await utilisateur.click(within(ligne("Ilda")).getByRole("button", { name: "Accueillir Ilda" }));
    expect(actions.accueillirUnVoyageur).toHaveBeenCalledExactlyOnceWith(72, null);
  });

  it("referme le dépliant d'un second toucher, ou d'Échap qui rend la main au bouton, sans rien changer ; un seul dépliant à la fois", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier("Ines"));
    await utilisateur.click(deplier("Ines"));
    expect(auChoix("Ines")).toEqual([]);
    await utilisateur.click(deplier("Ines"));
    await utilisateur.click(deplier("Ilda"));
    expect([auChoix("Ines").length, auChoix("Ilda").length]).toEqual([0, 8]);
    within(ligne("Ilda")).getByRole("button", { name: "Chasseur" }).focus();
    await utilisateur.keyboard("{Escape}");
    expect(auChoix("Ilda")).toEqual([]);
    expect(document.activeElement).toBe(deplier("Ilda"));
    expect(TROIS.map(({ prenom }) => deplier(prenom).textContent)).toEqual(["Sans Métier", "Sans Métier", "Sans Métier"]);
    expect(actions.accueillirUnVoyageur).not.toHaveBeenCalled();
  });

  it("garde la même confirmation quand la famine est imminente : le second toucher accueille avec le Métier choisi", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} metiers={METIERS} famineImminente />);
    const utilisateur = userEvent.setup();
    await choisir("Joran", "Cueilleur");
    await utilisateur.click(within(ligne("Joran")).getByRole("button", { name: "Accueillir Joran" }));
    expect(actions.accueillirUnVoyageur).not.toHaveBeenCalled();
    expect(within(ligne("Joran")).getByRole("alert").textContent).toBe(`Famine imminente : un Habitant de plus mangera ${ENTRETIEN_HABITANT_PAR_HEURE} Nourriture par heure.`);
    await utilisateur.click(within(ligne("Joran")).getByRole("button", { name: "Confirmer l'accueil de Joran" }));
    expect(actions.accueillirUnVoyageur).toHaveBeenCalledExactlyOnceWith(71, "cueilleur");
  });

  it("garde le Métier choisi sur la ligne d'un Voyageur que la page relue montre encore, l'accueil n'ayant pas eu lieu", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await choisir("Ines", "Chercheur");
    await utilisateur.click(within(ligne("Ines")).getByRole("button", { name: "Accueillir Ines" }));
    await finirLesActions("plus-de-place");
    expect(deplier("Ines").textContent).toBe("Chercheur");
  });

  it("ne propose aucun Métier quand il n'y en a aucun à proposer : le Voyageur arrive sans Métier", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} metiers={[]} />);
    expect(within(ligne("Ines")).getAllByRole("button").map((b) => b.textContent)).toEqual(["Accueillir", "Refuser"]);
    await userEvent.setup().click(within(ligne("Ines")).getByRole("button", { name: "Accueillir Ines" }));
    expect(actions.accueillirUnVoyageur).toHaveBeenCalledExactlyOnceWith(70, null);
  });
});

describe("refuser un Voyageur (US-0336)", () => {
  it("met sur la ligne de chaque Voyageur, après « Accueillir », un bouton « Refuser », qui dit pour un lecteur d'écran qui il refuse", () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    for (const { prenom } of TROIS) {
      expect(within(ligne(prenom)).getAllByRole("button").map((b) => [b.textContent, b.getAttribute("aria-label"), b.getAttribute("type")])).toEqual([
        ["Accueillir", `Accueillir ${prenom}`, "button"],
        ["Refuser", `Refuser ${prenom}`, "button"],
      ]);
    }
    expect(actions.refuserUnVoyageur).not.toHaveBeenCalled();
  });

  it("toucher « Refuser » retire aussitôt la ligne, sans attendre l'action, qui reçoit le Voyageur, sans l'accueillir", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    await userEvent.setup().click(within(ligne("Joran")).getByRole("button", { name: "Refuser Joran" }));
    expect(actions.refuserUnVoyageur).toHaveBeenCalledExactlyOnceWith(71);
    expect(actions.accueillirUnVoyageur).not.toHaveBeenCalled();
    expect(prenoms()).toEqual(["Ines", "Ilda"]);
  });

  it("ne remontre pas la ligne une fois la page relue, et laisse « Personne aux portes pour l'instant. » quand tous sont partis", async () => {
    const { rerender } = render(<AuxPortes placesLibres={LIBRES} voyageurs={[TROIS[0], TROIS[1]]} maintenant={MAINTENANT} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(within(ligne("Ines")).getByRole("button", { name: "Refuser Ines" }));
    await utilisateur.click(within(ligne("Joran")).getByRole("button", { name: "Accueillir Joran" }));
    expect(within(partie()).getByText("Personne aux portes pour l'instant.")).toBeTruthy();
    rerender(<AuxPortes placesLibres={LIBRES} voyageurs={[]} maintenant={new Date(MAINTENANT.getTime() + 2_000)} />);
    await finirLesActions();
    expect(within(partie()).queryByRole("list")).toBeNull();
    expect(within(partie()).getByText("Personne aux portes pour l'instant.")).toBeTruthy();
  });

  it("laisse la page relue faire foi quand le Voyageur n'a pas été refusé", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    await userEvent.setup().click(within(ligne("Ilda")).getByRole("button", { name: "Refuser Ilda" }));
    expect(prenoms()).toEqual(["Ines", "Joran"]);
    await finirLesActions();
    expect(prenoms()).toEqual(["Ines", "Joran", "Ilda"]);
  });
});

describe("accueillir un Voyageur déjà reparti (US-0337)", () => {
  /** Les messages d'alerte de la partie « Aux portes ». */
  const alertes = () => within(partie()).queryAllByRole("alert").map((a) => a.textContent);

  it("dit « Ce Voyageur est déjà reparti. » dans la partie, et la page relue ne le montre plus aux portes", async () => {
    const { rerender } = render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    await userEvent.setup().click(within(ligne("Ines")).getByRole("button", { name: "Accueillir Ines" }));
    expect(alertes()).toEqual([]);
    // La page relue ne compte plus Ines aux portes ; l'accueil revient : elle était déjà repartie.
    rerender(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS.slice(1)} maintenant={new Date(MAINTENANT.getTime() + 2_000)} />);
    await finirLesActions("reparti");
    expect(alertes()).toEqual(["Ce Voyageur est déjà reparti."]);
    expect(prenoms()).toEqual(["Joran", "Ilda"]);
  });

  it("le dit aussi quand plus personne n'attend", async () => {
    const { rerender } = render(<AuxPortes placesLibres={LIBRES} voyageurs={[TROIS[0]]} maintenant={MAINTENANT} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Accueillir Ines" }));
    rerender(<AuxPortes placesLibres={LIBRES} voyageurs={[]} maintenant={new Date(MAINTENANT.getTime() + 2_000)} />);
    await finirLesActions("reparti");
    expect(alertes()).toEqual(["Ce Voyageur est déjà reparti."]);
    expect(within(partie()).getByText("Personne aux portes pour l'instant.")).toBeTruthy();
  });

  it.each([["accueilli"], ["absent"], [undefined]])("ne dit rien quand l'accueil revient autrement : %s", async (rendu) => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    await userEvent.setup().click(within(ligne("Ines")).getByRole("button", { name: "Accueillir Ines" }));
    await finirLesActions(rendu);
    expect(alertes()).toEqual([]);
  });

  it("efface le message au choix suivant", async () => {
    const { rerender } = render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(within(ligne("Ines")).getByRole("button", { name: "Accueillir Ines" }));
    rerender(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS.slice(1)} maintenant={new Date(MAINTENANT.getTime() + 2_000)} />);
    await finirLesActions("reparti");
    expect(alertes()).toEqual(["Ce Voyageur est déjà reparti."]);

    await utilisateur.click(within(ligne("Joran")).getByRole("button", { name: "Refuser Joran" }));
    expect(alertes()).toEqual([]);
  });
});

describe("bloquer l'accueil quand la place manque (US-0338)", () => {
  const PHRASE = "Plus de place au Foyer.";
  /** Les boutons « Accueillir » de la partie, grisés ou non, dans l'ordre des lignes. */
  const grises = () => within(partie()).getAllByRole("button", { name: /^Accueillir / }).map((b) => (b as HTMLButtonElement).disabled);
  /** Les phrases de la partie qui disent que la place manque. */
  const phrases = () => within(partie()).queryAllByText(PHRASE);

  it("grise « Accueillir » sur chaque ligne quand toute la place est prise, toujours lu avec qui il accueille, sans toucher à « Refuser »", () => {
    render(<AuxPortes placesLibres={0} voyageurs={TROIS} maintenant={MAINTENANT} />);
    for (const { prenom } of TROIS) {
      expect((within(ligne(prenom)).getByRole("button", { name: `Accueillir ${prenom}` }) as HTMLButtonElement).disabled).toBe(true);
      expect((within(ligne(prenom)).getByRole("button", { name: `Refuser ${prenom}` }) as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it("dit une seule fois, dans la partie, qu'il n'y a plus de place, sans redire ce qui en ajoutera, et chaque « Accueillir » grisé y renvoie", () => {
    render(<AuxPortes placesLibres={0} voyageurs={TROIS} maintenant={MAINTENANT} />);
    expect(partie().textContent).not.toContain("huttes");
    expect(phrases()).toHaveLength(1);
    const id = phrases()[0].id;
    expect(id).not.toBe("");
    for (const { prenom } of TROIS) expect(within(ligne(prenom)).getByRole("button", { name: `Accueillir ${prenom}` }).getAttribute("aria-describedby")).toBe(id);
  });

  it("n'accueille personne d'un toucher sur « Accueillir » grisé ; « Refuser » reste possible", async () => {
    render(<AuxPortes placesLibres={0} voyageurs={TROIS} maintenant={MAINTENANT} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(within(ligne("Ines")).getByRole("button", { name: "Accueillir Ines" }));
    expect(actions.accueillirUnVoyageur).not.toHaveBeenCalled();
    expect(prenoms()).toEqual(["Ines", "Joran", "Ilda"]);
    await utilisateur.click(within(ligne("Ines")).getByRole("button", { name: "Refuser Ines" }));
    expect(actions.refuserUnVoyageur).toHaveBeenCalledExactlyOnceWith(70);
  });

  it("laisse accueillir, sans rien dire, tant qu'il reste une place", () => {
    render(<AuxPortes placesLibres={1} voyageurs={TROIS} maintenant={MAINTENANT} />);
    expect(grises()).toEqual([false, false, false]);
    expect(phrases()).toEqual([]);
    for (const { prenom } of TROIS) expect(within(ligne(prenom)).getByRole("button", { name: `Accueillir ${prenom}` }).hasAttribute("aria-describedby")).toBe(false);
  });

  it("ne dit rien quand personne n'attend", () => {
    render(<AuxPortes placesLibres={0} voyageurs={[]} maintenant={MAINTENANT} />);
    expect(phrases()).toEqual([]);
    expect(within(partie()).getByText("Personne aux portes pour l'instant.")).toBeTruthy();
  });

  it("laisse de nouveau accueillir dès que la page relue donne de la place, le Voyageur ayant attendu", () => {
    const { rerender } = render(<AuxPortes placesLibres={0} voyageurs={TROIS} maintenant={MAINTENANT} />);
    expect(grises()).toEqual([true, true, true]);
    rerender(<AuxPortes placesLibres={1} voyageurs={TROIS} maintenant={new Date(MAINTENANT.getTime() + 2_000)} />);
    expect(grises()).toEqual([false, false, false]);
    expect(phrases()).toEqual([]);
  });

  it("compte d'avance la place que prend un accueil en cours : la dernière prise, les autres « Accueillir » se grisent aussitôt", async () => {
    render(<AuxPortes placesLibres={1} voyageurs={TROIS} maintenant={MAINTENANT} />);
    await userEvent.setup().click(within(ligne("Ines")).getByRole("button", { name: "Accueillir Ines" }));
    expect(prenoms()).toEqual(["Joran", "Ilda"]);
    expect(grises()).toEqual([true, true]);
    expect(phrases()).toHaveLength(1);
    // L'accueil n'a pas eu lieu et la page relue n'a pas changé : la place est toujours libre.
    await finirLesActions("plus-de-place");
    expect(grises()).toEqual([false, false, false]);
    expect(phrases()).toEqual([]);
  });

  it("ne compte pas d'avance la place d'un refus en cours", async () => {
    render(<AuxPortes placesLibres={1} voyageurs={TROIS} maintenant={MAINTENANT} />);
    await userEvent.setup().click(within(ligne("Ines")).getByRole("button", { name: "Refuser Ines" }));
    expect(grises()).toEqual([false, false]);
  });
});

describe("fermer les portes pendant une Famine (US-0341)", () => {
  const PHRASE = "Les Voyageurs évitent un Territoire en Famine.";
  /** Chaque élément de la partie, sa balise et son texte. */
  const elements = () => [...partie().children].map((e) => [e.tagName, e.textContent]);

  it("dit, quand personne n'attend, que les Voyageurs évitent un Territoire en Famine, à la place de « Personne aux portes pour l'instant. »", () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={[]} maintenant={MAINTENANT} famine />);
    expect(elements()).toEqual([
      ["H2", "Aux portes"],
      ["A", "Historique"],
      ["P", PHRASE],
    ]);
  });

  it("le dit une seule fois, en tête de la partie, au-dessus des Voyageurs qui attendaient déjà, qu'on peut toujours accueillir ou refuser", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} famine famineImminente />);
    expect(within(partie()).getAllByText(PHRASE)).toHaveLength(1);
    expect(elements().map(([balise]) => balise)).toEqual(["H2", "A", "P", "UL"]);
    expect(elements()[2][1]).toBe(PHRASE);
    expect(prenoms()).toEqual(["Ines", "Joran", "Ilda"]);
    const utilisateur = userEvent.setup();
    await utilisateur.click(within(ligne("Joran")).getByRole("button", { name: "Refuser Joran" }));
    expect(actions.refuserUnVoyageur).toHaveBeenCalledExactlyOnceWith(71);
    // L'accueil reste possible, confirmé comme sous l'avertissement « famine imminente » (US-0340).
    await utilisateur.click(within(ligne("Ines")).getByRole("button", { name: "Accueillir Ines" }));
    await utilisateur.click(within(ligne("Ines")).getByRole("button", { name: "Confirmer l'accueil d'Ines" }));
    expect(actions.accueillirUnVoyageur).toHaveBeenCalledExactlyOnceWith(70, null);
  });

  it("le garde seul, sans « Personne aux portes pour l'instant. », quand le dernier Voyageur qui attendait s'en va", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={[TROIS[0]]} maintenant={MAINTENANT} famine />);
    await userEvent.setup().click(within(ligne("Ines")).getByRole("button", { name: "Refuser Ines" }));
    expect(elements()).toEqual([
      ["H2", "Aux portes"],
      ["A", "Historique"],
      ["P", PHRASE],
    ]);
  });

  it("le dit sous la phrase de la place qui manque, quand les deux valent", () => {
    render(<AuxPortes placesLibres={0} voyageurs={TROIS} maintenant={MAINTENANT} famine />);
    expect(elements().map(([balise, texte]) => (balise === "P" ? texte : balise))).toEqual([
      "H2",
      "A",
      "Plus de place au Foyer.",
      PHRASE,
      "UL",
    ]);
  });

  it("ne dit rien hors Famine", () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} famineImminente />);
    expect(within(partie()).queryByText(PHRASE)).toBeNull();
    cleanup();
    render(<AuxPortes placesLibres={LIBRES} voyageurs={[]} maintenant={MAINTENANT} famine={false} />);
    expect(elements()).toEqual([
      ["H2", "Aux portes"],
      ["A", "Historique"],
      ["P", "Personne aux portes pour l'instant."],
    ]);
  });
});

describe("ne jamais accueillir deux fois (US-0339)", () => {
  it("n'envoie qu'un accueil pour un double clic sur « Accueillir »", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    await userEvent.setup().dblClick(within(ligne("Ines")).getByRole("button", { name: "Accueillir Ines" }));
    expect(actions.accueillirUnVoyageur).toHaveBeenCalledExactlyOnceWith(70, null);
  });

  it("ne relance rien pour un Voyageur dont un choix est en cours, même touché de nouveau avant que sa ligne parte", () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    const [accueillir, refuser] = within(ligne("Ines")).getAllByRole("button");
    // Trois touchers avant que React ne retire la ligne.
    act(() => {
      accueillir.click();
      accueillir.click();
      refuser.click();
    });
    expect(actions.accueillirUnVoyageur).toHaveBeenCalledExactlyOnceWith(70, null);
    expect(actions.refuserUnVoyageur).not.toHaveBeenCalled();
  });

  it("laisse de nouveau choisir pour ce Voyageur une fois l'action finie, s'il attend toujours", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(within(ligne("Ines")).getByRole("button", { name: "Accueillir Ines" }));
    await finirLesActions("plus-de-place");
    await utilisateur.click(within(ligne("Ines")).getByRole("button", { name: "Accueillir Ines" }));
    expect(actions.accueillirUnVoyageur.mock.calls).toEqual([[70, null], [70, null]]);
  });
});

describe("mesurer l'Entretien en plus avant d'accueillir (US-0340)", () => {
  const PHRASE = `Famine imminente : un Habitant de plus mangera ${ENTRETIEN_HABITANT_PAR_HEURE} Nourriture par heure.`;
  /** Le bouton d'accueil de la ligne d'un Voyageur, qu'il dise « Accueillir » ou « Confirmer l'accueil ». */
  const accueil = (prenom: string) => within(ligne(prenom)).getAllByRole("button")[0] as HTMLButtonElement;
  /** Ce que dit le bouton d'accueil de chaque ligne, et s'il est dans la couleur d'alerte. */
  const accueils = () => prenoms().map((prenom) => [accueil(prenom!).textContent, accueil(prenom!).hasAttribute("data-confirmer")]);
  /** Ce que la ligne de chaque Voyageur dit sous ses boutons : la phrase de la confirmation, ou rien (null). */
  const dessous = () => prenoms().map((prenom) => (ligne(prenom!).lastElementChild?.getAttribute("role") === "alert" ? ligne(prenom!).lastElementChild!.textContent : null));
  /** Les messages annoncés de la partie. */
  const alertes = () => within(partie()).queryAllByRole("alert").map((a) => a.textContent);

  it("ne redit pas, sur la ligne de chaque Voyageur, ce qu'il mangera : la même règle pour tous (retour d'Antoine)", () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} />);
    expect(dessous()).toEqual([null, null, null]);
    expect(partie().textContent).not.toContain("Mangera");
  });

  it("ne demande rien de plus quand « Accueillir » est grisé faute de place", async () => {
    render(<AuxPortes placesLibres={0} voyageurs={TROIS} maintenant={MAINTENANT} famineImminente />);
    expect(dessous()).toEqual([null, null, null]);
    await userEvent.setup().click(accueil("Ines"));
    expect(accueils()).toEqual([
      ["Accueillir", false],
      ["Accueillir", false],
      ["Accueillir", false],
    ]);
    expect(alertes()).toEqual([]);
  });

  it("accueille dès le premier toucher, sans confirmation, tant que l'avertissement « famine imminente » n'est pas actif", async () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} famineImminente={false} />);
    await userEvent.setup().click(accueil("Joran"));
    expect(actions.accueillirUnVoyageur).toHaveBeenCalledExactlyOnceWith(71, null);
    expect(prenoms()).toEqual(["Ines", "Ilda"]);
  });

  describe("quand l'avertissement « famine imminente » est actif", () => {
    it("le premier toucher n'accueille personne : sur sa ligne, le bouton devient « Confirmer l'accueil », en alerte, et une phrase dit ce qu'il coûtera", async () => {
      render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} famineImminente />);
      await userEvent.setup().click(accueil("Joran"));
      expect(actions.accueillirUnVoyageur).not.toHaveBeenCalled();
      expect(prenoms()).toEqual(["Ines", "Joran", "Ilda"]);
      expect(accueils()).toEqual([
        ["Accueillir", false],
        ["Confirmer l'accueil", true],
        ["Accueillir", false],
      ]);
      // La phrase, sous ses boutons, sur sa ligne seulement ; un lecteur d'écran l'entend aussitôt.
      expect(dessous()).toEqual([null, PHRASE, null]);
      expect(within(ligne("Joran")).getByRole("alert").textContent).toBe(PHRASE);
      // Le bouton dit toujours, pour un lecteur d'écran, qui il accueille.
      expect(accueil("Joran").getAttribute("aria-label")).toBe("Confirmer l'accueil de Joran");
    });

    it("accorde « de » au prénom : « Confirmer l'accueil d'Ines »", async () => {
      render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} famineImminente />);
      await userEvent.setup().click(accueil("Ines"));
      expect(accueil("Ines").getAttribute("aria-label")).toBe("Confirmer l'accueil d'Ines");
    });

    it("le second toucher, sur « Confirmer l'accueil », accueille le Voyageur : sa ligne part aussitôt", async () => {
      render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} famineImminente />);
      const utilisateur = userEvent.setup();
      await utilisateur.click(accueil("Joran"));
      await utilisateur.click(within(ligne("Joran")).getByRole("button", { name: "Confirmer l'accueil de Joran" }));
      expect(actions.accueillirUnVoyageur).toHaveBeenCalledExactlyOnceWith(71, null);
      expect(prenoms()).toEqual(["Ines", "Ilda"]);
      expect(alertes()).toEqual([]);
    });

    it("n'accueille personne d'un double clic sur « Accueillir » : la confirmation reste demandée", async () => {
      render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} famineImminente />);
      const utilisateur = userEvent.setup();
      await utilisateur.dblClick(accueil("Joran"));
      expect(actions.accueillirUnVoyageur).not.toHaveBeenCalled();
      expect(accueils()[1]).toEqual(["Confirmer l'accueil", true]);
      await utilisateur.click(accueil("Joran"));
      expect(actions.accueillirUnVoyageur).toHaveBeenCalledExactlyOnceWith(71, null);
    });

    it("« Refuser » annule la confirmation : sur la même ligne, il refuse le Voyageur sans l'accueillir", async () => {
      render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} famineImminente />);
      const utilisateur = userEvent.setup();
      await utilisateur.click(accueil("Joran"));
      await utilisateur.click(within(ligne("Joran")).getByRole("button", { name: "Refuser Joran" }));
      expect(actions.refuserUnVoyageur).toHaveBeenCalledExactlyOnceWith(71);
      expect(actions.accueillirUnVoyageur).not.toHaveBeenCalled();
      expect(prenoms()).toEqual(["Ines", "Ilda"]);
      expect(alertes()).toEqual([]);
    });

    it("« Refuser » sur une autre ligne annule la confirmation demandée : sa ligne revient à « Accueillir »", async () => {
      render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} famineImminente />);
      const utilisateur = userEvent.setup();
      await utilisateur.click(accueil("Joran"));
      await utilisateur.click(within(ligne("Ilda")).getByRole("button", { name: "Refuser Ilda" }));
      expect(accueils()).toEqual([
        ["Accueillir", false],
        ["Accueillir", false],
      ]);
      expect(dessous()).toEqual([null, null]);
    });

    it("un toucher ailleurs annule la confirmation ; le toucher suivant sur « Accueillir » la redemande", async () => {
      render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} famineImminente />);
      const utilisateur = userEvent.setup();
      await utilisateur.click(accueil("Joran"));
      await utilisateur.click(document.body);
      expect(accueils()[1]).toEqual(["Accueillir", false]);
      expect(dessous()).toEqual([null, null, null]);
      await utilisateur.click(accueil("Joran"));
      expect(actions.accueillirUnVoyageur).not.toHaveBeenCalled();
      expect(accueils()[1]).toEqual(["Confirmer l'accueil", true]);
    });

    it("au clavier, Échap ou passer à un autre bouton annule la confirmation", async () => {
      render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} famineImminente />);
      const utilisateur = userEvent.setup();
      accueil("Joran").focus();
      await utilisateur.keyboard("{Enter}");
      expect(accueils()[1]).toEqual(["Confirmer l'accueil", true]);
      await utilisateur.keyboard("{Escape}");
      expect(accueils()[1]).toEqual(["Accueillir", false]);
      await utilisateur.keyboard("{Enter}");
      expect(accueils()[1]).toEqual(["Confirmer l'accueil", true]);
      await utilisateur.tab();
      expect(accueils()[1]).toEqual(["Accueillir", false]);
      expect(actions.accueillirUnVoyageur).not.toHaveBeenCalled();
    });

    it("toucher « Accueillir » sur une autre ligne y porte la confirmation, sans accueillir personne", async () => {
      render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} famineImminente />);
      const utilisateur = userEvent.setup();
      await utilisateur.click(accueil("Joran"));
      await utilisateur.click(accueil("Ilda"));
      expect(actions.accueillirUnVoyageur).not.toHaveBeenCalled();
      expect(accueils()).toEqual([
        ["Accueillir", false],
        ["Accueillir", false],
        ["Confirmer l'accueil", true],
      ]);
      expect(dessous()).toEqual([null, null, PHRASE]);
    });

    it("laisse accueillir dès le premier toucher quand la page relue n'a plus l'avertissement", async () => {
      const { rerender } = render(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={MAINTENANT} famineImminente />);
      const utilisateur = userEvent.setup();
      await utilisateur.click(accueil("Joran"));
      rerender(<AuxPortes placesLibres={LIBRES} voyageurs={TROIS} maintenant={new Date(MAINTENANT.getTime() + 2_000)} famineImminente={false} />);
      expect(accueils()[1]).toEqual(["Accueillir", false]);
      await utilisateur.click(accueil("Ilda"));
      expect(actions.accueillirUnVoyageur).toHaveBeenCalledExactlyOnceWith(72, null);
    });
  });
});

describe("le compte à rebours d'un Voyageur (US-0333)", () => {
  it("dit, au bout de sa ligne, dans combien de temps il repart, à la minute supérieure", () => {
    render(<AuxPortes placesLibres={LIBRES} voyageurs={[voyageur(1, "Joran", 18 * MINUTE), voyageur(2, "Ilda", 5 * HEURE), partantDans(3, "Maëlle", 42 * MINUTE + 10_000)]} maintenant={MAINTENANT} />);
    expect(lignes()).toEqual(["Joran · arrivé il y a 18 min · repart dans 11 h 42", "Ilda · arrivé il y a 5 h · repart dans 7 h", "Maëlle · arrivé il y a 11 h · repart dans 43 min"]);
  });

  it("diminue en direct, sans recharger la page, au rythme du jeu", async () => {
    vi.useFakeTimers();
    render(<AuxPortes placesLibres={LIBRES} voyageurs={[voyageur(1, "Joran", 18 * MINUTE)]} maintenant={MAINTENANT} />);
    expect(comptes()).toEqual(["repart dans 11 h 42"]);
    await act(async () => vi.advanceTimersByTime(59_000));
    expect(comptes()).toEqual(["repart dans 11 h 42"]);
    await act(async () => vi.advanceTimersByTime(1_000));
    expect(lignes()).toEqual(["Joran · arrivé il y a 19 min · repart dans 11 h 41"]);
  });

  it("va plus vite quand le temps du jeu est accéléré : à ×60, une minute de jeu par seconde", async () => {
    vi.useFakeTimers();
    render(<AuxPortes placesLibres={LIBRES} voyageurs={[voyageur(1, "Joran", 18 * MINUTE)]} maintenant={MAINTENANT} vitesse={60} />);
    await act(async () => vi.advanceTimersByTime(3_000));
    expect(comptes()).toEqual(["repart dans 11 h 39"]);
  });

  it(`passe dans la couleur d'alerte sous ${VOYAGEUR_ALERTE_MINUTES} minutes, et pas avant`, async () => {
    vi.useFakeTimers();
    render(<AuxPortes placesLibres={LIBRES} voyageurs={[partantDans(1, "Joran", 3 * HEURE), partantDans(2, "Ilda", 60 * MINUTE + 30_000), partantDans(3, "Maëlle", 59 * MINUTE)]} maintenant={MAINTENANT} />);
    expect(comptes()).toEqual(["repart dans 3 h", "repart dans 1 h 01", "repart dans 59 min"]);
    expect(enAlerte()).toEqual([false, false, true]);
    // Une minute plus tard, Ilda passe sous l'heure : l'alerte vient avec « 59 min », pas plus tôt.
    await act(async () => vi.advanceTimersByTime(MINUTE));
    expect(comptes()).toEqual(["repart dans 2 h 59", "repart dans 1 h", "repart dans 58 min"]);
    expect(enAlerte()).toEqual([false, false, true]);
    await act(async () => vi.advanceTimersByTime(MINUTE));
    expect(comptes()).toEqual(["repart dans 2 h 58", "repart dans 59 min", "repart dans 57 min"]);
    expect(enAlerte()).toEqual([false, true, true]);
  });

  it("affiche « sur le départ », toujours en alerte, quand le compte arrive à zéro, et jamais de temps négatif", async () => {
    vi.useFakeTimers();
    render(<AuxPortes placesLibres={LIBRES} voyageurs={[partantDans(1, "Joran", 90_000), partantDans(2, "Ilda", 0), partantDans(3, "Maëlle", -2 * HEURE)]} maintenant={MAINTENANT} />);
    expect(comptes()).toEqual(["repart dans 2 min", "sur le départ", "sur le départ"]);
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(comptes()).toEqual(["repart dans 1 min", "sur le départ", "sur le départ"]);
    await act(async () => vi.advanceTimersByTime(30_000));
    expect(comptes()).toEqual(["sur le départ", "sur le départ", "sur le départ"]);
    await act(async () => vi.advanceTimersByTime(HEURE));
    expect(comptes()).toEqual(["sur le départ", "sur le départ", "sur le départ"]);
    expect(enAlerte()).toEqual([true, true, true]);
  });

  it("repart de la nouvelle heure du jeu quand la page est relue, sans compter deux fois le temps passé", async () => {
    vi.useFakeTimers();
    const joran = voyageur(1, "Joran", 18 * MINUTE);
    const { rerender } = render(<AuxPortes placesLibres={LIBRES} voyageurs={[joran]} maintenant={MAINTENANT} />);
    await act(async () => vi.advanceTimersByTime(5 * MINUTE));
    expect(comptes()).toEqual(["repart dans 11 h 37"]);
    // La barre recale la page (US-0213) : le serveur donne la nouvelle heure du jeu, cinq minutes plus tard.
    rerender(<AuxPortes placesLibres={LIBRES} voyageurs={[joran]} maintenant={new Date(MAINTENANT.getTime() + 5 * MINUTE)} />);
    expect(comptes()).toEqual(["repart dans 11 h 37"]);
    await act(async () => vi.advanceTimersByTime(MINUTE));
    expect(comptes()).toEqual(["repart dans 11 h 36"]);
  });

  it("ne se fait pas réannoncer à chaque minute par un lecteur d'écran : aucune zone annoncée", async () => {
    vi.useFakeTimers();
    render(<AuxPortes placesLibres={LIBRES} voyageurs={[voyageur(1, "Joran", 18 * MINUTE)]} maintenant={MAINTENANT} />);
    await act(async () => vi.advanceTimersByTime(MINUTE));
    expect(partie().querySelectorAll("[aria-live], [role=status], [role=timer], [role=alert], [role=log], [role=marquee]")).toHaveLength(0);
  });
});
