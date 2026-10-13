// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import kit from "@/components/kit.module.css";

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

// US-0911 : le départ, côté serveur, n'a rien à faire ici.
vi.mock("./actions", () => ({ partir: vi.fn() }));

import { Explorateurs } from "./Explorateurs";
import { Recapitulatif } from "./Recapitulatif";

/** L'adresse de l'écran d'Expédition, avec `recherche` (« ?q=3&r=-5 ») : un rechargement, ou un lien. */
const ouvrir = (recherche = "") => window.history.replaceState(null, "", `/jeu/expeditions/nouvelle${recherche}`);
/**
 * L'écran réduit à ce qui compte ici : le bloc Explorateurs, puis le récapitulatif et son départ, comme la page les range,
 * la destination déjà choisie (US-0910).
 */
const ecran = (libres: number, total: number) =>
  render(
    <>
      <Explorateurs libres={libres} total={total} />
      <Recapitulatif libres={libres} especes={[]} destination={{ q: 3, r: -5, biome: "Forêt", distance: 7 }} maintenant={new Date()} />
    </>,
  );

afterEach(() => {
  cleanup();
  ouvrir();
});

/** Le bloc Explorateurs. */
const bloc = () => screen.getByRole("heading", { name: "Explorateurs" }).closest("section")!;
/** Ses textes, dans l'ordre de la lecture. */
const textes = () => bloc().innerHTML.replace(/<[^>]+>/g, "|").split("|").filter(Boolean);
/** « + », « − », le nombre choisi entre les deux, et le bouton de départ. */
const plus = () => within(bloc()).getByRole("button", { name: "Un explorateur de plus" }) as HTMLButtonElement;
const moins = () => within(bloc()).getByRole("button", { name: "Un explorateur de moins" }) as HTMLButtonElement;
const choisis = () => within(bloc()).getByRole("status").textContent;
const partir = () => screen.getByRole("button", { name: "Partir" }) as HTMLButtonElement;
/** Ce que dit le bouton de départ pour expliquer qu'il est grisé, ou null. */
const raison = () => {
  const id = partir().getAttribute("aria-describedby");
  return id ? document.getElementById(id)!.textContent : null;
};

describe("choisir les explorateurs (US-0902)", () => {
  it("propose les explorateurs libres avec le compteur « libres / total », puis combien partent, entre « − » et « + »", () => {
    ecran(2, 3);
    expect(textes()).toEqual(["Explorateurs", "Libres", "2 / 3", "Partent", "−", "0", "+"]);
  });

  it("choisit entre « − » et « + » du pas du kit, au pouce", () => {
    ecran(2, 3);
    expect(plus().parentElement!.className.split(" ")).toContain(kit.pas);
    expect([moins(), plus()].map((b) => b.className.split(" ").includes(kit.pasBouton))).toEqual([true, true]);
  });

  it("part de zéro : le bouton de départ est grisé et dit pourquoi", () => {
    ecran(2, 3);
    expect(choisis()).toBe("0");
    expect(moins().disabled).toBe(true);
    expect(partir().disabled).toBe(true);
    expect(raison()).toBe("Il faut au moins un explorateur.");
  });

  it("dégrise le bouton de départ dès un explorateur choisi, et le regrise en revenant à zéro", async () => {
    const joueur = userEvent.setup();
    ecran(2, 3);
    await joueur.click(plus());
    expect(choisis()).toBe("1");
    expect(partir().disabled).toBe(false);
    expect(raison()).toBeNull();
    expect(screen.queryByText("Il faut au moins un explorateur.")).toBeNull();
    await joueur.click(moins());
    expect(choisis()).toBe("0");
    expect(partir().disabled).toBe(true);
    expect(raison()).toBe("Il faut au moins un explorateur.");
  });

  it("ne laisse pas choisir plus d'explorateurs qu'il n'y en a de libres : « + » se grise au dernier", async () => {
    const joueur = userEvent.setup();
    ecran(2, 3);
    await joueur.click(plus());
    await joueur.click(plus());
    expect(choisis()).toBe("2");
    expect(plus().disabled).toBe(true);
    await joueur.click(plus());
    expect(choisis()).toBe("2");
    // Le compteur ne bouge pas : choisir n'est pas partir.
    expect(textes()).toContain("2 / 3");
  });

  it("ne propose rien sans explorateur libre : zéro, « + » et le départ grisés", () => {
    ecran(0, 2);
    expect(textes()).toEqual(["Explorateurs", "Libres", "0 / 2", "Partent", "−", "0", "+"]);
    expect(plus().disabled).toBe(true);
    expect(moins().disabled).toBe(true);
    expect(partir().disabled).toBe(true);
    expect(raison()).toBe("Il faut au moins un explorateur.");
  });

  it("garde le nombre choisi dans l'adresse, avec la destination, pour le retrouver au rechargement", async () => {
    const joueur = userEvent.setup();
    ouvrir("?q=3&r=-5");
    ecran(3, 3);
    await joueur.click(plus());
    await joueur.click(plus());
    expect(window.location.search).toBe("?q=3&r=-5&explorateurs=2");
    cleanup();
    ecran(3, 3);
    expect(choisis()).toBe("2");
    expect(partir().disabled).toBe(false);
    // À zéro, l'adresse ne dit plus rien des explorateurs.
    await joueur.click(moins());
    await joueur.click(moins());
    expect(window.location.search).toBe("?q=3&r=-5");
  });

  it("ne croit pas l'adresse : jamais plus que les libres, ni moins que zéro, ni autre chose qu'un nombre entier", () => {
    for (const [recherche, attendu, depart] of [
      ["?explorateurs=9", "2", false],
      ["?explorateurs=-1", "0", true],
      ["?explorateurs=1.5", "0", true],
      ["?explorateurs=deux", "0", true],
      ["?explorateurs=", "0", true],
    ] as const) {
      ouvrir(recherche);
      ecran(2, 3);
      expect([recherche, choisis(), partir().disabled]).toEqual([recherche, attendu, depart]);
      cleanup();
    }
    // Sans explorateur libre, le départ reste grisé, quoi que dise l'adresse.
    ouvrir("?explorateurs=2");
    ecran(0, 2);
    expect([choisis(), partir().disabled, raison()]).toEqual(["0", true, "Il faut au moins un explorateur."]);
  });
});
