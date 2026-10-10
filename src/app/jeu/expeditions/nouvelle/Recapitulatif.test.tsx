// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EspeceDisponible } from "@/monde/effectif";
import { PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE, SEJOURS_TOUT_PRETS_MINUTES } from "@/reglages";
import type { EtatDuDepart } from "./actions";

/**
 * Next.js relie window.history.replaceState à useSearchParams ; la simulation fait de même : l'écran relit
 * l'adresse à chaque changement, sans recharger la page.
 */
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const abonnes = new Set<() => void>();
  const remplacer = window.history.replaceState.bind(window.history);
  window.history.replaceState = (...args: Parameters<History["replaceState"]>) => {
    remplacer(...args);
    abonnes.forEach((prevenir) => prevenir());
  };
  const suivre = (prevenir: () => void) => {
    abonnes.add(prevenir);
    return () => abonnes.delete(prevenir);
  };
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore(suivre, () => window.location.search)) };
});
// US-0911 : le départ, côté serveur (actions.test.ts) : ici, ce que « Partir » lui envoie, et ce qu'il en dit.
const actions = vi.hoisted(() => ({ partir: vi.fn<(avant: EtatDuDepart, formulaire: FormData) => Promise<EtatDuDepart>>(async () => ({ refus: null })) }));
vi.mock("./actions", () => actions);

import { type DestinationChoisie, Recapitulatif } from "./Recapitulatif";
import { Sejour } from "./Sejour";

/** Deux Espèces de l'effectif, rangées comme la base les rend, avec la force d'une de leurs Bêtes et leur vitesse en km/h. */
const POULE: EspeceDisponible = { id: "poule", nom: "Poule", illustration: "especes/poule.webp", disponibles: 1, force: 9457, vitesse: 14, males: 0, femelles: 1, coupleReuni: false };
const SOURIS: EspeceDisponible = { id: "souris", nom: "Souris grise", illustration: "especes/souris.webp", disponibles: 3, force: 473, vitesse: 13, males: 2, femelles: 1, coupleReuni: false };
/** Une Espèce plus lente que la marche des explorateurs, pour l'essai. */
const TORTUE: EspeceDisponible = { id: "tortue", nom: "Tortue", illustration: null, disponibles: 2, force: 120, vitesse: 3, males: 1, femelles: 1, coupleReuni: false };
/** Une forêt à 7 Cases du Foyer, et une Case encore sous le brouillard, à 12. */
const FORET = { q: 3, r: -5, biome: "Forêt", distance: 7 };
const BROUILLARD = { q: -9, r: 2, biome: null, distance: 12 };
/** L'heure du jeu à l'ouverture de l'écran : 9 h 42 à Paris, pas à la minute pile. */
const MAINTENANT = new Date("2026-10-09T07:42:13.250Z");

type Choix = { libres?: number; especes?: EspeceDisponible[]; destination?: DestinationChoisie | null; vitesse?: number };
/** L'écran d'Expédition ouvert à l'adresse `recherche` (« ?explorateurs=2&sejour=240 »), réduit à son récapitulatif. */
const ouvrir = (recherche = "", { libres = 2, especes = [POULE, SOURIS], destination = FORET, vitesse }: Choix = {}) => {
  window.history.replaceState(null, "", `/jeu/expeditions/nouvelle${recherche}`);
  return render(<Recapitulatif libres={libres} especes={especes} destination={destination} maintenant={MAINTENANT} vitesse={vitesse} />);
};
/** Un autre bloc de l'écran écrit ses choix dans l'adresse. */
const choisir = (recherche: string) => act(() => window.history.replaceState(null, "", `/jeu/expeditions/nouvelle${recherche}`));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/jeu/expeditions/nouvelle");
});

/** Le bloc Récapitulatif. */
const bloc = () => screen.getByRole("heading", { level: 2, name: "Récapitulatif" }).closest("section")!;
/** Ses lignes, chacune son étiquette et ce qu'elle dit. */
const lignes = () => [...bloc().querySelectorAll("dl > div")].map((l) => [l.querySelector("dt")!.textContent, l.querySelector("dd")!.textContent]);
const ligne = (etiquette: string) => Object.fromEntries(lignes())[etiquette];
const partir = () => within(bloc()).getByRole("button", { name: "Partir" }) as HTMLButtonElement;
/** Ce que dit le bouton de départ pour expliquer qu'il est grisé, ou null. */
const raison = () => {
  const id = partir().getAttribute("aria-describedby");
  return id ? document.getElementById(id)!.textContent : null;
};
/** « 2 h 20 » : 140 minutes de trajet, celui d'une forêt à 7 Cases au pas des explorateurs. */
const ALLER_EN_FORET = "2 h 20";

describe("le récapitulatif avant le départ (US-0910)", () => {
  it("montre les explorateurs, l'escorte, la destination et son Biome, les durées de l'aller, du séjour et du retour, et l'heure de retour prévue", () => {
    expect(7 * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE).toBe(140);
    ouvrir("?explorateurs=2&sejour=240");
    expect(lignes()).toEqual([
      ["Explorateurs", "2"],
      ["Escorte", "Sans escorte : Bêtes communes seulement"],
      ["Destination", "7 Cases de votre Foyer"],
      ["Biome", "Forêt"],
      ["Aller", ALLER_EN_FORET],
      ["Séjour", "4 h"],
      ["Retour", ALLER_EN_FORET],
      // 9 h 42 à Paris, plus 2 h 20 d'aller, 4 h de séjour et 2 h 20 de retour.
      ["Retour prévu", "9 octobre à 18:22"],
    ]);
    expect(bloc().querySelector("time")?.getAttribute("dateTime")).toBe("2026-10-09T16:22:13.250Z");
  });

  it("montre l'escorte Espèce par Espèce, dans l'ordre du bloc Escorte, et sa force à la place de « Sans escorte »", () => {
    ouvrir("?explorateurs=1&escorte=souris.3&escorte=poule.1");
    expect(ligne("Escorte")).toBe("Poule × 1, Souris grise × 3");
    // 9 457 pour la Poule, 3 × 473 pour les Souris.
    expect(ligne("Force")).toBe("10 876");
    expect(lignes().map(([etiquette]) => etiquette)).toEqual(["Explorateurs", "Escorte", "Force", "Destination", "Biome", "Aller", "Séjour", "Retour", "Retour prévu"]);
    // Les Espèces qui ne partent pas n'y sont pas.
    choisir("?explorateurs=1&escorte=souris.2");
    expect(ligne("Escorte")).toBe("Souris grise × 2");
    expect(ligne("Force")).toBe("946");
  });

  it("chiffre aussi le trajet d'une escorte : au pas des explorateurs quand ses Bêtes vont plus vite qu'eux (US-0912)", () => {
    ouvrir("?explorateurs=1&escorte=souris.3&escorte=poule.1&sejour=240");
    expect([ligne("Aller"), ligne("Séjour"), ligne("Retour"), ligne("Retour prévu")]).toEqual([ALLER_EN_FORET, "4 h", ALLER_EN_FORET, "9 octobre à 18:22"]);
  });

  it("allonge l'aller et le retour au pas de la Bête la plus lente de l'escorte, d'après la vitesse de son Espèce (US-0912)", () => {
    ouvrir("?explorateurs=1&escorte=souris.1&escorte=tortue.1&sejour=240", { especes: [SOURIS, TORTUE] });
    // À 3 km/h, 34 minutes par Case au lieu de 20 : 3 h 58 pour 7 Cases, à l'aller comme au retour, autour de 4 h de séjour.
    expect([ligne("Aller"), ligne("Retour"), ligne("Retour prévu")]).toEqual(["3 h 58", "3 h 58", "9 octobre à 21:38"]);
    // Laissée au Foyer, l'Expédition reprend le pas des explorateurs.
    choisir("?explorateurs=1&escorte=souris.1&escorte=tortue.0&sejour=240");
    expect([ligne("Aller"), ligne("Retour prévu")]).toEqual([ALLER_EN_FORET, "9 octobre à 18:22"]);
  });

  it("dit le Biome « inconnu » d'une destination encore sous le brouillard", () => {
    ouvrir("?explorateurs=1", { destination: BROUILLARD });
    expect([ligne("Destination"), ligne("Biome")]).toEqual(["12 Cases de votre Foyer", "inconnu"]);
    expect(ligne("Aller")).toBe("4 h");
  });

  it("sans destination, le dit, et ne chiffre ni le trajet ni l'heure de retour", () => {
    ouvrir("?explorateurs=1", { destination: null });
    expect(lignes()).toEqual([
      ["Explorateurs", "1"],
      ["Escorte", "Sans escorte : Bêtes communes seulement"],
      ["Destination", "Aucune"],
      ["Aller", "—"],
      ["Séjour", "1 h"],
      ["Retour", "—"],
      ["Retour prévu", "—"],
    ]);
  });

  it("dit « Sans escorte » de même quand le Territoire n'a aucune Bête disponible (US-0909)", () => {
    ouvrir("?explorateurs=1&escorte=souris.2", { especes: [] });
    expect(ligne("Escorte")).toBe("Sans escorte : Bêtes communes seulement");
    expect(ligne("Force")).toBeUndefined();
    expect(ligne("Aller")).toBe(ALLER_EN_FORET);
  });

  it("dit « Aucun » tant qu'aucun explorateur n'est choisi, et ne croit pas l'adresse plus que le bloc Explorateurs", () => {
    ouvrir();
    expect(ligne("Explorateurs")).toBe("Aucun");
    cleanup();
    ouvrir("?explorateurs=9");
    expect(ligne("Explorateurs")).toBe("2");
  });

  it("rappelle que ceux qui partent continuent de manger pendant toute l'absence", () => {
    ouvrir("?explorateurs=2");
    expect(within(bloc()).getByText("Ceux qui partent continuent de manger pendant toute l'absence.")).toBeTruthy();
  });

  it("suit chaque choix de l'écran, au fil de la composition, sans recharger la page", () => {
    ouvrir("?explorateurs=1");
    expect([ligne("Séjour"), ligne("Retour prévu")]).toEqual(["1 h", "9 octobre à 15:22"]);
    choisir("?explorateurs=2&sejour=720");
    expect([ligne("Explorateurs"), ligne("Séjour"), ligne("Retour prévu")]).toEqual(["2", "12 h", "10 octobre à 02:22"]);
    choisir("?explorateurs=2&sejour=720&escorte=poule.1");
    expect([ligne("Force"), ligne("Retour prévu")]).toEqual(["9 457", "10 octobre à 02:22"]);
  });

  it("avance l'heure de retour prévue avec l'heure du jeu, sans recharger la page", async () => {
    vi.useFakeTimers();
    ouvrir("?explorateurs=1");
    expect(ligne("Retour prévu")).toBe("9 octobre à 15:22");
    await act(async () => vi.advanceTimersByTime(46_000));
    expect(ligne("Retour prévu")).toBe("9 octobre à 15:22");
    // 9 h 43 à Paris : l'heure prévue passe à la minute suivante.
    await act(async () => vi.advanceTimersByTime(1_000));
    expect(ligne("Retour prévu")).toBe("9 octobre à 15:23");
  });

  it("l'avance plus vite quand le temps du jeu est accéléré : à ×60, une minute de jeu par seconde", async () => {
    vi.useFakeTimers();
    ouvrir("?explorateurs=1", { vitesse: 60 });
    await act(async () => vi.advanceTimersByTime(3_000));
    expect(ligne("Retour prévu")).toBe("9 octobre à 15:25");
  });

  it("garde la première durée toute prête tant que l'adresse ne dit aucun séjour qu'on aurait pu choisir", () => {
    expect(SEJOURS_TOUT_PRETS_MINUTES[0]).toBe(60);
    ouvrir("?explorateurs=1&sejour=45");
    expect(ligne("Séjour")).toBe("1 h");
  });
});

describe("partir depuis le récapitulatif (US-0910)", () => {
  it("finit sur « Partir », grisé tant qu'un choix manque, qui nomme ce qui manque", () => {
    for (const [recherche, destination, attendue] of [
      ["", null, "Il faut une destination et au moins un explorateur."],
      ["", FORET, "Il faut au moins un explorateur."],
      ["?explorateurs=1", null, "Il faut une destination."],
    ] as const) {
      ouvrir(recherche, { destination });
      expect([partir().disabled, raison()]).toEqual([true, attendue]);
      cleanup();
    }
  });

  it("se dégrise dès qu'une destination et un explorateur sont choisis, sans escorte comme avec, et ne réclame plus rien", () => {
    ouvrir("?explorateurs=1");
    expect([partir().disabled, raison()]).toEqual([false, null]);
    expect(bloc().textContent).not.toMatch(/Il faut/);
    choisir("?explorateurs=1&escorte=souris.3");
    expect([partir().disabled, raison()]).toEqual([false, null]);
    choisir("");
    expect([partir().disabled, raison()]).toEqual([true, "Il faut au moins un explorateur."]);
  });
});

describe("confirmer le départ (US-0911)", () => {
  afterEach(() => actions.partir.mockReset());
  /** Ce que « Partir » a envoyé au départ, champ par champ, dans l'ordre du formulaire. */
  const envoye = () => [...actions.partir.mock.calls[0][1].entries()];

  it("envoie la destination, les explorateurs et l'escorte que l'écran montre, et le séjour du curseur", async () => {
    const joueur = userEvent.setup();
    actions.partir.mockResolvedValue({ refus: null });
    // Plus de souris que de disponibles : l'écran en montre trois, et c'est ce qui part.
    window.history.replaceState(null, "", "/jeu/expeditions/nouvelle?explorateurs=2&escorte=souris.9&escorte=poule.1&sejour=240");
    render(
      <>
        <Sejour />
        <Recapitulatif libres={2} especes={[POULE, SOURIS]} destination={FORET} maintenant={MAINTENANT} />
      </>,
    );
    // Le curseur encore tenu, avant que l'adresse garde la durée : elle part telle qu'il la montre.
    fireEvent.input(screen.getByRole("slider", { name: "Durée du séjour" }), { target: { value: "150" } });
    await joueur.click(partir());
    expect(actions.partir).toHaveBeenCalledTimes(1);
    expect(envoye()).toEqual([
      ["sejour", "150"],
      ["q", "3"],
      ["r", "-5"],
      ["explorateurs", "2"],
      ["escorte", "poule.1"],
      ["escorte", "souris.3"],
    ]);
  });

  it("n'envoie aucune Bête sans escorte (US-0909)", async () => {
    const joueur = userEvent.setup();
    ouvrir("?explorateurs=1&escorte=souris.0");
    await joueur.click(partir());
    expect(envoye().filter(([nom]) => nom === "escorte")).toEqual([]);
  });

  it("se grise le temps de l'envoi, pour ne partir qu'une fois", async () => {
    const joueur = userEvent.setup();
    let repondre: (etat: EtatDuDepart) => void = () => {};
    actions.partir.mockImplementation(() => new Promise((fin) => (repondre = fin)));
    ouvrir("?explorateurs=1");
    await joueur.click(partir());
    expect(partir().disabled).toBe(true);
    await act(async () => repondre({ refus: null }));
    expect(partir().disabled).toBe(false);
  });

  it("dit pourquoi le départ est refusé, juste sous « Partir », sans quitter l'écran", async () => {
    const joueur = userEvent.setup();
    actions.partir.mockResolvedValue({ refus: "Départ refusé : un explorateur n'est plus libre." });
    ouvrir("?explorateurs=2");
    await joueur.click(partir());
    expect(within(bloc()).getByRole("alert").textContent).toBe("Départ refusé : un explorateur n'est plus libre.");
    expect(raison()).toBe("Départ refusé : un explorateur n'est plus libre.");
    expect(partir().disabled).toBe(false);
  });

  it("ne dit plus ce refus dès que le joueur change un choix, même s'il y revient", async () => {
    const joueur = userEvent.setup();
    actions.partir.mockResolvedValue({ refus: "Départ refusé : un explorateur n'est plus libre." });
    ouvrir("?explorateurs=2");
    await joueur.click(partir());
    expect(within(bloc()).getByRole("alert")).toBeTruthy();
    choisir("?explorateurs=1");
    expect(within(bloc()).queryByRole("alert")).toBeNull();
    choisir("?explorateurs=2");
    expect(within(bloc()).queryByRole("alert")).toBeNull();
    expect(raison()).toBeNull();
  });

  it("ne part pas tant qu'un choix manque", async () => {
    const joueur = userEvent.setup();
    ouvrir("", { destination: null });
    await joueur.click(partir());
    expect(actions.partir).not.toHaveBeenCalled();
  });
});

describe("le récapitulatif et le bloc Séjour (US-0910)", () => {
  it("suit la durée du séjour pas à pas, curseur encore tenu, avant même que l'adresse la garde au lâcher", () => {
    window.history.replaceState(null, "", "/jeu/expeditions/nouvelle?explorateurs=1");
    render(
      <>
        <Sejour />
        <Recapitulatif libres={2} especes={[POULE, SOURIS]} destination={FORET} maintenant={MAINTENANT} />
      </>,
    );
    expect(ligne("Séjour")).toBe("1 h");
    const curseur = screen.getByRole<HTMLInputElement>("slider", { name: "Durée du séjour" });
    fireEvent.input(curseur, { target: { value: "150" } });
    expect(window.location.search).toBe("?explorateurs=1");
    // 9 h 42 à Paris, plus 2 h 20 d'aller, 2 h 30 de séjour et 2 h 20 de retour.
    expect([ligne("Séjour"), ligne("Retour prévu")]).toEqual(["2 h 30", "9 octobre à 16:52"]);
    fireEvent.change(curseur);
    expect(window.location.search).toBe("?explorateurs=1&sejour=150");
    expect(ligne("Séjour")).toBe("2 h 30");
  });

  it("reprend la durée de l'adresse quand le bloc Séjour n'est plus là", () => {
    window.history.replaceState(null, "", "/jeu/expeditions/nouvelle?explorateurs=1&sejour=240");
    const { unmount } = render(<Sejour />);
    fireEvent.input(screen.getByRole("slider", { name: "Durée du séjour" }), { target: { value: "150" } });
    unmount();
    ouvrir("?explorateurs=1&sejour=240");
    expect(ligne("Séjour")).toBe("4 h");
  });
});

describe("le récapitulatif sur un téléphone (US-0910)", () => {
  it("garde en vue, replié, l'heure de retour prévue, seule ligne essentielle, et « Partir », hors des lignes", () => {
    ouvrir("?explorateurs=2");
    const essentielles = [...bloc().querySelectorAll("dl > [data-essentiel]")].map((l) => l.querySelector("dt")!.textContent);
    expect(essentielles).toEqual(["Retour prévu"]);
    // « Partir » et ce qui manque, enfants du bloc, ni repliés ni défilants avec les lignes.
    expect(partir().parentElement!.parentElement).toBe(bloc());
    expect(bloc().querySelector("dl")!.contains(partir())).toBe(false);
  });

  it("se déplie et se replie d'un bouton qui dit son état, sans rien changer à ce qu'il montre", async () => {
    const joueur = userEvent.setup();
    ouvrir("?explorateurs=2");
    const deplier = within(bloc()).getByRole("button", { name: "Tout le récapitulatif" });
    expect(deplier.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(deplier.getAttribute("aria-controls")!)).toBe(bloc().querySelector("dl"));
    const avant = lignes();
    await joueur.click(deplier);
    expect(deplier.getAttribute("aria-expanded")).toBe("true");
    expect(lignes()).toEqual(avant);
    await joueur.click(deplier);
    expect(deplier.getAttribute("aria-expanded")).toBe("false");
  });
});
