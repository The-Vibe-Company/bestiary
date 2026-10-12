import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FORMATS_ESPECE } from "@/components/IllustrationEspece";
import type { EspeceDeLEffectif } from "@/monde/effectif";

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
// L'Espèce de la fiche, avec son effectif, lue sur base (page.db.test.tsx) : ici, ce que la fiche en montre. US-0810 :
// une Espèce dont le joueur a des Bêtes, ou dont il a réuni le Couple.
const effectif = vi.hoisted(() => ({ especeDuTerritoire: vi.fn(async (): Promise<EspeceDeLEffectif | null> => null) }));
vi.mock("@/monde/effectif", () => effectif);
vi.mock("@/temps/rattraper", () => ({ rattraper: vi.fn(async () => new Date()) }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));

import FicheDeLEspece, { metadata } from "./page";

const POULE: EspeceDeLEffectif = { especeId: "poule", nom: "Poule", illustration: "especes/poule.webp", rarete: { id: "commune", nom: "Commune" }, effectif: 12 };

/** La fiche de l'Espèce `espece`, telle que la page l'envoie, ouverte depuis la Réserve ou, US-0810, `depuis` la page Bêtes. */
const ouvrir = async (espece: string, recherche: { depuis?: string } = {}) =>
  renderToStaticMarkup(await FicheDeLEspece({ params: Promise.resolve({ espece }), searchParams: Promise.resolve(recherche) }));

describe("ouvrir la fiche d'une Espèce (US-0803)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    effectif.especeDuTerritoire.mockReset();
  });

  const connecte = (trouve: EspeceDeLEffectif | null = POULE) => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    effectif.especeDuTerritoire.mockResolvedValue(trouve);
  };

  it("montre l'illustration de l'Espèce en grand, son nom en titre et sa Rareté", async () => {
    connecte();
    const html = await ouvrir("poule");
    expect(effectif.especeDuTerritoire).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12, "poule");
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

  it("rappelle l'effectif de l'Espèce, sous son nom et sa Rareté (US-0810)", async () => {
    connecte();
    const html = await ouvrir("poule");
    expect(html).toMatch(/<p[^>]*><span>Effectif<\/span> <strong[^>]*>12<\/strong><\/p>/);
    expect(html.indexOf("Commune")).toBeLessThan(html.indexOf("Effectif"));
    // Une Espèce dont toutes les Bêtes forment le Couple, en Réserve, a un effectif vide : la fiche le dit.
    connecte({ ...POULE, effectif: 0 });
    expect(await ouvrir("poule")).toMatch(/<span>Effectif<\/span> <strong[^>]*>0<\/strong>/);
  });

  it("ouverte depuis la page Bêtes, s'y referme : « Fermer » y ramène (US-0810)", async () => {
    connecte();
    expect(await ouvrir("poule", { depuis: "betes" })).toMatch(/<a[^>]*href="\/jeu\/betes"[^>]*>Fermer<\/a>/);
    expect(await ouvrir("poule", { depuis: "ailleurs" })).toMatch(/<a[^>]*href="\/jeu\/reserve"[^>]*>Fermer<\/a>/);
  });

  it("n'existe que pour une Espèce dont le joueur a réuni le Couple ou, US-0810, a des Bêtes : sinon, introuvable", async () => {
    connecte(null);
    await expect(ouvrir("pigeon")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it("introuvable pour une adresse qui ne nomme pas une Espèce, sans rien lire", async () => {
    connecte();
    await expect(ouvrir("Poule%20et%20pigeon")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    expect(effectif.especeDuTerritoire).not.toHaveBeenCalled();
  });

  it("renvoie vers la connexion sans session, qui ramènera ensuite sur la fiche", async () => {
    cookie.jetonDeSession.mockResolvedValue(undefined);
    await expect(ouvrir("poule")).rejects.toMatchObject({ digest: expect.stringContaining(";/connexion?suite=%2Fjeu%2Freserve%2Fpoule;") });
    expect(effectif.especeDuTerritoire).not.toHaveBeenCalled();
  });

  it("reste introuvable en production tant que l'entrée du jeu est fermée", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(ouvrir("poule")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    expect(cookie.jetonDeSession).not.toHaveBeenCalled();
  });
});
