// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExpeditionEnCours } from "@/expeditions/en-cours";

// US-0920 : le rappel, une action du serveur (actions.ts) : ici, ce que le bouton lui confie.
const actions = vi.hoisted(() => {
  const enCours: Array<() => void> = [];
  return { enCours, rappeler: vi.fn(() => new Promise<void>((finir) => enCours.push(finir))) };
});
vi.mock("./actions", () => actions);

import { PanneauDeLExpedition } from "./PanneauDeLExpedition";

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

/** Ce qui est posé sur le paysage : la destination, sa distance, puis la phase et le temps restant, dans sa pastille. */
const ligne = () => {
  const [destination, distance, puce] = document.querySelector("[data-ligne]")!.children;
  return [destination, distance, ...puce.children].map((morceau) => morceau.textContent);
};
/** Son détail : chaque étiquette et ce qu'elle dit. */
const detail = () => Object.fromEntries([...document.querySelectorAll("dl > div")].map((l) => [l.querySelector("dt")!.textContent, l.querySelector("dd")!.textContent]));
/** La frise : chaque temps, et où il en est. */
const frise = () => [...document.querySelectorAll("[data-etat]")].map((t) => [t.textContent, t.getAttribute("data-etat"), (t as HTMLElement).style.getPropertyValue("--part")]);
const deplier = () => screen.getByRole("button", { name: "Détail" });

describe("une Expédition en cours, dans son panneau (US-0918)", () => {
  it("montre sa destination et sa distance, sa phase et son temps restant, puis ses explorateurs, son escorte et son retour prévu", () => {
    render(<PanneauDeLExpedition expedition={FORET} instant={apres(18)} />);
    expect(ligne()).toEqual(["Forêt", "3 Cases de votre Foyer", "Aller", "arrive dans 42 min"]);
    expect(detail()).toEqual({
      // Un prénom après l'autre, chacun son médaillon.
      Explorateurs: "Joran Ines",
      // Le nombre ne quitte jamais son Espèce : une espace insécable, comme au récapitulatif (US-0910).
      Escorte: "Poule × 1 Souris grise × 2",
      // 9 h 42 à Paris, plus 1 h d'aller, 4 h de séjour et 1 h de retour.
      "Retour prévu": "9 octobre à 15:42",
    });
    expect(document.querySelector("time")?.getAttribute("dateTime")).toBe("2026-10-09T13:42:00.000Z");
  });

  it("se nomme par sa destination, pour un lecteur d'écran", () => {
    render(<PanneauDeLExpedition expedition={FORET} instant={apres(18)} />);
    expect(screen.getByRole("article", { name: "Forêt" })).toBeTruthy();
  });

  it("peint le paysage de son Biome, et la brume pour une Case encore sous le brouillard", () => {
    const { rerender } = render(<PanneauDeLExpedition expedition={FORET} instant={DEPART} />);
    expect(document.querySelector("img")?.getAttribute("src")).toContain(encodeURIComponent("/illustrations/prototype/biomes/forest-1.webp"));
    expect(document.querySelector("svg path[d^='M0-36']")).toBeNull();
    rerender(<PanneauDeLExpedition expedition={{ ...FORET, destination: { q: 4, r: -5, inconnue: true, distance: 1 } }} instant={DEPART} />);
    expect(document.querySelector("svg path[d^='M0-36']")).not.toBeNull();
  });

  it("montre chaque explorateur avec son médaillon, et chaque Espèce de l'escorte avec son portrait", () => {
    render(<PanneauDeLExpedition expedition={FORET} instant={DEPART} />);
    const [explorateurs, escorte] = document.querySelectorAll("dd");
    expect(explorateurs.querySelectorAll("img")).toHaveLength(2);
    expect([...escorte.querySelectorAll("img")].map((i) => i.getAttribute("src"))).toEqual([
      expect.stringContaining(encodeURIComponent("/illustrations/especes/poule.webp")),
      expect.stringContaining(encodeURIComponent("/illustrations/especes/souris.webp")),
    ]);
  });

  it("compte à rebours la phase en cours : l'arrivée à l'aller, la durée choisie en séjour, la rentrée au retour", () => {
    const { rerender } = render(<PanneauDeLExpedition expedition={FORET} instant={apres(60)} />);
    expect(ligne().slice(2)).toEqual(["Séjour", "repart dans 4 h"]);
    rerender(<PanneauDeLExpedition expedition={FORET} instant={apres(60 + 239.5)} />);
    expect(ligne().slice(2)).toEqual(["Séjour", "repart dans 1 min"]);
    rerender(<PanneauDeLExpedition expedition={FORET} instant={apres(60 + 240 + 25)} />);
    expect(ligne().slice(2)).toEqual(["Retour", "rentre dans 35 min"]);
    // Rentrée, elle quitte la liste avec son retour au Foyer (US-0916) ; d'ici là, elle y est « de retour ».
    rerender(<PanneauDeLExpedition expedition={FORET} instant={apres(60 + 240 + 60)} />);
    expect(ligne().slice(2)).toEqual(["Retour", "de retour"]);
  });

  it("compte les minutes entières sans en ajouter une : 31 min tout rond restent « 31 min »", () => {
    const { rerender } = render(<PanneauDeLExpedition expedition={FORET} instant={apres(29)} />);
    expect(ligne()[3]).toBe("arrive dans 31 min");
    rerender(<PanneauDeLExpedition expedition={FORET} instant={apres(60 + 240 - 125)} />);
    expect(ligne()[3]).toBe("repart dans 2 h 05");
  });

  it("remplit sa frise jusqu'où elle en est : les temps passés pleins, la phase en cours à sa part, ceux à venir creux", () => {
    const { rerender } = render(<PanneauDeLExpedition expedition={FORET} instant={apres(15)} />);
    expect(frise()).toEqual([
      ["Aller", "en-cours", "25%"],
      ["Séjour", "a-venir", ""],
      ["Retour", "a-venir", ""],
    ]);
    rerender(<PanneauDeLExpedition expedition={FORET} instant={apres(60 + 60)} />);
    expect(frise().map(([, etat, part]) => [etat, part])).toEqual([
      ["fait", ""],
      ["en-cours", "25%"],
      ["a-venir", ""],
    ]);
    rerender(<PanneauDeLExpedition expedition={FORET} instant={apres(60 + 240 + 45)} />);
    expect(frise().map(([, etat, part]) => [etat, part])).toEqual([
      ["fait", ""],
      ["fait", ""],
      ["en-cours", "75%"],
    ]);
  });

  it("dit « Aucun » quand aucun de ses explorateurs n'est plus là, plutôt qu'une ligne vide", () => {
    render(<PanneauDeLExpedition expedition={{ ...FORET, explorateurs: [] }} instant={DEPART} />);
    expect(detail().Explorateurs).toBe("Aucun");
  });

  it("lit sa phase à l'heure qu'on lui donne, pas à celle où la liste a été lue", () => {
    render(<PanneauDeLExpedition expedition={{ ...FORET, phase: "aller" }} instant={apres(61)} />);
    expect(ligne()[2]).toBe("Séjour");
  });

  it("dit « Case inconnue » d'une destination encore sous le brouillard", () => {
    render(<PanneauDeLExpedition expedition={{ ...FORET, destination: { q: 4, r: -5, inconnue: true, distance: 1 } }} instant={DEPART} />);
    expect(ligne().slice(0, 2)).toEqual(["Case inconnue", "1 Case de votre Foyer"]);
  });

  it("montre ses Éclaireurs à part de l'escorte, Espèce par Espèce, et rien sans Éclaireur (US-0976)", () => {
    const { rerender } = render(<PanneauDeLExpedition expedition={{ ...FORET, eclaireurs: [{ id: "pigeon", nom: "Pigeon biset", nombre: 2 }] }} instant={DEPART} />);
    expect(Object.keys(detail())).toEqual(["Explorateurs", "Escorte", "Éclaireurs", "Retour prévu"]);
    expect(detail()).toMatchObject({ Escorte: "Poule × 1 Souris grise × 2", Éclaireurs: "Pigeon biset × 2" });
    rerender(<PanneauDeLExpedition expedition={{ ...FORET, escorte: [], eclaireurs: [{ id: "pigeon", nom: "Pigeon biset", nombre: 3 }] }} instant={DEPART} />);
    expect(detail()).toMatchObject({ Escorte: "Sans escorte", Éclaireurs: "Pigeon biset × 3" });
    rerender(<PanneauDeLExpedition expedition={FORET} instant={DEPART} />);
    expect(Object.keys(detail())).not.toContain("Éclaireurs");
  });

  it("dit « Sans escorte » quand aucune Bête n'est partie", () => {
    render(<PanneauDeLExpedition expedition={{ ...FORET, escorte: [], explorateurs: ["Joran"] }} instant={DEPART} />);
    expect(detail()).toMatchObject({ Explorateurs: "Joran", Escorte: "Sans escorte" });
  });

  it("ne chiffre ni son temps restant ni son retour tant que le trajet d'une escorte ne l'est pas (US-0912)", () => {
    render(<PanneauDeLExpedition expedition={{ ...FORET, trajetMinutes: null }} instant={apres(30 * 24 * 60)} />);
    expect(ligne().slice(2)).toEqual(["Aller", "—"]);
    expect(detail()["Retour prévu"]).toBe("—");
    expect(frise()[0]).toEqual(["Aller", "en-cours", "0%"]);
  });

  it("sur un téléphone, se déplie d'un toucher pour montrer son détail, et se replie de même", async () => {
    render(<PanneauDeLExpedition expedition={FORET} instant={DEPART} />);
    expect(deplier().getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(deplier().getAttribute("aria-controls")!)?.querySelector("dl")).not.toBeNull();
    // Un lecteur d'écran entend aussi de quelle Expédition il s'agit, et où elle en est.
    const decrit = deplier()
      .getAttribute("aria-describedby")!
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent);
    expect(decrit).toEqual(["Forêt", "Aller", "arrive dans 1 h"]);
    await userEvent.click(deplier());
    expect(deplier().getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(deplier());
    expect(deplier().getAttribute("aria-expanded")).toBe("false");
  });
});

describe("rappeler une Expédition (US-0920)", () => {
  const rappeler = () => screen.queryByRole("button", { name: "Rappeler" });

  it("à l'aller, un bouton « Rappeler » la rappelle, une seule fois : il attend la réponse du serveur", async () => {
    render(<PanneauDeLExpedition expedition={FORET} instant={apres(18)} />);
    await userEvent.click(rappeler()!);
    expect(actions.rappeler).toHaveBeenCalledExactlyOnceWith(5);
    expect(rappeler()).toHaveProperty("disabled", true);
    await userEvent.click(rappeler()!);
    expect(actions.rappeler).toHaveBeenCalledTimes(1);
    await act(async () => actions.enCours.splice(0).forEach((finir) => finir()));
    expect(rappeler()).toHaveProperty("disabled", false);
  });

  it("dit de quelle Expédition il s'agit à un lecteur d'écran", () => {
    render(<PanneauDeLExpedition expedition={FORET} instant={apres(18)} />);
    expect(document.getElementById(rappeler()!.getAttribute("aria-describedby")!)?.textContent).toBe("Forêt");
  });

  it("en séjour aussi, pour la faire rentrer plus tôt (décidé le 2026-10-08)", () => {
    render(<PanneauDeLExpedition expedition={FORET} instant={apres(60 + 30)} />);
    expect(rappeler()).not.toBeNull();
  });

  it("disparaît au retour, qu'elle soit rappelée ou au bout de son séjour", () => {
    const { rerender } = render(<PanneauDeLExpedition expedition={FORET} instant={apres(60 + 240)} />);
    expect(rappeler()).toBeNull();
    rerender(<PanneauDeLExpedition expedition={{ ...FORET, rappeleeLe: apres(18) }} instant={apres(18)} />);
    expect(rappeler()).toBeNull();
  });

  it("rappelée à l'aller, est au retour, qui dure le temps déjà parcouru, et son retour prévu avance d'autant", () => {
    render(<PanneauDeLExpedition expedition={{ ...FORET, rappeleeLe: apres(18) }} instant={apres(25)} />);
    expect(ligne().slice(2)).toEqual(["Retour", "rentre dans 11 min"]);
    // 9 h 42 à Paris, plus 18 min d'aller et 18 min de retour.
    expect(detail()["Retour prévu"]).toBe("9 octobre à 10:18");
    // Sa frise : le retour, depuis le rappel, fait à 7 minutes sur 18.
    expect(frise()[2]).toEqual(["Retour", "en-cours", "39%"]);
  });

  it("en fuite après un combat (US-0945), est au retour avec la mention « en fuite », sans rien à rappeler", () => {
    // Attaquée 1 h 30 après son arrivée : elle rentre en 1 h, comme rappelée en séjour.
    render(<PanneauDeLExpedition expedition={{ ...FORET, rappeleeLe: apres(60 + 90), enFuite: true }} instant={apres(60 + 100)} />);
    expect(ligne().slice(2)).toEqual(["Retour · en fuite", "rentre dans 50 min"]);
    expect(detail()["Retour prévu"]).toBe("9 octobre à 13:12");
    expect(rappeler()).toBeNull();
  });

  it("rappelée par le joueur, elle n'est pas en fuite", () => {
    render(<PanneauDeLExpedition expedition={{ ...FORET, rappeleeLe: apres(60 + 90), enFuite: false }} instant={apres(60 + 100)} />);
    expect(ligne().slice(2)).toEqual(["Retour", "rentre dans 50 min"]);
  });

  it("ne se propose pas sans trajet chiffré : aucun retour, rien à rappeler (US-0912)", () => {
    render(<PanneauDeLExpedition expedition={{ ...FORET, trajetMinutes: null }} instant={apres(10)} />);
    expect(rappeler()).toBeNull();
  });
});
