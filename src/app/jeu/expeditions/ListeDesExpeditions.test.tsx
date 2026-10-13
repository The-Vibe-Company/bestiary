// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExpeditionEnCours } from "@/expeditions/en-cours";

// US-0916 : le routeur, observé pour voir la page se relire au retour d'une Expédition.
const routeur = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routeur }));
// US-0920 : le rappel, une action du serveur (src/app/jeu/expeditions/actions.ts).
vi.mock("./actions", () => ({ rappeler: vi.fn() }));

import { ListeDesExpeditions } from "./ListeDesExpeditions";
import panneau from "./PanneauDeLExpedition.module.css";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  routeur.refresh.mockClear();
});

const MINUTE_MS = 60_000;
/** L'heure du jeu à l'affichage de la page : 9 h 42 à Paris, pas à la minute pile. */
const MAINTENANT = new Date("2026-10-09T07:42:13.250Z");
/** Une heure du jeu, `minutes` avant l'affichage. */
const avant = (minutes: number) => new Date(MAINTENANT.getTime() - minutes * MINUTE_MS);

/** Une Expédition vers une forêt à 3 Cases, 1 h d'aller et de retour, 4 h de séjour, partie à `partLe`. */
const vers = (id: number, partLe: Date, autre: Partial<ExpeditionEnCours> = {}): ExpeditionEnCours => ({
  id,
  destination: { q: 3, r: -5, biome: "Forêt", chef: null, aVous: false, zone: 0, distance: 3, anneau: 3 },
  phase: "aller",
  partLe,
  trajetMinutes: 60,
  sejourMinutes: 240,
  explorateurs: ["Joran"],
  escorte: [],
  ...autre,
});

/** Chaque Expédition de la liste : sa phase et son temps restant, dans la pastille posée sur son paysage. */
const comptes = () => [...document.querySelectorAll("li [data-ligne]")].map((l) => [...l.children[2].children].map((m) => m.textContent));

describe("la liste des Expéditions en cours, en direct (US-0918)", () => {
  it("montre chaque Expédition, dans l'ordre de la lecture, chacune avec son temps restant", () => {
    render(<ListeDesExpeditions expeditions={[vers(5, avant(18)), vers(6, avant(90), { destination: { q: 4, r: -5, inconnue: true, distance: 1 } })]} maintenant={MAINTENANT} />);
    expect(comptes()).toEqual([
      ["Aller", "arrive dans 42 min"],
      ["Séjour", "repart dans 3 h 30"],
    ]);
    expect([...document.querySelectorAll("li strong")].map((d) => d.textContent)).toEqual(["Forêt", "Case inconnue"]);
  });

  it("fait avancer les comptes à rebours sans recharger la page, et change la phase à son heure", async () => {
    vi.useFakeTimers();
    // Partie il y a 59 min : elle arrive dans 47 s, à la minute supérieure « 1 min ».
    render(<ListeDesExpeditions expeditions={[vers(5, new Date(avant(59).getTime() - 13_250)), vers(6, avant(18))]} maintenant={MAINTENANT} />);
    expect(comptes()).toEqual([
      ["Aller", "arrive dans 1 min"],
      ["Aller", "arrive dans 42 min"],
    ]);
    await act(async () => vi.advanceTimersByTime(46_000));
    expect(comptes()[0]).toEqual(["Aller", "arrive dans 1 min"]);
    await act(async () => vi.advanceTimersByTime(1_000));
    expect(comptes()).toEqual([
      ["Séjour", "repart dans 4 h"],
      ["Aller", "arrive dans 42 min"],
    ]);
    await act(async () => vi.advanceTimersByTime(MINUTE_MS));
    expect(comptes()[1]).toEqual(["Aller", "arrive dans 41 min"]);
  });

  it("suit le rythme du jeu, quand il est accéléré", async () => {
    vi.useFakeTimers();
    render(<ListeDesExpeditions expeditions={[vers(5, avant(18))]} maintenant={MAINTENANT} vitesse={60} />);
    // 3 s à × 60 : 3 minutes du jeu.
    await act(async () => vi.advanceTimersByTime(3_000));
    expect(comptes()).toEqual([["Aller", "arrive dans 39 min"]]);
  });

  it("repart de la nouvelle heure du jeu quand la page est relue", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<ListeDesExpeditions expeditions={[vers(5, avant(18))]} maintenant={MAINTENANT} />);
    await act(async () => vi.advanceTimersByTime(2 * MINUTE_MS));
    expect(comptes()).toEqual([["Aller", "arrive dans 40 min"]]);
    // Relue 10 minutes du jeu plus tard : le temps déjà écoulé dans le navigateur ne compte plus.
    rerender(<ListeDesExpeditions expeditions={[vers(5, avant(18))]} maintenant={new Date(MAINTENANT.getTime() + 10 * MINUTE_MS)} />);
    expect(comptes()).toEqual([["Aller", "arrive dans 32 min"]]);
  });

  it("serre les panneaux au-delà de deux Expéditions, pour en voir plus d'un coup d'œil", () => {
    const { rerender } = render(<ListeDesExpeditions expeditions={[vers(5, avant(18)), vers(6, avant(90))]} maintenant={MAINTENANT} />);
    const serres = () => [...document.querySelectorAll("li > article")].map((a) => a.classList.contains(panneau.serre));
    expect(serres()).toEqual([false, false]);
    rerender(<ListeDesExpeditions expeditions={[vers(5, avant(18)), vers(6, avant(90)), vers(7, avant(100))]} maintenant={MAINTENANT} />);
    expect(serres()).toEqual([true, true, true]);
  });

  it("se déplie Expédition par Expédition sur un téléphone, et se replie de même", async () => {
    render(<ListeDesExpeditions expeditions={[vers(5, avant(18)), vers(6, avant(90))]} maintenant={MAINTENANT} />);
    const boutons = () => [...document.querySelectorAll("li button[aria-expanded]")];
    const etats = () => boutons().map((b) => b.getAttribute("aria-expanded"));
    expect(etats()).toEqual(["false", "false"]);
    await userEvent.click(boutons()[1]);
    expect(etats()).toEqual(["false", "true"]);
    await userEvent.click(boutons()[0]);
    expect(etats()).toEqual(["true", "true"]);
    await userEvent.click(boutons()[1]);
    expect(etats()).toEqual(["true", "false"]);
  });
});

describe("le séjour sur la Case, en direct (US-0915)", () => {
  it("passe en séjour à l'arrivée avec le compte à rebours de la durée choisie, puis repart seule vers le Foyer à sa fin", async () => {
    vi.useFakeTimers();
    // Partie il y a 59 min 30 s, au rythme du jeu × 60 : elle arrive dans 30 s du jeu ; son séjour dure 4 h.
    render(<ListeDesExpeditions expeditions={[vers(5, new Date(avant(59).getTime() - 30_000))]} maintenant={MAINTENANT} vitesse={60} />);
    expect(comptes()).toEqual([["Aller", "arrive dans 1 min"]]);
    await act(async () => vi.advanceTimersByTime(1_000));
    expect(comptes()).toEqual([["Séjour", "repart dans 4 h"]]);
    // 3 h 59 du jeu plus tard, sans rien toucher ni recharger : la dernière minute du séjour.
    await act(async () => vi.advanceTimersByTime(239_000));
    expect(comptes()).toEqual([["Séjour", "repart dans 1 min"]]);
    await act(async () => vi.advanceTimersByTime(1_000));
    expect(comptes()).toEqual([["Retour", "rentre dans 1 h"]]);
  });
});

describe("le retour au Foyer, en direct (US-0916)", () => {
  it("relit la page juste après le retour de la première Expédition qui rentre, pour qu'elle quitte la liste", async () => {
    vi.useFakeTimers();
    // Parties il y a 5 h 59 min 30 s et 2 h : la première rentre dans 30 s, la seconde dans 4 h.
    render(<ListeDesExpeditions expeditions={[vers(5, avant(6 * 60 - 0.5)), vers(6, avant(2 * 60))]} maintenant={MAINTENANT} />);
    expect(comptes()[0]).toEqual(["Retour", "rentre dans 1 min"]);
    await act(async () => vi.advanceTimersByTime(30_000));
    expect(comptes()[0]).toEqual(["Retour", "de retour"]);
    expect(routeur.refresh).not.toHaveBeenCalled();
    // Une seconde réelle plus tard, le temps que le serveur l'ait fait rentrer.
    await act(async () => vi.advanceTimersByTime(1_000));
    expect(routeur.refresh).toHaveBeenCalledTimes(1);
  });

  it("suit le rythme du jeu, et repart de la page relue pour l'Expédition suivante", async () => {
    vi.useFakeTimers();
    // Au rythme du jeu × 60, la première rentre dans 30 s réelles, la seconde dans 4 min réelles.
    const { rerender } = render(<ListeDesExpeditions expeditions={[vers(5, avant(6 * 60 - 30)), vers(6, avant(2 * 60))]} maintenant={MAINTENANT} vitesse={60} />);
    await act(async () => vi.advanceTimersByTime(31_000));
    expect(routeur.refresh).toHaveBeenCalledTimes(1);
    // La page relue n'a plus que la seconde, lue 35 minutes du jeu après l'affichage, plus tard que l'horloge du
    // navigateur : elle rentre dans 3 h 25 du jeu, 3 min 25 s réelles, et non plus dans les 3 min 29 de la première lecture.
    rerender(<ListeDesExpeditions expeditions={[vers(6, avant(2 * 60))]} maintenant={new Date(MAINTENANT.getTime() + 35 * MINUTE_MS)} vitesse={60} />);
    await act(async () => vi.advanceTimersByTime(205_000));
    expect(routeur.refresh).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(1_000));
    expect(routeur.refresh).toHaveBeenCalledTimes(2);
  });

  it("ne relit pas la page pour une Expédition déjà de retour à l'affichage, ni pour une dont le retour n'est pas chiffré", async () => {
    vi.useFakeTimers();
    render(<ListeDesExpeditions expeditions={[vers(5, avant(7 * 60)), vers(6, avant(10), { trajetMinutes: null })]} maintenant={MAINTENANT} />);
    expect(comptes()).toEqual([
      ["Retour", "de retour"],
      ["Aller", "—"],
    ]);
    await act(async () => vi.advanceTimersByTime(24 * 60 * MINUTE_MS));
    expect(routeur.refresh).not.toHaveBeenCalled();
  });
});
