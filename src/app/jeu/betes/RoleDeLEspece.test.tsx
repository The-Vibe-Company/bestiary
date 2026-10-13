// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import kit from "@/components/kit.module.css";

/** Les actions serveur, tenues en suspens jusqu'à ce que le test les laisse finir. */
const actions = vi.hoisted(() => {
  const enCours: Array<() => void> = [];
  const enSuspens = () => new Promise<void>((finir) => enCours.push(finir));
  return { enCours, affecterAuRole: vi.fn(enSuspens), retirerDuRole: vi.fn(enSuspens) };
});
vi.mock("./actions", () => actions);

import { RoleDeLEspece } from "./RoleDeLEspece";

const NOURRICIER = { id: "nourricier", nom: "Nourricier" };

/** Laisse finir les actions en suspens : React attend qu'elles aient toutes fini pour clore leurs transitions. */
const finirLesActions = () => act(async () => actions.enCours.splice(0).forEach((finir) => finir()));

afterEach(async () => {
  await finirLesActions();
  cleanup();
  actions.affecterAuRole.mockClear();
  actions.retirerDuRole.mockClear();
});

/** Le Rôle de la poule, avec `affectees` poules affectées, `valides` valides au Foyer, sur un effectif de `effectif`. */
const role = (affectees: number, valides: number, effectif: number) =>
  render(<RoleDeLEspece especeId="poule" nom="Poule" role={NOURRICIER} affectees={affectees} valides={valides} effectif={effectif} />);
const groupe = () => screen.getByRole("group", { name: "Poule, Nourricier" });
const plus = () => within(groupe()).getByRole("button", { name: "Une Bête de plus au Rôle de Nourricier" }) as HTMLButtonElement;
const moins = () => within(groupe()).getByRole("button", { name: "Une Bête de moins au Rôle de Nourricier" }) as HTMLButtonElement;
const compte = () => within(groupe()).getByRole("status").textContent;

describe("affecter des Bêtes à leur Rôle depuis la page Bêtes (US-0837)", () => {
  it("dit le Rôle, puis le pas du kit : « − », le compte « affectées / effectif », « + »", () => {
    role(2, 4, 5);
    expect(groupe().textContent).toBe("Nourricier−2 / 5+");
    expect(within(groupe()).getByText("Nourricier").className).toContain(kit.etiquette);
    expect(plus().parentElement!.className.split(" ")).toContain(kit.pas);
    expect(plus().className.split(" ")).toContain(kit.pasBouton);
    expect(within(groupe()).getByRole("status").className.split(" ")).toContain(kit.pasValeur);
  });

  it("« + » affecte une Bête de l'Espèce et le compte la montre aussitôt, sans attendre la page relue", async () => {
    role(2, 4, 5);
    await userEvent.click(plus());
    expect(actions.affecterAuRole).toHaveBeenCalledExactlyOnceWith("poule");
    expect(compte()).toBe("3 / 5");
  });

  it("« − » en retire une, de même", async () => {
    role(2, 4, 5);
    await userEvent.click(moins());
    expect(actions.retirerDuRole).toHaveBeenCalledExactlyOnceWith("poule");
    expect(compte()).toBe("1 / 5");
  });

  it("éteint « + » quand toutes les Bêtes valides au Foyer sont affectées, même quand l'effectif en compte d'autres, sorties ou Blessées", async () => {
    role(3, 3, 5);
    expect(plus().disabled).toBe(true);
    expect(moins().disabled).toBe(false);
    cleanup();
    role(2, 3, 5);
    await userEvent.click(plus());
    expect(compte()).toBe("3 / 5");
    expect(plus().disabled).toBe(true);
  });

  it("éteint « − » quand aucune n'est affectée, et « + » quand aucune n'est valide", () => {
    role(0, 0, 2);
    expect(moins().disabled).toBe(true);
    expect(plus().disabled).toBe(true);
    expect(compte()).toBe("0 / 2");
  });

  it("revient au compte de la page relue une fois l'action finie", async () => {
    const { rerender } = role(2, 4, 5);
    await userEvent.click(plus());
    expect(compte()).toBe("3 / 5");
    // La page relue fait foi : la base n'a rien changé (une autre Bête est sortie entre-temps).
    rerender(<RoleDeLEspece especeId="poule" nom="Poule" role={NOURRICIER} affectees={2} valides={2} effectif={5} />);
    await finirLesActions();
    expect(compte()).toBe("2 / 5");
  });
});
