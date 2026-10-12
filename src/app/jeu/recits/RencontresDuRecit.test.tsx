// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type RencontreAffichee, RencontresDuRecit } from "./RencontresDuRecit";

/** Trois Bêtes vues lors d'un même séjour, dans l'ordre des apparitions, chacune à son heure. */
const RENCONTRES: RencontreAffichee[] = [
  {
    instant: "2026-10-09T12:05:00.000Z",
    heure: "14:05",
    nom: "Souris grise",
    illustration: "especes/souris.webp",
    rarete: { id: "commune", nom: "Commune" },
    issue: "apprivoisee",
    sexe: "femelle",
    nouvelleEspece: true,
  },
  {
    instant: "2026-10-09T12:40:00.000Z",
    heure: "14:40",
    nom: "Renard roux",
    illustration: null,
    rarete: { id: "rare", nom: "Rare" },
    issue: "restee",
    sexe: null,
    nouvelleEspece: false,
  },
  {
    instant: "2026-10-09T13:15:00.000Z",
    heure: "15:15",
    nom: "Loup gris",
    illustration: "especes/loup.webp",
    rarete: { id: "epique", nom: "Épique" },
    issue: "repartie",
    sexe: null,
    nouvelleEspece: false,
  },
];

describe("le récit de Rencontre (US-0940)", () => {
  afterEach(cleanup);

  const lignes = () => within(screen.getByRole("list")).getAllByRole("listitem");

  it("liste chaque Bête vue, à son heure, dans l'ordre reçu : son illustration, son Espèce et sa Rareté", () => {
    render(<RencontresDuRecit rencontres={RENCONTRES} />);
    expect(lignes()).toHaveLength(3);
    lignes().forEach((ligne, i) => {
      const r = RENCONTRES[i];
      expect(within(ligne).getByText(r.heure).closest("time")?.getAttribute("datetime")).toBe(r.instant);
      expect(within(ligne).getByText(r.nom)).toBeTruthy();
      expect(within(ligne).getByText(r.rarete.nom).getAttribute("data-rarete")).toBe(r.rarete.id);
      // L'illustration de l'Espèce, ou la tête de loup quand elle n'en a pas, nommée par l'Espèce.
      expect(within(ligne).getByRole("img", { name: r.nom })).toBeTruthy();
    });
  });

  it("dit pour chacune ce qui s'est passé : apprivoisée avec son sexe, trop forte et restée, ou repartie à la fin de sa durée", () => {
    render(<RencontresDuRecit rencontres={RENCONTRES} />);
    expect(lignes().map((ligne) => ligne.querySelector("[data-issue]")?.textContent)).toEqual([
      "Apprivoisée, femelle",
      "Trop forte, restée sur sa Case",
      "Repartie à la fin de sa durée",
    ]);
  });

  it("dit d'une Bête trop forte et restée la force qui manquait à l'escorte, en chiffres insécables (US-0942)", () => {
    render(<RencontresDuRecit rencontres={[{ ...RENCONTRES[1], manque: 37_340 }]} />);
    expect(screen.getByRole("list").querySelector("[data-issue]")?.textContent).toBe("Trop forte, restée sur sa Case : il manquait 37 340 de force");
  });

  it("dit l'heure où une Bête repartie a quitté sa Case, et son jour s'il a changé depuis la Rencontre (US-0950)", () => {
    render(
      <RencontresDuRecit
        rencontres={[
          { ...RENCONTRES[2], repartie: { instant: "2026-10-09T15:15:00.000Z", heure: "17:15", autreJour: false } },
          { ...RENCONTRES[2], repartie: { instant: "2026-10-09T23:10:00.000Z", heure: "10 octobre à 01:10", autreJour: true } },
        ]}
      />,
    );
    const issues = lignes().map((ligne) => ligne.querySelector("[data-issue]")!);
    expect(issues.map((issue) => issue.textContent)).toEqual([
      "Repartie à 17:15, à la fin de sa durée",
      "Repartie le 10 octobre à 01:10, à la fin de sa durée",
    ]);
    expect(issues.map((issue) => issue.querySelector("time")?.getAttribute("datetime"))).toEqual(["2026-10-09T15:15:00.000Z", "2026-10-09T23:10:00.000Z"]);
  });

  it("dit le sexe d'un mâle apprivoisé", () => {
    render(<RencontresDuRecit rencontres={[{ ...RENCONTRES[0], sexe: "male", nouvelleEspece: false }]} />);
    expect(screen.getByText("Apprivoisée, mâle")).toBeTruthy();
  });

  it("met en avant une Bête apprivoisée ou une nouvelle Espèce, d'un mot et pas de la couleur seule", () => {
    const rencontres: RencontreAffichee[] = [
      RENCONTRES[0],
      { ...RENCONTRES[0], nouvelleEspece: false },
      { ...RENCONTRES[1], nouvelleEspece: true },
      RENCONTRES[1],
      RENCONTRES[2],
    ];
    render(<RencontresDuRecit rencontres={rencontres} />);
    expect(lignes().map((ligne) => ligne.hasAttribute("data-en-avant"))).toEqual([true, true, true, false, false]);
    expect(lignes().map((ligne) => within(ligne).queryByText("Nouvelle Espèce au Bestiaire") !== null)).toEqual([true, false, true, false, false]);
  });

  it("n'ajoute aucune phrase d'explication : pour chaque Bête, son heure, son Espèce, sa Rareté et ce qui s'est passé", () => {
    render(<RencontresDuRecit rencontres={[RENCONTRES[1]]} />);
    expect(screen.getByRole("list").textContent).toBe("14:40Renard rouxRareTrop forte, restée sur sa Case");
  });
});
