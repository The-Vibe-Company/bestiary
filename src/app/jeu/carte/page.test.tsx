import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BeteReperee } from "@/expeditions/betes-reperees";
import type { ExpeditionEnCours } from "@/expeditions/en-cours";
import type { CarteDuJoueur } from "@/monde/carte";

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
const lecture = vi.hoisted(() => ({ carteDuJoueur: vi.fn(async (): Promise<CarteDuJoueur | null> => null) }));
vi.mock("@/monde/carte", () => lecture);
// US-0432 : les Biomes en base, dans leur ordre, l'eau avec ses variantes.
const donnees = vi.hoisted(() => ({
  biomesEnBase: vi.fn(async () => [
    { id: "prairie", nom: "Prairie", variantes: [], production: [{ ressource: "Viande", parHeure: "8" }] },
    { id: "foret", nom: "Forêt", variantes: [], production: [] },
    {
      id: "eau",
      nom: "Eau",
      variantes: [
        { id: "cote", nom: "Côte" },
        { id: "lac", nom: "Lac" },
      ],
      production: [],
    },
  ]),
}));
vi.mock("@/donnees/en-base", () => donnees);
// US-0913 : les Expéditions en cours du Territoire, et l'heure du jeu, à × 3 en développement.
const enCours = vi.hoisted(() => ({ expeditionsEnCours: vi.fn(async (): Promise<ExpeditionEnCours[]> => []) }));
vi.mock("@/expeditions/en-cours", () => enCours);
// US-0948 : les Bêtes repérées du Territoire.
const reperees = vi.hoisted(() => ({ betesReperees: vi.fn(async (): Promise<BeteReperee[]> => []) }));
vi.mock("@/expeditions/betes-reperees", () => reperees);
const MAINTENANT = vi.hoisted(() => new Date("2026-10-09T07:42:13.250Z"));
vi.mock("@/temps/horloge", async (original) => ({ ...(await original<object>()), maintenant: () => MAINTENANT, vitesse: () => 3 }));
vi.mock("@/temps/rattraper", () => ({ rattraper: vi.fn(async () => new Date()) }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));
// La carte elle-même se vérifie à part (CarteDuJeu.test.tsx) : ici, ce que la page lui donne.
vi.mock("./CarteDuJeu", () => ({ CarteDuJeu: (proprietes: object) => <canvas data-proprietes={JSON.stringify(proprietes)} /> }));
// La légende aussi (Legende.test.tsx), et l'attente (Attente.test.tsx).
vi.mock("./Legende", () => ({ Legende: (proprietes: object) => <aside data-legende={JSON.stringify(proprietes)} /> }));
vi.mock("./Attente", () => ({ Attente: () => <div data-attente="" /> }));

import Carte, { metadata } from "./page";

/** La carte d'un joueur d'Aube, réduite à trois Cases de la Couronne, son Foyer au milieu entre une forêt et un lac. */
const CARTE: CarteDuJoueur = {
  monde: "Aube",
  foyer: { q: 31, r: -57 },
  foyers: [{ q: 35, r: -58 }],
  teintes: ["foret", "prairie", "lac"],
  cases: { q: [30, 31, 32], r: [-57, -57, -57], teinte: [0, 1, 2], zone: [1, 1, 1] },
};
/** Ce que la page donne à la carte. */
const proprietes = (html: string) => JSON.parse(html.match(/data-proprietes="([^"]*)"/)![1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
/** La page ouverte avec `recherche` dans son adresse (« ?choix=destination » : { choix: "destination" }). */
const ouverte = (recherche: Record<string, string | string[]> = {}) => ({ params: Promise.resolve({}), searchParams: Promise.resolve(recherche) }) as PageProps<"/jeu/carte">;

describe("page Carte (US-0417)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    lecture.carteDuJoueur.mockReset();
  });

  const connecte = (carte: CarteDuJoueur | null = CARTE) => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    lecture.carteDuJoueur.mockResolvedValue(carte);
  };

  it("titre l'onglet « Carte », et le dit aux lecteurs d'écran sans phrase de plus : la carte et sa légende suffisent", async () => {
    connecte();
    expect(metadata.title).toBe("Carte");
    const html = renderToStaticMarkup(await Carte(ouverte()));
    expect(html).toMatch(/^<main[^>]*><h1[^>]*>Carte<\/h1><canvas[^>]*><\/canvas><div data-attente=""><\/div><aside[^>]*><\/aside><\/main>$/);
  });

  it("attend la carte dans un bloc Bento, posé avec elle et caché dès qu'elle est dessinée (US-0434)", async () => {
    connecte();
    // L'attente vient avec la page : aucune frontière de chargement ne retarde la carte (Attente.test.tsx).
    expect(renderToStaticMarkup(await Carte(ouverte()))).toContain("<canvas data-proprietes=");
    expect(renderToStaticMarkup(await Carte(ouverte()))).toMatch(/<\/canvas><div data-attente=""><\/div>/);
    expect(existsSync(join(process.cwd(), "src/app/jeu/carte/loading.tsx"))).toBe(false);
  });

  it("pose la légende de la carte : les Biomes de terre puis les eaux, dans leur ordre, de leur nom en base (US-0432)", async () => {
    connecte();
    const html = renderToStaticMarkup(await Carte(ouverte()));
    const legende = JSON.parse(html.match(/data-legende="([^"]*)"/)![1].replace(/&quot;/g, '"'));
    expect(legende).toEqual({
      terre: [
        { teinte: "prairie", nom: "Prairie" },
        { teinte: "foret", nom: "Forêt" },
      ],
      eaux: [
        { teinte: "cote", nom: "Côte" },
        { teinte: "lac", nom: "Lac" },
      ],
    });
  });

  it("dessine la carte du Monde du joueur, lue pour son Territoire", async () => {
    connecte();
    const html = renderToStaticMarkup(await Carte(ouverte()));
    expect(lecture.carteDuJoueur).toHaveBeenCalledWith(expect.anything(), 12);
    expect(proprietes(html).carte).toEqual(CARTE);
  });

  it("peint chaque teinte de la couleur de la page de contrôle du Monde (US-0418)", async () => {
    connecte();
    expect(proprietes(renderToStaticMarkup(await Carte(ouverte()))).fonds).toEqual(["var(--biome-foret)", "var(--biome-prairie)", "var(--sarcelle-fonce)"]);
  });

  it("n'a pas de carte à montrer sans Foyer, ni de légende, ni rien à attendre", async () => {
    connecte(null);
    expect(renderToStaticMarkup(await Carte(ouverte()))).not.toMatch(/<canvas|<aside|data-attente/);
  });

  it("donne à la carte les Expéditions en cours du joueur, lues pour son Territoire à l'heure du jeu, avec cette heure et le rythme du jeu (US-0913)", async () => {
    connecte();
    const expedition: ExpeditionEnCours = {
      id: 5,
      destination: { q: 33, r: -57, inconnue: true, distance: 2 },
      phase: "aller",
      partLe: new Date("2026-10-09T07:30:00.000Z"),
      trajetMinutes: 40,
      sejourMinutes: 60,
      explorateurs: ["Joran"],
      escorte: [],
    };
    enCours.expeditionsEnCours.mockClear().mockResolvedValueOnce([expedition]);
    const { expeditions, maintenant, vitesse } = proprietes(renderToStaticMarkup(await Carte(ouverte())));
    expect(enCours.expeditionsEnCours).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12, MAINTENANT);
    expect(expeditions).toEqual([{ ...expedition, partLe: expedition.partLe.toISOString() }]);
    expect([maintenant, vitesse]).toEqual([MAINTENANT.toISOString(), 3]);
  });

  it("donne à la carte les Bêtes repérées du joueur, lues pour son Territoire à l'heure du jeu (US-0948)", async () => {
    connecte();
    const bete: BeteReperee = {
      id: 41,
      laCase: { q: 34, r: -57 },
      especeId: "renard_roux",
      espece: "Renard roux",
      force: 37_340,
      jusquA: new Date("2026-10-09T11:42:13.250Z"),
    };
    reperees.betesReperees.mockClear().mockResolvedValueOnce([bete]);
    const { betes } = proprietes(renderToStaticMarkup(await Carte(ouverte())));
    expect(reperees.betesReperees).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12, MAINTENANT);
    expect(betes).toEqual([{ ...bete, jusquA: bete.jusquA.toISOString() }]);
  });

  it("prend toute la place sous la barre du haut, sans défiler", () => {
    const css = readFileSync(join(process.cwd(), "src/app/jeu/carte/page.module.css"), "utf8");
    expect(css).toMatch(/\.page \{[^}]*height: var\(--hauteur-utile\);[^}]*overflow: hidden;/);
    expect(css).toMatch(/\.carte \{[^}]*display: block;[^}]*width: 100%;[^}]*height: 100%;/);
  });

  it("montre d'abord le récit d'arrivée s'il ne l'a pas été (US-0160)", async () => {
    connecte();
    chefs.chefDuCompte.mockResolvedValueOnce({ nom: "Ourse", territoireId: 12, recitLu: false });
    await expect(Carte(ouverte())).rejects.toMatchObject({ digest: expect.stringContaining(";/jeu/arrivee;") });
  });

  it("renvoie vers la connexion sans session, qui ramènera ensuite ici", async () => {
    cookie.jetonDeSession.mockResolvedValue(undefined);
    await expect(Carte(ouverte())).rejects.toMatchObject({ digest: expect.stringContaining(";/connexion?suite=%2Fjeu%2Fcarte;") });
    expect(lecture.carteDuJoueur).not.toHaveBeenCalled();
  });

  it("reste introuvable en production tant que l'entrée du jeu est fermée", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(Carte(ouverte())).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    expect(cookie.jetonDeSession).not.toHaveBeenCalled();
  });
});

describe("la carte ouverte pour choisir la destination d'une Expédition (US-0907)", () => {
  afterEach(() => {
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    lecture.carteDuJoueur.mockReset();
  });

  const connecte = () => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    lecture.carteDuJoueur.mockResolvedValue(CARTE);
  };

  it("le dit à la carte, avec son adresse, où l'écran d'Expédition retrouvera ses autres choix", async () => {
    connecte();
    expect(proprietes(renderToStaticMarkup(await Carte(ouverte({ choix: "destination" })))).destination).toBe("choix=destination");
    expect(proprietes(renderToStaticMarkup(await Carte(ouverte({ choix: "destination", sejour: "60" })))).destination).toBe("choix=destination&sejour=60");
  });

  it("ouverte depuis la navigation, ou pour un autre choix, ne choisit pas de destination", async () => {
    connecte();
    expect(proprietes(renderToStaticMarkup(await Carte(ouverte()))).destination).toBeNull();
    expect(proprietes(renderToStaticMarkup(await Carte(ouverte({ choix: "autre" })))).destination).toBeNull();
  });

  it("renvoie vers la connexion sans session, qui ramènera ensuite au même choix", async () => {
    cookie.jetonDeSession.mockResolvedValue(undefined);
    await expect(Carte(ouverte({ choix: "destination", sejour: "60" }))).rejects.toMatchObject({
      digest: expect.stringContaining(`;/connexion?suite=${encodeURIComponent("/jeu/carte?choix=destination&sejour=60")};`),
    });
  });
});
