// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

/** Next.js relie window.history.replaceState à useSearchParams ; la simulation fait de même (comme Explorateurs.test.tsx). */
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

// US-0911 : le départ, côté serveur, n'a rien à faire ici.
vi.mock("./actions", () => ({ partir: vi.fn() }));

import { Explorateurs } from "./Explorateurs";
import { Recapitulatif } from "./Recapitulatif";
import { SansEscorte } from "./SansEscorte";

/**
 * L'écran d'une Expédition sans escorte, réduit à ce qui compte ici, comme la page le range : les explorateurs, l'escorte,
 * le récapitulatif et son départ, la destination déjà choisie (US-0910).
 */
const ecran = () =>
  render(
    <>
      <Explorateurs libres={2} total={2} />
      <SansEscorte />
      <Recapitulatif libres={2} especes={[]} destination={{ q: 3, r: -5, biome: "Forêt", distance: 7 }} maintenant={new Date()} />
    </>,
  );

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/jeu/expeditions/nouvelle");
});

/** Le bloc Escorte, et ses textes dans l'ordre de la lecture. */
const escorte = () => screen.getByRole("heading", { name: "Escorte" }).closest("section")!;
const textes = () => escorte().innerHTML.replace(/<[^>]+>/g, "|").split("|").filter(Boolean);
const partir = () => screen.getByRole("button", { name: "Partir" }) as HTMLButtonElement;

describe("partir sans escorte (US-0909)", () => {
  it("dit seulement, là où serait l'escorte, qu'il n'y a aucune Bête, sans redire ce qu'une Expédition sans escorte ramène", () => {
    ecran();
    expect(textes()).toEqual(["Escorte", "Aucune Bête"]);
    // Rien à choisir : ni bouton, ni nombre.
    expect(within(escorte()).queryAllByRole("button")).toEqual([]);
  });

  it("laisse partir au moins un explorateur sans aucune Bête : « Partir » se dégrise, sans rien réclamer d'autre", async () => {
    const joueur = userEvent.setup();
    // Le joueur est revenu à zéro explorateur : un explorateur suffit, sans Bête.
    window.history.replaceState(null, "", "/jeu/expeditions/nouvelle?explorateurs=0");
    ecran();
    expect(partir().disabled).toBe(true);
    await joueur.click(screen.getByRole("button", { name: "Un explorateur de plus" }));
    expect(partir().disabled).toBe(false);
    expect(partir().getAttribute("aria-describedby")).toBeNull();
    expect(document.body.textContent).not.toMatch(/Il faut/);
  });
});
