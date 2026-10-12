// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ lireUnRecit: vi.fn(async () => {}) }));
vi.mock("./actions", () => actions);

import { ListeDesRecits, type RecitAffiche } from "./ListeDesRecits";

const RECITS: RecitAffiche[] = [
  { id: 43, titre: "Famine", texte: "Deux Habitants sont partis.", instant: "2026-10-07T12:05:00.000Z", quand: "7 octobre 2026 à 14:05", lu: false },
  { id: 41, titre: "Retour de Récolte", texte: "Du Bois.", instant: "2026-10-06T22:30:00.000Z", quand: "7 octobre 2026 à 00:30", lu: true },
];

describe("liste des Récits (US-0324)", () => {
  afterEach(() => {
    cleanup();
    actions.lireUnRecit.mockClear();
  });

  const ligne = (titre: string) => screen.getByRole("button", { name: new RegExp(`^${titre}`) });
  const marques = () => screen.queryAllByText("nouveau").map((m) => m.closest("li")?.querySelector("time")?.textContent);

  it("montre une ligne par Récit dans l'ordre reçu, son texte replié", () => {
    render(<ListeDesRecits recits={RECITS} />);
    expect(screen.getAllByRole("listitem").map((li) => within(li).getByRole("button").textContent)).toEqual([
      "Faminenouveau7 octobre 2026 à 14:05",
      "Retour de Récolte7 octobre 2026 à 00:30",
    ]);
    expect(screen.getByText("Deux Habitants sont partis.").hidden).toBe(true);
    expect(ligne("Famine").getAttribute("aria-expanded")).toBe("false");
  });

  it("marque le Récit non lu, et lui seul", () => {
    render(<ListeDesRecits recits={RECITS} />);
    expect(marques()).toEqual(["7 octobre 2026 à 14:05"]);
  });

  it("ouvrir un Récit non lu déplie son texte sur place, le note comme lu et retire sa marque", async () => {
    render(<ListeDesRecits recits={RECITS} />);
    await userEvent.setup().click(ligne("Famine"));
    expect(ligne("Famine").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Deux Habitants sont partis.").hidden).toBe(false);
    expect(screen.getByText("Deux Habitants sont partis.").id).toBe(ligne("Famine").getAttribute("aria-controls"));
    expect(actions.lireUnRecit).toHaveBeenCalledExactlyOnceWith(43);
    expect(marques()).toEqual([]);
  });

  it("le replie d'un second toucher, sans le noter une seconde fois", async () => {
    render(<ListeDesRecits recits={RECITS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(ligne("Famine"));
    await utilisateur.click(ligne("Famine"));
    expect(ligne("Famine").getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Deux Habitants sont partis.").hidden).toBe(true);
    await utilisateur.click(ligne("Famine"));
    expect(actions.lireUnRecit).toHaveBeenCalledTimes(1);
  });

  it("ouvre un Récit déjà lu sans rien noter", async () => {
    render(<ListeDesRecits recits={RECITS} />);
    await userEvent.setup().click(ligne("Retour de Récolte"));
    expect(screen.getByText("Du Bois.").hidden).toBe(false);
    expect(actions.lireUnRecit).not.toHaveBeenCalled();
  });
});

describe("le récit de Rencontre dans la liste des Récits (US-0940)", () => {
  afterEach(() => {
    cleanup();
    actions.lireUnRecit.mockClear();
  });

  /** Un retour d'Expédition où une Bête s'est montrée, et un Récit sans Rencontre. */
  const RETOUR: RecitAffiche = {
    id: 51,
    titre: "Retour d'Expédition",
    texte: "Une Bête s'est montrée.",
    instant: "2026-10-09T16:05:00.000Z",
    quand: "9 octobre 2026 à 18:05",
    lu: false,
    rencontres: [
      {
        instant: "2026-10-09T12:05:00.000Z",
        heure: "14:05",
        nom: "Souris grise",
        illustration: null,
        rarete: { id: "commune", nom: "Commune" },
        issue: "apprivoisee",
        sexe: "male",
        nouvelleEspece: true,
      },
    ],
  };
  const ligne = (titre: string) => screen.getByRole("button", { name: new RegExp(`^${titre}`) });
  /** La liste des Rencontres, repliée ou non : repliée, elle n'a pas de nom accessible, d'où la lecture de son étiquette. */
  const lesRencontres = () => screen.queryAllByRole("list", { hidden: true }).find((liste) => liste.getAttribute("aria-label") === "Rencontres");
  const rencontres = () => lesRencontres()!;

  it("déplie, sous le texte d'un retour, ses Rencontres, et les replie avec lui", async () => {
    render(<ListeDesRecits recits={[RETOUR, RECITS[1]]} />);
    expect(rencontres().hidden).toBe(true);
    const utilisateur = userEvent.setup();
    await utilisateur.click(ligne("Retour d'Expédition"));
    expect(screen.getByText("Une Bête s'est montrée.").hidden).toBe(false);
    expect(rencontres().hidden).toBe(false);
    expect(within(rencontres()).getByText("Apprivoisée, mâle")).toBeTruthy();
    // Le texte précède les Rencontres, et le bouton les déplie tous deux.
    expect(screen.getByText("Une Bête s'est montrée.").compareDocumentPosition(rencontres()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ligne("Retour d'Expédition").getAttribute("aria-controls")?.split(" ")).toEqual([screen.getByText("Une Bête s'est montrée.").id, rencontres().id]);
    await utilisateur.click(ligne("Retour d'Expédition"));
    expect(rencontres().hidden).toBe(true);
  });

  it("ne montre aucune liste de Rencontres pour un Récit qui n'en a pas", async () => {
    render(<ListeDesRecits recits={[RECITS[1]]} />);
    await userEvent.setup().click(ligne("Retour de Récolte"));
    expect(lesRencontres()).toBeUndefined();
    expect(ligne("Retour de Récolte").getAttribute("aria-controls")).toBe(screen.getByText("Du Bois.").id);
  });
});

describe("le résumé en tête du récit d'un retour d'Expédition (US-0941)", () => {
  afterEach(() => {
    cleanup();
    actions.lireUnRecit.mockClear();
  });

  const RESUME = ["1 Bête ramenée", "1 nouvelle Espèce au Bestiaire"];
  /** Un retour d'Expédition résumé, où une Bête s'est montrée. */
  const RETOUR: RecitAffiche = {
    id: 51,
    titre: "Retour d'Expédition",
    texte: "Une Bête s'est montrée.",
    instant: "2026-10-09T16:05:00.000Z",
    quand: "9 octobre 2026 à 18:05",
    lu: false,
    resume: RESUME,
    rencontres: [
      {
        instant: "2026-10-09T12:05:00.000Z",
        heure: "14:05",
        nom: "Souris grise",
        illustration: null,
        rarete: { id: "commune", nom: "Commune" },
        issue: "apprivoisee",
        sexe: "male",
        nouvelleEspece: true,
      },
    ],
  };
  const ligne = () => screen.getByRole("button", { name: /^Retour d'Expédition/ });
  const rencontres = () => screen.queryAllByRole("list", { hidden: true }).find((liste) => liste.getAttribute("aria-label") === "Rencontres")!;

  /** Le résumé : ses faits, chacun d'un bloc, pour qu'un téléphone ne passe à la ligne qu'entre deux. */
  const resume = () => within(ligne()).getByText(RESUME[1]).parentElement!;

  it("montre le résumé sur la ligne du récit, sans qu'il faille l'ouvrir", () => {
    render(<ListeDesRecits recits={[RETOUR, RECITS[1]]} />);
    expect(ligne().getAttribute("aria-expanded")).toBe("false");
    expect(resume().textContent).toBe("1 Bête ramenée · 1 nouvelle Espèce au Bestiaire");
    expect([...resume().children].map((fait) => fait.textContent)).toEqual(["1 Bête ramenée · ", "1 nouvelle Espèce au Bestiaire"]);
    expect(resume().closest("[hidden]")).toBeNull();
    expect(rencontres().hidden).toBe(true);
    // Les autres Récits n'ont que leur titre et leur date.
    expect(screen.getByRole("button", { name: /^Retour de Récolte/ }).textContent).toBe("Retour de Récolte7 octobre 2026 à 00:30");
  });

  it("déplie sous le résumé le détail, heure par heure, et le replie sans toucher au résumé", async () => {
    render(<ListeDesRecits recits={[RETOUR]} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(ligne());
    expect(rencontres().hidden).toBe(false);
    expect(within(rencontres()).getByText("14:05")).toBeTruthy();
    for (const detail of [screen.getByText("Une Bête s'est montrée."), rencontres()])
      expect(resume().compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await utilisateur.click(ligne());
    expect(rencontres().hidden).toBe(true);
    expect(resume().closest("[hidden]")).toBeNull();
  });
});

describe("l'annonce du Couple réuni en tête du récit du retour qui l'a réuni (US-0958)", () => {
  afterEach(() => {
    cleanup();
    actions.lireUnRecit.mockClear();
  });

  /** Un retour d'Expédition qui a réuni le Couple de la Souris grise. */
  const RETOUR: RecitAffiche = {
    id: 51,
    titre: "Retour d'Expédition",
    texte: "Une Bête s'est montrée.",
    instant: "2026-10-09T16:05:00.000Z",
    quand: "9 octobre 2026 à 18:05",
    lu: false,
    resume: ["1 Bête ramenée"],
    couples: [{ nom: "Souris grise", illustration: null }],
  };
  const ligne = () => screen.getByRole("button", { name: /^Retour d'Expédition/ });
  /** L'annonce du Couple : la seule figure de la liste, « Couple réuni » et le nom de l'Espèce sous son illustration. */
  const annonce = () => {
    const figure = screen.getByRole("figure");
    expect(figure.textContent).toBe("Couple réuni Souris grise");
    return figure;
  };

  it("se voit sans ouvrir le récit, sous sa ligne et avant son texte, avec l'illustration de l'Espèce", () => {
    render(<ListeDesRecits recits={[RETOUR, RECITS[1]]} />);
    expect(ligne().getAttribute("aria-expanded")).toBe("false");
    expect(annonce().closest("[hidden]")).toBeNull();
    expect(within(annonce()).getByRole("img", { name: "Souris grise" })).toBeTruthy();
    expect(ligne().contains(annonce())).toBe(false);
    expect(ligne().compareDocumentPosition(annonce()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(annonce().compareDocumentPosition(screen.getByText("Une Bête s'est montrée.")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Un seul retour a réuni un Couple.
    expect(screen.getAllByRole("figure")).toHaveLength(1);
  });

  it("reste en place quand le récit se déplie et se replie", async () => {
    render(<ListeDesRecits recits={[RETOUR]} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(ligne());
    expect(screen.getByText("Une Bête s'est montrée.").hidden).toBe(false);
    expect(annonce().closest("[hidden]")).toBeNull();
    await utilisateur.click(ligne());
    expect(annonce().closest("[hidden]")).toBeNull();
  });

  it("annonce chacun des Couples qu'un même retour a réunis", () => {
    render(<ListeDesRecits recits={[{ ...RETOUR, couples: [{ nom: "Poule", illustration: null }, ...RETOUR.couples!] }]} />);
    expect(screen.getAllByRole("figure").map((couple) => couple.textContent)).toEqual(["Couple réuni Poule", "Couple réuni Souris grise"]);
  });
});
