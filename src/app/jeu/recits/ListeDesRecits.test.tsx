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
  /** Le Récit que la ligne `titre` ouvre : ce qu'elle contrôle. */
  const lecture = (titre: string) => document.getElementById(ligne(titre).getAttribute("aria-controls")!)!;
  /** Un texte est replié tant qu'il est dans un élément caché. */
  const replie = (texte: string) => screen.getByText(texte).closest("[hidden]") !== null;

  it("montre une ligne par Récit dans l'ordre reçu, son texte replié", () => {
    render(<ListeDesRecits recits={RECITS} />);
    expect(screen.getAllByRole("listitem").map((li) => within(li).getByRole("button").textContent)).toEqual([
      "Faminenouveau7 octobre 2026 à 14:05",
      "Retour de Récolte7 octobre 2026 à 00:30",
    ]);
    expect(replie("Deux Habitants sont partis.")).toBe(true);
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
    expect(replie("Deux Habitants sont partis.")).toBe(false);
    expect(lecture("Famine").contains(screen.getByText("Deux Habitants sont partis."))).toBe(true);
    expect(actions.lireUnRecit).toHaveBeenCalledExactlyOnceWith(43);
    expect(marques()).toEqual([]);
  });

  it("le replie d'un second toucher, sans le noter une seconde fois", async () => {
    render(<ListeDesRecits recits={RECITS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(ligne("Famine"));
    await utilisateur.click(ligne("Famine"));
    expect(ligne("Famine").getAttribute("aria-expanded")).toBe("false");
    expect(replie("Deux Habitants sont partis.")).toBe(true);
    await utilisateur.click(ligne("Famine"));
    expect(actions.lireUnRecit).toHaveBeenCalledTimes(1);
  });

  it("n'ouvre qu'un Récit à la fois : en ouvrir un autre referme le premier", async () => {
    render(<ListeDesRecits recits={RECITS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(ligne("Famine"));
    await utilisateur.click(ligne("Retour de Récolte"));
    expect(ligne("Famine").getAttribute("aria-expanded")).toBe("false");
    expect(replie("Deux Habitants sont partis.")).toBe(true);
    expect(ligne("Retour de Récolte").getAttribute("aria-expanded")).toBe("true");
    expect(replie("Du Bois.")).toBe(false);
  });

  it("tant qu'aucun Récit n'est ouvert, dit à sa place « Choisissez un récit. », pour les yeux, sans en ouvrir ni en noter aucun", async () => {
    render(<ListeDesRecits recits={RECITS} />);
    const invite = screen.getByText("Choisissez un récit.");
    expect(invite.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-expanded"))).toEqual(["false", "false"]);
    expect(actions.lireUnRecit).not.toHaveBeenCalled();
    // Un Récit ouvert prend sa place.
    await userEvent.setup().click(ligne("Retour de Récolte"));
    expect(screen.queryByText("Choisissez un récit.")).toBeNull();
  });

  it("ouvre un Récit déjà lu sans rien noter", async () => {
    render(<ListeDesRecits recits={RECITS} />);
    await userEvent.setup().click(ligne("Retour de Récolte"));
    expect(replie("Du Bois.")).toBe(false);
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
  const replie = (element: Element) => element.closest("[hidden]") !== null;

  it("déplie, sous le texte d'un retour, ses Rencontres, et les replie avec lui", async () => {
    render(<ListeDesRecits recits={[RETOUR, RECITS[1]]} />);
    expect(replie(rencontres())).toBe(true);
    const utilisateur = userEvent.setup();
    await utilisateur.click(ligne("Retour d'Expédition"));
    expect(replie(screen.getByText("Une Bête s'est montrée."))).toBe(false);
    expect(replie(rencontres())).toBe(false);
    expect(within(rencontres()).getByText("Apprivoisée, mâle")).toBeTruthy();
    // Le texte précède les Rencontres, et le bouton contrôle le Récit qui les tient tous deux.
    expect(screen.getByText("Une Bête s'est montrée.").compareDocumentPosition(rencontres()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const lecture = document.getElementById(ligne("Retour d'Expédition").getAttribute("aria-controls")!)!;
    expect([screen.getByText("Une Bête s'est montrée."), rencontres()].every((partie) => lecture.contains(partie))).toBe(true);
    await utilisateur.click(ligne("Retour d'Expédition"));
    expect(replie(rencontres())).toBe(true);
  });

  it("ne montre aucune liste de Rencontres pour un Récit qui n'en a pas", async () => {
    render(<ListeDesRecits recits={[RECITS[1]]} />);
    await userEvent.setup().click(ligne("Retour de Récolte"));
    expect(lesRencontres()).toBeUndefined();
    expect(document.getElementById(ligne("Retour de Récolte").getAttribute("aria-controls")!)?.contains(screen.getByText("Du Bois."))).toBe(true);
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
    expect(rencontres().closest("[hidden]")).not.toBeNull();
    // Les autres Récits n'ont que leur titre et leur date.
    expect(screen.getByRole("button", { name: /^Retour de Récolte/ }).textContent).toBe("Retour de Récolte7 octobre 2026 à 00:30");
  });

  it("nomme la ligne de son titre, de sa marque, de sa date et de son résumé, le médaillon muet", () => {
    render(<ListeDesRecits recits={[RETOUR]} />);
    // jsdom ne met pas en page : il colle les morceaux que le navigateur sépare d'une espace.
    expect(
      screen.getByRole("button", { name: /^Retour d'Expédition\s*nouveau\s*9 octobre 2026 à 18:05\s*1 Bête ramenée ·\s*1 nouvelle Espèce au Bestiaire$/ }),
    ).toBeTruthy();
  });

  it("déplie sous le résumé le détail, heure par heure, et le replie sans toucher au résumé", async () => {
    render(<ListeDesRecits recits={[RETOUR]} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(ligne());
    expect(rencontres().closest("[hidden]")).toBeNull();
    expect(within(rencontres()).getByText("14:05")).toBeTruthy();
    for (const detail of [screen.getByText("Une Bête s'est montrée."), rencontres()])
      expect(resume().compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await utilisateur.click(ligne());
    expect(rencontres().closest("[hidden]")).not.toBeNull();
    expect(resume().closest("[hidden]")).toBeNull();
  });
});

describe("la lecture d'un retour d'Expédition ouvert (US-0917, US-0941)", () => {
  afterEach(() => {
    cleanup();
    actions.lireUnRecit.mockClear();
  });

  /** Un retour d'Expédition tel que le jeu l'écrit, ligne à ligne, avec son résumé et sa Rencontre. */
  const RETOUR: RecitAffiche = {
    id: 61,
    titre: "Retour d'Expédition",
    texte: [
      "Destination : Prairie, à 8 Cases de votre Foyer.",
      "Aller 2 h 40, séjour 4 h, retour 2 h 40.",
      "21 Cases sont sorties du brouillard.",
      "Une Bête s'est montrée.",
      "Bête ramenée au Foyer : Souris grise (femelle).",
    ].join("\n"),
    instant: "2026-10-08T18:29:00.000Z",
    quand: "8 octobre 2026 à 20:29",
    lu: false,
    resume: ["1 Bête ramenée", "1 nouvelle Espèce au Bestiaire"],
    rencontres: [
      {
        instant: "2026-10-08T11:49:00.000Z",
        heure: "13:49",
        nom: "Souris grise",
        illustration: "especes/souris.webp",
        rarete: { id: "commune", nom: "Commune" },
        issue: "apprivoisee",
        sexe: "femelle",
        nouvelleEspece: true,
      },
    ],
  };
  const ouvrir = async (recit: RecitAffiche) => {
    render(<ListeDesRecits recits={[recit]} />);
    const ligne = screen.getByRole("button", { name: /^Retour d'Expédition/ });
    await userEvent.setup().click(ligne);
    return document.getElementById(ligne.getAttribute("aria-controls")!)!;
  };

  it("dit ses faits ligne à ligne, et ses durées sur la frise de l'aller, du séjour et du retour", async () => {
    const lecture = await ouvrir(RETOUR);
    const faits = within(lecture)
      .getAllByRole("list")
      .find((liste) => liste.getAttribute("aria-label") !== "Rencontres")!;
    expect(
      within(faits)
        .getAllByRole("listitem")
        .map((fait) => fait.textContent),
    ).toEqual([
      "Destination : Prairie, à 8 Cases de votre Foyer.",
      "21 Cases sont sorties du brouillard.",
      "Une Bête s'est montrée.",
      "Bête ramenée au Foyer : Souris grise (femelle).",
    ]);
    expect(
      within(lecture)
        .getAllByRole("term")
        .map((temps) => temps.textContent),
    ).toEqual(["Aller", "Séjour", "Retour"]);
    expect(
      within(lecture)
        .getAllByRole("definition")
        .map((duree) => duree.textContent),
    ).toEqual(["2 h 40", "4 h", "2 h 40"]);
  });

  it("redit aux yeux seulement, en tête, son titre, sa date et les puces de son résumé, que sa ligne porte déjà", async () => {
    const lecture = await ouvrir(RETOUR);
    for (const texte of ["8 octobre 2026 à 20:29", "1 nouvelle Espèce au Bestiaire"])
      expect(within(lecture).getByText(texte).closest('[aria-hidden="true"]')).not.toBeNull();
    expect(within(lecture).queryByRole("heading")).toBeNull();
  });

  it("sans Bête vue, n'a pas de Rencontres", async () => {
    const lecture = await ouvrir({
      ...RETOUR,
      texte: "Destination : Forêt, à 3 Cases de votre Foyer.\nAucune Bête ne s'est montrée.",
      resume: ["Aucune Bête ramenée"],
      rencontres: undefined,
    });
    expect(
      within(lecture)
        .getAllByRole("listitem")
        .map((fait) => fait.textContent),
    ).toEqual(["Destination : Forêt, à 3 Cases de votre Foyer.", "Aucune Bête ne s'est montrée."]);
    expect(within(lecture).queryByRole("list", { name: "Rencontres" })).toBeNull();
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
    couples: [{ especeId: "souris", nom: "Souris grise", illustration: null }],
  };
  const ligne = () => screen.getByRole("button", { name: /^Retour d'Expédition/ });
  /**
   * L'annonce du Couple : la seule figure de la liste, « Couple réuni » et le nom de l'Espèce sous son illustration ;
   * US-0812 : puis « Élever ».
   */
  const annonce = () => {
    const figure = screen.getByRole("figure");
    expect(figure.textContent).toBe("Couple réuni Souris grise Élever");
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
    render(<ListeDesRecits recits={[{ ...RETOUR, couples: [{ especeId: "poule", nom: "Poule", illustration: null }, ...RETOUR.couples!] }]} />);
    expect(screen.getAllByRole("figure").map((couple) => couple.textContent)).toEqual(["Couple réuni Poule Élever", "Couple réuni Souris grise Élever"]);
  });

  it("mène, d'un lien « Élever », au bloc « Élever » de la fiche de l'Espèce (US-0812)", () => {
    render(<ListeDesRecits recits={[{ ...RETOUR, couples: [{ especeId: "poule", nom: "Poule", illustration: null }, ...RETOUR.couples!] }]} />);
    expect(screen.getAllByRole("link", { name: /^Élever/ }).map((lien) => [lien.getAttribute("aria-label"), lien.getAttribute("href")])).toEqual([
      ["Élever : Poule", "/jeu/reserve/poule#elever"],
      ["Élever : Souris grise", "/jeu/reserve/souris#elever"],
    ]);
    // Le lien est dans l'annonce, visible sans déplier le récit.
    expect(screen.getAllByRole("link", { name: /^Élever/ }).every((lien) => lien.closest("[hidden]") === null)).toBe(true);
  });
});
