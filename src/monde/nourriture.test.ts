import { describe, expect, it } from "vitest";
import { FAMINE_IMMINENTE_HEURES, FAMINE_IMMINENTE_MARGE_HEURES } from "@/reglages";
import {
  avantFamine,
  avantFamineImminente,
  depuisCombienDeTemps,
  depuisFamine,
  depuisFamineImminente,
  famineImminenteRetenue,
  nourriturePourEncore,
  nourriturePourEncoreDesStocks,
  nourritureRestante,
  type StockDeNourriture,
  tenueDeLaNourriture,
} from "./nourriture";

/** Un Stock de Nourriture : sa quantité, sa production par heure, et sa limite (1 000 au départ). */
const stock = (quantite: number, parHeure: number, limite = 1000): StockDeNourriture => ({ quantite, parHeure, limite });

/**
 * La règle de l'Entretien (US-0316) déroulée pas à pas, telle que PRODUIRE la décrit : à chaque pas, la
 * Viande et les Végétaux paient chacun la moitié de l'Entretien ; celui qui ne le peut pas donne tout ce
 * qu'il a, et l'autre paie le reste s'il le peut. Un Stock au-dessus de sa limite ne produit plus, et sa
 * production ne le pousse jamais au-delà. Rend les heures écoulées avant le premier pas où l'Entretien
 * n'est plus payé en entier ; null s'il l'est encore au bout de `jusqua` heures.
 */
function deroulement(viande: StockDeNourriture, vegetaux: StockDeNourriture, entretien: number, pas: number, jusqua = 3000): number | null {
  const unPas = (s: number, p: number, c: number, l: number) => Math.max(s - c, Math.min(s + p - c, l));
  const [e, pv, pg] = [entretien * pas, viande.parHeure * pas, vegetaux.parHeure * pas];
  let [v, g] = [viande.quantite, vegetaux.quantite];
  for (let n = 0; n * pas < jusqua; n++) {
    const [dv, dg] = [v + pv, g + pg];
    let [cv, cg] = [e / 2, e / 2];
    if (dv < e / 2) [cv, cg] = [dv, Math.min(dg, e - dv)];
    else if (dg < e / 2) [cv, cg] = [Math.min(dv, e - dg), dg];
    if (cv + cg < e - 1e-9) return n * pas;
    [v, g] = [unPas(v, pv, cv, viande.limite), unPas(g, pg, cg, vegetaux.limite)];
  }
  return null;
}

/** Une suite de nombres au hasard, toujours la même d'un lancement à l'autre. */
function hasard(graine: number) {
  let etat = graine;
  return () => {
    etat = (etat * 1103515245 + 12345) % 2147483648;
    return etat / 2147483648;
  };
}

describe("combien de temps tiendra la Nourriture (US-0320)", () => {
  it("rend null quand la production couvre l'Entretien : la Nourriture est assurée, solde nul compris", () => {
    // Trois Habitants en prairie : +8 et +14 pour 6 d'Entretien.
    expect(nourriturePourEncore(stock(100, 8), stock(100, 14), 6)).toBeNull();
    expect(nourriturePourEncore(stock(100, 3), stock(100, 3), 6)).toBeNull();
    expect(nourriturePourEncore(stock(0, 0), stock(0, 0), 0)).toBeNull();
  });

  it("rend null même quand un Stock baisse, si l'autre suffit seul ensuite", () => {
    // La Viande se vide en 50 h ; les Végétaux paient alors 10 − 1 = 9 par heure, et en produisent 9.
    expect(nourriturePourEncore(stock(200, 1), stock(100, 9), 10)).toBeNull();
    expect(deroulement(stock(200, 1), stock(100, 9), 10, 1 / 60)).toBeNull();
  });

  it("compte les deux Stocks qui baissent ensemble : 100 de chaque à −4 par heure tiennent 25 h", () => {
    expect(nourriturePourEncore(stock(100, 8), stock(100, 8), 24)).toBeCloseTo(25, 9);
  });

  it("ne divise pas le stock total par le solde quand un seul Stock baisse : douze Habitants en prairie tiennent 100 h, pas 50", () => {
    // Viande 8 − 12 = −4 par heure, Végétaux 14 − 12 = +2 : solde −2 pour 200 en stock.
    // La Viande se vide en 25 h ; les Végétaux, montés à 150, paient alors 24 − 8 = 16 et en produisent 14 : 75 h de plus.
    expect(nourriturePourEncore(stock(100, 8), stock(100, 14), 24)).toBeCloseTo(100, 9);
    expect(nourriturePourEncore(stock(100, 14), stock(100, 8), 24)).toBeCloseTo(100, 9);
  });

  it("arrête le Stock qui monte à sa limite, comme le calcul du jeu", () => {
    // Les Végétaux plafonnent à 1 000 au bout de 5 h ; la Viande se vide en 25 h ; puis 1 000 à −2 par heure.
    expect(nourriturePourEncore(stock(100, 8), stock(990, 14), 24)).toBeCloseTo(525, 9);
  });

  it("ne fait plus produire un Stock au-dessus de sa limite : il paie sa part sans rien recevoir jusqu'à elle", () => {
    // Les Végétaux, à 2 000 pour 1 000, paient 12 par heure sans produire : 1 700 quand la Viande se vide, au bout
    // de 25 h ; puis 16 par heure jusqu'à 1 000 (43,75 h), et enfin −2 par heure (500 h).
    expect(nourriturePourEncore(stock(100, 8), stock(2000, 14), 24)).toBeCloseTo(568.75, 9);
  });

  it("compte un Stock sans production qui se vide le premier, l'autre montant en attendant", () => {
    // La Viande paie 6 par heure : vide en 8 h 20 ; les Végétaux montent de 4 par heure jusqu'à 43,33, puis baissent de 2.
    expect(nourriturePourEncore(stock(50, 0), stock(10, 10), 12)).toBeCloseTo(30, 9);
  });

  it("part d'un Stock déjà vide : l'autre paie tout le reste dès maintenant", () => {
    expect(nourriturePourEncore(stock(0, 8), stock(100, 14), 24)).toBeCloseTo(50, 9);
    expect(nourriturePourEncore(stock(0, 8), stock(0, 14), 24)).toBe(0);
  });

  it("donne le temps d'un déroulement pas à pas, à un pas près, quels que soient les Stocks, au-dessus de leur limite compris", () => {
    const tirer = hasard(320);
    const pas = 1 / 60;
    const entier = (max: number) => Math.round(tirer() * max);
    for (let essai = 0; essai < 60; essai++) {
      const viande = stock(entier(2500), entier(20), 200 + entier(1800));
      const vegetaux = stock(entier(2500), entier(20), 200 + entier(1800));
      const production = viande.parHeure + vegetaux.parHeure;
      // Deux fois sur trois, la Nourriture baisse d'au moins 2 par heure (elle tient alors moins de 2 500 h) ; sinon, elle est assurée.
      const entretien = essai % 3 ? production + 2 + 2 * entier(10) : Math.max(0, production - 2 * entier(5));
      const calcule = nourriturePourEncore(viande, vegetaux, entretien);
      const deroule = deroulement(viande, vegetaux, entretien, pas);
      const cas = JSON.stringify({ viande, vegetaux, entretien });
      if (essai % 3) {
        expect(deroule, cas).not.toBeNull();
        expect(calcule, cas).not.toBeNull();
        expect(Math.abs(calcule! - deroule!), cas).toBeLessThanOrEqual(2 * pas);
      } else {
        expect(calcule, cas).toBeNull();
        expect(deroule, cas).toBeNull();
      }
    }
  });
});

/** US-0826 : l'Entretien des Bêtes par heure : des carnivores (Viande), des herbivores (Végétaux), des omnivores (l'un ou l'autre). */
type Betes = { viande: number; vegetaux: number; omnivores: number };

/**
 * US-0826 : la règle de l'Entretien déroulée pas à pas avec les Bêtes, telle que PRODUIRE la décrit. Chaque Stock paie
 * d'abord les Bêtes qui ne mangent que lui, puis la moitié de la demande partagée (les Habitants, puis les omnivores) ;
 * celui qui ne le peut pas donne tout ce qu'il a, à ses Bêtes d'abord, et l'autre paie tout le reste s'il le peut.
 * Rend les heures écoulées avant le premier pas où les Habitants ne reçoivent plus tout leur Entretien ; null s'ils le
 * reçoivent encore au bout de `jusqua` heures.
 */
function deroulementAvecBetes(viande: StockDeNourriture, vegetaux: StockDeNourriture, entretien: number, betes: Betes, pas: number, jusqua = 3000): number | null {
  const unPas = (s: number, p: number, c: number, l: number) => Math.max(s - c, Math.min(s + p - c, l));
  const [h, dv, dg, partage] = [entretien * pas, betes.viande * pas, betes.vegetaux * pas, (entretien + betes.omnivores) * pas];
  const [pv, pg] = [viande.parHeure * pas, vegetaux.parHeure * pas];
  let [v, g] = [viande.quantite, vegetaux.quantite];
  for (let n = 0; n * pas < jusqua; n++) {
    const [av, ag] = [v + pv, g + pg];
    const [cv1, cg1] = [dv + partage / 2, dg + partage / 2];
    let [cv, cg] = [cv1, cg1];
    if (av < cv1 && ag < cg1) [cv, cg] = [av, ag];
    else if (av < cv1) [cv, cg] = [av, Math.min(ag, dg + partage - Math.max(0, av - dv))];
    else if (ag < cg1) [cv, cg] = [Math.min(av, dv + partage - Math.max(0, ag - dg)), ag];
    if (Math.max(0, cv - dv) + Math.max(0, cg - dg) < h - 1e-9) return n * pas;
    [v, g] = [unPas(v, pv, cv, viande.limite), unPas(g, pg, cg, vegetaux.limite)];
  }
  return null;
}

describe("combien de temps tiendra la Nourriture des Habitants, avec l'Entretien des Bêtes (US-0826)", () => {
  const sans: Betes = { viande: 0, vegetaux: 0, omnivores: 0 };

  it("sans Bête, rend ce que rendait la règle des seuls Habitants", () => {
    expect(nourriturePourEncore(stock(100, 8), stock(100, 14), 24, sans)).toBeCloseTo(100, 9);
    expect(nourriturePourEncore(stock(100, 8), stock(100, 14), 6, sans)).toBeNull();
  });

  it("fait payer les carnivores par la seule Viande : vide, elle laisse les Végétaux nourrir les Habitants", () => {
    // La Viande paie 4 aux carnivores et 3 aux Habitants : vide en 100 / 7 h ; les Végétaux, qui produisent 100, paient
    // alors les 6 des Habitants. Les carnivores ont faim, les Habitants non : la Nourriture des Habitants est assurée.
    expect(nourriturePourEncore(stock(100, 0), stock(1000, 100), 6, { ...sans, viande: 4 })).toBeNull();
  });

  it("vide plus vite la Nourriture que les Bêtes partagent avec les Habitants", () => {
    // Deux omnivores à 3 par heure : 6 + 6 = 12 partagés, 6 sur chaque Stock, qui ne produisent rien : 100 h ; sans eux, 200 h.
    expect(nourriturePourEncore(stock(600, 0), stock(600, 0), 6, sans)).toBeCloseTo(200, 9);
    expect(nourriturePourEncore(stock(600, 0), stock(600, 0), 6, { ...sans, omnivores: 6 })).toBeCloseTo(100, 9);
    // Des herbivores à 6 par heure sur les Végétaux : ceux-ci, à 9 par heure, se vident en 66,67 h ; la Viande, qui en a
    // payé 3, en a encore 400 et paie alors les 6 des Habitants : 66,67 h de plus.
    expect(nourriturePourEncore(stock(600, 0), stock(600, 0), 6, { ...sans, vegetaux: 6 })).toBeCloseTo(600 / 9 + 400 / 6, 9);
  });

  it("rend null quand ce que la production laisse aux Habitants, après les Bêtes qui ne mangent qu'elle, les nourrit", () => {
    expect(nourriturePourEncore(stock(0, 10), stock(0, 10), 12, { ...sans, viande: 5 })).toBeNull();
    expect(nourriturePourEncore(stock(0, 10), stock(0, 10), 12, { ...sans, viande: 9 })).toBe(0);
  });

  it("donne le temps d'un déroulement pas à pas, à un pas près, avec des Bêtes de tous les régimes", () => {
    const tirer = hasard(826);
    const pas = 1 / 60;
    const entier = (max: number) => Math.round(tirer() * max);
    for (let essai = 0; essai < 90; essai++) {
      const viande = stock(entier(2500), entier(20), 200 + entier(1800));
      const vegetaux = stock(entier(2500), entier(20), 200 + entier(1800));
      const betes = { viande: entier(8), vegetaux: entier(8), omnivores: entier(8) };
      const entretien = 2 + entier(20);
      const calcule = nourriturePourEncore(viande, vegetaux, entretien, betes);
      const deroule = deroulementAvecBetes(viande, vegetaux, entretien, betes, pas);
      const cas = JSON.stringify({ viande, vegetaux, entretien, betes });
      if (deroule === null) expect(calcule === null || calcule > 2900, cas).toBe(true);
      else {
        expect(calcule, cas).not.toBeNull();
        expect(Math.abs(calcule! - deroule), cas).toBeLessThanOrEqual(2 * pas);
      }
    }
  });

  it("lit l'Entretien des Bêtes tel que la base le rend, en texte (nourriturePourEncoreDesStocks)", () => {
    const lus = [
      { famille: "nourriture", quantite: "600", parHeure: "0", limite: "1000" },
      { famille: "nourriture", quantite: "600", parHeure: "0", limite: "1000" },
    ];
    expect(nourriturePourEncoreDesStocks(lus, "6", { viande: "0", vegetaux: "0", omnivores: "6" })).toBeCloseTo(100, 9);
    expect(nourriturePourEncoreDesStocks(lus, "6")).toBeCloseTo(200, 9);
  });
});

describe("dire combien de temps tiendra la Nourriture (US-0320)", () => {
  /** Une espace insécable entre un nombre et son unité, pour qu'ils ne se séparent jamais. */
  const _ = " ";

  it("dit « Nourriture assurée » quand le solde est positif ou nul", () => {
    expect(tenueDeLaNourriture(null)).toBe("Nourriture assurée");
  });

  it("dit les heures, arrondies vers le bas : « Nourriture pour encore 7 h »", () => {
    expect(tenueDeLaNourriture(7)).toBe(`Nourriture pour encore 7${_}h`);
    expect(tenueDeLaNourriture(7.99)).toBe(`Nourriture pour encore 7${_}h`);
    expect(tenueDeLaNourriture(1)).toBe(`Nourriture pour encore 1${_}h`);
    expect(tenueDeLaNourriture(48.9)).toBe(`Nourriture pour encore 48${_}h`);
    // Une erreur d'arrondi du calcul, sous la microseconde, ne fait pas perdre une heure.
    expect(tenueDeLaNourriture(29.999999999999996)).toBe(`Nourriture pour encore 30${_}h`);
    expect(tenueDeLaNourriture(29.9999)).toBe(`Nourriture pour encore 29${_}h`);
  });

  it("dit « moins d'une heure » sous une heure", () => {
    expect(tenueDeLaNourriture(0.99)).toBe("Nourriture pour encore moins d'une heure");
    expect(tenueDeLaNourriture(0.001)).toBe("Nourriture pour encore moins d'une heure");
  });

  it("dit « Famine » quand la Nourriture ne paie plus du tout l'Entretien (US-0325)", () => {
    expect(tenueDeLaNourriture(0)).toBe("Famine");
  });

  it("passe aux jours au-delà de 48 h : « 3 j 5 h », « 3 j »", () => {
    expect(tenueDeLaNourriture(49)).toBe(`Nourriture pour encore 2${_}j${_}1${_}h`);
    expect(tenueDeLaNourriture(77.5)).toBe(`Nourriture pour encore 3${_}j${_}5${_}h`);
    expect(tenueDeLaNourriture(100)).toBe(`Nourriture pour encore 4${_}j${_}4${_}h`);
    expect(tenueDeLaNourriture(72)).toBe(`Nourriture pour encore 3${_}j`);
  });
});

describe("la famine imminente (US-0321)", () => {
  const HEURE = 3_600_000;

  it("compte la tenue de la Nourriture sur les Stocks tels que la base les lit : la Viande et les Végétaux, en texte", () => {
    /** Un Stock lu en base, en texte. */
    const lu = (id: string, famille: "nourriture" | "materiaux", quantite: string, parHeure: string) => ({ id, famille, quantite, parHeure, limite: "1000.000000" });
    const stocks = [lu("viande", "nourriture", "20.000000", "8.000000"), lu("vegetaux", "nourriture", "7.500000", "14.000000"), lu("bois", "materiaux", "0.000000", "4.000000")];
    // Douze Habitants en prairie : la Viande se vide en 5 h, puis les Végétaux, à 17,5, en 8 h 45.
    expect(nourriturePourEncoreDesStocks(stocks, "24.000000")).toBeCloseTo(13.75, 9);
    expect(nourriturePourEncoreDesStocks(stocks, "22.000000")).toBeNull();
    // Sans Stock de Nourriture, rien à compter.
    expect(nourriturePourEncoreDesStocks(stocks.slice(2), "24.000000")).toBeNull();
  });

  it("devient imminente quand la Nourriture ne couvre plus que 12 heures d'Entretien : dit dans combien de temps réel, au rythme du jeu, aussitôt si elle l'est déjà", () => {
    expect(FAMINE_IMMINENTE_HEURES).toBe(12);
    expect(avantFamineImminente(13, 1)).toBe(HEURE);
    expect(avantFamineImminente(13, 100)).toBe(HEURE / 100);
    expect(avantFamineImminente(12.01, 100)).toBeCloseTo(360, 6);
    expect(avantFamineImminente(12, 100)).toBe(0);
    expect(avantFamineImminente(7, 1)).toBe(0);
  });

  it("fait baisser le temps qui reste au rythme du jeu, sans passer sous zéro", () => {
    expect(nourritureRestante(7.5, HEURE, 1)).toBe(6.5);
    expect(nourritureRestante(7.5, HEURE / 100, 100)).toBe(6.5);
    expect(nourritureRestante(7.5, 0, 100)).toBe(7.5);
    expect(nourritureRestante(0.5, HEURE, 1)).toBe(0);
  });
});

describe("depuis quand la famine est imminente (US-0322)", () => {
  const HEURE = 3_600_000;
  /** Une espace insécable entre un nombre et son unité. */
  const _ = "\u00a0";

  it("part de ce que le Territoire retient, et le fait monter au rythme du jeu", () => {
    expect(depuisFamineImminente(7, 3, 0, 1)).toBe(3);
    expect(depuisFamineImminente(7, 3, HEURE, 1)).toBe(4);
    expect(depuisFamineImminente(7, 3, HEURE / 100, 100)).toBe(4);
  });

  it("sans rien de retenu, compte depuis le passage du seuil, page ouverte", () => {
    // 13 h de Nourriture : le seuil est passé au bout d'une heure de jeu, puis le temps court.
    expect(depuisFamineImminente(13, null, HEURE, 1)).toBe(0);
    expect(depuisFamineImminente(13, null, 1.5 * HEURE, 1)).toBe(0.5);
    expect(depuisFamineImminente(13, null, (1.5 * HEURE) / 100, 100)).toBeCloseTo(0.5, 12);
  });

  it("sans rien de retenu mais déjà sous le seuil, compte depuis la lecture, comme le fera le prochain rattrapage", () => {
    expect(depuisFamineImminente(7, null, 0, 1)).toBe(0);
    expect(depuisFamineImminente(7, null, HEURE, 1)).toBe(1);
  });

  it("dit « depuis un instant » sous une minute, puis les minutes, puis les heures, arrondies vers le bas", () => {
    expect(depuisCombienDeTemps(0)).toBe("depuis un instant");
    expect(depuisCombienDeTemps(59 / 3600)).toBe("depuis un instant");
    expect(depuisCombienDeTemps(1 / 60)).toBe(`depuis 1${_}min`);
    expect(depuisCombienDeTemps(45.9 / 60)).toBe(`depuis 45${_}min`);
    expect(depuisCombienDeTemps(1)).toBe(`depuis 1${_}h`);
    expect(depuisCombienDeTemps(3.99)).toBe(`depuis 3${_}h`);
    expect(depuisCombienDeTemps(48.5)).toBe(`depuis 48${_}h`);
    // Une erreur d'arrondi du calcul, sous la microseconde, ne fait pas perdre une minute.
    expect(depuisCombienDeTemps(31 / 60 - 1e-15)).toBe(`depuis 31${_}min`);
    expect(depuisCombienDeTemps(2.9999999999999996)).toBe(`depuis 3${_}h`);
  });

  it("passe aux jours au-delà de 48 h, comme le temps qui reste : « 2 j 5 h », « 3 j »", () => {
    expect(depuisCombienDeTemps(53.5)).toBe(`depuis 2${_}j${_}5${_}h`);
    expect(depuisCombienDeTemps(72)).toBe(`depuis 3${_}j`);
  });
});

describe("retirer l'avertissement quand le danger est passé (US-0323)", () => {
  it("garde la famine imminente que le Territoire retient tant que la Nourriture ne couvre pas plus de 13 heures", () => {
    expect(FAMINE_IMMINENTE_MARGE_HEURES).toBe(1);
    expect(famineImminenteRetenue(7, 3)).toBe(3);
    expect(famineImminenteRetenue(12.5, 3)).toBe(3);
    expect(famineImminenteRetenue(13, 3)).toBe(3);
  });

  it("la lâche au-delà de 13 heures", () => {
    expect(famineImminenteRetenue(13.01, 3)).toBeNull();
    expect(famineImminenteRetenue(40, 3)).toBeNull();
  });

  it("ne retient rien que le Territoire ne retienne", () => {
    expect(famineImminenteRetenue(7, null)).toBeNull();
    expect(famineImminenteRetenue(12.5, null)).toBeNull();
  });
});

describe("la Famine (US-0325)", () => {
  const HEURE = 3_600_000;

  it("commence quand la Nourriture ne paie plus l'Entretien : dit dans combien de temps réel, au rythme du jeu, aussitôt si c'est déjà le cas", () => {
    expect(avantFamine(7, 1)).toBe(7 * HEURE);
    expect(avantFamine(7, 100)).toBe((7 * HEURE) / 100);
    expect(avantFamine(0, 100)).toBe(0);
  });

  it("part de ce que le Territoire retient, et le fait monter au rythme du jeu", () => {
    expect(depuisFamine(0, 2, 0, 1)).toBe(2);
    expect(depuisFamine(0, 2, HEURE, 1)).toBe(3);
    expect(depuisFamine(0, 2, HEURE / 100, 100)).toBe(3);
  });

  it("sans rien de retenu, compte depuis l'instant où la Nourriture ne paie plus l'Entretien, page ouverte", () => {
    // 7 h de Nourriture : la Famine commence au bout de 7 h de jeu, puis le temps court.
    expect(depuisFamine(7, null, 7 * HEURE, 1)).toBe(0);
    expect(depuisFamine(7, null, 7.5 * HEURE, 1)).toBe(0.5);
    expect(depuisFamine(7, null, (7.5 * HEURE) / 100, 100)).toBeCloseTo(0.5, 12);
    // Déjà là à la lecture : depuis la lecture, comme le fera le prochain rattrapage.
    expect(depuisFamine(0, null, HEURE, 1)).toBe(1);
  });
});
