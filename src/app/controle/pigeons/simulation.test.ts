import { describe, expect, it } from "vitest";
import { casesRevelees } from "@/expeditions/brouillard";
import { retourDUneExpedition, sejourDUneExpedition } from "@/expeditions/phase";
import { vueProlongee } from "@/expeditions/vue-des-eclaireurs";
import { abordsDuFoyer } from "@/monde/brouillard";
import { distance } from "@/monde/hex";
import {
  MINUTES_DE_VUE_AU_PLUS,
  MINUTES_DE_VUE_PAR_ECLAIREUR,
  PORTEE_D_EXPLORATION_CASES,
  PRESENCE_D_UNE_BETE_HEURES,
  SIMULATION_DES_PIGEONS_ECART_MINIMAL_POURCENT,
  SIMULATION_DES_PIGEONS_EXPEDITIONS,
} from "@/reglages";
import { casesDeLExpedition, ECLAIREURS_SIMULES, expeditionSimulee, rencontresVues, simulerLesPigeons } from "./simulation";

const MINUTE_MS = 60_000;
const HEURE_MS = 60 * MINUTE_MS;

describe("la simulation des pigeons éclaireurs (US-0974)", () => {
  it("simule des Expéditions identiques, avec ou sans pigeons : la même destination, les mêmes horaires", () => {
    const a = expeditionSimulee(17);
    expect(expeditionSimulee(17)).toEqual(a);
    expect(a.horaires.sejourMinutes).toBe(4 * 60);
    expect(a.horaires.trajetMinutes).toBeGreaterThan(0);
    // Toujours à portée d'exploration, jamais sur les abords immédiats du Foyer.
    const distances = Array.from({ length: 700 }, (_, i) => distance({ q: 0, r: 0 }, expeditionSimulee(i).destination));
    expect(Math.min(...distances)).toBe(2);
    expect(Math.max(...distances)).toBe(PORTEE_D_EXPLORATION_CASES);
    // D'une Expédition à la suivante, une autre Case, un autre moment : la période est longue.
    const b = expeditionSimulee(18);
    expect(b.destination).not.toEqual(a.destination);
    expect(b.horaires.partLe.getTime()).toBeGreaterThan(a.horaires.partLe.getTime());
  });

  it("compte les Rencontres comme le jeu : chaque Bête que l'Expédition voit pendant son séjour (vueLe), ses Éclaireurs la gardant en vue plus longtemps", () => {
    const { horaires } = expeditionSimulee(0);
    const sejour = sejourDUneExpedition(horaires)!;
    const presente = (arrivee: number) => ({ arrivee: new Date(arrivee), depart: new Date(arrivee + PRESENCE_D_UNE_BETE_HEURES * HEURE_MS) });
    const debut = sejour.debut.getTime();
    // Partie avant l'arrivée de l'Expédition, d'autant d'Éclaireurs (une demie, une et demie, deux et demie).
    const partieAvant = (eclaireurs: number) => presente(debut - PRESENCE_D_UNE_BETE_HEURES * HEURE_MS - eclaireurs * MINUTES_DE_VUE_PAR_ECLAIREUR * MINUTE_MS);
    const betes = [presente(debut - PRESENCE_D_UNE_BETE_HEURES * HEURE_MS + 30 * MINUTE_MS), partieAvant(0.5), partieAvant(1.5), partieAvant(2.5), presente(sejour.fin.getTime() + MINUTE_MS)];
    expect([0, 1, 2, 3].map((e) => rencontresVues(betes, sejour, e))).toEqual([1, 2, 3, 4]);
    // Au-delà de MINUTES_DE_VUE_AU_PLUS, plus rien.
    const auDela = presente(debut - PRESENCE_D_UNE_BETE_HEURES * HEURE_MS - MINUTES_DE_VUE_AU_PLUS * MINUTE_MS - MINUTE_MS);
    expect(rencontresVues([auDela], sejour, 1_000)).toBe(0);
  });

  it("compte les Cases qu'une Expédition sort du brouillard comme le jeu les lui attribue : jamais les abords du Foyer, découverts à sa naissance", () => {
    const { destination, horaires } = expeditionSimulee(3);
    const retour = retourDUneExpedition(horaires)!;
    const abords = new Set(abordsDuFoyer({ q: 0, r: 0 }).map((c) => `${c.q},${c.r}`));
    for (const eclaireurs of [0, 1, 2]) {
      const toutes = casesRevelees({ q: 0, r: 0 }, destination, horaires, retour, eclaireurs);
      expect(casesDeLExpedition(destination, horaires, eclaireurs)).toBe(toutes.filter((c) => !abords.has(`${c.q},${c.r}`)).length);
    }
  });

  it(
    "sur une longue période, celles avec pigeons font mesurablement plus de Rencontres, et révèlent plus de Cases",
    () => {
      const s = simulerLesPigeons();
      expect(s.expeditions).toBe(SIMULATION_DES_PIGEONS_EXPEDITIONS);
      expect(s.ecartMinimal).toBe(SIMULATION_DES_PIGEONS_ECART_MINIMAL_POURCENT);
      expect(s.sans.rencontres).toBeGreaterThan(1000);
      expect(s.lignes.map((l) => l.eclaireurs)).toEqual(ECLAIREURS_SIMULES);
      for (const l of s.lignes) {
        expect(l.rencontres, `${l.eclaireurs} Éclaireurs`).toBeGreaterThan(s.sans.rencontres);
        expect(l.ecart).toBeCloseTo((100 * (l.rencontres - s.sans.rencontres)) / s.sans.rencontres, 10);
        expect(l.ecart).toBeGreaterThanOrEqual(s.ecartMinimal);
        expect(l.casesEnPlus).toBeGreaterThan(0);
        // L'écart attendu : les Bêtes parties pendant la vue en plus, rapportées à celles que l'Expédition voit sans pigeon
        // (présence + séjour). À quatre écarts types près : aucune Bête oubliée, aucune comptée deux fois.
        const attendu = (100 * vueProlongee(l.eclaireurs)) / ((PRESENCE_D_UNE_BETE_HEURES + 4) * HEURE_MS);
        const enPlus = l.rencontres - s.sans.rencontres;
        expect(Math.abs(l.ecart - attendu), `${l.eclaireurs} Éclaireurs : ${l.ecart} au lieu de ${attendu}`).toBeLessThanOrEqual((attendu * 4) / Math.sqrt(enPlus));
      }
      // Plus de pigeons, plus de Rencontres et de Cases, jusqu'aux plafonds.
      for (let i = 1; i < s.lignes.length; i++) {
        expect(s.lignes[i].rencontres).toBeGreaterThanOrEqual(s.lignes[i - 1].rencontres);
        expect(s.lignes[i].casesEnPlus).toBeGreaterThanOrEqual(s.lignes[i - 1].casesEnPlus);
      }
      expect(s.reussie).toBe(true);
    },
    60_000,
  );

  it("échoue, et dit où, quand l'écart reste sous le minimum", () => {
    const s = simulerLesPigeons({ expeditions: 500, ecartMinimal: 1000 });
    expect(s.reussie).toBe(false);
    expect(s.lignes.every((l) => l.sousLEcart)).toBe(true);
  });
});
