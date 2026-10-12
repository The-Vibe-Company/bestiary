// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serveur = vi.hoisted(() => ({ seDeconnecter: vi.fn(async () => {}) }));
vi.mock("@/comptes/deconnexion", () => serveur);
const recharger = vi.hoisted(() => ({ rechargerVers: vi.fn() }));
vi.mock("./recharger", () => recharger);

import { MenuChef } from "./MenuChef";

describe("nom de chef dans la barre du haut (US-0140)", () => {
  beforeEach(() => {
    serveur.seDeconnecter.mockClear();
    recharger.rechargerVers.mockClear();
  });
  afterEach(cleanup);

  const nom = () => screen.getByRole("button", { name: "Le grand ours de" });

  it("montre le nom, lisible en entier au survol, menu fermé", () => {
    render(<MenuChef nom="Le grand ours de" />);
    expect(nom().getAttribute("title")).toBe("Le grand ours de");
    expect(nom().getAttribute("aria-haspopup")).toBe("menu");
    expect(nom().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("ouvre un menu avec le nom en entier et « Se déconnecter », prêt au clavier", async () => {
    const u = userEvent.setup();
    render(<MenuChef nom="Le grand ours de" />);
    await u.click(nom());
    expect(nom().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByText("Le grand ours de", { selector: "p" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Se déconnecter" }));
  });

  it("ne propose rien d'autre que « Se déconnecter » tant que le jeu n'a pas d'autre page (US-0163)", async () => {
    const u = userEvent.setup();
    render(<MenuChef nom="Ourse" />);
    await u.click(screen.getByRole("button", { name: "Ourse" }));
    expect(screen.getAllByRole("menuitem").map((choix) => choix.textContent)).toEqual(["Se déconnecter"]);
    expect(screen.getByRole("menu").querySelectorAll("a")).toHaveLength(0);
  });

  it("se referme d'un nouveau clic sur le nom", async () => {
    const u = userEvent.setup();
    render(<MenuChef nom="Ourse" />);
    await u.click(screen.getByRole("button", { name: "Ourse" }));
    await u.click(screen.getByRole("button", { name: "Ourse" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("se referme avec Échap, et rend le regard au nom", async () => {
    const u = userEvent.setup();
    render(<MenuChef nom="Ourse" />);
    await u.click(screen.getByRole("button", { name: "Ourse" }));
    await u.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ourse" }));
  });

  it("se referme d'un clic ailleurs", async () => {
    const u = userEvent.setup();
    render(
      <>
        <MenuChef nom="Ourse" />
        <p>Ailleurs</p>
      </>,
    );
    await u.click(screen.getByRole("button", { name: "Ourse" }));
    await u.click(screen.getByText("Ailleurs"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("se referme quand le clavier quitte le menu", async () => {
    const u = userEvent.setup();
    render(
      <>
        <MenuChef nom="Ourse" />
        <button type="button">Plus loin</button>
      </>,
    );
    await u.click(screen.getByRole("button", { name: "Ourse" }));
    await u.tab();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("déconnecte depuis le menu", async () => {
    const u = userEvent.setup();
    render(<MenuChef nom="Ourse" />);
    await u.click(screen.getByRole("button", { name: "Ourse" }));
    await u.click(screen.getByRole("menuitem", { name: "Se déconnecter" }));
    await vi.waitFor(() => expect(recharger.rechargerVers).toHaveBeenCalledWith("/"));
    expect(serveur.seDeconnecter).toHaveBeenCalledTimes(1);
  });
});

describe("le nombre de Couples réunis dans le menu du chef (US-0958)", () => {
  afterEach(cleanup);

  /** La ligne « Couples réunis » du menu ouvert, ou null. */
  const ligne = () => screen.queryByText("Couples réunis")?.parentElement ?? null;

  it("montre sous le nom, d'une ligne sobre, « Couples réunis » suivi du nombre", async () => {
    const u = userEvent.setup();
    render(<MenuChef nom="Ourse" couplesReunis={2} />);
    expect(screen.queryByText("Couples réunis")).toBeNull();
    await u.click(screen.getByRole("button", { name: "Ourse" }));
    expect(ligne()?.textContent).toBe("Couples réunis2");
    expect([...ligne()!.children].map((morceau) => morceau.textContent)).toEqual(["Couples réunis", "2"]);
    // Sous le nom en entier, avant « Se déconnecter » ; ce n'est pas un choix du menu.
    const nom = screen.getByText("Ourse", { selector: "p" });
    expect(nom.compareDocumentPosition(ligne()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ligne()!.compareDocumentPosition(screen.getByRole("menu")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("menuitem").map((choix) => choix.textContent)).toEqual(["Se déconnecter"]);
  });

  it("dit zéro tant qu'aucun Couple n'est réuni", async () => {
    const u = userEvent.setup();
    render(<MenuChef nom="Ourse" couplesReunis={0} />);
    await u.click(screen.getByRole("button", { name: "Ourse" }));
    expect(ligne()?.textContent).toBe("Couples réunis0");
  });

  it("ne la montre pas sans Territoire, avant l'entrée dans le Foyer", async () => {
    const u = userEvent.setup();
    render(<MenuChef nom="Ourse" />);
    await u.click(screen.getByRole("button", { name: "Ourse" }));
    expect(ligne()).toBeNull();
  });
});
