// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const adresse = vi.hoisted(() => ({ page: "/jeu" }));
vi.mock("next/navigation", () => ({ usePathname: () => adresse.page }));

import { Navigation } from "./Navigation";

describe("navigation du jeu (US-0302)", () => {
  afterEach(() => {
    cleanup();
    adresse.page = "/jeu";
  });

  const entrees = () => within(screen.getByRole("navigation")).getAllByRole("link");
  const marquees = () => entrees().filter((lien) => lien.getAttribute("aria-current") === "page").map((lien) => lien.textContent);

  it("mène au Foyer, à la Carte (US-0417), à l'écran d'Expédition (US-0901), à la Réserve (US-0801), aux Habitants puis aux Récits (US-0324)", () => {
    render(<Navigation />);
    expect(entrees().map((lien) => [lien.textContent, lien.getAttribute("href")])).toEqual([
      ["Foyer", "/jeu"],
      ["Carte", "/jeu/carte"],
      // US-0901 : le même écran que depuis la fiche d'une Case, sans destination choisie.
      ["Expéditions", "/jeu/expeditions/nouvelle"],
      // US-0801 : le lieu protégé où vivent les Couples.
      ["Réserve", "/jeu/reserve"],
      ["Habitants", "/jeu/habitants"],
      ["Récits", "/jeu/recits"],
    ]);
  });

  it("porte sur l'entrée « Récits » le nombre de Récits non lus, en chiffres, et le dit dans son nom (US-0324)", () => {
    render(<Navigation recitsNonLus={2} />);
    const recits = screen.getByRole("link", { name: "Récits, 2 non lus" });
    expect(recits.getAttribute("href")).toBe("/jeu/recits");
    expect(recits.textContent).toBe("Récits2");
    // La pastille ne double pas le nom pour un lecteur d'écran, et aucune autre entrée n'en porte.
    expect(within(recits).getByText("2").getAttribute("aria-hidden")).toBe("true");
    expect(entrees().map((lien) => lien.textContent)).toEqual(["Foyer", "Carte", "Expéditions", "Réserve", "Habitants", "Récits2"]);
  });

  it("accorde le nom au nombre : « Récits, 1 non lu »", () => {
    render(<Navigation recitsNonLus={1} />);
    expect(screen.getByRole("link", { name: "Récits, 1 non lu" }).textContent).toBe("Récits1");
  });

  it("n'a pas de pastille sans Récit non lu", () => {
    render(<Navigation recitsNonLus={0} />);
    const recits = screen.getByRole("link", { name: "Récits" });
    expect(recits.textContent).toBe("Récits");
    expect(recits.hasAttribute("aria-label")).toBe(false);
  });

  it("garde la pastille courte au-delà de 99, le nom donnant le nombre exact", () => {
    render(<Navigation recitsNonLus={140} />);
    expect(screen.getByRole("link", { name: "Récits, 140 non lus" }).textContent).toBe("Récits99+");
  });

  it("signale d'un repère sur l'entrée « Habitants » qu'un Voyageur attend aux portes, et le dit dans son nom (US-0332)", () => {
    render(<Navigation voyageurs={1} />);
    const habitants = screen.getByRole("link", { name: "Habitants, un Voyageur attend" });
    expect(habitants.getAttribute("href")).toBe("/jeu/habitants");
    // Un point, sans chiffre, que le lecteur d'écran ne lit pas : le nom le dit déjà.
    const repere = habitants.querySelector("[aria-hidden='true']");
    expect(repere?.textContent).toBe("");
    expect(habitants.textContent).toBe("Habitants");
    // Les autres entrées n'en portent pas.
    expect(entrees().filter((lien) => lien.querySelector("[aria-hidden='true']")).map((lien) => lien.textContent)).toEqual(["Habitants"]);
  });

  it("accorde le nom au nombre de Voyageurs, sans le montrer en chiffres : « Habitants, 2 Voyageurs attendent » (US-0332)", () => {
    render(<Navigation voyageurs={2} />);
    expect(screen.getByRole("link", { name: "Habitants, 2 Voyageurs attendent" }).textContent).toBe("Habitants");
  });

  it("n'a pas de repère quand personne n'attend aux portes (US-0332)", () => {
    render(<Navigation voyageurs={0} />);
    const habitants = screen.getByRole("link", { name: "Habitants" });
    expect(habitants.querySelector("[aria-hidden='true']")).toBeNull();
    expect(habitants.hasAttribute("aria-label")).toBe(false);
  });

  it("porte à la fois le repère des Voyageurs et la pastille des Récits non lus (US-0332)", () => {
    render(<Navigation voyageurs={3} recitsNonLus={2} />);
    expect(entrees().map((lien) => lien.getAttribute("aria-label"))).toEqual([null, null, null, null, "Habitants, 3 Voyageurs attendent", "Récits, 2 non lus"]);
  });

  it("signale du même repère sur l'entrée « Habitants » des Habitants sans Métier, et le dit dans son nom : « Habitants, 2 sans Métier » (US-0313)", () => {
    render(<Navigation sansMetier={2} />);
    const habitants = screen.getByRole("link", { name: "Habitants, 2 sans Métier" });
    expect(habitants.getAttribute("href")).toBe("/jeu/habitants");
    expect(habitants.textContent).toBe("Habitants");
    expect(habitants.querySelectorAll("[aria-hidden='true']")).toHaveLength(1);
    cleanup();
    render(<Navigation sansMetier={1} />);
    expect(screen.getByRole("link", { name: "Habitants, 1 sans Métier" }).textContent).toBe("Habitants");
  });

  it("n'a qu'un repère pour les Habitants sans Métier et les Voyageurs aux portes, et dit les deux dans son nom (US-0313)", () => {
    render(<Navigation sansMetier={2} voyageurs={1} />);
    const habitants = screen.getByRole("link", { name: "Habitants, 2 sans Métier, un Voyageur attend" });
    expect(habitants.querySelectorAll("[aria-hidden='true']")).toHaveLength(1);
    cleanup();
    render(<Navigation sansMetier={3} voyageurs={2} recitsNonLus={4} />);
    expect(entrees().map((lien) => lien.getAttribute("aria-label"))).toEqual([null, null, null, null, "Habitants, 3 sans Métier, 2 Voyageurs attendent", "Récits, 4 non lus"]);
  });

  it("retire le repère dès que tous les Habitants ont un Métier et que personne n'attend aux portes (US-0313)", () => {
    render(<Navigation sansMetier={0} voyageurs={0} />);
    const habitants = screen.getByRole("link", { name: "Habitants" });
    expect(habitants.querySelector("[aria-hidden='true']")).toBeNull();
    expect(habitants.hasAttribute("aria-label")).toBe(false);
  });

  it("marque l'entrée de la page affichée, et elle seule", () => {
    render(<Navigation />);
    expect(marquees()).toEqual(["Foyer"]);
    cleanup();
    adresse.page = "/jeu/habitants";
    render(<Navigation />);
    expect(marquees()).toEqual(["Habitants"]);
    cleanup();
    adresse.page = "/jeu/recits";
    render(<Navigation recitsNonLus={3} />);
    expect(marquees()).toEqual(["Récits3"]);
    cleanup();
    adresse.page = "/jeu/carte";
    render(<Navigation />);
    expect(marquees()).toEqual(["Carte"]);
    cleanup();
    adresse.page = "/jeu/expeditions/nouvelle";
    render(<Navigation />);
    expect(marquees()).toEqual(["Expéditions"]);
    cleanup();
    adresse.page = "/jeu/reserve";
    render(<Navigation />);
    expect(marquees()).toEqual(["Réserve"]);
  });

  it("marque l'entrée « Expéditions » sur la liste des Expéditions en cours aussi, où mène un départ (US-0911)", () => {
    adresse.page = "/jeu/expeditions";
    render(<Navigation />);
    expect(marquees()).toEqual(["Expéditions"]);
  });

  it("marque le Foyer sur la page Bêtes, qu'ouvre son bloc « Bêtes » (US-0810)", () => {
    adresse.page = "/jeu/betes";
    render(<Navigation />);
    expect(marquees()).toEqual(["Foyer"]);
  });

  it("ne marque pas le Foyer sur une autre page du jeu", () => {
    adresse.page = "/jeu/arrivee";
    render(<Navigation />);
    expect(marquees()).toEqual([]);
  });

  it("porte la marque des onglets, qui réserve leur hauteur en bas de la page sur mobile (BarreHaut.test.tsx)", () => {
    render(<Navigation />);
    expect(screen.getByRole("navigation").hasAttribute("data-onglets")).toBe(true);
  });
});
