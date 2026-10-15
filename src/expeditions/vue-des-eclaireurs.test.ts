import { describe, expect, it } from "vitest";
import { MINUTES_DE_VUE_AU_PLUS, MINUTES_DE_VUE_PAR_ECLAIREUR } from "@/reglages";
import { vueProlongee } from "./vue-des-eclaireurs";

const MINUTE_MS = 60_000;

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
