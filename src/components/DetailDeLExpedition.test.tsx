// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExpeditionEnCours } from "@/expeditions/en-cours";

// US-0920 : le rappel, une action du serveur (src/app/jeu/expeditions/actions.ts) : ici, ce que le bouton lui confie.
const actions = vi.hoisted(() => {
  const enCours: Array<() => void> = [];
  return { enCours, rappeler: vi.fn(() => new Promise<void>((finir) => enCours.push(finir))) };
});
vi.mock("@/app/jeu/expeditions/actions", () => actions);

import { DetailDeLExpedition } from "./DetailDeLExpedition";

afterEach(() => {
  cleanup();
  actions.rappeler.mockClear();
  actions.enCours.splice(0);
});

const MINUTE_MS = 60_000;
/** Le départ : 9 h 42 à Paris. */
const DEPART = new Date("2026-10-09T07:42:00.000Z");
/** Une heure du jeu, `minutes` après le départ. */
const apres = (minutes: number) => new Date(DEPART.getTime() + minutes * MINUTE_MS);

/**
 * Une Expédition partie vers une forêt à 3 Cases du Foyer : 1 h d'aller, 4 h de séjour, 1 h de retour, avec deux
 * explorateurs et une escorte de deux Espèces, rangées comme la base les rend.
 */
const FORET: ExpeditionEnCours = {
  id: 5,
  destination: { q: 3, r: -5, biome: "Forêt", chef: null, aVous: false, zone: 0, distance: 3, anneau: 3 },
  phase: "aller",
  partLe: DEPART,
  trajetMinutes: 60,
  sejourMinutes: 240,
  explorateurs: ["Joran", "Ines"],
  escorte: [
    { id: "poule", nom: "Poule", nombre: 1 },
    { id: "souris", nom: "Souris grise", nombre: 2 },
  ],
};

/** La ligne de l'Expédition : ses textes, dans l'ordre de la lecture. */
const ligne = () => [...document.querySelectorAll("[data-ligne] > *")].map((morceau) => morceau.textContent).filter(Boolean);
/** Son détail : chaque étiquette et ce qu'elle dit. */
const detail = () => Object.fromEntries([...document.querySelectorAll("dl > div")].map((l) => [l.querySelector("dt")!.textContent, l.querySelector("dd")!.textContent]));

describe("le détail d'une Expédition en cours (US-0918)", () => {
  it("montre sa destination et sa distance, sa phase et son temps restant, puis ses explorateurs, son escorte et son retour prévu", () => {
    render(<DetailDeLExpedition expedition={FORET} instant={apres(18)} />);
    expect(ligne()).toEqual(["Forêt", "3 Cases de votre Foyer", "Aller", "arrive dans 42 min"]);
    expect(detail()).toEqual({
      Explorateurs: "Joran, Ines",
      // Le nombre ne quitte jamais son Espèce : des espaces insécables, comme au récapitulatif (US-0910).
      Escorte: "Poule × 1, Souris grise × 2",
      // 9 h 42 à Paris, plus 1 h d'aller, 4 h de séjour et 1 h de retour.
      "Retour prévu": "9 octobre à 15:42",
    });
    expect(document.querySelector("time")?.getAttribute("dateTime")).toBe("2026-10-09T13:42:00.000Z");
  });

  it("compte à rebours la phase en cours : l'arrivée à l'aller, la durée choisie en séjour, la rentrée au retour", () => {
    const { rerender } = render(<DetailDeLExpedition expedition={FORET} instant={apres(60)} />);
    expect(ligne().slice(2)).toEqual(["Séjour", "repart dans 4 h"]);
    rerender(<DetailDeLExpedition expedition={FORET} instant={apres(60 + 239.5)} />);
    expect(ligne().slice(2)).toEqual(["Séjour", "repart dans 1 min"]);
    rerender(<DetailDeLExpedition expedition={FORET} instant={apres(60 + 240 + 25)} />);
    expect(ligne().slice(2)).toEqual(["Retour", "rentre dans 35 min"]);
    // Rentrée, elle quitte la liste avec son retour au Foyer (US-0916) ; d'ici là, elle y est « de retour ».
    rerender(<DetailDeLExpedition expedition={FORET} instant={apres(60 + 240 + 60)} />);
    expect(ligne().slice(2)).toEqual(["Retour", "de retour"]);
  });

  it("compte les minutes entières sans en ajouter une : 31 min tout rond restent « 31 min »", () => {
    const { rerender } = render(<DetailDeLExpedition expedition={FORET} instant={apres(29)} />);
    expect(ligne()[3]).toBe("arrive dans 31 min");
    rerender(<DetailDeLExpedition expedition={FORET} instant={apres(60 + 240 - 125)} />);
    expect(ligne()[3]).toBe("repart dans 2 h 05");
  });

  it("dit « Aucun » quand aucun de ses explorateurs n'est plus là, plutôt qu'une ligne vide", () => {
    render(<DetailDeLExpedition expedition={{ ...FORET, explorateurs: [] }} instant={DEPART} />);
    expect(detail().Explorateurs).toBe("Aucun");
  });

  it("lit sa phase à l'heure qu'on lui donne, pas à celle où la liste a été lue", () => {
    render(<DetailDeLExpedition expedition={{ ...FORET, phase: "aller" }} instant={apres(61)} />);
    expect(ligne()[2]).toBe("Séjour");
  });

  it("dit « Case inconnue » d'une destination encore sous le brouillard", () => {
    render(<DetailDeLExpedition expedition={{ ...FORET, destination: { q: 4, r: -5, inconnue: true, distance: 1 } }} instant={DEPART} />);
    expect(ligne().slice(0, 2)).toEqual(["Case inconnue", "1 Case de votre Foyer"]);
  });

  it("dit « Sans escorte » quand aucune Bête n'est partie", () => {
    render(<DetailDeLExpedition expedition={{ ...FORET, escorte: [], explorateurs: ["Joran"] }} instant={DEPART} />);
    expect(detail()).toMatchObject({ Explorateurs: "Joran", Escorte: "Sans escorte" });
  });

  it("ne chiffre ni son temps restant ni son retour tant que le trajet d'une escorte ne l'est pas (US-0912)", () => {
    render(<DetailDeLExpedition expedition={{ ...FORET, trajetMinutes: null }} instant={apres(30 * 24 * 60)} />);
    expect(ligne().slice(2)).toEqual(["Aller", "—"]);
    expect(detail()["Retour prévu"]).toBe("—");
  });

  it("montre tout, sans rien à déplier", () => {
    render(<DetailDeLExpedition expedition={FORET} instant={DEPART} />);
    expect(screen.queryByRole("button", { name: "Détail" })).toBeNull();
  });
});

describe("rappeler une Expédition (US-0920)", () => {
  const rappeler = () => screen.queryByRole("button", { name: "Rappeler" });

  it("à l'aller, un bouton « Rappeler » la rappelle, une seule fois : il attend la réponse du serveur", async () => {
    render(<DetailDeLExpedition expedition={FORET} instant={apres(18)} />);
    await userEvent.click(rappeler()!);
    expect(actions.rappeler).toHaveBeenCalledExactlyOnceWith(5);
    expect(rappeler()).toHaveProperty("disabled", true);
    await userEvent.click(rappeler()!);
    expect(actions.rappeler).toHaveBeenCalledTimes(1);
    await act(async () => actions.enCours.splice(0).forEach((finir) => finir()));
    expect(rappeler()).toHaveProperty("disabled", false);
  });

  it("dit de quelle Expédition il s'agit à un lecteur d'écran", () => {
    render(<DetailDeLExpedition expedition={FORET} instant={apres(18)} />);
    expect(document.getElementById(rappeler()!.getAttribute("aria-describedby")!)?.textContent).toBe("Forêt");
  });

  it("en séjour aussi, pour la faire rentrer plus tôt (décidé le 2026-10-08)", () => {
    render(<DetailDeLExpedition expedition={FORET} instant={apres(60 + 30)} />);
    expect(rappeler()).not.toBeNull();
  });

  it("disparaît au retour, qu'elle soit rappelée ou au bout de son séjour", () => {
    const { rerender } = render(<DetailDeLExpedition expedition={FORET} instant={apres(60 + 240)} />);
    expect(rappeler()).toBeNull();
    rerender(<DetailDeLExpedition expedition={{ ...FORET, rappeleeLe: apres(18) }} instant={apres(18)} />);
    expect(rappeler()).toBeNull();
  });

  it("rappelée à l'aller, est au retour, qui dure le temps déjà parcouru, et son retour prévu avance d'autant", () => {
    render(<DetailDeLExpedition expedition={{ ...FORET, rappeleeLe: apres(18) }} instant={apres(25)} />);
    expect(ligne().slice(2)).toEqual(["Retour", "rentre dans 11 min"]);
    // 9 h 42 à Paris, plus 18 min d'aller et 18 min de retour.
    expect(detail()["Retour prévu"]).toBe("9 octobre à 10:18");
  });

  it("en fuite après un combat (US-0945), passe au retour avec la mention « en fuite », sans rien à rappeler", () => {
    // Attaquée 1 h 30 après son arrivée : elle rentre en 1 h, comme rappelée en séjour.
    const enFuite = { ...FORET, rappeleeLe: apres(60 + 90), enFuite: true };
    render(<DetailDeLExpedition expedition={enFuite} instant={apres(60 + 100)} />);
    expect(ligne().slice(2)).toEqual(["Retour · en fuite", "rentre dans 50 min"]);
    expect(detail()["Retour prévu"]).toBe("9 octobre à 13:12");
    expect(rappeler()).toBeNull();
  });

  it("rappelée par le joueur, elle n'est pas en fuite", () => {
    render(<DetailDeLExpedition expedition={{ ...FORET, rappeleeLe: apres(60 + 90), enFuite: false }} instant={apres(60 + 100)} />);
    expect(ligne().slice(2)).toEqual(["Retour", "rentre dans 50 min"]);
  });

  it("n'a rien à rappeler tant que son trajet n'est pas chiffré (US-0912) : il n'y aurait pas de retour", () => {
    render(<DetailDeLExpedition expedition={{ ...FORET, trajetMinutes: null }} instant={apres(18)} />);
    expect(rappeler()).toBeNull();
  });
});
