// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lireJeu } from "@/donnees/charger";
import { METIERS } from "@/donnees/jeux";

// La vraie garde, branchée sur une session simulée.
const cookie = vi.hoisted(() => ({ jetonDeSession: vi.fn() }));
vi.mock("@/comptes/cookie-session", () => cookie);
const session = vi.hoisted(() => ({ compteDeLaSession: vi.fn() }));
vi.mock("@/comptes/session", () => session);
const chefs = vi.hoisted(() => ({
  chefDuCompte: vi.fn<() => Promise<{ nom: string; territoireId: number | null; recitLu: boolean }>>(async () => ({ nom: "Ourse", territoireId: 12, recitLu: true })),
  naitreSurLaCouronne: vi.fn(async (): Promise<number | null> => null),
}));
vi.mock("@/chefs/chef", () => chefs);
type Habitant = { id: number; prenom: string; metier: string | null; arriveLe: Date; etat: "libre" };
const PRENOMS = ["Arno", "Brune", "Cael"];
/** Un Habitant arrivé le 7 octobre 2026 au matin, à Paris. */
const UN_HABITANT = { metier: null, arriveLe: new Date("2026-10-07T08:00:00Z"), etat: "libre" as const };
const ARRIVE_LE = "7 octobre 2026";
const habitants = vi.hoisted(() => ({
  habitantsDuTerritoire: vi.fn(async (): Promise<Habitant[]> => []),
  placesDuTerritoire: vi.fn(async (): Promise<number> => 0),
  entretienDesHabitants: vi.fn(async (): Promise<{ habitants: number; parHabitant: number; parHeure: string }> => ({ habitants: 0, parHabitant: 2, parHeure: "0" })),
}));
vi.mock("@/monde/habitants", () => habitants);
type Metier = { id: string; nom: string; phrase: string; servira: string | null };
/** US-0307 : les huit Métiers tels que donnees/metiers.yaml les règle. */
const HUIT_METIERS: Metier[] = lireJeu(METIERS).map((m) => ({ id: m.id, nom: m.nom, phrase: m.phrase, servira: m.servira ?? null }));
const metiers = vi.hoisted(() => ({ lesMetiers: vi.fn(async (): Promise<Metier[]> => []) }));
vi.mock("@/monde/metiers", async (original) => ({ ...(await original<object>()), ...metiers }));
// US-0320 : les Stocks du Territoire, que la vraie garde lit après l'avoir mis à l'heure.
type Stock = import("@/monde/stocks").Stock;
const stocks = vi.hoisted(() => ({ stocksDuTerritoire: vi.fn(async (): Promise<Stock[]> => []) }));
vi.mock("@/monde/stocks", () => stocks);
// US-0323 : l'avertissement de famine que le Territoire retient, lu par la vraie garde ; rien de retenu ici.
vi.mock("@/monde/production", async (original) => ({ ...(await original<object>()), famineImminenteDepuis: vi.fn(async () => null) }));
// US-0341 : la Famine que le Territoire retient, lue par la vraie garde ; aucune, sauf quand un essai en met une.
const famine = vi.hoisted(() => ({ famineDepuis: vi.fn(async (): Promise<number | null> => null) }));
vi.mock("@/monde/famine", async (original) => ({ ...(await original<object>()), ...famine }));
const temps = vi.hoisted(() => ({ rattraper: vi.fn(async () => new Date()) }));
vi.mock("@/temps/rattraper", () => temps);
vi.mock("@/db", () => ({ getPool: () => ({}) }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));
vi.mock("./actions", () => ({ donnerUnMetier: vi.fn(), retirerLeMetier: vi.fn(), ajouterAuMetier: vi.fn(), retirerDuMetier: vi.fn(), renvoyerUnHabitant: vi.fn() }));
// US-0314 : l'adresse de la page, que la liste lit pour son filtre, dès le rendu sur le serveur.
const adresse = vi.hoisted(() => ({ recherche: "" }));
vi.mock("next/navigation", async (original) => ({ ...(await original<object>()), useSearchParams: () => new URLSearchParams(adresse.recherche) }));
// US-0308 : la vraie liste, observée pour voir ce que la page lui confie.
const liste = vi.hoisted(() => ({ ListeDesHabitants: vi.fn() }));
vi.mock("./ListeDesHabitants", async (original) => {
  const { ListeDesHabitants } = await original<typeof import("./ListeDesHabitants")>();
  liste.ListeDesHabitants.mockImplementation(ListeDesHabitants);
  return liste;
});

import Habitants, { metadata } from "./page";

/** US-0320 : un Stock tel que stocksDuTerritoire le lit, en texte, sans Entretien pris sur lui. */
const unStock = (id: string, famille: Stock["famille"], quantite: string, parHeure: string, limite = "1000.000000", entretienParHeure = "0.000000"): Stock => ({
  id,
  nom: id,
  famille,
  quantite,
  limite,
  parHeure,
  entretienParHeure,
  sources: [],
});
/** US-0320 : les quatre Stocks d'un Foyer en prairie (+8 Viande, +14 Végétaux, +4 Bois et Pierre), 100 de chaque. */
const STOCKS_DE_PRAIRIE: Stock[] = [
  unStock("viande", "nourriture", "100.000000", "8.000000"),
  unStock("vegetaux", "nourriture", "100.000000", "14.000000"),
  unStock("bois", "materiaux", "100.000000", "4.000000"),
  unStock("pierre", "materiaux", "100.000000", "4.000000"),
];

/** La page, rendue comme sur le serveur, puis posée dans le document comme un navigateur la lirait. */
async function afficher() {
  const html = renderToStaticMarkup(await Habitants());
  document.body.innerHTML = html;
  return html;
}

/** Les morceaux de texte d'un élément que lit un lecteur d'écran, sans ce qui ne sert qu'aux yeux. */
function morceaux(element: Element): string[] {
  const lus: string[] = [];
  const lire = (noeud: Node) => {
    if (noeud.nodeType === Node.TEXT_NODE) lus.push((noeud.textContent ?? "").trim());
    else if (noeud.nodeType === Node.ELEMENT_NODE && !(noeud as Element).hasAttribute("aria-hidden")) noeud.childNodes.forEach(lire);
  };
  lire(element);
  return lus.filter(Boolean);
}
/** Ce qu'un élément dit à un lecteur d'écran, d'un tenant ; pour un bouton nommé, son nom. */
const nom = (element: Element) => element.getAttribute("aria-label") ?? morceaux(element).join(" ");

const principal = () => document.querySelector("main")!;
/** US-0309 : la rangée des compteurs, dans le rail. */
const rangeeDesEffectifs = () => screen.getByRole("list", { name: "Effectifs par Métier" });
/** Chaque compteur, par ce qu'il dit, « Tous » compris. */
const compteurs = () => within(rangeeDesEffectifs()).getAllByRole("button").map(nom);
/** Le tableau des Habitants, et ses lignes d'Habitants. */
const tableau = () => screen.getByRole("table");
const lignesDHabitants = () => [...tableau().querySelectorAll("tr")].filter((tr) => tr.querySelector(':scope > th[scope="row"]'));
/** Le texte de chaque ligne, ses cellules séparées par « · ». */
const lignes = () => lignesDHabitants().map((tr) => [...tr.cells].map((c) => c.textContent).filter(Boolean).join(" · "));
/** US-0307 : l'en-tête du groupe de chaque Métier, dans l'ordre du tableau. */
const tetesDeMetier = () => [...tableau().querySelectorAll('th[scope="rowgroup"]')].filter((th) => th.querySelector('[aria-label^="Un "]'));
/** US-0312 : en tête de chaque groupe de Métier, le nom, l'effectif entre « − » et « + », et ceux des deux boutons qui sont grisés. */
const repartitions = () =>
  tetesDeMetier().map((th) => {
    const [moins, plus] = within(th as HTMLElement).getAllByRole("button") as HTMLButtonElement[];
    return [morceaux(th)[0], Number(plus.previousElementSibling?.textContent), ...[moins, plus].map((b) => (b.disabled ? "grisé" : "actif"))];
  });
/** La colonne de contexte : « Aux portes », la place, l'Entretien. */
const auxPortes = () => screen.getByRole("heading", { name: "Aux portes" }).closest("section")!;
const contexte = () => auxPortes().parentElement!;
/** US-0305 : le panneau de la place. */
const place = () => screen.getByText(/^\d+ Habitants? sur \d+ places?$/).parentElement!;
/** US-0318 : le panneau de l'Entretien, sa ligne, et US-0320 la tenue de la Nourriture, sa dernière phrase. */
const entretien = () => screen.getByRole("heading", { name: "Entretien" }).closest("section")!;
const ligneEntretien = () => entretien().querySelector("h2 + p")?.textContent;
const tenue = () => entretien().lastElementChild!;
/** Le texte d'un élément, ses espaces insécables écrites comme les autres. */
const texte = (element: Element) => (element.textContent ?? "").replace(/\s/g, " ");

describe("page Habitants (US-0302, US-0303, US-0305, US-0307, US-0308, US-0309, US-0310, US-0311, US-0312, US-0314, US-0315, US-0318, US-0320)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    adresse.recherche = "";
    document.body.innerHTML = "";
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    habitants.habitantsDuTerritoire.mockReset();
    habitants.placesDuTerritoire.mockReset();
    habitants.entretienDesHabitants.mockReset();
    metiers.lesMetiers.mockReset();
    stocks.stocksDuTerritoire.mockReset();
    temps.rattraper.mockClear();
  });

  /**
   * Un joueur connecté, ses `nombre` Habitants, la place de son Territoire (5 par défaut, celle du Foyer),
   * leur Entretien, 2 Nourriture par heure chacun, les huit Métiers, et les Stocks d'un Foyer en prairie.
   */
  const connecte = (nombre = 3, places = 5) => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    habitants.habitantsDuTerritoire.mockResolvedValue(Array.from({ length: nombre }, (_, i) => ({ id: 40 + i, prenom: PRENOMS[i % 3], ...UN_HABITANT })));
    habitants.placesDuTerritoire.mockResolvedValue(places);
    habitants.entretienDesHabitants.mockResolvedValue({ habitants: nombre, parHabitant: 2, parHeure: String(2 * nombre) });
    metiers.lesMetiers.mockResolvedValue(HUIT_METIERS);
    stocks.stocksDuTerritoire.mockResolvedValue(STOCKS_DE_PRAIRIE);
  };

  it("titre la page « Habitants », dans l'onglet comme sur la page, en tête du registre", async () => {
    connecte();
    expect(metadata.title).toBe("Habitants");
    await afficher();
    expect(within(principal()).getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Habitants"]);
    expect(screen.getByRole("region", { name: "Habitants" }).contains(tableau())).toBe(true);
  });

  it("pose l'écran en trois zones : le rail des Métiers, le registre des Habitants, la colonne de contexte", async () => {
    connecte();
    await afficher();
    const zones = [...principal().children];
    expect(zones).toHaveLength(3);
    expect(zones[0].contains(rangeeDesEffectifs())).toBe(true);
    expect(zones[1]).toBe(screen.getByRole("region", { name: "Habitants" }));
    expect(zones[2]).toBe(contexte());
  });

  it("compte les Habitants du Territoire du joueur, dans la colonne de contexte", async () => {
    connecte();
    await afficher();
    expect(habitants.habitantsDuTerritoire).toHaveBeenCalledWith(expect.anything(), 12);
    expect(contexte().contains(place())).toBe(true);
    expect(within(place()).getByText("3 Habitants sur 5 places").tagName).toBe("P");
  });

  it("dit combien de places le Territoire offre, lues pour le Territoire du joueur : « 3 Habitants sur 5 places » (US-0305)", async () => {
    connecte(3, 5);
    expect(await afficher()).toContain(">3 Habitants sur 5 places<");
    expect(habitants.placesDuTerritoire).toHaveBeenCalledWith(expect.anything(), 12);
    connecte(2, 9);
    expect(await afficher()).toContain(">2 Habitants sur 9 places<");
  });

  it("accorde la place : « 1 Habitant sur 1 place » (US-0305)", async () => {
    connecte(1, 1);
    expect(await afficher()).toContain(">1 Habitant sur 1 place<");
  });

  it("montre en grand les Habitants sur les places, pour les yeux, avec une case par place (US-0305)", async () => {
    connecte(3, 5);
    await afficher();
    const grand = place().querySelector('[aria-hidden="true"]')!;
    expect(grand.textContent).toBe("3 / 5");
    expect(place().querySelectorAll('[aria-hidden="true"] > i')).toHaveLength(5);
  });

  it("affiche « Plus de place » quand toute la place est prise, et pas avant (US-0305)", async () => {
    connecte(4, 5);
    expect(await afficher()).not.toContain("Plus de place");
    for (const nombre of [5, 6]) {
      connecte(nombre, 5);
      await afficher();
      expect(morceaux(place())).toEqual(["Plus de place", `${nombre} Habitants sur 5 places`]);
      expect(place().hasAttribute("data-plein")).toBe(true);
    }
  });

  it("montre chaque Habitant sur une ligne du tableau : son prénom, « Choisir un Métier » à la place de « sans Métier », « libre » et la date de son arrivée (US-0303, US-0308)", async () => {
    connecte();
    await afficher();
    expect(within(tableau()).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Prénom", "Métier", "État", "Arrivé le"]);
    expect(lignes()).toEqual(PRENOMS.map((prenom) => `${prenom} · Choisir un Métier · libre · ${ARRIVE_LE}`));
  });

  it("montre le Métier d'un Habitant qui en a un, sur le bouton qui en choisit un autre (US-0310)", async () => {
    connecte();
    habitants.habitantsDuTerritoire.mockResolvedValue([
      { id: 41, prenom: "Dara", ...UN_HABITANT },
      { id: 40, prenom: "Elio", ...UN_HABITANT, metier: "Chasseur" },
    ]);
    await afficher();
    expect(lignes()).toEqual([`Dara · Choisir un Métier · libre · ${ARRIVE_LE}`, `Elio · Chasseur · libre · ${ARRIVE_LE}`]);
    expect([...tableau().querySelectorAll('button[aria-expanded="false"]')].map((b) => b.textContent)).toEqual(["Choisir un Métier", "Chasseur"]);
  });

  it("confie à la liste chaque Habitant avec le nom de son Métier et la date de son arrivée, et les Métiers, chacun avec son icône, sa phrase et ce qu'il attend (US-0307, US-0308)", async () => {
    connecte();
    habitants.habitantsDuTerritoire.mockResolvedValue([
      { id: 41, prenom: "Dara", ...UN_HABITANT },
      { id: 40, prenom: "Elio", ...UN_HABITANT, metier: "Chasseur", arriveLe: new Date("2026-10-01T23:30:00Z") },
    ]);
    await afficher();
    expect(liste.ListeDesHabitants.mock.lastCall?.[0]).toEqual({
      habitants: [
        { id: 41, prenom: "Dara", metier: null, etat: "libre", arriveLe: ARRIVE_LE },
        // L'heure de Paris : le 2 octobre à 1 h 30.
        { id: 40, prenom: "Elio", metier: "Chasseur", etat: "libre", arriveLe: "2 octobre 2026" },
      ],
      metiers: HUIT_METIERS.map((m) => ({ ...m, icone: `/illustrations/metiers/${m.id}.webp` })),
    });
  });

  it("garde l'ordre de la lecture dans chaque groupe, les groupes dans l'ordre des Métiers, ceux sans Métier en premier", async () => {
    connecte();
    habitants.habitantsDuTerritoire.mockResolvedValue([
      { id: 42, prenom: "Joran", ...UN_HABITANT },
      { id: 40, prenom: "Fenn", ...UN_HABITANT, metier: "Bûcheron" },
      { id: 41, prenom: "Ilda", ...UN_HABITANT, metier: "Chasseur" },
      { id: 43, prenom: "Cael", ...UN_HABITANT, metier: "Chasseur" },
    ]);
    await afficher();
    expect(lignes().map((l) => l.split(" · ")[0])).toEqual(["Joran", "Ilda", "Cael", "Fenn"]);
  });

  it("ne montre ni rail ni tableau vide quand il n'y a aucun Habitant : US-0329, une phrase dit que des Voyageurs finiront par passer", async () => {
    connecte(0);
    await afficher();
    const registre = screen.getByRole("region", { name: "Habitants" });
    expect(morceaux(registre)).toEqual(["Habitants", "Aucun Habitant pour l'instant. Des Voyageurs finiront par passer aux portes."]);
    expect(screen.queryByRole("list", { name: "Effectifs par Métier" })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    // Le registre prend la place du rail.
    expect(registre.hasAttribute("data-seul")).toBe(true);
  });

  it("sans Habitant, ne compte rien d'autre : ni bandeau des sans Métier, ni compteurs à zéro, ni filtre (US-0329)", async () => {
    connecte(0);
    await afficher();
    expect(morceaux(principal())).toEqual([
      "Habitants",
      "Aucun Habitant pour l'instant. Des Voyageurs finiront par passer aux portes.",
      "Aux portes",
      "Historique",
      "Personne aux portes pour l'instant.",
      "0 Habitant sur 5 places",
      "Entretien",
      "0 Habitant × 2 Nourriture =",
      "0 Nourriture par heure",
      ...["viande", "100", ", 8 par heure", "vegetaux", "100", ", 14 par heure"],
      "Nourriture assurée",
    ]);
    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("accorde le nombre : « 1 Habitant », « 0 Habitant »", async () => {
    connecte(1);
    expect(await afficher()).toContain(">1 Habitant sur 5 places<");
    connecte(0);
    expect(await afficher()).toContain(">0 Habitant sur 5 places<");
  });

  it("n'ajoute aucune phrase d'explication, ni lien vers ce qui n'existe pas encore", async () => {
    connecte();
    const html = await afficher();
    expect(morceaux(principal())).toEqual([
      // US-0309 : le rail, chacun son nom et son nombre, après « Tous » (US-0314), dont le nombre ne sert qu'aux yeux.
      "Métiers",
      ...["Tous", "Sans Métier", "3"],
      ...HUIT_METIERS.flatMap((m) => [m.nom, "0"]),
      // Le registre : son titre, ce que montre le filtre ; US-0313 : le bandeau des Habitants sans Métier.
      ...["Habitants", "Tous ·", "3"],
      ...["3 Habitants sans Métier", "Voir"],
      ...["Prénom", "Métier", "État", "Arrivé le"],
      // US-0303 : le groupe des sans Métier, puis US-0307, US-0312 : chaque Métier, sa phrase, son effectif entre « − » et « + ».
      ...["Sans Métier", "3"],
      ...PRENOMS.flatMap((prenom) => [prenom, "Choisir un Métier", "libre", ARRIVE_LE]),
      ...HUIT_METIERS.flatMap((m) => [m.nom, m.phrase, ...(m.servira ? [`Servira ${m.servira}.`] : []), "−", "0", "+"]),
      // US-0332 : la partie « Aux portes », quand personne n'attend ; US-0342 : son lien vers l'historique.
      "Aux portes",
      "Historique",
      "Personne aux portes pour l'instant.",
      // US-0305
      "3 Habitants sur 5 places",
      // US-0318, US-0319 : l'Entretien, puis la Viande et les Végétaux qui le paient ; US-0320 : leur tenue.
      "Entretien",
      "3 Habitants × 2 Nourriture =",
      "6 Nourriture par heure",
      ...["viande", "100", ", 8 par heure", "vegetaux", "100", ", 14 par heure"],
      "Nourriture assurée",
    ]);
    expect(html).not.toMatch(/<(form|input|select)[ >]/);
    // Les seuls liens : le raccourci du bandeau vers les Habitants sans Métier (US-0313), puis l'historique des Voyageurs (US-0342).
    expect(within(principal()).getAllByRole("link").map((a) => [a.getAttribute("href"), a.textContent])).toEqual([
      ["/jeu/habitants?metier=sans", "Voir"],
      ["/jeu/habitants/voyageurs", "Historique"],
    ]);
    // Les seuls boutons : ceux qui filtrent le tableau (US-0314), ceux qui donnent un Métier (US-0308), puis « − » et
    // « + » de chaque Métier (US-0312).
    expect(within(principal()).getAllByRole("button").map(nom)).toEqual([
      "Tous",
      "Sans Métier 3",
      ...HUIT_METIERS.map((m) => `${m.nom} 0`),
      ...PRENOMS.map(() => "Choisir un Métier"),
      ...HUIT_METIERS.flatMap((m) => [`Un ${m.nom} de moins`, `Un ${m.nom} de plus`]),
    ]);
  });

  it("signale en tête du registre, à côté du titre, les Habitants sans Métier, avec « Voir » qui mène à eux (US-0313)", async () => {
    connecte();
    await afficher();
    const voir = screen.getByRole("link", { name: "Voir" });
    expect(voir.getAttribute("href")).toBe("/jeu/habitants?metier=sans");
    expect(morceaux(voir.closest("p")!)).toEqual(["3 Habitants sans Métier", "Voir"]);
    expect(screen.getByRole("heading", { level: 1 }).parentElement?.contains(voir)).toBe(true);
  });

  it("compte sur les Habitants de la liste même : « 1 Habitant sans Métier » (US-0313)", async () => {
    connecte();
    habitants.habitantsDuTerritoire.mockResolvedValue([
      { id: 41, prenom: "Dara", ...UN_HABITANT },
      { id: 40, prenom: "Elio", ...UN_HABITANT, metier: "Chasseur" },
      { id: 42, prenom: "Fenn", ...UN_HABITANT, metier: "Mineur" },
    ]);
    expect(await afficher()).toContain(">1 Habitant sans Métier<");
    expect(habitants.habitantsDuTerritoire).toHaveBeenCalledTimes(1);
  });

  it("n'a pas de bandeau quand tous les Habitants ont un Métier, ni sans Habitant (US-0313)", async () => {
    connecte();
    habitants.habitantsDuTerritoire.mockResolvedValue([
      { id: 40, prenom: "Elio", ...UN_HABITANT, metier: "Chasseur" },
      { id: 42, prenom: "Fenn", ...UN_HABITANT, metier: "Mineur" },
    ]);
    await afficher();
    expect(screen.queryByText(/sans Métier$/)).toBeNull();
    // Le seul lien qui reste : l'historique des Voyageurs (US-0342).
    expect(within(principal()).getAllByRole("link").map((a) => a.textContent)).toEqual(["Historique"]);
    connecte(0);
    await afficher();
    expect(within(principal()).getAllByRole("link").map((a) => a.textContent)).toEqual(["Historique"]);
  });

  it("reste sur la page Habitants pour un joueur entré dans son Foyer : recharger la page y ramène", async () => {
    connecte();
    await expect(Habitants()).resolves.toBeTruthy();
  });

  it("montre d'abord le récit d'arrivée s'il ne l'a pas été (US-0160)", async () => {
    connecte();
    chefs.chefDuCompte.mockResolvedValueOnce({ nom: "Ourse", territoireId: 12, recitLu: false });
    await expect(Habitants()).rejects.toMatchObject({ digest: expect.stringContaining(";/jeu/arrivee;") });
  });

  it("renvoie vers la connexion sans session, qui ramènera ensuite ici", async () => {
    cookie.jetonDeSession.mockResolvedValue(undefined);
    await expect(Habitants()).rejects.toMatchObject({ digest: expect.stringContaining(";/connexion?suite=%2Fjeu%2Fhabitants;") });
    expect(habitants.habitantsDuTerritoire).not.toHaveBeenCalled();
  });

  it("reste introuvable en production tant que l'entrée du jeu est fermée", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(Habitants()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    expect(cookie.jetonDeSession).not.toHaveBeenCalled();
  });

  it("compte les effectifs par Métier dans le rail, à gauche du registre : « Tous », « Sans Métier » puis les huit Métiers (US-0309)", async () => {
    connecte();
    await afficher();
    expect(compteurs()).toEqual(["Tous", "Sans Métier 3", ...HUIT_METIERS.map((m) => `${m.nom} 0`)]);
    expect(rangeeDesEffectifs().compareDocumentPosition(tableau()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("compte sur la lecture même de la liste : la somme des compteurs est le nombre d'Habitants (US-0309)", async () => {
    connecte();
    habitants.habitantsDuTerritoire.mockResolvedValue([
      { id: 41, prenom: "Dara", ...UN_HABITANT },
      { id: 40, prenom: "Fenn", ...UN_HABITANT, metier: "Chasseur" },
      { id: 43, prenom: "Ilda", ...UN_HABITANT, metier: "Chasseur" },
      { id: 42, prenom: "Joran", ...UN_HABITANT, metier: "Bûcheron" },
    ]);
    await afficher();
    expect(compteurs().slice(1)).toEqual(["Sans Métier 1", "Explorateur 0", "Chasseur 2", "Cueilleur 0", "Bûcheron 1", "Mineur 0", "Chercheur 0", "Bâtisseur 0", "Éleveur 0"]);
    expect(habitants.habitantsDuTerritoire).toHaveBeenCalledTimes(1);
  });

  it("relit les Habitants à chaque affichage : après rechargement, deux appareils montrent les effectifs de la base, les mêmes partout (US-0315)", async () => {
    connecte();
    /** Les effectifs que montre un affichage de la page : dans le rail, puis en tête de chaque groupe. */
    const effectifsAffiches = async () => {
      await afficher();
      return { compteurs: compteurs().slice(1), metiers: repartitions().map(([n, nombre]) => `${n} ${nombre}`) };
    };
    habitants.habitantsDuTerritoire.mockResolvedValue([{ id: 40, prenom: "Fenn", ...UN_HABITANT, metier: "Chasseur" }]);
    const avant = await effectifsAffiches();
    // L'autre appareil a remis Fenn sans Métier et donné un Métier à Ilda : la base a changé entre deux affichages.
    habitants.habitantsDuTerritoire.mockResolvedValue([
      { id: 40, prenom: "Fenn", ...UN_HABITANT },
      { id: 43, prenom: "Ilda", ...UN_HABITANT, metier: "Mineur" },
    ]);
    const [ordinateur, telephone] = [await effectifsAffiches(), await effectifsAffiches()];
    expect(avant.compteurs.slice(0, 3)).toEqual(["Sans Métier 0", "Explorateur 0", "Chasseur 1"]);
    expect(ordinateur).toEqual(telephone);
    expect(ordinateur.compteurs).toEqual(["Sans Métier 1", "Explorateur 0", "Chasseur 0", "Cueilleur 0", "Bûcheron 0", "Mineur 1", "Chercheur 0", "Bâtisseur 0", "Éleveur 0"]);
    expect(ordinateur.metiers).toEqual(ordinateur.compteurs.slice(1));
    expect(habitants.habitantsDuTerritoire).toHaveBeenCalledTimes(3);
  });

  it("rend le tableau déjà filtré quand l'adresse porte un filtre : recharger la page ou suivre un lien le garde (US-0314)", async () => {
    connecte();
    habitants.habitantsDuTerritoire.mockResolvedValue([
      { id: 41, prenom: "Dara", ...UN_HABITANT },
      { id: 40, prenom: "Elio", ...UN_HABITANT, metier: "Chasseur" },
    ]);
    adresse.recherche = "metier=chasseur";
    await afficher();
    expect(lignes()).toEqual([`Elio · Chasseur · libre · ${ARRIVE_LE}`]);
    const presses = () => within(rangeeDesEffectifs()).getAllByRole("button", { pressed: true }).map(nom);
    expect(presses()).toEqual(["Chasseur 1"]);
    // En tête du registre, ce que montre le filtre.
    expect(screen.getByRole("heading", { level: 1 }).nextElementSibling?.textContent).toBe("Chasseur · 1");
    adresse.recherche = "metier=sans";
    await afficher();
    expect(lignes()).toEqual([`Dara · Choisir un Métier · libre · ${ARRIVE_LE}`]);
    expect(presses()).toEqual(["Sans Métier 1"]);
    // Le filtre ne touche qu'au tableau : les compteurs restent entiers.
    expect(compteurs().slice(1, 3)).toEqual(["Sans Métier 1", "Explorateur 0"]);
  });

  it("montre « Personne n'exerce ce Métier. » à la place des lignes quand l'adresse filtre sur un Métier que personne n'exerce (US-0314)", async () => {
    connecte();
    adresse.recherche = "metier=mineur";
    await afficher();
    expect(lignes()).toEqual([]);
    expect(within(tableau()).getByText("Personne n'exerce ce Métier.").tagName).toBe("P");
    // Le groupe garde son en-tête : « + » y donne le Métier au premier Habitant sans Métier.
    expect(repartitions()).toEqual([["Mineur", 0, "grisé", "actif"]]);
  });

  it("ne filtre rien quand l'adresse porte un identifiant inconnu (US-0314)", async () => {
    connecte();
    adresse.recherche = "metier=druide";
    await afficher();
    expect(lignes()).toHaveLength(3);
    expect(within(rangeeDesEffectifs()).getAllByRole("button", { pressed: true }).map(nom)).toEqual(["Tous"]);
  });

  it("affiche l'Entretien total par heure, détaillé en une ligne : « 3 Habitants × 2 Nourriture = 6 Nourriture par heure » (US-0318)", async () => {
    connecte();
    await afficher();
    expect(habitants.entretienDesHabitants).toHaveBeenCalledWith(expect.anything(), 12);
    expect(ligneEntretien()).toBe("3 Habitants × 2 Nourriture = 6 Nourriture par heure");
    // Le total ressort de la ligne.
    expect(entretien().querySelector("h2 + p > strong")?.textContent).toBe("6 Nourriture par heure");
  });

  it("met l'Entretien dans la colonne de contexte, sous « Aux portes » et la place, dans un panneau à lui (US-0318)", async () => {
    connecte();
    await afficher();
    expect([...contexte().children]).toEqual([auxPortes(), place(), entretien()]);
    expect(entretien().tagName).toBe("SECTION");
  });

  it("relit l'Entretien à chaque affichage : il suit chaque arrivée et chaque départ (US-0318)", async () => {
    connecte(4);
    await afficher();
    expect(ligneEntretien()).toBe("4 Habitants × 2 Nourriture = 8 Nourriture par heure");
    connecte(1);
    await afficher();
    expect(ligneEntretien()).toBe("1 Habitant × 2 Nourriture = 2 Nourriture par heure");
    connecte(0);
    await afficher();
    expect(ligneEntretien()).toBe("0 Habitant × 2 Nourriture = 0 Nourriture par heure");
    expect(habitants.entretienDesHabitants).toHaveBeenCalledTimes(3);
  });

  it("montre le total que rend la lecture, celle du calcul, exact et à la française (US-0318)", async () => {
    connecte();
    habitants.entretienDesHabitants.mockResolvedValue({ habitants: 3, parHabitant: 1.5, parHeure: "4.500000" });
    await afficher();
    expect(ligneEntretien()).toBe("3 Habitants × 1,5 Nourriture = 4,5 Nourriture par heure");
  });

  it("montre sous l'Entretien la Viande et les Végétaux qui le paient : leur quantité, et leur solde par heure comme la barre le compte (US-0319)", async () => {
    connecte();
    stocks.stocksDuTerritoire.mockResolvedValue([
      unStock("viande", "nourriture", "244.700000", "8.000000", "1000.000000", "10.000000"),
      unStock("vegetaux", "nourriture", "460.000000", "14.000000"),
      ...STOCKS_DE_PRAIRIE.slice(2),
    ]);
    await afficher();
    const [viande, vegetaux, ...autres] = within(entretien()).getAllByRole("listitem");
    expect(autres).toEqual([]);
    expect([viande, vegetaux].map((li) => li.textContent)).toEqual(["viande 244 −2/h, moins 2 par heure", "vegetaux 460 +14/h, 14 par heure"]);
    expect([viande, vegetaux].map((li) => li.querySelector("[data-negatif]") !== null)).toEqual([true, false]);
    expect(viande.querySelector("img")?.getAttribute("src")).toContain(encodeURIComponent("/illustrations/ressources/viande.webp"));
  });

  it("dit « Nourriture assurée » sous l'Entretien quand la production la couvre, ou tout juste (US-0320)", async () => {
    connecte();
    await afficher();
    expect([tenue().tagName, tenue().textContent, tenue().hasAttribute("data-baisse")]).toEqual(["P", "Nourriture assurée", false]);
    // 11 Habitants : 22 d'Entretien pour 8 + 14 de production, un solde nul.
    connecte(11);
    await afficher();
    expect(tenue().textContent).toBe("Nourriture assurée");
  });

  it("dit combien de temps la Nourriture tiendra quand elle baisse : douze Habitants en prairie, « Nourriture pour encore 4 j 4 h » (US-0320)", async () => {
    // La Viande baisse de 4 par heure, les Végétaux montent de 2 : la Viande se vide en 25 h, puis les Végétaux, à 150, en 75 h.
    connecte(12);
    await afficher();
    expect([texte(tenue()), tenue().hasAttribute("data-baisse")]).toEqual(["Nourriture pour encore 4 j 4 h", true]);
    // Le panneau de l'Entretien passe en alerte.
    expect(entretien().hasAttribute("data-alerte")).toBe(true);
  });

  it("compte avec les Stocks, la production et l'Entretien du moment, lus pour le Territoire du joueur une fois mis à l'heure (US-0320)", async () => {
    connecte(12);
    stocks.stocksDuTerritoire.mockResolvedValue([
      unStock("viande", "nourriture", "20.000000", "8.000000"),
      unStock("vegetaux", "nourriture", "7.500000", "14.000000"),
      ...STOCKS_DE_PRAIRIE.slice(2),
    ]);
    await afficher();
    // La Viande se vide en 5 h ; les Végétaux, à 17,5, baissent alors de 2 par heure : 8 h 45 de plus.
    expect(texte(tenue())).toBe("Nourriture pour encore 13 h");
    expect(stocks.stocksDuTerritoire).toHaveBeenCalledWith(expect.anything(), 12);
    expect(temps.rattraper).toHaveBeenCalledWith("territoire", 12);
    expect(temps.rattraper.mock.invocationCallOrder[0]).toBeLessThan(stocks.stocksDuTerritoire.mock.invocationCallOrder[0]);
  });

  it("dit « moins d'une heure » quand la Nourriture est presque épuisée (US-0320)", async () => {
    connecte(12);
    stocks.stocksDuTerritoire.mockResolvedValue([
      unStock("viande", "nourriture", "0.000000", "8.000000"),
      unStock("vegetaux", "nourriture", "1.500000", "14.000000"),
      ...STOCKS_DE_PRAIRIE.slice(2),
    ]);
    await afficher();
    expect(texte(tenue())).toBe("Nourriture pour encore moins d'une heure");
  });

  it("met en tête du groupe de chaque Métier son nom, sa phrase et quand il servira, dans l'ordre des huit Métiers (US-0307)", async () => {
    connecte();
    await afficher();
    const lus = tetesDeMetier().map((th) => morceaux(th).slice(0, -3));
    expect(lus.map(([n]) => n)).toEqual(["Explorateur", "Chasseur", "Cueilleur", "Bûcheron", "Mineur", "Chercheur", "Bâtisseur", "Éleveur"]);
    expect(lus[3]).toEqual(["Bûcheron", "rapporte du Bois des forêts", "Servira avec les Récoltes."]);
    expect(lus[5]).toEqual(["Chercheur", "fait avancer la Recherche", "Servira quand le cercle des sages sera bâti."]);
    expect(lus).toEqual(HUIT_METIERS.map((m) => [m.nom, m.phrase, ...(m.servira ? [`Servira ${m.servira}.`] : [])]));
  });

  it("montre le médaillon peint de chaque Métier, muet (le nom est à côté), en tête de son groupe et dans le rail (US-0307)", async () => {
    connecte();
    await afficher();
    for (const [i, m] of HUIT_METIERS.entries()) {
      const chemin = encodeURIComponent(`/illustrations/metiers/${m.id}.webp`);
      for (const ou of [tetesDeMetier()[i], within(rangeeDesEffectifs()).getAllByRole("listitem")[i + 2]]) {
        const icone = [...ou.querySelectorAll("img")].find((img) => img.getAttribute("src")?.includes(chemin));
        expect(icone?.getAttribute("alt"), m.id).toBe("");
        expect(icone?.closest("[aria-hidden]"), m.id).not.toBeNull();
      }
    }
  });

  it("met en tête de chaque groupe de Métier son effectif entre « − » et « + », compté sur la lecture même de la liste, et les grise quand ils ne peuvent servir (US-0312)", async () => {
    connecte();
    habitants.habitantsDuTerritoire.mockResolvedValue([
      { id: 41, prenom: "Dara", ...UN_HABITANT },
      { id: 40, prenom: "Fenn", ...UN_HABITANT, metier: "Chasseur" },
      { id: 43, prenom: "Ilda", ...UN_HABITANT, metier: "Chasseur" },
    ]);
    await afficher();
    expect(repartitions()).toEqual(HUIT_METIERS.map((m) => (m.nom === "Chasseur" ? [m.nom, 2, "actif", "actif"] : [m.nom, 0, "grisé", "actif"])));
    // Chaque bouton dit à un lecteur d'écran ce qu'il fait.
    expect(within(tableau()).getByRole("button", { name: "Un Chasseur de moins" }).textContent).toBe("−");
    expect(within(tableau()).getByRole("button", { name: "Un Chasseur de plus" }).textContent).toBe("+");
    // Plus personne sans Métier : « + » est grisé partout.
    habitants.habitantsDuTerritoire.mockResolvedValue([{ id: 40, prenom: "Fenn", ...UN_HABITANT, metier: "Mineur" }]);
    await afficher();
    expect(repartitions()).toEqual(HUIT_METIERS.map((m) => (m.nom === "Mineur" ? [m.nom, 1, "actif", "grisé"] : [m.nom, 0, "grisé", "grisé"])));
  });

  it("lit les Métiers une fois par affichage, et les montre dans l'ordre de la lecture (US-0307)", async () => {
    connecte();
    metiers.lesMetiers.mockResolvedValue([HUIT_METIERS[4], HUIT_METIERS[0]]);
    await afficher();
    expect(metiers.lesMetiers).toHaveBeenCalledTimes(1);
    expect(repartitions().map(([n]) => n)).toEqual(["Mineur", "Explorateur"]);
    expect(compteurs()).toEqual(["Tous", "Sans Métier 3", "Mineur 0", "Explorateur 0"]);
  });

  it("ne dit rien de plus d'un Métier qui sert déjà (US-0307)", async () => {
    connecte();
    metiers.lesMetiers.mockResolvedValue([{ ...HUIT_METIERS[3], servira: null }, HUIT_METIERS[4]]);
    await afficher();
    expect(tetesDeMetier().map((th) => morceaux(th).slice(0, -3))).toEqual([
      ["Bûcheron", "rapporte du Bois des forêts"],
      ["Mineur", "rapporte de la Pierre des montagnes", "Servira avec les Récoltes."],
    ]);
  });

  it("ne montre aucun groupe de Métier vide sans Métier à lire (US-0307)", async () => {
    connecte();
    metiers.lesMetiers.mockResolvedValue([]);
    await afficher();
    expect(tetesDeMetier()).toEqual([]);
    expect(compteurs()).toEqual(["Tous", "Sans Métier 3"]);
  });
});

describe("page Habitants, l'écran de stratégie en trois zones (US-0302, US-0306)", () => {
  const lire = (chemin: string) => readFileSync(join(process.cwd(), "src/app/jeu/habitants", chemin), "utf8");
  const [page, registre, choix] = [lire("page.module.css"), lire("ListeDesHabitants.module.css"), lire("MetiersAuChoix.module.css")];
  /** Les déclarations d'une règle, dans `texte`. */
  const regle = (selecteur: string, texte: string) =>
    texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\>]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";
  /** La feuille à partir du bloc @media `media`. */
  const depuis = (texte: string, media: string) => texte.slice(texte.indexOf(media));
  const tablette = (texte: string) => depuis(texte, "@media (max-width: 1023px)");
  const telephone = (texte: string) => depuis(texte, "@media (max-width: 760px)");

  it("pose sur ordinateur le rail, le registre et la colonne de contexte côte à côte, et les tient dans la fenêtre", () => {
    expect(regle(".page", page)).toContain('grid-template-areas: "rail registre contexte";');
    expect(regle(".page", page)).toContain("grid-template-columns: 218px minmax(0, 1fr) 296px;");
    expect(regle(".rail", registre)).toContain("grid-area: rail;");
    expect(regle(".registre", registre)).toContain("grid-area: registre;");
    expect(regle(".contexte", page)).toContain("grid-area: contexte;");
    const grand = depuis(page, "@media (min-width: 1024px) and (min-height: 600px)");
    expect(regle(".page", grand)).toContain("height: var(--hauteur-utile);");
    expect(regle(".page", grand)).toContain("grid-template-rows: minmax(0, 1fr);");
    // US-0329 : sans Habitant, le registre prend la place du rail.
    expect(regle(".registre[data-seul]", registre)).toContain("grid-column: rail-start / registre-end;");
  });

  it("tient 100 Habitants : le tableau défile dans son panneau, l'en-tête des colonnes et celui de chaque groupe collés en haut, des lignes denses", () => {
    expect(regle(".defile", registre)).toContain("overflow: auto;");
    expect(regle(".registre", registre)).toContain("min-height: 0;");
    expect(regle(".tableau thead th", registre)).toMatch(/position: sticky;[^}]*top: 0;/);
    expect(regle(".teteDeGroupe > th", registre)).toMatch(/position: sticky;[^}]*top: 32px;/);
    expect(regle(".tableau thead th", registre)).toContain("height: 32px;");
    expect(regle(".habitant > *", registre)).toContain("height: 38px;");
    // Un long prénom ou une longue phrase se coupent d'une ellipse sans élargir le tableau.
    expect(regle(".tableau", registre)).toMatch(/width: 100%;[^}]*table-layout: fixed;/);
    expect(regle(".habitant > *", registre)).toMatch(/overflow: hidden;[^}]*text-overflow: ellipsis;/);
    expect(regle(".phrase", registre)).toMatch(/overflow: hidden;[^}]*text-overflow: ellipsis;/);
  });

  it("resserre le rail et la colonne de contexte entre 1 024 et 1 200 px, pour laisser sa place au registre", () => {
    const entreDeux = depuis(page, "@media (min-width: 1024px) and (max-width: 1199px)");
    expect(regle(".page", entreDeux)).toContain("grid-template-columns: 204px minmax(0, 1fr) 268px;");
    expect(regle(".colonneMetier", depuis(registre, "@media (min-width: 1024px) and (max-width: 1199px)"))).toContain("width: 176px;");
  });

  it("garde le rail entier à côté sur ordinateur : chaque compteur se partage la hauteur, entre 48 et 66 px", () => {
    expect(regle(".compteurs > li", registre)).toMatch(/flex: 1 1 0;[^}]*min-height: 48px;[^}]*max-height: 66px;/);
  });

  it("sur une tablette et un téléphone, fait du rail une bande qui défile de côté, et passe la colonne de contexte au-dessus du registre", () => {
    expect(regle(".page", tablette(page))).toMatch(/grid-template-areas:\s*"rail"\s*"contexte"\s*"registre";/);
    expect(regle(".page", tablette(page))).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(regle(".compteurs", tablette(registre))).toMatch(/flex-direction: row;[^}]*overflow-x: auto;/);
    expect(regle(".compteurs > li", tablette(registre))).toContain("flex: none;");
    // La page défile : l'en-tête des colonnes se colle sous la barre du haut.
    expect(regle(".tableau thead th", tablette(registre))).toContain("top: var(--hauteur-barre);");
    expect(regle(".defile", tablette(registre))).toContain("overflow: visible;");
  });

  it("sur un téléphone, tient sur une seule colonne, sans défilement de côté : chaque ligne en deux rangées", () => {
    expect(regle(".contexte", telephone(page))).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(regle(".tableau thead", telephone(registre))).toContain("display: none;");
    expect(regle(".habitant", telephone(registre))).toMatch(/grid-template-areas:\s*"prenom metier"\s*"etat arrivee";/);
    expect(regle(".phrase,\n  .servira", telephone(registre))).toContain("white-space: normal;");
    for (const texte of [tablette(page), tablette(registre)]) {
      for (const [, colonnes] of texte.matchAll(/grid-template-columns: ([^;]+);/g)) {
        expect(colonnes.split(/ (?![^(]*\))/).every((c) => c === "auto" || c.startsWith("minmax(0,")), colonnes).toBe(true);
      }
    }
  });

  it("met « − » et « + » au pouce sur un téléphone : 36 px de côté au moins", () => {
    const pouce = regle(".pas > button", telephone(registre));
    expect(Number(pouce.match(/width: (\d+)px;/)?.[1])).toBeGreaterThanOrEqual(36);
    expect(Number(pouce.match(/height: (\d+)px;/)?.[1])).toBeGreaterThanOrEqual(34);
  });

  it("marque le filtre pressé d'un trait lumineux à gauche, lisible sans la couleur ; d'un cerne de cuivre clair dans la bande (US-0314)", () => {
    expect(regle('.compteur[aria-pressed="true"]::before', registre)).toMatch(/left: 0;[^}]*width: 3px;[^}]*background: var\(--cuivre-clair\);/);
    expect(regle('.compteur[aria-pressed="true"]', tablette(registre))).toContain("border-color: var(--cuivre-clair);");
    expect(regle(".compteur:focus-visible", registre)).toContain("outline: 2px solid var(--cuivre-clair);");
  });

  it("déplie les Métiers sur une rangée de huit, quatre sur un téléphone ; « Sans Métier » et « Renvoyer » en haut à droite pour les yeux, les derniers au clavier (US-0308, US-0311, US-0330)", () => {
    expect(regle(".choixDuMetier", registre)).toContain("display: contents;");
    expect(regle(".choixDuMetier > [data-metier]", registre)).toMatch(/flex: 0 0 calc\(\(100% - 7 \* 8px\) \/ 8\);[^}]*order: 3;/);
    expect(regle(".choixDuMetier > [data-metier]", telephone(registre))).toContain("flex-basis: calc((100% - 3 * 8px) / 4);");
    expect(regle(".choixDuMetier > [data-sans-metier]", registre)).toContain("order: 1;");
    expect(regle(".renvoyer", registre)).toContain("order: 2;");
    // Rien de plus après « Renvoyer » sur sa rangée : les Métiers commencent à la ligne.
    expect(regle(".dedans::after", registre)).toMatch(/flex-basis: 100%;[^}]*order: 2;/);
  });

  it("marque dans le dépliant le Métier que l'Habitant exerce, cerclé de cuivre clair, sans réagir au survol (US-0310)", () => {
    const actuel = regle('.metierAuChoix[aria-pressed="true"]', choix);
    expect(actuel).toContain("border-color: var(--cuivre-lueur);");
    expect(actuel).toContain("color: var(--cuivre-clair);");
    expect(actuel).toContain("cursor: default;");
    expect(choix).toMatch(/\.metierAuChoix:enabled:hover[ ,]/);
    expect(choix).not.toMatch(/\.metierAuChoix:hover/);
  });

  it("donne à « Sans Métier » une autre allure qu'un Métier : un bouton en contour, sur toute la largeur quand il est dans la grille (US-0311)", () => {
    const sansMetier = regle(".sansMetierAuChoix", choix);
    expect(sansMetier).toContain("display: inline-flex;");
    expect(sansMetier).toContain("grid-column: 1 / -1;");
    expect(sansMetier).toContain("border: 1px solid var(--filet-cuivre);");
    expect(sansMetier).toContain("cursor: pointer;");
    expect(choix).toMatch(/\.sansMetierAuChoix:hover/);
    expect(choix).toMatch(/\.sansMetierAuChoix:focus-visible/);
  });

  it("met « Confirmer le renvoi » plein, dans la couleur d'alerte (US-0330)", () => {
    expect(regle(".renvoyer[data-confirmer]", registre)).toMatch(/border-color: var\(--braise\);[^}]*background: var\(--braise\);[^}]*color: var\(--sur-cuivre\);/);
  });

  it("met « Choisir un Métier » au cuivre, la pastille dépliée cerclée de cuivre clair, sa flèche retournée (US-0308)", () => {
    expect(regle(".choisir[data-a-choisir]", choix)).toMatch(/border-color: var\(--cuivre-trace\);[^}]*color: var\(--cuivre-clair\);/);
    expect(regle('.choisir[aria-expanded="true"]', choix)).toContain("border-color: var(--cuivre-clair);");
    expect(regle('.choisir[aria-expanded="true"] .fleche', choix)).toContain("transform: rotate(180deg);");
    expect(regle(".choisir:focus-visible", choix)).toContain("outline: 2px solid var(--cuivre-clair);");
  });

  it("pose le bandeau des sans Métier sur son filet de braise, son lien « Voir » souligné au clavier (US-0313)", () => {
    expect(regle(".voirSansMetier", registre)).toMatch(/border-left: 1px solid var\(--braise-filet\);[^}]*color: var\(--cuivre-clair\);/);
    expect(regle(".voirSansMetier:focus-visible", registre)).toContain("outline: 2px solid var(--cuivre-clair);");
  });

  it("met la tenue de la Nourriture en gras, en feuille, dans la couleur d'alerte quand elle baisse (US-0320)", () => {
    const laTenue = regle(".tenue", page);
    expect(laTenue).toContain("color: var(--feuille);");
    expect(laTenue).toContain("font: var(--graisse-titre) 13.5px / 1.2 var(--police);");
    expect(regle(".tenue[data-baisse]", page)).toContain("color: var(--braise);");
    expect(regle(".entretien[data-alerte]", page)).toContain("border-color: var(--braise-filet);");
  });

  it("n'écrit aucune couleur en clair, ni aucun des anciens noms : seulement ceux du kit", () => {
    for (const texte of [page, registre, choix]) {
      expect(texte).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|oklch\(/i);
      expect(texte).not.toMatch(/var\(--(bloc|encre|miel|texte-2|texte-discret|texte-pale|trait|galet|mauvais|bon|sable|voile)\)/);
    }
  });
});

// US-0332 : les Voyageurs aux portes, lus pour la page, et US-0333 : la partie qui les montre, observée pour voir
// ce que la page lui confie (vitest remonte ces appels en tête du fichier).
type Voyageur = { id: number; prenom: string; arriveLe: Date; departLe: Date };
const voyageurs = vi.hoisted(() => ({ voyageursAuxPortes: vi.fn(async (): Promise<Voyageur[]> => []) }));
vi.mock("@/monde/voyageurs", async (original) => ({ ...(await original<object>()), ...voyageurs }));
const portes = vi.hoisted(() => ({ AuxPortes: vi.fn() }));
vi.mock("./AuxPortes", async (original) => {
  const { AuxPortes } = await original<typeof import("./AuxPortes")>();
  portes.AuxPortes.mockImplementation(AuxPortes);
  return portes;
});

describe("page Habitants, les Voyageurs aux portes (US-0332, US-0333)", () => {
  afterEach(async () => {
    document.body.innerHTML = "";
    voyageurs.voyageursAuxPortes.mockReset();
    metiers.lesMetiers.mockReset();
    stocks.stocksDuTerritoire.mockReset();
    (await import("@/temps/horloge")).definirAncre(null);
  });

  const HEURE = 3_600_000;
  /**
   * Un joueur connecté, ses trois Habitants, les huit Métiers et ces Voyageurs aux portes, arrivés il y a tant
   * d'heures, chacun avec son départ tel que le jeu le calcule.
   */
  const connecte = async (...attentes: [prenom: string, heures: number][]) => {
    const { departDuVoyageur } = await import("@/monde/voyageurs");
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    habitants.habitantsDuTerritoire.mockResolvedValue(PRENOMS.map((prenom, i) => ({ id: 40 + i, prenom, ...UN_HABITANT })));
    habitants.placesDuTerritoire.mockResolvedValue(5);
    habitants.entretienDesHabitants.mockResolvedValue({ habitants: 3, parHabitant: 2, parHeure: "6" });
    metiers.lesMetiers.mockResolvedValue(HUIT_METIERS);
    // Une demi-minute de plus : le temps du test passe sans changer l'heure entière affichée.
    const arrivees = attentes.map(([prenom, heures], i) => ({ id: 70 + i, prenom, arriveLe: new Date(Date.now() - heures * HEURE - 30_000) }));
    voyageurs.voyageursAuxPortes.mockResolvedValue(arrivees.map((v) => ({ ...v, departLe: departDuVoyageur(v.arriveLe) })));
  };
  /** Ce que dit chaque carte de Voyageur, ses morceaux séparés par « · » ; son portrait ne sert qu'aux yeux. */
  const lignesAuxPortes = () => within(auxPortes()).queryAllByRole("listitem").map((li) => morceaux(li).join(" · "));

  it("montre chaque Voyageur qui attend aux portes du Territoire du joueur, dans l'ordre de la lecture, depuis quand il attend et, US-0333, dans combien de temps il repart", async () => {
    await connecte(["Joran", 5], ["Ilda", 2]);
    await afficher();
    expect(voyageurs.voyageursAuxPortes).toHaveBeenCalledWith(expect.anything(), 12);
    // US-0334, US-0336 : chaque carte finit par « Accueillir » et « Refuser » ; US-0340 : puis l'Entretien en plus.
    // US-0335 : au-dessus des boutons, le Métier qu'aura le Voyageur, « Sans Métier » d'abord.
    expect(lignesAuxPortes()).toEqual([
      "Joran · arrivé il y a 5 h · repart dans 7 h · Sans Métier · Accueillir · Refuser · Mangera 2 Nourriture par heure",
      "Ilda · arrivé il y a 2 h · repart dans 10 h · Sans Métier · Accueillir · Refuser · Mangera 2 Nourriture par heure",
    ]);
  });

  it("confie à « Aux portes » les huit Métiers au choix de la liste, pour en donner un dès l'accueil (US-0335)", async () => {
    await connecte(["Joran", 5]);
    await afficher();
    expect(portes.AuxPortes.mock.lastCall?.[0].metiers).toEqual(HUIT_METIERS.map((m) => ({ id: m.id, nom: m.nom, icone: `/illustrations/metiers/${m.id}.webp` })));
  });

  it("confie au compte à rebours l'heure et la vitesse du jeu, telles que le serveur les tient (US-0333)", async () => {
    const { definirAncre } = await import("@/temps/horloge");
    const jeu = Date.parse("2026-10-07T18:00:00Z");
    definirAncre({ facteur: 100, reel: Date.now(), jeu });
    await connecte(["Joran", 5]);
    await afficher();
    const { voyageurs: confies, maintenant, vitesse } = portes.AuxPortes.mock.lastCall?.[0] ?? {};
    expect(confies).toEqual(await voyageurs.voyageursAuxPortes.mock.results[0].value);
    expect(vitesse).toBe(100);
    expect(maintenant.getTime() - jeu).toBeGreaterThanOrEqual(0);
    expect(maintenant.getTime() - jeu).toBeLessThan(100 * 5_000);
  });

  it("confie à « Aux portes » la place qui reste au Foyer, grisant « Accueillir » quand elle est toute prise (US-0338)", async () => {
    await connecte(["Joran", 5]);
    await afficher();
    expect(portes.AuxPortes.mock.lastCall?.[0].placesLibres).toBe(2);
    habitants.placesDuTerritoire.mockResolvedValue(3);
    await afficher();
    expect(portes.AuxPortes.mock.lastCall?.[0].placesLibres).toBe(0);
    expect(within(auxPortes()).getByText("Plus de place au Foyer. Des huttes en ajouteront quand les constructions seront là.")).toBeTruthy();
    expect((within(auxPortes()).getByRole("button", { name: "Accueillir Joran" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("confie à « Aux portes » l'avertissement « famine imminente », compté comme la bande d'alerte sur les Stocks et l'Entretien lus à l'heure (US-0340)", async () => {
    await connecte(["Joran", 5]);
    await afficher();
    // Trois Habitants en prairie : la Nourriture est assurée.
    expect(portes.AuxPortes.mock.lastCall?.[0].famineImminente).toBe(false);
    // Douze Habitants, la Viande vide : les Végétaux tiennent 13 h, puis 12 h, au seuil.
    habitants.entretienDesHabitants.mockResolvedValue({ habitants: 12, parHabitant: 2, parHeure: "24.000000" });
    for (const [vegetaux, avertissement] of [
      ["26.000000", false],
      ["24.000000", true],
    ] as const) {
      stocks.stocksDuTerritoire.mockResolvedValue([unStock("viande", "nourriture", "0.000000", "8.000000"), unStock("vegetaux", "nourriture", vegetaux, "14.000000")]);
      await afficher();
      expect(portes.AuxPortes.mock.lastCall?.[0].famineImminente, vegetaux).toBe(avertissement);
    }
    expect(stocks.stocksDuTerritoire).toHaveBeenLastCalledWith(expect.anything(), 12);
  });

  it("confie à « Aux portes » la Famine du Territoire, lue une fois mis à l'heure : les Voyageurs l'évitent (US-0341)", async () => {
    await connecte();
    await afficher();
    expect(portes.AuxPortes.mock.lastCall?.[0].famine).toBe(false);
    famine.famineDepuis.mockResolvedValueOnce(2.5);
    temps.rattraper.mockClear();
    await afficher();
    expect(portes.AuxPortes.mock.lastCall?.[0].famine).toBe(true);
    expect(famine.famineDepuis).toHaveBeenLastCalledWith(expect.anything(), 12);
    expect(temps.rattraper).toHaveBeenCalledWith("territoire", 12);
    expect(auxPortes().lastElementChild?.textContent).toBe("Les Voyageurs évitent un Territoire en Famine.");
  });

  it("affiche « Personne aux portes pour l'instant. » quand personne n'attend, sous le lien vers l'historique (US-0342)", async () => {
    await connecte();
    await afficher();
    expect([...auxPortes().children].map((e) => [e.tagName, e.textContent])).toEqual([
      ["H2", "Aux portes"],
      ["A", "Historique"],
      ["P", "Personne aux portes pour l'instant."],
    ]);
    expect(within(auxPortes()).getByRole("link", { name: "Historique" }).getAttribute("href")).toBe("/jeu/habitants/voyageurs");
  });

  it("met « Aux portes » en tête de la colonne de contexte, avant la place et l'Entretien, à côté du registre sur ordinateur", async () => {
    await connecte(["Joran", 5]);
    await afficher();
    expect(contexte().firstElementChild).toBe(auxPortes());
    expect(principal().lastElementChild).toBe(contexte());
  });

  it("pose le portrait du Voyageur en bandeau, sous son prénom, pour les yeux seulement", async () => {
    await connecte(["Joran", 5]);
    await afficher();
    const carte = within(auxPortes()).getByRole("listitem");
    const portrait = carte.querySelector("img")!;
    expect(portrait.getAttribute("alt")).toBe("");
    expect(portrait.closest("[aria-hidden]")).not.toBeNull();
    expect(carte.querySelector(":scope > span")?.textContent).toBe("Joran");
  });
});
