// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Frise } from "./Frise";

afterEach(cleanup);

/** Chaque temps de la frise : son nom et ce qui le suit (sa durée), tels qu'ils se lisent. */
const temps = (frise: Element) => [...frise.children].map((t) => [...t.children].map((morceau) => morceau.textContent));
/** La place que chaque temps prend, en parts de la largeur. */
const parts = (frise: Element) => [...frise.children].map((t) => (t as HTMLElement).style.flexGrow);

describe("la frise d'une Expédition, avec ses durées", () => {
  it("dit chaque temps et sa durée, dans l'ordre : l'aller, le séjour, le retour", () => {
    const { container } = render(<Frise durees={{ aller: 140, sejour: 60, retour: 140 }} />);
    const frise = container.firstElementChild!;
    expect(frise.tagName).toBe("DL");
    expect(temps(frise)).toEqual([
      ["Aller", "2 h 20"],
      ["Séjour", "1 h"],
      ["Retour", "2 h 20"],
    ]);
    // Une liste libellé / valeur : le nom, puis la durée.
    expect([...frise.querySelectorAll("dt")].map((dt) => dt.nextElementSibling?.tagName)).toEqual(["DD", "DD", "DD"]);
  });

  it("donne à chaque trait la place de sa durée", () => {
    const { container } = render(<Frise durees={{ aller: 160, sejour: 240, retour: 160 }} />);
    expect(parts(container.firstElementChild!)).toEqual(["160", "240", "160"]);
  });

  it("écrit « — » d'une durée qu'elle ne peut pas chiffrer, et partage alors la largeur en trois", () => {
    const { container } = render(<Frise durees={{ aller: null, sejour: 60, retour: null }} />);
    const frise = container.firstElementChild!;
    expect(temps(frise)).toEqual([
      ["Aller", "—"],
      ["Séjour", "1 h"],
      ["Retour", "—"],
    ]);
    expect(parts(frise)).toEqual(["1", "1", "1"]);
  });
});

describe("la frise d'une Expédition en cours", () => {
  /** L'état de chaque temps : passé, en cours ou à venir. */
  const etats = (frise: Element) => [...frise.children].map((t) => t.getAttribute("data-etat"));

  it("marque les temps passés, remplit la phase en cours jusqu'où elle en est, et laisse creux ceux à venir", () => {
    const { container } = render(<Frise phase="sejour" part={0.38} />);
    const frise = container.firstElementChild!;
    expect([...frise.children].map((t) => t.textContent)).toEqual(["Aller", "Séjour", "Retour"]);
    expect(etats(frise)).toEqual(["fait", "en-cours", "a-venir"]);
    expect((frise.children[1] as HTMLElement).style.getPropertyValue("--part")).toBe("38%");
    expect((frise.children[0] as HTMLElement).style.getPropertyValue("--part")).toBe("");
  });

  it("garde sa part entre vide et pleine", () => {
    const { container, rerender } = render(<Frise phase="aller" part={-0.2} />);
    expect(etats(container.firstElementChild!)).toEqual(["en-cours", "a-venir", "a-venir"]);
    expect((container.firstElementChild!.children[0] as HTMLElement).style.getPropertyValue("--part")).toBe("0%");
    rerender(<Frise phase="retour" part={1.5} />);
    expect(etats(container.firstElementChild!)).toEqual(["fait", "fait", "en-cours"]);
    expect((container.firstElementChild!.children[2] as HTMLElement).style.getPropertyValue("--part")).toBe("100%");
  });

  it("ne sert qu'aux yeux : la page dit la phase en mots", () => {
    const { container } = render(<Frise phase="aller" part={0.5} />);
    expect(container.firstElementChild!.getAttribute("aria-hidden")).toBe("true");
  });
});
