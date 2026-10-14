// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EspeceDisponible } from "@/monde/effectif";

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

import { Escorte } from "./Escorte";

/**
 * Deux Espèces de l'effectif, rangées comme la base les rend, avec la force d'une de leurs Bêtes, leur vitesse, et les
 * mâles et femelles que le joueur en possède (US-0937), et une Espèce sans illustration.
 */
const POULE: EspeceDisponible = { id: "poule", nom: "Poule", illustration: "especes/poule.webp", disponibles: 1, force: 9457, vitesse: 14, males: 0, femelles: 1, coupleReuni: false };
const SOURIS: EspeceDisponible = { id: "souris", nom: "Souris grise", illustration: "especes/souris.webp", disponibles: 3, force: 473, vitesse: 13, males: 2, femelles: 1, coupleReuni: false };
const SANS_ILLUSTRATION: EspeceDisponible = { id: "bete_d_essai", nom: "Bête d'essai", illustration: null, disponibles: 2, force: 1, vitesse: 10, males: 1, femelles: 1, coupleReuni: false };

/** L'adresse de l'écran d'Expédition, avec `recherche` (« ?q=3&r=-5 ») : un rechargement, ou un lien. */
const ouvrir = (recherche = "") => window.history.replaceState(null, "", `/jeu/expeditions/nouvelle${recherche}`);
const ecran = (especes: EspeceDisponible[] = [POULE, SOURIS]) => render(<Escorte especes={especes} />);

afterEach(() => {
  cleanup();
  ouvrir();
});

/** Le bloc Escorte. */
const bloc = () => screen.getByRole("heading", { name: "Escorte" }).closest("section")!;
/** Ses textes, dans l'ordre de la lecture. */
const textes = () => bloc().innerHTML.replace(/<[^>]+>/g, "|").split("|").filter(Boolean);
/** Les choix d'une Espèce, nommés par elle, et sa ligne entière. */
const choix = (nom: string) => within(bloc()).getByRole("group", { name: nom });
const ligne = (nom: string) => choix(nom).closest("li")!;
/** Un bouton des choix d'une Espèce, et le nombre de ses Bêtes qui partent. */
const bouton = (nom: string, bouton: string) => within(choix(nom)).getByRole("button", { name: bouton }) as HTMLButtonElement;
const choisies = (nom: string) => within(choix(nom)).getByRole("status").textContent;
/** Ce qui est grisé parmi « − », « + », « Toutes » et « Aucune ». */
const grises = (nom: string) => ["Une Bête de moins", "Une Bête de plus", "Toutes", "Aucune"].filter((b) => bouton(nom, b).disabled);
/** US-0905 : la force de l'escorte choisie, telle que le bloc l'affiche. */
const force = () => within(bloc()).getByRole("status", { name: "Force" }).textContent;

describe("choisir l'escorte (US-0904)", () => {
  it("propose chaque Espèce de l'effectif avec le nombre de Bêtes disponibles, puis combien partent", () => {
    ecran();
    expect(textes()).toEqual([
      "Escorte",
      "Poule",
      "1 disponible",
      "0 mâle · 1 femelle",
      "−",
      "0",
      "+",
      "Toutes",
      "Aucune",
      "Souris grise",
      "3 disponibles",
      "2 mâles · 1 femelle",
      "−",
      "0",
      "+",
      "Toutes",
      "Aucune",
      "Force",
      "0",
    ]);
  });

  it("montre l'illustration de chaque Espèce, et la tête de loup pour une Espèce qui n'en a pas", () => {
    ecran([SOURIS, SANS_ILLUSTRATION]);
    const portrait = within(ligne("Souris grise")).getByRole("img", { name: "Souris grise" });
    expect(portrait.getAttribute("src")).toContain(encodeURIComponent("/illustrations/especes/souris.webp"));
    const loup = within(ligne("Bête d'essai")).getByRole("img", { name: "Bête d'essai" });
    expect(loup.tagName).toBe("DIV");
    expect(loup.querySelector("svg")).not.toBeNull();
  });

  it("ne propose pas d'escorte sans aucune Bête : le bloc n'apparaît pas", () => {
    const { container } = ecran([]);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByRole("heading", { name: "Escorte" })).toBeNull();
  });

  it("part de zéro Bête pour chaque Espèce : « − » et « Aucune » grisés", () => {
    ecran();
    expect([choisies("Poule"), choisies("Souris grise")]).toEqual(["0", "0"]);
    expect(grises("Souris grise")).toEqual(["Une Bête de moins", "Aucune"]);
  });

  it("ajoute et retire une Bête à la fois, sans jamais dépasser le nombre disponible", async () => {
    const joueur = userEvent.setup();
    ecran();
    await joueur.click(bouton("Souris grise", "Une Bête de plus"));
    await joueur.click(bouton("Souris grise", "Une Bête de plus"));
    expect(choisies("Souris grise")).toBe("2");
    expect(grises("Souris grise")).toEqual([]);
    await joueur.click(bouton("Souris grise", "Une Bête de moins"));
    expect(choisies("Souris grise")).toBe("1");
    // La seule Poule : « + » et « Toutes » se grisent à la première.
    await joueur.click(bouton("Poule", "Une Bête de plus"));
    expect(choisies("Poule")).toBe("1");
    expect(grises("Poule")).toEqual(["Une Bête de plus", "Toutes"]);
    await joueur.click(bouton("Poule", "Une Bête de plus"));
    expect(choisies("Poule")).toBe("1");
  });

  it("« Toutes » prend le maximum d'une Espèce, « Aucune » la remet à zéro, sans toucher aux autres", async () => {
    const joueur = userEvent.setup();
    ecran();
    await joueur.click(bouton("Poule", "Une Bête de plus"));
    await joueur.click(bouton("Souris grise", "Toutes"));
    expect([choisies("Poule"), choisies("Souris grise")]).toEqual(["1", "3"]);
    expect(grises("Souris grise")).toEqual(["Une Bête de plus", "Toutes"]);
    await joueur.click(bouton("Souris grise", "Aucune"));
    expect([choisies("Poule"), choisies("Souris grise")]).toEqual(["1", "0"]);
    expect(grises("Souris grise")).toEqual(["Une Bête de moins", "Aucune"]);
  });

  it("ne retient aucune Bête : le nombre disponible ne bouge pas tant qu'on choisit", async () => {
    const joueur = userEvent.setup();
    ecran();
    await joueur.click(bouton("Souris grise", "Toutes"));
    expect(within(ligne("Souris grise")).getByText("3 disponibles")).toBeTruthy();
  });

  it("garde l'escorte dans l'adresse, avec les autres choix, pour la retrouver au rechargement", async () => {
    const joueur = userEvent.setup();
    ouvrir("?q=3&r=-5&explorateurs=2");
    ecran();
    await joueur.click(bouton("Souris grise", "Une Bête de plus"));
    await joueur.click(bouton("Souris grise", "Une Bête de plus"));
    await joueur.click(bouton("Poule", "Toutes"));
    expect(window.location.search).toBe("?q=3&r=-5&explorateurs=2&escorte=poule.1&escorte=souris.2");
    cleanup();
    ecran();
    expect([choisies("Poule"), choisies("Souris grise")]).toEqual(["1", "2"]);
    // À zéro, l'adresse ne dit plus rien de l'escorte.
    await joueur.click(bouton("Poule", "Aucune"));
    await joueur.click(bouton("Souris grise", "Aucune"));
    expect(window.location.search).toBe("?q=3&r=-5&explorateurs=2");
  });

  it("ne croit pas l'adresse : jamais plus que les disponibles, ni moins que zéro, ni une Espèce que l'écran ne propose pas", async () => {
    for (const [recherche, attendu] of [
      ["?escorte=souris.9", "3"],
      ["?escorte=souris.-1", "0"],
      ["?escorte=souris.1.5", "0"],
      ["?escorte=souris.deux", "0"],
      ["?escorte=souris", "0"],
      ["?escorte=Souris.2", "0"],
      ["?escorte=souris.2&escorte=souris.1", "2"],
    ] as const) {
      ouvrir(recherche);
      ecran();
      expect([recherche, choisies("Souris grise"), choisies("Poule")]).toEqual([recherche, attendu, "0"]);
      cleanup();
    }
    // Le premier choix nettoie l'adresse : ce qui n'y valait rien n'y reste pas.
    const joueur = userEvent.setup();
    ouvrir("?escorte=pigeon.2&escorte=souris.9");
    ecran();
    await joueur.click(bouton("Souris grise", "Une Bête de moins"));
    expect(window.location.search).toBe("?escorte=souris.2");
  });
});

describe("la force de l'escorte (US-0905)", () => {
  it("vaut zéro sans escorte : aucune Bête choisie", () => {
    ecran();
    expect(force()).toBe("0");
  });

  it("se met à jour à chaque Bête ajoutée ou retirée : la simple somme des forces de ses Bêtes", async () => {
    const joueur = userEvent.setup();
    ecran();
    await joueur.click(bouton("Souris grise", "Une Bête de plus"));
    expect(force()).toBe("473");
    await joueur.click(bouton("Souris grise", "Une Bête de plus"));
    expect(force()).toBe("946");
    await joueur.click(bouton("Poule", "Toutes"));
    expect(force()).toBe("10 403");
    await joueur.click(bouton("Souris grise", "Une Bête de moins"));
    expect(force()).toBe("9 930");
    await joueur.click(bouton("Souris grise", "Toutes"));
    expect(force()).toBe("10 876");
    await joueur.click(bouton("Poule", "Aucune"));
    await joueur.click(bouton("Souris grise", "Aucune"));
    expect(force()).toBe("0");
  });

  it("compte l'escorte gardée dans l'adresse, au rechargement, sans rien de ce que l'adresse dit de trop", () => {
    ouvrir("?escorte=souris.2&escorte=poule.5&escorte=pigeon.4");
    ecran();
    expect(force()).toBe("10 403");
  });

  it("écrit un grand total d'un tenant, ses milliers séparés d'une espace insécable", () => {
    ouvrir("?escorte=elephant.1000");
    ecran([{ id: "elephant", nom: "Éléphant de savane", illustration: null, disponibles: 1000, force: 5_286_856, vitesse: 40, males: 600, femelles: 400, coupleReuni: false }]);
    expect(force()).toBe("5 286 856 000");
  });
});

describe("les mâles et les femelles de l'effectif (US-0937)", () => {
  /** Ce que la ligne d'une Espèce dit de ses mâles et de ses femelles. */
  const sexes = (nom: string) => within(ligne(nom)).getByText(/mâle/).textContent;

  it("dit, sous les disponibles de chaque Espèce, combien de mâles et de femelles le joueur possède", () => {
    ecran([POULE, SOURIS, SANS_ILLUSTRATION]);
    expect([sexes("Poule"), sexes("Souris grise"), sexes("Bête d'essai")]).toEqual(["0 mâle · 1 femelle", "2 mâles · 1 femelle", "1 mâle · 1 femelle"]);
  });

  it("montre les mâles et les femelles possédés même au-delà des disponibles : les Bêtes parties en escorte en sont", () => {
    ecran([{ ...SOURIS, disponibles: 1, males: 3, femelles: 2 }]);
    expect(within(ligne("Souris grise")).getByText("1 disponible")).toBeTruthy();
    expect(sexes("Souris grise")).toBe("3 mâles · 2 femelles");
  });

  it("ne bouge pas tant qu'on choisit l'escorte : rien n'est encore parti", async () => {
    const joueur = userEvent.setup();
    ecran();
    await joueur.click(bouton("Souris grise", "Toutes"));
    expect(sexes("Souris grise")).toBe("2 mâles · 1 femelle");
  });

  it("ne les dit plus pour une Espèce dont le Couple est réuni (US-0956) : le sexe ne compte plus", () => {
    ecran([POULE, { ...SOURIS, disponibles: 2, males: 2, femelles: 0, coupleReuni: true }]);
    expect(within(ligne("Souris grise")).getByText("2 disponibles")).toBeTruthy();
    expect(within(ligne("Souris grise")).queryByText(/mâle|femelle/)).toBeNull();
    expect(sexes("Poule")).toBe("0 mâle · 1 femelle");
  });
});

describe("les Blessés de l'effectif (US-0952)", () => {
  it("distingue, sous les disponibles d'une Espèce, chaque groupe de Blessés et le temps restant avant sa guérison", () => {
    render(
      <Escorte
        especes={[POULE, { ...SOURIS, disponibles: 6 }]}
        blesses={{
          souris: [
            { nombre: 2, dansMinutes: 300 },
            { nombre: 1, dansMinutes: 1_380 },
          ],
        }}
      />,
    );
    expect(textes().slice(9, 15)).toEqual(["Souris grise", "6 disponibles", "2 mâles · 1 femelle", "2 Blessés, guéris dans 5 h", "1 Blessé, guéri dans 23 h", "−"]);
  });

  it("une Espèce dont toutes les Bêtes au Foyer sont blessées n'en propose aucune : ses Blessés ne partent pas (US-0953)", () => {
    render(<Escorte especes={[{ ...SOURIS, disponibles: 0, blesses: 3 }]} blesses={{ souris: [{ nombre: 3, dansMinutes: 60 }] }} />);
    expect(within(ligne("Souris grise")).getByText("0 disponible")).toBeTruthy();
    expect(within(ligne("Souris grise")).getByText("3 Blessés, guéris dans 1 h")).toBeTruthy();
    expect(grises("Souris grise")).toEqual(["Une Bête de moins", "Une Bête de plus", "Toutes", "Aucune"]);
  });

  it("dit les Blessés soignés à leur retour : « 2 Blessés soignés, guéris dans 11 h » (US-0955)", () => {
    render(
      <Escorte
        especes={[POULE, { ...SOURIS, disponibles: 6 }]}
        blesses={{
          souris: [
            { nombre: 2, dansMinutes: 660, soignes: true },
            { nombre: 1, dansMinutes: 1_380 },
          ],
        }}
      />,
    );
    expect(textes().slice(12, 14)).toEqual(["2 Blessés soignés, guéris dans 11 h", "1 Blessé, guéri dans 23 h"]);
  });

  it("sans Blessé, rien de plus, pas même une ligne vide", () => {
    render(<Escorte especes={[POULE, SOURIS]} blesses={{ souris: [] }} />);
    const sansBlesses = textes();
    cleanup();
    ecran();
    expect(textes()).toEqual(sansBlesses);
    expect(within(bloc()).queryByText(/Blessé/)).toBeNull();
  });
});

describe("emmener des Éclaireurs (US-0976)", () => {
  /** Une Espèce Éclaireuse, son Rôle (US-0806) : ses Bêtes peuvent partir en Éclaireurs. */
  const PIGEON: EspeceDisponible = { id: "pigeon", nom: "Pigeon biset", illustration: "especes/pigeon.webp", disponibles: 3, force: 2216, vitesse: 80, males: 2, femelles: 1, coupleReuni: false, eclaireuse: true };
  /** Les choix des Éclaireurs d'une Espèce, nommés par eux et par elle ; un de leurs boutons, et leur nombre. */
  const eclaireurs = (nom: string) => within(bloc()).getByRole("group", { name: `Éclaireurs ${nom}` });
  const boutonEclaireur = (nom: string, b: string) => within(eclaireurs(nom)).getByRole("button", { name: b }) as HTMLButtonElement;
  const eclaireursChoisis = (nom: string) => within(eclaireurs(nom)).getByRole("status").textContent;

  it("pour une Espèce Éclaireuse, propose à côté de l'escorte combien de ses Bêtes partent comme Éclaireurs ; pas pour les autres", () => {
    ecran([SOURIS, PIGEON]);
    expect(within(ligne("Pigeon biset")).getAllByText("Éclaireurs")).toHaveLength(1);
    expect(eclaireursChoisis("Pigeon biset")).toBe("0");
    expect(within(ligne("Souris grise")).queryByText("Éclaireurs")).toBeNull();
    expect(within(bloc()).queryByRole("group", { name: "Éclaireurs Souris grise" })).toBeNull();
  });

  it("une même Bête est l'un ou l'autre : l'escorte et les Éclaireurs d'une Espèce ne dépassent jamais ses disponibles", async () => {
    const joueur = userEvent.setup();
    ecran([SOURIS, PIGEON]);
    await joueur.click(boutonEclaireur("Pigeon biset", "Un Éclaireur de plus"));
    await joueur.click(boutonEclaireur("Pigeon biset", "Un Éclaireur de plus"));
    expect(eclaireursChoisis("Pigeon biset")).toBe("2");
    // Il ne reste qu'un pigeon pour l'escorte : « Toutes » le prend, et plus rien ne s'ajoute, ni d'un côté ni de l'autre.
    await joueur.click(bouton("Pigeon biset", "Toutes"));
    expect(choisies("Pigeon biset")).toBe("1");
    expect(grises("Pigeon biset")).toEqual(["Une Bête de plus", "Toutes"]);
    expect(boutonEclaireur("Pigeon biset", "Un Éclaireur de plus").disabled).toBe(true);
    // Un pigeon rendu à l'escorte peut partir en Éclaireur.
    await joueur.click(bouton("Pigeon biset", "Une Bête de moins"));
    await joueur.click(boutonEclaireur("Pigeon biset", "Un Éclaireur de plus"));
    expect([choisies("Pigeon biset"), eclaireursChoisis("Pigeon biset")]).toEqual(["0", "3"]);
    expect(boutonEclaireur("Pigeon biset", "Un Éclaireur de moins").disabled).toBe(false);
    // Les disponibles ne bougent pas tant qu'on choisit.
    expect(within(ligne("Pigeon biset")).getByText("3 disponibles")).toBeTruthy();
  });

  it("les Éclaireurs n'ajoutent rien à la force de l'escorte", async () => {
    const joueur = userEvent.setup();
    ecran([SOURIS, PIGEON]);
    await joueur.click(bouton("Pigeon biset", "Une Bête de plus"));
    expect(force()).toBe("2\u00a0216");
    await joueur.click(boutonEclaireur("Pigeon biset", "Un Éclaireur de plus"));
    await joueur.click(boutonEclaireur("Pigeon biset", "Un Éclaireur de plus"));
    expect(force()).toBe("2\u00a0216");
  });

  it("garde les Éclaireurs dans l'adresse, avec l'escorte, pour les retrouver au rechargement ; à zéro, l'adresse n'en dit rien", async () => {
    const joueur = userEvent.setup();
    ouvrir("?q=3&r=-5");
    ecran([SOURIS, PIGEON]);
    await joueur.click(bouton("Pigeon biset", "Une Bête de plus"));
    await joueur.click(boutonEclaireur("Pigeon biset", "Un Éclaireur de plus"));
    expect(window.location.search).toBe("?q=3&r=-5&escorte=pigeon.1&eclaireurs=pigeon.1");
    cleanup();
    ecran([SOURIS, PIGEON]);
    expect([choisies("Pigeon biset"), eclaireursChoisis("Pigeon biset")]).toEqual(["1", "1"]);
    await joueur.click(boutonEclaireur("Pigeon biset", "Un Éclaireur de moins"));
    expect(window.location.search).toBe("?q=3&r=-5&escorte=pigeon.1");
  });

  it("ne croit pas l'adresse : jamais plus que ce que l'escorte laisse, ni d'Éclaireurs d'une Espèce qui n'en a pas le Rôle", () => {
    for (const [recherche, escorte, partis] of [
      ["?eclaireurs=pigeon.9", "0", "3"],
      ["?escorte=pigeon.2&eclaireurs=pigeon.9", "2", "1"],
      ["?escorte=pigeon.9&eclaireurs=pigeon.1", "3", "0"],
      ["?eclaireurs=pigeon.-1", "0", "0"],
      ["?eclaireurs=pigeon.2&eclaireurs=pigeon.1", "0", "2"],
    ] as const) {
      ouvrir(recherche);
      ecran([SOURIS, PIGEON]);
      expect([recherche, choisies("Pigeon biset"), eclaireursChoisis("Pigeon biset")]).toEqual([recherche, escorte, partis]);
      cleanup();
    }
    ouvrir("?eclaireurs=souris.2");
    ecran([SOURIS, PIGEON]);
    expect(choisies("Souris grise")).toBe("0");
    expect(within(bloc()).queryByRole("group", { name: "Éclaireurs Souris grise" })).toBeNull();
  });
});

describe("les Bêtes affectées à leur Rôle (US-0842)", () => {
  it("dit, sous les disponibles d'une Espèce, combien de ses Bêtes sont affectées : elles ne sont pas parmi les disponibles", () => {
    render(<Escorte especes={[{ ...POULE, disponibles: 3, affectees: 2 }, SOURIS]} blesses={{ poule: [{ nombre: 1, dansMinutes: 60 }] }} />);
    expect(textes().slice(1, 6)).toEqual(["Poule", "3 disponibles", "0 mâle · 1 femelle", "2 affectées", "1 Blessé, guéri dans 1 h"]);
  });

  it("une Espèce dont toutes les Bêtes valides sont affectées n'en propose aucune : ses affectées ne partent pas", () => {
    render(<Escorte especes={[{ ...POULE, disponibles: 0, affectees: 1 }]} />);
    expect(within(ligne("Poule")).getByText("0 disponible")).toBeTruthy();
    expect(within(ligne("Poule")).getByText("1 affectée")).toBeTruthy();
    expect(grises("Poule")).toEqual(["Une Bête de moins", "Une Bête de plus", "Toutes", "Aucune"]);
  });

  it("sans affectée, rien de plus", () => {
    ecran();
    expect(within(bloc()).queryByText(/affectée/)).toBeNull();
  });
});
