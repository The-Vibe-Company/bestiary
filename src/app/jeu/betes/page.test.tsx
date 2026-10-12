import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
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
// L'effectif du Territoire, lu sur base (src/monde/effectif.db.test.ts, page.db.test.tsx) : ici, ce que la page en montre.
const effectif = vi.hoisted(() => ({ effectifParEspece: vi.fn(async (): Promise<EspeceDeLEffectif[]> => []) }));
vi.mock("@/monde/effectif", () => effectif);
vi.mock("@/temps/rattraper", () => ({ rattraper: vi.fn(async () => new Date()) }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));

import Betes, { metadata } from "./page";

/** L'effectif d'un Territoire, de la plus commune à la plus rare : 12 souris, une poule et 3 pigeons. */
const EFFECTIF: EspeceDeLEffectif[] = [
  { especeId: "poule", nom: "Poule", illustration: "especes/poule.webp", rarete: { id: "commune", nom: "Commune" }, effectif: 1 },
  { especeId: "souris", nom: "Souris grise", illustration: "especes/souris.webp", rarete: { id: "commune", nom: "Commune" }, effectif: 12 },
  { especeId: "pigeon", nom: "Pigeon biset", illustration: null, rarete: { id: "peu_commune", nom: "Peu commune" }, effectif: 3 },
];

/** Le texte d'un morceau de page, ses morceaux séparés par « · ». */
const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, "|")
    .replace(/&#x27;/g, "'")
    .split("|")
    .map((morceau) => morceau.trim())
    .filter(Boolean)
    .join(" · ");

/** Chaque Espèce de la liste : où elle mène, son nom pour un lecteur d'écran, son illustration et son texte. */
const especesMontrees = (html: string) =>
  [...(html.match(/<ul[^>]*aria-label="Effectif"[^>]*>(.*?)<\/ul>/)?.[1] ?? "").matchAll(/<li[^>]*>(.*?)<\/li>/g)].map(([, li]) => ({
    lien: li.match(/<a [^>]*href="([^"]*)"/)?.[1].replace(/&amp;/g, "&"),
    nom: li.match(/<a [^>]*aria-label="([^"]*)"/)?.[1],
    illustration: li.match(/<img[^>]*alt="([^"]*)"|role="img" aria-label="([^"]*)"/)?.slice(1).find(Boolean),
    texte: texte(li),
  }));

describe("voir l'effectif par Espèce (US-0810)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    effectif.effectifParEspece.mockReset();
  });

  const connecte = (especes: EspeceDeLEffectif[] = EFFECTIF) => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    effectif.effectifParEspece.mockResolvedValue(especes);
  };

  it("titre la page « Bêtes », dans l'onglet comme sur la page", async () => {
    connecte();
    expect(metadata.title).toBe("Bêtes");
    expect(renderToStaticMarkup(await Betes())).toMatch(/<main[^>]*><h1[^>]*>Bêtes<\/h1>/);
  });

  it("liste chaque Espèce dont le joueur a des Bêtes, avec son illustration, son nom, sa Rareté et son effectif", async () => {
    connecte();
    const html = renderToStaticMarkup(await Betes());
    expect(effectif.effectifParEspece).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12);
    expect(especesMontrees(html).map(({ illustration, texte }) => ({ illustration, texte }))).toEqual([
      { illustration: "Poule", texte: "Poule · Commune · 1" },
      { illustration: "Souris grise", texte: "Souris grise · Commune · 12" },
      // Sans illustration, la tête de loup la remplace, sous le nom de l'Espèce.
      { illustration: "Pigeon biset", texte: "Pigeon biset · Peu commune · 3" },
    ]);
    // Un lecteur d'écran lit chaque Espèce d'une traite, son effectif accordé.
    expect(especesMontrees(html).map((e) => e.nom)).toEqual(["Poule, Commune, 1 Bête", "Souris grise, Commune, 12 Bêtes", "Pigeon biset, Peu commune, 3 Bêtes"]);
  });

  it("affiche en haut de la page le total des Bêtes, avant la liste", async () => {
    connecte();
    const html = renderToStaticMarkup(await Betes());
    expect(texte(html).startsWith("Bêtes · 16 · Bêtes · Poule")).toBe(true);
    connecte(EFFECTIF.slice(0, 1));
    expect(texte(renderToStaticMarkup(await Betes())).startsWith("Bêtes · 1 · Bête · Poule")).toBe(true);
  });

  it("ouvre d'un toucher la fiche de chaque Espèce, qui se refermera sur la page Bêtes", async () => {
    connecte();
    expect(especesMontrees(renderToStaticMarkup(await Betes())).map((e) => e.lien)).toEqual([
      "/jeu/reserve/poule?depuis=betes",
      "/jeu/reserve/souris?depuis=betes",
      "/jeu/reserve/pigeon?depuis=betes",
    ]);
  });

  it("n'ajoute aucune phrase d'explication : le titre, le total, puis les Espèces", async () => {
    connecte(EFFECTIF.slice(1, 2));
    expect(texte(renderToStaticMarkup(await Betes()))).toBe("Bêtes · 12 · Bêtes · Souris grise · Commune · 12");
  });

  it("renvoie vers la connexion sans session, qui ramènera ensuite ici", async () => {
    cookie.jetonDeSession.mockResolvedValue(undefined);
    await expect(Betes()).rejects.toMatchObject({ digest: expect.stringContaining(";/connexion?suite=%2Fjeu%2Fbetes;") });
    expect(effectif.effectifParEspece).not.toHaveBeenCalled();
  });

  it("montre d'abord le récit d'arrivée s'il ne l'a pas été (US-0160)", async () => {
    connecte();
    chefs.chefDuCompte.mockResolvedValueOnce({ nom: "Ourse", territoireId: 12, recitLu: false });
    await expect(Betes()).rejects.toMatchObject({ digest: expect.stringContaining(";/jeu/arrivee;") });
  });

  it("reste introuvable en production tant que l'entrée du jeu est fermée", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(Betes()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    expect(cookie.jetonDeSession).not.toHaveBeenCalled();
  });
});

describe("voir un effectif vide (US-0811)", () => {
  afterEach(() => {
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    effectif.effectifParEspece.mockReset();
  });

  const connecte = (especes: EspeceDeLEffectif[]) => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    effectif.effectifParEspece.mockResolvedValue(especes);
  };

  it("sans aucune Bête, affiche « Aucune Bête pour l'instant », sans autre phrase", async () => {
    connecte([]);
    // Le titre, le message et le bouton : rien d'autre, ni « 0 Bête », ni liste.
    const html = renderToStaticMarkup(await Betes());
    expect(texte(html)).toBe("Bêtes · Aucune Bête pour l'instant · Envoyer une Expédition");
    expect(html).not.toContain("<ul");
  });

  it("met un bouton « Envoyer une Expédition », qui mène à l'écran d'Expédition (US-0901)", async () => {
    connecte([]);
    expect(renderToStaticMarkup(await Betes())).toMatch(/<a[^>]*href="\/jeu\/expeditions\/nouvelle"[^>]*>Envoyer une Expédition<\/a>/);
  });

  it("dès la première Bête ramenée, le message et son bouton laissent place au total et à la liste", async () => {
    connecte(EFFECTIF.slice(0, 1));
    const html = renderToStaticMarkup(await Betes());
    expect(texte(html)).toBe("Bêtes · 1 · Bête · Poule · Commune · 1");
    expect(html).not.toContain("Envoyer une Expédition");
  });
});
