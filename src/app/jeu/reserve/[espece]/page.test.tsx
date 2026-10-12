import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FORMATS_ESPECE } from "@/components/IllustrationEspece";
import type { CoupleEnReserve } from "@/monde/couple";

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
// Le Couple de la Réserve d'une Espèce, lu sur base (page.db.test.tsx) : ici, ce que la fiche en montre.
const couple = vi.hoisted(() => ({ coupleEnReserve: vi.fn(async (): Promise<CoupleEnReserve | null> => null) }));
vi.mock("@/monde/couple", () => couple);
vi.mock("@/temps/rattraper", () => ({ rattraper: vi.fn(async () => new Date()) }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));

import FicheDeLEspece, { metadata } from "./page";

const POULE: CoupleEnReserve = { especeId: "poule", nom: "Poule", illustration: "especes/poule.webp", rarete: { id: "commune", nom: "Commune" } };

/** La fiche de l'Espèce `espece`, telle que la page l'envoie. */
const ouvrir = async (espece: string) => renderToStaticMarkup(await FicheDeLEspece({ params: Promise.resolve({ espece }) }));

describe("ouvrir la fiche d'une Espèce (US-0803)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    couple.coupleEnReserve.mockReset();
  });

  const connecte = (trouve: CoupleEnReserve | null = POULE) => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    couple.coupleEnReserve.mockResolvedValue(trouve);
  };

  it("montre l'illustration de l'Espèce en grand, son nom en titre et sa Rareté", async () => {
    connecte();
    const html = await ouvrir("poule");
    expect(couple.coupleEnReserve).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12, "poule");
    expect(html).toMatch(/<img[^>]*alt="Poule"[^>]*sizes="[^"]*"/);
    expect(html).toContain(`sizes="${FORMATS_ESPECE.grand}"`);
    expect(html).toMatch(/<h1[^>]*>Poule<\/h1>/);
    expect(html).toMatch(/<span[^>]*data-rarete="commune"[^>]*>Commune<\/span>/);
    expect(metadata.title).toBe("Réserve");
  });

  it("se ferme sur la Réserve : « Fermer » y ramène", async () => {
    connecte();
    expect(await ouvrir("poule")).toMatch(/<a[^>]*href="\/jeu\/reserve"[^>]*>Fermer<\/a>/);
  });

  it("n'existe que pour une Espèce dont le joueur a réuni le Couple : sinon, introuvable", async () => {
    connecte(null);
    await expect(ouvrir("pigeon")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it("introuvable pour une adresse qui ne nomme pas une Espèce, sans rien lire", async () => {
    connecte();
    await expect(ouvrir("Poule%20et%20pigeon")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    expect(couple.coupleEnReserve).not.toHaveBeenCalled();
  });

  it("renvoie vers la connexion sans session, qui ramènera ensuite sur la fiche", async () => {
    cookie.jetonDeSession.mockResolvedValue(undefined);
    await expect(ouvrir("poule")).rejects.toMatchObject({ digest: expect.stringContaining(";/connexion?suite=%2Fjeu%2Freserve%2Fpoule;") });
    expect(couple.coupleEnReserve).not.toHaveBeenCalled();
  });

  it("reste introuvable en production tant que l'entrée du jeu est fermée", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(ouvrir("poule")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    expect(cookie.jetonDeSession).not.toHaveBeenCalled();
  });
});
