import { describe, expect, it } from "vitest";
import { FAMINE_IMMINENTE_HEURES, VOYAGEUR_ATTEND_HEURES, VOYAGEUR_TOUTES_LES_HEURES } from "@/reglages";
import type { Stock } from "./stocks";
import { avertissementDeFamine, departDuVoyageur, ecartAvantVoyageur, recitDAccueil, recitDeDepart } from "./voyageurs";

const HEURE = 3_600_000;
const MINUTE = 60_000;
const MOYENNE = VOYAGEUR_TOUTES_LES_HEURES * HEURE;

/** Les écarts de 200 Territoires sur leurs 500 premières arrivées : 100 000 tirages. */
function tirages(): number[] {
  const ecarts: number[] = [];
  for (let territoire = 1; territoire <= 200; territoire++) {
    for (let numero = 1; numero <= 500; numero++) ecarts.push(ecartAvantVoyageur(territoire, numero));
  }
  return ecarts;
}

describe("l'écart entre deux arrivées de Voyageurs (US-0331)", () => {
  const ecarts = tirages();

  it("vaut en moyenne la moyenne réglée, à moins de 3 minutes près sur 100 000 tirages", () => {
    const moyenne = ecarts.reduce((somme, e) => somme + e, 0) / ecarts.length;
    // L'écart type d'une moyenne de 100 000 tirages uniformes sur 8 heures est d'environ 26 secondes.
    expect(Math.abs(moyenne - MOYENNE)).toBeLessThan(3 * 60_000);
  });

  it("va de la moitié à une fois et demie la moyenne, et couvre tout l'intervalle", () => {
    const [min, max] = [Math.min(...ecarts), Math.max(...ecarts)];
    expect(min).toBeGreaterThanOrEqual(MOYENNE / 2);
    expect(max).toBeLessThan(MOYENNE * 1.5);
    expect(min).toBeLessThan(MOYENNE / 2 + 60_000);
    expect(max).toBeGreaterThan(MOYENNE * 1.5 - 60_000);
    expect(ecarts.every(Number.isInteger)).toBe(true);
  });

  it("tombe aussi souvent dans chaque huitième de l'intervalle : un tirage uniforme", () => {
    const parts = Array.from({ length: 8 }, () => 0);
    for (const e of ecarts) parts[Math.floor(((e - MOYENNE / 2) / MOYENNE) * 8)] += 1;
    // 12 500 attendus dans chacun ; l'écart type est d'environ 105.
    for (const n of parts) expect(Math.abs(n - ecarts.length / 8)).toBeLessThan(600);
  });

  it("est irrégulier : d'une arrivée à l'autre et d'un Territoire à l'autre, la suite change", () => {
    const suite = (territoire: number) => Array.from({ length: 20 }, (_, i) => ecartAvantVoyageur(territoire, i + 1));
    expect(new Set(suite(7)).size).toBe(20);
    expect(suite(7)).not.toEqual(suite(8));
  });

  it("est reproductible : le même Territoire et le même numéro donnent toujours le même écart", () => {
    expect(ecartAvantVoyageur(42, 3)).toBe(ecartAvantVoyageur(42, 3));
    // Des valeurs fixées : la base tire les mêmes (voyageurs.db.test.ts) ; les changer changerait la suite de chacun.
    expect([ecartAvantVoyageur(1, 1), ecartAvantVoyageur(1, 2), ecartAvantVoyageur(303, 1)]).toEqual(ECARTS_FIXES);
  });
});

/** Les écarts du Territoire 1 pour ses arrivées 1 et 2, et du Territoire 303 pour sa première, en millisecondes. */
const ECARTS_FIXES = [37_883_206, 39_482_426, 38_074_376];

describe("le départ d'un Voyageur (US-0333)", () => {
  it("vient VOYAGEUR_ATTEND_HEURES heures de jeu après son arrivée, à la milliseconde", () => {
    const arrive = new Date("2026-10-07T08:00:00.123Z");
    expect(departDuVoyageur(arrive)).toEqual(new Date(arrive.getTime() + VOYAGEUR_ATTEND_HEURES * HEURE));
    // L'instant d'arrivée qu'on lui confie reste tel quel.
    expect(arrive.toISOString()).toBe("2026-10-07T08:00:00.123Z");
  });

  it("laisse une attente de quelques heures entières", () => {
    expect(Number.isInteger(VOYAGEUR_ATTEND_HEURES)).toBe(true);
    expect(VOYAGEUR_ATTEND_HEURES).toBeGreaterThan(0);
    expect(VOYAGEUR_ATTEND_HEURES).toBeLessThanOrEqual(48);
  });
});

describe("le Récit d'un Voyageur accueilli (US-0334)", () => {
  /** L'heure du jeu de l'accueil. */
  const ACCUEIL = new Date("2026-10-07T18:00:00Z");
  /** Un Voyageur arrivé `ms` millisecondes de jeu avant l'accueil. */
  const arriveIlYa = (ms: number) => new Date(ACCUEIL.getTime() - ms);

  it("annonce le nouvel Habitant, et dit en une phrase depuis quand il attendait, à l'heure de l'accueil", () => {
    expect(recitDAccueil("Ines", arriveIlYa(3 * HEURE + 20 * MINUTE), ACCUEIL)).toEqual({
      titre: "Ines a rejoint le Territoire",
      texte: "Ines, qui attendait aux portes depuis 3 h, vit désormais au Foyer.",
      survenuLe: ACCUEIL,
    });
  });

  it.each([
    [30_000, "moins d'une minute"],
    [MINUTE, "1 min"],
    [59 * MINUTE + 59_000, "59 min"],
    [HEURE, "1 h"],
    [11 * HEURE + 59 * MINUTE, "11 h"],
  ])("compte l'attente comme la ligne aux portes : %i ms, « %s »", (ms, attente) => {
    expect(recitDAccueil("Joran", arriveIlYa(ms), ACCUEIL).texte).toBe(`Joran, qui attendait aux portes depuis ${attente}, vit désormais au Foyer.`);
  });
});

describe("le Récit des Voyageurs repartis sans avoir été accueillis (US-0337)", () => {
  /** L'heure du jeu du dernier départ. */
  const DEPART = new Date("2026-10-07T18:00:00Z");

  it("dit, pour un seul Voyageur, qu'il a repris la route, sans lui donner de genre, daté de son départ", () => {
    expect(recitDeDepart(["Ines"], DEPART)).toEqual({
      titre: "Ines a repris la route",
      texte: "Ines a attendu aux portes sans qu'on l'accueille.",
      survenuLe: DEPART,
    });
  });

  it("regroupe ceux repartis ensemble : leur nombre en titre, leurs prénoms dans le texte, dans l'ordre de leurs départs", () => {
    expect(recitDeDepart(["Ines", "Joran"], DEPART)).toEqual({
      titre: "2 Voyageurs ont repris la route",
      texte: "Ines et Joran ont attendu aux portes sans qu'on les accueille.",
      survenuLe: DEPART,
    });
    expect(recitDeDepart(["Ines", "Joran", "Ilda", "Arno"], DEPART)).toMatchObject({
      titre: "4 Voyageurs ont repris la route",
      texte: "Ines, Joran, Ilda et Arno ont attendu aux portes sans qu'on les accueille.",
    });
  });
});

describe("l'avertissement « famine imminente » au moment d'accueillir (US-0340)", () => {
  /** Un Stock tel que la base le lit, en texte. */
  const unStock = (id: string, famille: Stock["famille"], quantite: string, parHeure: string): Stock => ({
    id,
    nom: id,
    famille,
    quantite,
    limite: "1000.000000",
    parHeure,
    entretienParHeure: "0.000000",
    sources: [],
  });
  /** Les quatre Stocks d'un Foyer en prairie (+8 Viande, +14 Végétaux, +4 Bois et Pierre), avec ces quantités de Viande et de Végétaux. */
  const stocks = (viande: string, vegetaux: string) => [
    unStock("viande", "nourriture", viande, "8.000000"),
    unStock("vegetaux", "nourriture", vegetaux, "14.000000"),
    unStock("bois", "materiaux", "100.000000", "4.000000"),
    unStock("pierre", "materiaux", "100.000000", "4.000000"),
  ];

  it("n'est pas actif quand la production couvre l'Entretien, même les Stocks vides", () => {
    expect(avertissementDeFamine(stocks("100.000000", "100.000000"), "6.000000")).toBe(false);
    expect(avertissementDeFamine(stocks("0.000000", "0.000000"), "22.000000")).toBe(false);
  });

  // Douze Habitants : 24 d'Entretien. La Viande est vide ; les Végétaux paient 16 par heure pour 14 produits.
  it(`l'est, comme la bande d'alerte, quand la Nourriture ne tient plus que ${FAMINE_IMMINENTE_HEURES} heures, ou moins`, () => {
    expect(avertissementDeFamine(stocks("0.000000", "26.000000"), "24.000000")).toBe(false);
    expect(avertissementDeFamine(stocks("0.000000", "24.000000"), "24.000000")).toBe(true);
    expect(avertissementDeFamine(stocks("0.000000", "22.000000"), "24.000000")).toBe(true);
  });

  // US-0826 : douze Habitants (24) et des carnivores qui mangent 8 de Viande par heure, toute sa production : la Viande, à
  // 12, se vide en 1 h ; les Végétaux, montés à 102, paient alors les 24 pour 14 produits : 10 h 12 de plus, sous le seuil.
  // Sans les carnivores, la Viande tiendrait 3 h, puis les Végétaux, à 106, 53 h.
  it("compte l'Entretien des Bêtes, comme le calcul du jeu (US-0826)", () => {
    expect(avertissementDeFamine(stocks("12.000000", "100.000000"), "24.000000")).toBe(false);
    expect(avertissementDeFamine(stocks("12.000000", "100.000000"), "24.000000", null, { viande: "8.000000", vegetaux: "0.000000", omnivores: "0.000000" })).toBe(true);
    // Les omnivores mangent après les Habitants : quand la production nourrit ceux-ci, aucun avertissement, poules ou non.
    expect(avertissementDeFamine(stocks("60.000000", "100.000000"), "6.000000", null, { viande: "0.000000", vegetaux: "0.000000", omnivores: "30.000000" })).toBe(false);
  });

  // US-0323 : à 13 h tout juste (Végétaux 26, −2 par heure), dans la marge : actif seulement si le Territoire le retient.
  it("le reste dans la marge du seuil tant que le Territoire retient l'avertissement, comme la bande", () => {
    expect(avertissementDeFamine(stocks("0.000000", "26.000000"), "24.000000", null)).toBe(false);
    expect(avertissementDeFamine(stocks("0.000000", "26.000000"), "24.000000", 2)).toBe(true);
    expect(avertissementDeFamine(stocks("0.000000", "30.000000"), "24.000000", 2)).toBe(false);
  });

  it("le reste quand la Nourriture est épuisée, comme pendant une Famine : l'accueil demande la même confirmation", () => {
    expect(avertissementDeFamine(stocks("0.000000", "0.000000"), "24.000000")).toBe(true);
  });

  it("n'est pas actif sans Stock de Nourriture", () => {
    expect(avertissementDeFamine([], "24.000000")).toBe(false);
  });
});
