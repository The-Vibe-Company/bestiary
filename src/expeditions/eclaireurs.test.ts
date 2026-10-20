import { describe, expect, it } from "vitest";
import { BROUILLARD_LEVE_PAR_ECLAIREUR_CASES, BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES, MINUTES_DE_VUE_AU_PLUS, MINUTES_DE_VUE_PAR_ECLAIREUR } from "@/reglages";
import { rayonDesEclaireurs, vueProlongee } from "./eclaireurs";

const MINUTE_MS = 60_000;

describe("le brouillard levé plus loin par les Éclaireurs (US-0969)", () => {
  it(`chaque Éclaireur agrandit le rayon de ${BROUILLARD_LEVE_PAR_ECLAIREUR_CASES} Case, jusqu'à ${BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES} Cases de plus ; rien sans Éclaireur`, () => {
    expect([-1, 0, 1].map(rayonDesEclaireurs)).toEqual([0, 0, BROUILLARD_LEVE_PAR_ECLAIREUR_CASES]);
    const auPlus = Math.ceil(BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES / BROUILLARD_LEVE_PAR_ECLAIREUR_CASES);
    expect([auPlus, auPlus + 1, 100].map(rayonDesEclaireurs)).toEqual([BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES, BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES, BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES]);
  });
});

describe("la vue prolongée des Éclaireurs (US-0970)", () => {
  it("MINUTES_DE_VUE_PAR_ECLAIREUR de plus par Éclaireur, aucune sans Éclaireur", () => {
    expect(vueProlongee(0)).toBe(0);
    expect(vueProlongee(-1)).toBe(0);
    expect(vueProlongee(1)).toBe(MINUTES_DE_VUE_PAR_ECLAIREUR * MINUTE_MS);
    expect(vueProlongee(3)).toBe(3 * MINUTES_DE_VUE_PAR_ECLAIREUR * MINUTE_MS);
  });

  it("jamais plus de MINUTES_DE_VUE_AU_PLUS, si nombreux soient-ils : atteint, puis tenu", () => {
    const auPlus = Math.floor(MINUTES_DE_VUE_AU_PLUS / MINUTES_DE_VUE_PAR_ECLAIREUR);
    expect(vueProlongee(auPlus)).toBe(auPlus * MINUTES_DE_VUE_PAR_ECLAIREUR * MINUTE_MS);
    expect(vueProlongee(auPlus + 1)).toBe(MINUTES_DE_VUE_AU_PLUS * MINUTE_MS);
    expect(vueProlongee(100)).toBe(MINUTES_DE_VUE_AU_PLUS * MINUTE_MS);
  });
});
