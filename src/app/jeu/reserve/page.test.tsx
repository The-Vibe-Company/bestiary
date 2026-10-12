import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CoupleReuni } from "@/monde/couple";

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
// Les Couples réunis du Territoire, lus sur base (src/monde/couple.db.test.ts) : ici, ce que la Réserve en dit.
const couple = vi.hoisted(() => ({ couplesDuTerritoire: vi.fn(async (): Promise<CoupleReuni[]> => []) }));
vi.mock("@/monde/couple", () => couple);
vi.mock("@/temps/rattraper", () => ({ rattraper: vi.fn(async () => new Date()) }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));

import Reserve, { metadata } from "./page";

/** Les Couples réunis d'un Territoire : la souris, la poule, puis le pigeon. */
const COUPLES: CoupleReuni[] = ["souris", "poule", "pigeon"].map((especeId, i) => ({ especeId, reuniLe: new Date(Date.UTC(2026, 9, 10, 8 + i)) }));

/** Le texte de la page, ses morceaux séparés par « · » ; l'apostrophe telle qu'on la lit. */
const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, "|")
    .replace(/&#x27;/g, "'")
    .split("|")
    .map((morceau) => morceau.trim())
    .filter(Boolean)
    .join(" · ");

describe("ouvrir la Réserve (US-0801)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    couple.couplesDuTerritoire.mockReset();
  });

  const connecte = (couples: CoupleReuni[] = COUPLES) => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    couple.couplesDuTerritoire.mockResolvedValue(couples);
  };

  it("titre la page « Réserve », dans l'onglet comme sur la page", async () => {
    connecte();
    expect(metadata.title).toBe("Réserve");
    expect(renderToStaticMarkup(await Reserve())).toMatch(/<main[^>]*><h1[^>]*>Réserve<\/h1>/);
  });

  it("la présente comme le lieu protégé où vivent les Couples, à l'abri, qui ne combattent plus", async () => {
    connecte();
    expect(texte(renderToStaticMarkup(await Reserve()))).toContain("Le lieu protégé de votre Territoire : vos Couples y vivent à l'abri, loin des combats.");
  });

  it("affiche le nombre de Couples qu'elle abrite : ceux que le Territoire a réunis", async () => {
    connecte();
    const html = renderToStaticMarkup(await Reserve());
    expect(couple.couplesDuTerritoire).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12);
    expect(texte(html)).toMatch(/ · 3 · Couples$/);
  });

  it("accorde le nom au nombre : « 1 Couple », « 0 Couple »", async () => {
    connecte(COUPLES.slice(0, 1));
    expect(texte(renderToStaticMarkup(await Reserve()))).toMatch(/ · 1 · Couple$/);
    connecte([]);
    expect(texte(renderToStaticMarkup(await Reserve()))).toMatch(/ · 0 · Couple$/);
  });

  it("renvoie vers la connexion sans session, qui ramènera ensuite ici", async () => {
    cookie.jetonDeSession.mockResolvedValue(undefined);
    await expect(Reserve()).rejects.toMatchObject({ digest: expect.stringContaining(";/connexion?suite=%2Fjeu%2Freserve;") });
    expect(couple.couplesDuTerritoire).not.toHaveBeenCalled();
  });

  it("reste introuvable en production tant que l'entrée du jeu est fermée", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(Reserve()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    expect(cookie.jetonDeSession).not.toHaveBeenCalled();
  });
});
