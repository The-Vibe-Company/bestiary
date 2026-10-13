import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExpeditionEnCours } from "@/expeditions/en-cours";

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
// Les Expéditions en cours, lues sur base (src/expeditions/depart.db.test.ts) : ici, ce que la liste en montre.
const enCours = vi.hoisted(() => ({ expeditionsEnCours: vi.fn(async (): Promise<ExpeditionEnCours[]> => []) }));
vi.mock("@/expeditions/en-cours", () => enCours);
const INSTANT = new Date("2026-10-09T07:42:13.250Z");
vi.mock("@/temps/horloge", () => ({ maintenant: () => INSTANT, vitesse: () => 1 }));
vi.mock("@/temps/rattraper", () => ({ rattraper: vi.fn(async () => new Date()) }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));
// US-0916 : la liste se relit au prochain retour (src/app/jeu/expeditions/ListeDesExpeditions.test.tsx) ; ici, rien ne se relit.
vi.mock("next/navigation", async (original) => ({ ...(await original<object>()), useRouter: () => ({ refresh: vi.fn() }) }));

import ExpeditionsEnCours, { metadata } from "./page";

/** Une heure du jeu, `minutes` avant l'affichage de la page. */
const avant = (minutes: number) => new Date(INSTANT.getTime() - minutes * 60_000);

/**
 * Une Expédition partie il y a 18 min vers une forêt à 3 Cases (1 h d'aller, 4 h de séjour), avec deux explorateurs et
 * une escorte ; et une autre, partie il y a 30 min vers une Case encore sous le brouillard, à 1 Case (20 min d'aller,
 * 1 h de séjour), avec un explorateur, sans escorte.
 */
const EXPEDITIONS: ExpeditionEnCours[] = [
  {
    id: 5,
    destination: { q: 3, r: -5, biome: "Forêt", chef: null, aVous: false, zone: 0, distance: 3, anneau: 3 },
    phase: "aller",
    partLe: avant(18),
    trajetMinutes: 60,
    sejourMinutes: 240,
    explorateurs: ["Joran", "Ines"],
    escorte: [{ id: "souris", nom: "Souris grise", nombre: 2 }],
  },
  {
    id: 6,
    destination: { q: 4, r: -5, inconnue: true, distance: 1 },
    phase: "sejour",
    partLe: avant(30),
    trajetMinutes: 20,
    sejourMinutes: 60,
    explorateurs: ["Mael"],
    escorte: [],
  },
];

describe("la liste des Expéditions en cours (US-0911, US-0918)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    enCours.expeditionsEnCours.mockReset();
  });

  const connecte = (expeditions = EXPEDITIONS) => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    enCours.expeditionsEnCours.mockResolvedValue(expeditions);
  };
  /** Le texte du panneau de chaque Expédition de la liste, ses morceaux séparés par « · ». */
  const lignes = (html: string) =>
    [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map(([, ligne]) =>
      ligne
        .replace(/<[^>]+>/g, "|")
        .split("|")
        .map((morceau) => morceau.trim())
        .filter(Boolean)
        .join(" · "),
    );

  it("titre la page « Expéditions en cours », dans l'onglet comme sur la page", async () => {
    connecte();
    expect(metadata.title).toBe("Expéditions en cours");
    expect(renderToStaticMarkup(await ExpeditionsEnCours())).toMatch(/<main[^>]*><div[^>]*><h1[^>]*>Expéditions en cours<\/h1><\/div>/);
  });

  it("montre chaque Expédition en cours du Territoire, à l'heure du jeu : sa destination, sa phase, son temps restant, ses explorateurs et son escorte", async () => {
    connecte();
    const html = renderToStaticMarkup(await ExpeditionsEnCours());
    expect(enCours.expeditionsEnCours).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12, INSTANT);
    expect(lignes(html)).toEqual([
      // Sur son paysage, la destination, sa distance, sa phase et son temps restant ; puis sa frise (« Aller · Séjour ·
      // Retour ») et son détail. 9 h 24 à Paris, plus 1 h d'aller, 4 h de séjour et 1 h de retour ; à l'aller comme en
      // séjour, « Rappeler » (US-0920).
      "Forêt · 3 Cases de votre Foyer · Aller · arrive dans 42 min · Aller · Séjour · Retour · Explorateurs · Joran · Ines · Escorte · Souris grise · ×\u00a02 · Retour prévu · 9 octobre à 15:24 · Rappeler",
      "Case inconnue · 1 Case de votre Foyer · Séjour · repart dans 50 min · Aller · Séjour · Retour · Explorateurs · Mael · Escorte · Sans escorte · Retour prévu · 9 octobre à 10:52 · Rappeler",
    ]);
  });

  it("dit la phase de retour, et le temps qu'il reste avant la rentrée au Foyer", async () => {
    connecte([{ ...EXPEDITIONS[0], partLe: avant(60 + 240 + 30) }]);
    expect(lignes(renderToStaticMarkup(await ExpeditionsEnCours()))[0]).toMatch(/^Forêt · 3 Cases de votre Foyer · Retour · rentre dans 30 min · /);
  });

  it("sans Expédition en cours, le dit, sans liste, avec un bouton pour en préparer une sur l'écran d'Expédition", async () => {
    connecte([]);
    const html = renderToStaticMarkup(await ExpeditionsEnCours());
    expect(html).toContain("Aucune Expédition en cours");
    expect(html).not.toContain("<ul");
    expect(html).toMatch(/<a[^>]*href="\/jeu\/expeditions\/nouvelle"[^>]*>Préparer une Expédition<\/a>/);
  });

  it("renvoie vers la connexion sans session, qui ramènera ensuite ici", async () => {
    cookie.jetonDeSession.mockResolvedValue(undefined);
    await expect(ExpeditionsEnCours()).rejects.toMatchObject({ digest: expect.stringContaining(";/connexion?suite=%2Fjeu%2Fexpeditions;") });
    expect(enCours.expeditionsEnCours).not.toHaveBeenCalled();
  });

  it("reste introuvable en production tant que l'entrée du jeu est fermée", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(ExpeditionsEnCours()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    expect(cookie.jetonDeSession).not.toHaveBeenCalled();
  });
});
