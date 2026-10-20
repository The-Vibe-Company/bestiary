import { describe, expect, it } from "vitest";
import { casesDansLeRayon, type Coordonnees } from "@/monde/hex";
import {
  BROUILLARD_LEVE_AUTOUR_DE_LA_DESTINATION_CASES,
  BROUILLARD_LEVE_PAR_ECLAIREUR_CASES,
  BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES,
  BROUILLARD_LEVE_SUR_LE_CHEMIN_CASES,
} from "@/reglages";
import { casesRevelees } from "./brouillard";
import { rayonDesEclaireurs } from "./eclaireurs";
import { cheminDUneExpedition } from "./chemin";
import type { HorairesDUneExpedition } from "./phase";

const MINUTE_MS = 60_000;
const DEPART = new Date("2026-10-09T07:42:00.000Z");
/** Une heure du jeu, `minutes` après le départ. */
const apres = (minutes: number) => new Date(DEPART.getTime() + minutes * MINUTE_MS);

const FOYER: Coordonnees = { q: 12, r: -7 };
/** Une destination à 6 Cases à l'est du Foyer : son chemin passe par (13, -7), (14, -7)… jusqu'à (18, -7). */
const DESTINATION: Coordonnees = { q: 18, r: -7 };
const CHEMIN = cheminDUneExpedition(FOYER, DESTINATION);
/** 6 Cases au pas des explorateurs, 20 minutes chacune : 2 h d'aller, puis 4 h de séjour, puis 2 h de retour. */
const EXPEDITION: HorairesDUneExpedition = { partLe: DEPART, trajetMinutes: 120, sejourMinutes: 240 };
/** Les Cases que l'Expédition a sorties du brouillard `minutes` après son départ, sous forme de clés « q,r ». */
const a = (minutes: number, horaires = EXPEDITION) => new Set(casesRevelees(FOYER, DESTINATION, horaires, apres(minutes)).map(cle));
const cle = ({ q, r }: Coordonnees) => `${q},${r}`;
/** Les Cases à `rayon` Cases de `c` ou moins, sous forme de clés. */
const autour = (c: Coordonnees, rayon: number) => casesDansLeRayon(c, rayon).map(cle);

describe("le brouillard se lève sur le chemin (US-0914)", () => {
  it("ne se lève pas au départ : rien n'est révélé avant que l'Expédition atteigne la première Case de son chemin", () => {
    expect(a(0)).toEqual(new Set());
    expect(a(19)).toEqual(new Set());
  });

  it(`se lève à chaque Case du chemin à son passage, et sur ${BROUILLARD_LEVE_SUR_LE_CHEMIN_CASES} Case autour d'elle, pas plus loin`, () => {
    expect(a(20)).toEqual(new Set(autour(CHEMIN[0], BROUILLARD_LEVE_SUR_LE_CHEMIN_CASES)));
    expect(a(39)).toEqual(a(20));
    expect(a(40)).toEqual(new Set([...autour(CHEMIN[0], 1), ...autour(CHEMIN[1], 1)]));
    // La troisième Case du chemin, à deux pas de la deuxième, reste sous le brouillard tant qu'elle n'atteint pas la deuxième.
    expect(a(39).has(cle(CHEMIN[2]))).toBe(false);
    expect(a(40).has(cle(CHEMIN[2]))).toBe(true);
    expect(a(40).has(cle(CHEMIN[3]))).toBe(false);
  });

  it(`se lève à l'arrivée sur la destination et ${BROUILLARD_LEVE_AUTOUR_DE_LA_DESTINATION_CASES} Cases autour d'elle`, () => {
    const avant = a(119);
    const arrivee = a(120);
    for (const c of autour(DESTINATION, BROUILLARD_LEVE_AUTOUR_DE_LA_DESTINATION_CASES)) expect(arrivee.has(c)).toBe(true);
    // À deux pas au-delà de la destination, rien n'était révélé juste avant l'arrivée.
    expect(avant.has(cle({ q: 20, r: -7 }))).toBe(false);
    expect(arrivee.has(cle({ q: 20, r: -7 }))).toBe(true);
    expect(arrivee.has(cle({ q: 21, r: -7 }))).toBe(false);
    const toutLeChemin = CHEMIN.slice(0, -1).flatMap((c) => autour(c, BROUILLARD_LEVE_SUR_LE_CHEMIN_CASES));
    expect(arrivee).toEqual(new Set([...toutLeChemin, ...autour(DESTINATION, BROUILLARD_LEVE_AUTOUR_DE_LA_DESTINATION_CASES)]));
  });

  it("ne lève plus rien de neuf pendant le séjour ni au retour, ni une fois l'Expédition rentrée", () => {
    for (const minutes of [120 + 239, 120 + 240, 120 + 240 + 61, 120 + 240 + 120, 30 * 24 * 60]) expect(a(minutes)).toEqual(a(120));
  });

  it("suit l'allure de l'Expédition : une escorte plus lente lève le brouillard d'autant plus tard (US-0912)", () => {
    const lente = { ...EXPEDITION, trajetMinutes: 300 };
    expect(a(49, lente)).toEqual(new Set());
    expect(a(50, lente)).toEqual(new Set(autour(CHEMIN[0], 1)));
    expect(a(299, lente).has(cle({ q: 20, r: -7 }))).toBe(false);
    expect(a(300, lente)).toEqual(a(120));
  });

  it("ne lève rien tant que le trajet d'une escorte n'est pas chiffré (US-0912) : elle reste au Foyer", () => {
    expect(a(30 * 24 * 60, { ...EXPEDITION, trajetMinutes: null })).toEqual(new Set());
  });

  it("dit pour chaque Case l'instant où l'Expédition l'a sortie du brouillard : son premier passage d'où elle la voit", () => {
    const quand = new Map(casesRevelees(FOYER, DESTINATION, EXPEDITION, apres(30 * 24 * 60)).map((c) => [cle(c), c.le]));
    expect(quand.get(cle(CHEMIN[0]))).toEqual(apres(20));
    // La troisième Case du chemin se voit dès la deuxième.
    expect(quand.get(cle(CHEMIN[2]))).toEqual(apres(40));
    expect(quand.get(cle(DESTINATION))).toEqual(apres(100));
    expect(quand.get(cle({ q: 20, r: -7 }))).toEqual(apres(120));
    for (const le of quand.values()) expect(le.getTime()).toBeLessThanOrEqual(apres(120).getTime());
  });

  it("révèle chaque Case une seule fois", () => {
    const revelees = casesRevelees(FOYER, DESTINATION, EXPEDITION, apres(120)).map(cle);
    expect(revelees).toHaveLength(new Set(revelees).size);
  });
});

describe("le brouillard d'une Expédition rappelée (US-0920)", () => {
  /** Rappelée 50 minutes après son départ, entre la deuxième et la troisième Case de son chemin. */
  const RAPPELEE = { ...EXPEDITION, rappeleeLe: apres(50) };

  it("garde levées les Cases déjà révélées, et n'en lève plus aucune après son rappel, ni la destination", () => {
    expect(a(50, RAPPELEE)).toEqual(a(40));
    for (const minutes of [60, 100, 120, 120 + 240, 30 * 24 * 60]) expect(a(minutes, RAPPELEE)).toEqual(a(40));
    expect(a(30 * 24 * 60, RAPPELEE).has(cle(DESTINATION))).toBe(false);
  });

  it("rappelée en séjour, garde tout ce que son aller a levé, destination comprise", () => {
    expect(a(30 * 24 * 60, { ...EXPEDITION, rappeleeLe: apres(121) })).toEqual(a(120));
  });
});

describe("les Éclaireurs lèvent plus de brouillard (US-0969)", () => {
  /** Les Cases qu'une Expédition de `eclaireurs` Éclaireurs a sorties du brouillard `minutes` après son départ, sous forme de clés. */
  const avec = (eclaireurs: number, minutes: number) => new Set(casesRevelees(FOYER, DESTINATION, EXPEDITION, apres(minutes), eclaireurs).map(cle));

  it(`chaque Éclaireur agrandit le rayon de ${BROUILLARD_LEVE_PAR_ECLAIREUR_CASES} Case, jusqu'à ${BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES} Cases de plus`, () => {
    expect([0, 1, 2, 3, 10].map(rayonDesEclaireurs)).toEqual([0, 1, 2, 2, 2]);
    // Sans Éclaireur, rien ne change.
    for (const minutes of [0, 20, 40, 120, 30 * 24 * 60]) expect(avec(0, minutes)).toEqual(a(minutes));
  });

  it("sur le chemin, au passage de chaque Case, et autour de la destination, à l'arrivée, le rayon s'agrandit", () => {
    for (const [eclaireurs, enPlus] of [
      [1, 1],
      [2, 2],
    ]) {
      expect(avec(eclaireurs, 19)).toEqual(new Set());
      expect(avec(eclaireurs, 20)).toEqual(new Set(autour(CHEMIN[0], BROUILLARD_LEVE_SUR_LE_CHEMIN_CASES + enPlus)));
      const toutLeChemin = CHEMIN.slice(0, -1).flatMap((c) => autour(c, BROUILLARD_LEVE_SUR_LE_CHEMIN_CASES + enPlus));
      expect(avec(eclaireurs, 120)).toEqual(new Set([...toutLeChemin, ...autour(DESTINATION, BROUILLARD_LEVE_AUTOUR_DE_LA_DESTINATION_CASES + enPlus)]));
    }
  });

  it("l'effet grandit avec le nombre d'Éclaireurs, jusqu'au plafond : au-delà, pas une Case de plus", () => {
    const [un, deux, trois, dix] = [1, 2, 3, 10].map((n) => avec(n, 120));
    expect(un.size).toBeGreaterThan(a(120).size);
    expect(deux.size).toBeGreaterThan(un.size);
    for (const c of a(120)) expect(un.has(c)).toBe(true);
    for (const c of un) expect(deux.has(c)).toBe(true);
    expect(trois).toEqual(deux);
    expect(dix).toEqual(deux);
  });

  it("garde le rythme de l'Expédition : rien de plus au départ, rien de neuf pendant le séjour ni au retour", () => {
    expect(avec(2, 0)).toEqual(new Set());
    for (const minutes of [120 + 239, 120 + 240 + 61, 30 * 24 * 60]) expect(avec(2, minutes)).toEqual(avec(2, 120));
  });

  it("rappelée (US-0920) ou en fuite (US-0945, qui s'écrit de même) : les Éclaireurs n'agrandissent que ce qu'elle a déjà passé", () => {
    /** Les Cases d'une Expédition de 2 Éclaireurs rappelée à `rappel` minutes, `minutes` après son départ. */
    const rappelee = (rappel: number, minutes: number) =>
      new Set(casesRevelees(FOYER, DESTINATION, { ...EXPEDITION, rappeleeLe: apres(rappel) }, apres(minutes), 2).map(cle));
    // Rappelée entre la deuxième et la troisième Case de son chemin : ses deux premières Cases, à 3 Cases autour, et rien de plus.
    const auRappel = new Set([...autour(CHEMIN[0], BROUILLARD_LEVE_SUR_LE_CHEMIN_CASES + 2), ...autour(CHEMIN[1], BROUILLARD_LEVE_SUR_LE_CHEMIN_CASES + 2)]);
    expect(rappelee(50, 50)).toEqual(auRappel);
    for (const minutes of [60, 120, 120 + 240, 30 * 24 * 60]) expect(rappelee(50, minutes)).toEqual(auRappel);
    expect(rappelee(50, 30 * 24 * 60).has(cle(DESTINATION))).toBe(false);
    // Rappelée pendant son séjour : tout ce que son aller a levé avec ses Éclaireurs, destination comprise, et rien de plus.
    expect(rappelee(121, 30 * 24 * 60)).toEqual(avec(2, 120));
  });
});
