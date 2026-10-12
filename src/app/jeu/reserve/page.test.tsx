import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
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
// Les Couples de la Réserve du Territoire, lus sur base (page.db.test.tsx) : ici, ce que la page en montre.
const couple = vi.hoisted(() => ({ couplesEnReserve: vi.fn(async (): Promise<CoupleEnReserve[]> => []) }));
vi.mock("@/monde/couple", () => couple);
vi.mock("@/temps/rattraper", () => ({ rattraper: vi.fn(async () => new Date()) }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));

import Reserve, { metadata } from "./page";

/** Les Couples de la Réserve d'un Territoire, du premier réuni au dernier : la souris, la poule, puis le pigeon. */
const COUPLES: CoupleEnReserve[] = [
  { especeId: "souris", nom: "Souris grise", illustration: "especes/souris.webp", rarete: { id: "commune", nom: "Commune" } },
  { especeId: "poule", nom: "Poule", illustration: "especes/poule.webp", rarete: { id: "commune", nom: "Commune" } },
  { especeId: "pigeon", nom: "Pigeon biset", illustration: null, rarete: { id: "peu_commune", nom: "Peu commune" } },
];

/** Le texte de la page, ses morceaux séparés par « · » ; l'apostrophe telle qu'on la lit. */
const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, "|")
    .replace(/&#x27;/g, "'")
    .split("|")
    .map((morceau) => morceau.trim())
    .filter(Boolean)
    .join(" · ");

/** Le nombre de Couples que la page dit abriter, et son nom : « 3 Couples ». */
const nombre = (html: string) => texte(html).match(/ · (\d+ · Couples?)( · |$)/)?.[1].replace(" · ", " ");

/**
 * US-0802 : chaque Couple de la liste : le nom donné à chacune de ses deux illustrations (une image, ou la tête de loup),
 * sans celui de la paire, puis son texte.
 */
const couplesMontres = (html: string) =>
  [...(html.match(/<ul[^>]*>(.*?)<\/ul>/)?.[1] ?? "").matchAll(/<li[^>]*>(.*?)<\/li>/g)].map(([, li]) => ({
    betes: [...li.matchAll(/<img[^>]*alt="([^"]*)"|role="img" aria-label="([^"]*)"/g)].map((m) => m[1] ?? m[2]).filter((nom) => !nom.endsWith(", deux Bêtes")),
    texte: texte(li),
  }));

describe("ouvrir la Réserve (US-0801)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    couple.couplesEnReserve.mockReset();
  });

  const connecte = (couples: CoupleEnReserve[] = COUPLES) => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    couple.couplesEnReserve.mockResolvedValue(couples);
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
    expect(couple.couplesEnReserve).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12);
    expect(nombre(html)).toBe("3 Couples");
  });

  it("accorde le nom au nombre : « 1 Couple », « 2 Couples »", async () => {
    connecte(COUPLES.slice(0, 1));
    expect(nombre(renderToStaticMarkup(await Reserve()))).toBe("1 Couple");
    connecte(COUPLES.slice(0, 2));
    expect(nombre(renderToStaticMarkup(await Reserve()))).toBe("2 Couples");
  });

  it("renvoie vers la connexion sans session, qui ramènera ensuite ici", async () => {
    cookie.jetonDeSession.mockResolvedValue(undefined);
    await expect(Reserve()).rejects.toMatchObject({ digest: expect.stringContaining(";/connexion?suite=%2Fjeu%2Freserve;") });
    expect(couple.couplesEnReserve).not.toHaveBeenCalled();
  });

  it("reste introuvable en production tant que l'entrée du jeu est fermée", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(Reserve()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    expect(cookie.jetonDeSession).not.toHaveBeenCalled();
  });
});

describe("voir ses Couples réunis (US-0802)", () => {
  afterEach(() => {
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    couple.couplesEnReserve.mockReset();
  });

  const connecte = (couples: CoupleEnReserve[] = COUPLES) => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    couple.couplesEnReserve.mockResolvedValue(couples);
  };

  it("montre chaque Couple réuni, du premier au dernier, avec l'illustration de son Espèce, son nom et sa Rareté", async () => {
    connecte();
    expect(couplesMontres(renderToStaticMarkup(await Reserve())).map((c) => c.texte)).toEqual([
      "Souris grise · Commune",
      "Poule · Commune",
      // Sans illustration, la tête de loup la remplace, sous le nom de l'Espèce.
      "Pigeon biset · Peu commune",
    ]);
  });

  it("montre les deux Bêtes de chaque Couple, chacune sous le nom de son Espèce, sans les étiqueter mâle et femelle", async () => {
    connecte();
    const html = renderToStaticMarkup(await Reserve());
    expect(couplesMontres(html).map((c) => c.betes)).toEqual([
      ["Souris grise", "Souris grise"],
      ["Poule", "Poule"],
      ["Pigeon biset", "Pigeon biset"],
    ]);
    expect(texte(html)).not.toMatch(/mâle|femelle/i);
    // Un lecteur d'écran lit la paire d'un seul nom, sans le répéter pour chaque Bête.
    expect([...html.matchAll(/<div[^>]*role="img" aria-label="([^"]*, deux Bêtes)"/g)].map((m) => m[1])).toEqual([
      "Souris grise, deux Bêtes",
      "Poule, deux Bêtes",
      "Pigeon biset, deux Bêtes",
    ]);
  });

  it("ne montre que la Réserve du joueur connecté : celle de son Territoire, que rien dans l'adresse ne change", async () => {
    connecte();
    await Reserve();
    expect(couple.couplesEnReserve).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12);
    // La page ne prend ni paramètre ni recherche : aucun moyen d'y demander un autre Territoire.
    expect(Reserve.length).toBe(0);
  });

  it("fait de chaque Couple un lien vers la fiche de son Espèce (US-0803), nommé de l'Espèce et de sa Rareté", async () => {
    connecte();
    const html = renderToStaticMarkup(await Reserve());
    const liens = [...html.matchAll(/<a ([^>]*)>/g)].map(([, a]) => [a.match(/href="([^"]*)"/)?.[1], a.match(/aria-label="([^"]*)"/)?.[1]]);
    expect(liens.filter(([href]) => href?.startsWith("/jeu/reserve/"))).toEqual([
      ["/jeu/reserve/souris", "Souris grise, Commune"],
      ["/jeu/reserve/poule", "Poule, Commune"],
      ["/jeu/reserve/pigeon", "Pigeon biset, Peu commune"],
    ]);
  });

  it("sans Couple, n'a pas de liste", async () => {
    connecte([]);
    expect(renderToStaticMarkup(await Reserve())).not.toContain("<ul");
  });
});

describe("voir une Réserve vide (US-0809)", () => {
  afterEach(() => {
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    couple.couplesEnReserve.mockReset();
  });

  const connecte = (couples: CoupleEnReserve[]) => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    couple.couplesEnReserve.mockResolvedValue(couples);
  };

  it("sans Couple, affiche « Aucun Couple pour l'instant », sans autre phrase", async () => {
    connecte([]);
    // Le titre, le message et le bouton : rien d'autre, ni la présentation de la Réserve, ni « 0 Couple ».
    expect(texte(renderToStaticMarkup(await Reserve()))).toBe("Réserve · Aucun Couple pour l'instant · Envoyer une Expédition");
  });

  it("met un bouton « Envoyer une Expédition », qui mène à l'écran d'Expédition (US-0901)", async () => {
    connecte([]);
    expect(renderToStaticMarkup(await Reserve())).toMatch(/<a[^>]*href="\/jeu\/expeditions\/nouvelle"[^>]*>Envoyer une Expédition<\/a>/);
  });

  it("dès le premier Couple réuni, le message et son bouton laissent place à la liste", async () => {
    connecte(COUPLES.slice(0, 1));
    const html = renderToStaticMarkup(await Reserve());
    expect(html).not.toContain("Aucun Couple pour l&#x27;instant");
    expect(html).not.toContain("Envoyer une Expédition");
    expect(texte(html)).toBe("Réserve · Le lieu protégé de votre Territoire : vos Couples y vivent à l'abri, loin des combats. · 1 · Couple · Souris grise · Commune");
  });
});
