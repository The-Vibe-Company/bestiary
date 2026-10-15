// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// La page relue après chaque naissance.
const routeur = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routeur }));

import { ElevagesEnCours } from "./ElevagesEnCours";

const MINUTE = 60_000;
/** L'heure du jeu à l'affichage de l'accueil : midi à Paris. */
const MAINTENANT = new Date("2026-10-15T10:00:00Z");
/**
 * Deux Élevages en cours, un par éleveur, rangés par prénom : trois poules confiées à Brune, la première née, la
 * deuxième dans 7 h 28 ; deux souris confiées à Hael, aucune née, la première dans 10 min.
 */
const POULES = { especeId: "poule", espece: "Poule", illustration: "especes/poule.webp", eleveur: "Brune", quantite: 3, lanceLe: new Date(MAINTENANT.getTime() - 500 * MINUTE), dureeMinutes: 474 };
const SOURIS = { especeId: "souris", espece: "Souris", illustration: null, eleveur: "Hael", quantite: 2, lanceLe: new Date(MAINTENANT.getTime() - 5 * MINUTE), dureeMinutes: 15 };

describe("les Élevages en cours, sur l'accueil (US-0818)", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    routeur.refresh.mockReset();
  });

  /** Le bloc, sous son titre « Élevages ». */
  const bloc = () => screen.getByRole("heading", { name: "Élevages" }).closest("section")!;
  /** Chaque ligne du bloc, ses textes l'un après l'autre (le médaillon n'en a pas). */
  const lignes = () =>
    within(bloc())
      .queryAllByRole("listitem")
      .map((li) => [...li.querySelectorAll("span")].filter((s) => s.children.length === 0 && s.textContent).map((s) => s.textContent));

  it("résume chaque Élevage en cours, un par éleveur : l'Espèce, son éleveur, le temps avant la prochaine Bête, et les Bêtes nées sur la quantité", () => {
    render(<ElevagesEnCours elevages={[POULES, SOURIS]} maintenant={MAINTENANT} />);
    expect(lignes()).toEqual([
      ["Poule", "Brune · prochaine dans 7 h 28", "1 / 3"],
      ["Souris", "Hael · prochaine dans 10 min", "0 / 2"],
    ]);
  });

  it("mène chaque ligne au bloc « Élever » de la fiche de son Espèce, sous le médaillon de sa peinture", () => {
    render(<ElevagesEnCours elevages={[POULES, SOURIS]} maintenant={MAINTENANT} />);
    const liens = within(bloc()).getAllByRole("link");
    expect(liens.map((a) => a.getAttribute("href"))).toEqual(["/jeu/reserve/poule#elever", "/jeu/reserve/souris#elever"]);
    expect(decodeURIComponent(liens[0].querySelector("img")?.getAttribute("src") ?? "")).toContain("/illustrations/especes/poule.webp");
    // Sans illustration, l'emplacement vide du médaillon.
    expect(liens[1].querySelector("img")).toBeNull();
  });

  it("dit « Aucun Élevage en cours » sans Élevage en cours", () => {
    render(<ElevagesEnCours elevages={[]} maintenant={MAINTENANT} />);
    expect(bloc().textContent).toBe("ÉlevagesAucun Élevage en cours");
  });

  it("fait avancer le décompte et les naissances sans recharger, au rythme du jeu ; un Élevage fini quitte le bloc", async () => {
    vi.useFakeTimers();
    render(<ElevagesEnCours elevages={[SOURIS]} maintenant={MAINTENANT} vitesse={60} />);
    // Une seconde réelle, une minute de jeu.
    await act(async () => vi.advanceTimersByTime(4_000));
    expect(lignes()).toEqual([["Souris", "Hael · prochaine dans 6 min", "0 / 2"]]);
    await act(async () => vi.advanceTimersByTime(6_000));
    expect(lignes()).toEqual([["Souris", "Hael · prochaine dans 15 min", "1 / 2"]]);
    await act(async () => vi.advanceTimersByTime(15_000));
    expect(bloc().textContent).toBe("ÉlevagesAucun Élevage en cours");
  });

  it("relit la page une seconde réelle après la prochaine naissance, pour le total des Bêtes", async () => {
    vi.useFakeTimers();
    render(<ElevagesEnCours elevages={[POULES, SOURIS]} maintenant={MAINTENANT} vitesse={60} />);
    // La première souris naît dix minutes de jeu après l'affichage : dix secondes réelles.
    await act(async () => vi.advanceTimersByTime(10_999));
    expect(routeur.refresh).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(routeur.refresh).toHaveBeenCalledOnce();
  });

  it("ne relit rien sans Élevage en cours", async () => {
    vi.useFakeTimers();
    render(<ElevagesEnCours elevages={[]} maintenant={MAINTENANT} vitesse={60} />);
    await act(async () => vi.advanceTimersByTime(60 * MINUTE));
    expect(routeur.refresh).not.toHaveBeenCalled();
  });

  it("dit « Aucun éleveur » pour un Élevage dont l'éleveur n'est plus là", () => {
    render(<ElevagesEnCours elevages={[{ ...SOURIS, eleveur: null }]} maintenant={MAINTENANT} />);
    expect(lignes()).toEqual([["Souris", "Aucun éleveur · prochaine dans 10 min", "0 / 2"]]);
  });
});
