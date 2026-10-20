import { describe, expect, it } from "vitest";
import { ouEnEstLElevage, prochaineNaissance, tempsAvant } from "./suivi-d-elevage";

const MINUTE = 60_000;
/** Un Élevage de trois souris de 15 minutes chacune, lancé à midi pile (heure de Paris), à la milliseconde. */
const LANCE = new Date("2026-10-15T10:00:00.250Z");
const TROIS = { quantite: 3, lanceLe: LANCE, dureeMinutes: 15 };
const apres = (ms: number) => new Date(LANCE.getTime() + ms);

describe("où en est un Élevage en cours (US-0818)", () => {
  it("compte les Bêtes déjà nées comme leurs naissances : la k-ième au lancement plus k fois la durée d'une Bête", () => {
    expect(ouEnEstLElevage(TROIS, LANCE)).toEqual({ nees: 0, prochaine: apres(15 * MINUTE), derniere: apres(45 * MINUTE) });
    expect(ouEnEstLElevage(TROIS, apres(15 * MINUTE - 1)).nees).toBe(0);
    // Pile à sa naissance, la Bête est née, et la suivante est attendue.
    expect(ouEnEstLElevage(TROIS, apres(15 * MINUTE))).toEqual({ nees: 1, prochaine: apres(30 * MINUTE), derniere: apres(45 * MINUTE) });
    expect(ouEnEstLElevage(TROIS, apres(44 * MINUTE)).nees).toBe(2);
  });

  it("n'attend plus rien une fois la dernière née, et n'en compte jamais plus que la quantité", () => {
    expect(ouEnEstLElevage(TROIS, apres(45 * MINUTE))).toEqual({ nees: 3, prochaine: null, derniere: apres(45 * MINUTE) });
    expect(ouEnEstLElevage(TROIS, apres(600 * MINUTE)).nees).toBe(3);
  });

  it("ne compte aucune Bête avant le lancement, posé un peu après le clic (lancerUnElevage)", () => {
    expect(ouEnEstLElevage(TROIS, apres(-5))).toEqual({ nees: 0, prochaine: apres(15 * MINUTE), derniere: apres(45 * MINUTE) });
  });
});

describe("la prochaine naissance des Élevages en cours (US-0818)", () => {
  it("est la plus proche de toutes, à l'heure donnée ; aucune sans Élevage, ou tous finis", () => {
    const pigeons = { quantite: 2, lanceLe: apres(10 * MINUTE), dureeMinutes: 30 };
    expect(prochaineNaissance([TROIS, pigeons], apres(16 * MINUTE))).toEqual(apres(30 * MINUTE));
    expect(prochaineNaissance([TROIS, pigeons], apres(31 * MINUTE))).toEqual(apres(40 * MINUTE));
    expect(prochaineNaissance([TROIS, pigeons], apres(70 * MINUTE))).toBeNull();
    expect(prochaineNaissance([], LANCE)).toBeNull();
  });
});

describe("le temps avant une naissance (US-0818)", () => {
  it("se dit à la minute supérieure, comme le temps restant d'une Expédition : jamais « 0 min »", () => {
    expect(tempsAvant(apres(15 * MINUTE), LANCE)).toBe("15 min");
    expect(tempsAvant(apres(15 * MINUTE), apres(1))).toBe("15 min");
    expect(tempsAvant(apres(15 * MINUTE), apres(15 * MINUTE - 1))).toBe("1 min");
    expect(tempsAvant(apres(500 * MINUTE), LANCE)).toBe("8 h 20");
  });
});
