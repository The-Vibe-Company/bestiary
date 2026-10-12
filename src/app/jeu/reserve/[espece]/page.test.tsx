import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FORMATS_ESPECE } from "@/components/IllustrationEspece";
import type { FicheDEspece } from "@/monde/effectif";

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
const effectif = vi.hoisted(() => ({ especeDuTerritoire: vi.fn(async (): Promise<FicheDEspece | null> => null) }));
vi.mock("@/monde/effectif", () => effectif);
// US-0812 : l'Élevage de l'Espèce, acquis ou non, lu sur base (page.db.test.tsx).
const elevage = vi.hoisted(() => ({ elevageAcquis: vi.fn(async () => false) }));
vi.mock("@/monde/elevage", async (original) => ({ ...(await original<object>()), elevageAcquis: elevage.elevageAcquis }));
// US-0822 : les Places de l'Habitat du Foyer, lues sur base (src/monde/habitat.db.test.ts).
const habitat = vi.hoisted(() => ({ placesDeLHabitat: vi.fn(async () => ({ occupees: 21, total: 500 })) }));
vi.mock("@/monde/habitat", () => habitat);
vi.mock("@/temps/rattraper", () => ({ rattraper: vi.fn(async () => new Date()) }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));

import FicheDeLEspece, { metadata } from "./page";

/** La fiche de la poule, son effectif, et les caractéristiques que donne pour elle la base (donnees/especes.yaml, par le barème). */
const POULE: FicheDEspece = {
  especeId: "poule",
  nom: "Poule",
  illustration: "especes/poule.webp",
  rarete: { id: "commune", nom: "Commune" },
  effectif: 12,
  attaque: 5981,
  vie: 14953,
  vitesse: 14,
  charge: 500,
};

/** US-0804 : les caractéristiques de la fiche, nom et valeur, les espaces des milliers lues comme des espaces. */
const caracteristiques = (html: string) =>
  [...(html.match(/<dl[^>]*>(.*?)<\/dl>/)?.[1] ?? "").matchAll(/<dt[^>]*>(.*?)<\/dt><dd[^>]*>(.*?)<\/dd>/g)].map(([, nom, valeur]) => [
    nom,
    valeur.replace(/<[^>]+>/g, "").replace(/[\u00a0\u202f]/g, " "),
  ]);

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

  const connecte = (trouve: FicheDEspece | null = POULE) => {
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

  it("propose sous la fiche le bloc « Élever » quand le joueur a réuni le Couple de l'Espèce (US-0812)", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValueOnce(true);
    const html = await ouvrir("poule");
    expect(elevage.elevageAcquis).toHaveBeenLastCalledWith(expect.anything(), 12, "poule");
    expect(html).toMatch(/<div id="elever"[^>]*><section[^>]*><h2[^>]*>Élever<\/h2>/);
    expect(html.indexOf("Fermer")).toBeLessThan(html.indexOf('id="elever"'));
    // US-0822 : avec les Places de l'Habitat du Foyer, comme la page Bêtes.
    expect(habitat.placesDeLHabitat).toHaveBeenLastCalledWith(expect.anything(), 12);
    expect(html.slice(html.indexOf('id="elever"')).replace(/<[^>]+>/g, "")).toContain("Places : 21 / 500");
  });

  it("ne le propose pas pour une Espèce sans Couple, même avec des Bêtes (US-0812)", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValueOnce(false);
    const html = await ouvrir("poule");
    expect(html).not.toContain('id="elever"');
    expect(html).not.toContain(">Élever<");
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

describe("lire l'attaque, la vie, la vitesse et la charge (US-0804)", () => {
  afterEach(() => {
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    effectif.especeDuTerritoire.mockReset();
  });

  const connecte = (fiche: FicheDEspece) => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    effectif.especeDuTerritoire.mockResolvedValue(fiche);
  };

  it("affiche l'attaque, la vie, la vitesse et la charge de l'Espèce, avec ses valeurs enregistrées, sans phrase", async () => {
    connecte(POULE);
    expect(caracteristiques(await ouvrir("poule"))).toEqual([
      ["Attaque", "5 981"],
      ["Vie", "14 953"],
      ["Vitesse", "14 km/h"],
      ["Charge", "500"],
    ]);
  });

  it("écrit une valeur décimale à la française : « 87,5 »", async () => {
    connecte({ ...POULE, especeId: "pigeon", nom: "Pigeon biset", attaque: 1214, vie: 4046, vitesse: 80, charge: 87.5 });
    expect(caracteristiques(await ouvrir("pigeon"))).toEqual([
      ["Attaque", "1 214"],
      ["Vie", "4 046"],
      ["Vitesse", "80 km/h"],
      ["Charge", "87,5"],
    ]);
  });

  it("sépare les milliers, et la valeur de son unité, d'une espace insécable : rien ne se coupe ni ne disparaît", async () => {
    connecte(POULE);
    const html = await ouvrir("poule");
    expect(html).toContain("<dd>5\u00a0981</dd>");
    expect(html).toContain("<dd>14\u00a0953</dd>");
    expect(html).toContain("<dd>14\u00a0km/h</dd>");
  });
});
