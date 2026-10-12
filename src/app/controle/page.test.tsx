import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const entetes = vi.hoisted(() => ({ authorization: null as string | null }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(entetes.authorization ? { authorization: entetes.authorization } : {}),
}));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));
vi.mock("@/temps/absents", () => ({
  derniersPassages: async () => [
    { debut: new Date("2026-10-03T09:05:00Z"), rattrapes: 0, echecs: 1, restants: 2, dureeMs: 45000, erreurs: [{ element: "tache", id: null, raison: "base injoignable" }] },
    { debut: new Date("2026-10-03T09:00:00Z"), rattrapes: 3, echecs: 0, restants: 0, dureeMs: 840, erreurs: [] },
  ],
}));

vi.mock("@/donnees/en-base", () => ({
  biomesEnBase: async () => [
    {
      id: "prairie",
      nom: "Prairie",
      variantes: [],
      production: [
        { ressource: "Viande", parHeure: "8.000000" },
        { ressource: "Végétaux", parHeure: "14.500000" },
        { ressource: "Bois", parHeure: "4.000000" },
        { ressource: "Pierre", parHeure: "0.000000" },
      ],
    },
    {
      id: "eau",
      nom: "Eau",
      production: [],
      variantes: [
        { id: "cote", nom: "Côte" },
        { id: "lac", nom: "Lac" },
        { id: "riviere", nom: "Rivière" },
        { id: "mer", nom: "Mer" },
      ],
    },
  ],
  especesEnBase: async () => [
    {
      id: "poule",
      nom: "Poule",
      attaque: 5981,
      vie: 14953,
      vitesse: 14,
      charge: 500,
      taille: 31.623,
      regime: "omnivore",
      entretienParHeure: 5,
      biome: { id: "prairie", nom: "Prairie" },
      rarete: { id: "commune", nom: "Commune" },
      role: { id: "nourricier", nom: "Nourricier" },
      masseG: 2000,
      facteurArme: 0.4,
      illustration: "especes/poule.webp",
      source: "Gallus gallus domesticus",
    },
    {
      id: "essai",
      nom: "Bête d'essai",
      attaque: 473,
      vie: 473,
      vitesse: 2,
      charge: 5,
      taille: 1,
      regime: "herbivore",
      entretienParHeure: 0.167,
      biome: { id: "prairie", nom: "Prairie" },
      rarete: { id: "peu_commune", nom: "Peu commune" },
      role: null,
      masseG: null,
      facteurArme: null,
      illustration: null,
      source: null,
    },
  ],
  raretesEnBase: async () => [
    { id: "commune", nom: "Commune", rang: 1, selevent: true },
    { id: "mythique", nom: "Mythique", rang: 6, selevent: false },
  ],
  rolesEnBase: async () => [{ id: "eclaireur", nom: "Éclaireur", phrase: "Voit loin." }],
}));

const monde = vi.hoisted(() => ({ couronneEnBase: vi.fn(), territoiresSuivis: vi.fn(async (): Promise<{ nombre: number; plusAncien: Date | null }> => ({ nombre: 0, plusAncien: null })) }));
vi.mock("@/monde/en-base", () => monde);
const COURONNE = {
  monde: "Aube",
  cases: [
    { q: 0, r: -2, biome: "prairie", chef: null, foyer: false },
    { q: 1, r: -2, biome: "prairie", chef: null, foyer: false },
    { q: 2, r: -2, biome: "prairie", chef: null, foyer: false },
    { q: 2, r: -1, biome: "eau", chef: null, foyer: false },
  ],
};

const chefs = vi.hoisted(() => ({ chefParNom: vi.fn(async (): Promise<{ nom: string; territoireId: number | null } | null> => null) }));
vi.mock("@/chefs/chef", () => chefs);
const stocks = vi.hoisted(() => ({
  stocksDuTerritoire: vi.fn(async () => [
    { id: "viande", nom: "Viande", famille: "nourriture", quantite: "100.000000", limite: "1000.000000", parHeure: "8.000000" },
    { id: "bois", nom: "Bois", famille: "materiaux", quantite: "1234.400000", limite: "1000.000000", parHeure: "4.000000" },
  ]),
}));
vi.mock("@/monde/stocks", () => stocks);
const temps = vi.hoisted(() => ({ rattraper: vi.fn(async () => new Date()) }));
vi.mock("@/temps/rattraper", () => temps);
vi.mock("./actions", () => ({ fixerUnStock: vi.fn(), sauter: vi.fn() }));

import Controle from "./page";

const ouvrir = (recherche: Record<string, string> = {}) =>
  Controle({ params: Promise.resolve({}), searchParams: Promise.resolve(recherche) } as PageProps<"/controle">);

const MOT_DE_PASSE = "mot-de-passe-d-essai";

describe("page de contrôle", () => {
  beforeEach(() => {
    vi.stubEnv("CONTROLE_MOT_DE_PASSE", MOT_DE_PASSE);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    entetes.authorization = null;
  });

  it("répond « page introuvable » sans le mot de passe, même si le proxy était contourné", async () => {
    await expect(ouvrir()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it("montre l'heure du jeu, la vitesse du temps et les derniers passages de la tâche", async () => {
    entetes.authorization = `Basic ${Buffer.from(`dev:${MOT_DE_PASSE}`).toString("base64")}`;
    const html = renderToStaticMarkup(await ouvrir());
    expect(html).toContain("Heure du jeu");
    expect(html).toContain("×1");
    expect(html).toContain("Vitesse normale.");
    expect(html).toContain("1 échec : base injoignable");
    expect(html).toContain("Réussi");
    expect(html).toContain("0,8 s");
    expect(html.indexOf("1 échec")).toBeLessThan(html.indexOf("Réussi"));
  });

  it("liste les Biomes en base, avec leur nom, leur identifiant et les quatre formes de l'eau", async () => {
    entetes.authorization = `Basic ${Buffer.from(`dev:${MOT_DE_PASSE}`).toString("base64")}`;
    const html = renderToStaticMarkup(await ouvrir());
    expect(html).toContain("Biomes en base · 2");
    expect(html).toMatch(/Prairie<\/span> <code[^>]*>prairie<\/code>/);
    expect(html).toContain('aria-label="Les 4 formes : Eau"');
    for (const forme of ["Côte", "Lac", "Rivière", "Mer"]) expect(html).toContain(`<li>${forme} <code`);
  });

  it("montre chaque Espèce avec sa vignette, sa Rareté, son Rôle et toutes ses caractéristiques", async () => {
    entetes.authorization = `Basic ${Buffer.from(`dev:${MOT_DE_PASSE}`).toString("base64")}`;
    const html = renderToStaticMarkup(await ouvrir());
    expect(html).toContain("Espèces en base · 2");
    expect(html).toMatch(/srcSet="\/_next\/image\?url=%2Fillustrations%2Fespeces%2Fpoule\.webp/);
    expect(html).toContain('sizes="96px"');
    expect(html).toContain('data-rarete="commune"');
    expect(html).toContain("Nourricier");
    for (const valeur of ["5 981", "14 953", "14 km/h", "31,623", "5 / h", "omnivore", "2 000 g", "0,4", "Gallus gallus domesticus"]) {
      expect(html.replaceAll("\u202f", " ")).toContain(valeur);
    }
  });

  it("signale en couleur chaque champ vide, et met la tête de loup à la place d'une illustration absente", async () => {
    entetes.authorization = `Basic ${Buffer.from(`dev:${MOT_DE_PASSE}`).toString("base64")}`;
    const html = renderToStaticMarkup(await ouvrir());
    const essai = html.slice(html.indexOf("Bête d&#x27;essai"));
    // L'illustration, la masse, l'arme et la source : quatre champs vides.
    expect(essai.match(/class="[^"]*vide[^"]*"( title="[^"]*")?>vide</g)).toHaveLength(4);
    expect(essai).toContain('title="Pas d&#x27;illustration en base"');
    expect(html).toContain('aria-label="Bête d&#x27;essai"');
    expect(html).toContain('data-rarete="peu_commune"');
    expect(essai).toContain("Aucun Rôle");
  });

  it("liste aussi les Raretés et les Rôles en base", async () => {
    entetes.authorization = `Basic ${Buffer.from(`dev:${MOT_DE_PASSE}`).toString("base64")}`;
    const html = renderToStaticMarkup(await ouvrir());
    expect(html).toContain("Raretés en base · 2");
    expect(html).toContain("rang 6 · ne s&#x27;élèvent pas");
    expect(html).toContain("Rôles en base · 1");
    expect(html).toContain("Voit loin.");
  });

  it("mène à la simulation des Raretés par Anneau (US-0931)", async () => {
    entetes.authorization = `Basic ${Buffer.from(`controle:${MOT_DE_PASSE}`).toString("base64")}`;
    expect(renderToStaticMarkup(await ouvrir())).toContain('<a href="/controle/raretes">Simulation par Anneau</a>');
  });

  it("mène à la simulation des chances des Rencontres disputées (US-0968)", async () => {
    entetes.authorization = `Basic ${Buffer.from(`controle:${MOT_DE_PASSE}`).toString("base64")}`;
    expect(renderToStaticMarkup(await ouvrir())).toContain('<a href="/controle/chances">Simulation des chances</a>');
  });

  it("montre la Couronne vue d'en haut, une forme par Biome, et la part de chacun (US-0151)", async () => {
    entetes.authorization = `Basic ${Buffer.from(`controle:${MOT_DE_PASSE}`).toString("base64")}`;
    monde.couronneEnBase.mockResolvedValue(COURONNE);
    const html = renderToStaticMarkup(await ouvrir());
    expect(html).toContain("Couronne de Aube · 4 Cases");
    expect(html).toMatch(/<svg[^>]*aria-label="La Couronne de Aube, 4 Cases"/);
    expect(html.match(/<path data-biome="([a-z]+)"/g)).toEqual(['<path data-biome="prairie"', '<path data-biome="eau"']);
    expect(html).toContain("fill:var(--biome-prairie)");
    expect(html).toMatch(/Prairie<span[^>]*>3 · 75 %<\/span>/);
    expect(html).toMatch(/Eau<span[^>]*>1 · 25 %<\/span>/);
  });

  it("marque d'un point chaque emplacement où un Foyer pourrait naître, et les compte (US-0152)", async () => {
    entetes.authorization = `Basic ${Buffer.from(`controle:${MOT_DE_PASSE}`).toString("base64")}`;
    monde.couronneEnBase.mockResolvedValue(COURONNE);
    const html = renderToStaticMarkup(await ouvrir());
    // Trois prairies voisines : une seule peut accueillir un Foyer, les autres sont trop près.
    expect(html.match(/<circle /g)).toHaveLength(1);
    expect(html).toMatch(/Emplacements de Foyer<span[^>]*>1<\/span>/);
    // Une seule place : sous le seuil d'alerte, le nombre passe en couleur de danger (US-0159).
    expect(html).toMatch(/Emplacements de Foyer<span class="[^"]*alerte[^"]*">1<\/span>/);
  });

  it("mène au contrôle du Monde entier (US-0412)", async () => {
    entetes.authorization = `Basic ${Buffer.from(`controle:${MOT_DE_PASSE}`).toString("base64")}`;
    monde.couronneEnBase.mockResolvedValue(COURONNE);
    expect(renderToStaticMarkup(await ouvrir())).toContain('<a href="/controle/monde">Le Monde entier</a>');
  });

  it("dit comment préparer la Couronne quand elle n'est pas encore en base", async () => {
    entetes.authorization = `Basic ${Buffer.from(`controle:${MOT_DE_PASSE}`).toString("base64")}`;
    monde.couronneEnBase.mockResolvedValue({ monde: "Aube", cases: [] });
    expect(renderToStaticMarkup(await ouvrir())).toContain("lancez npm run monde:couronne");
  });

  it("cercle chaque Case possédée, avec le nom de son chef au survol, et en tient compte pour les emplacements (US-0153)", async () => {
    entetes.authorization = `Basic ${Buffer.from(`controle:${MOT_DE_PASSE}`).toString("base64")}`;
    monde.couronneEnBase.mockResolvedValue({ ...COURONNE, cases: COURONNE.cases.map((c, i) => (i === 0 ? { ...c, chef: "Ourse", foyer: true } : c)) });
    const html = renderToStaticMarkup(await ouvrir());
    expect(html).toMatch(/<path d="[^"]+"><title>Ourse<\/title><\/path>/);
    expect(html).toMatch(/Cases possédées<span[^>]*>1<\/span>/);
    expect(html).toMatch(/Foyers<span[^>]*>1<\/span>/);
    expect(html).toMatch(/<path class="[^"]*foyers[^"]*" d="M[^"]+Z"/);
    expect(html).toMatch(/Emplacements de Foyer<span[^>]*>0<\/span>/);
  });

  it("compte les Territoires suivis par le temps, et dit le retard du plus en retard (US-0156)", async () => {
    entetes.authorization = `Basic ${Buffer.from(`controle:${MOT_DE_PASSE}`).toString("base64")}`;
    monde.territoiresSuivis.mockResolvedValueOnce({ nombre: 2, plusAncien: new Date(Date.now() - 3 * 60_000) });
    const html = renderToStaticMarkup(await ouvrir());
    expect(html).toContain("Territoires suivis par le temps");
    expect(html).toMatch(/Le plus en retard a été calculé il y a 3 min\./);
  });

  it("dit qu'il n'y a encore aucun Territoire", async () => {
    entetes.authorization = `Basic ${Buffer.from(`controle:${MOT_DE_PASSE}`).toString("base64")}`;
    expect(renderToStaticMarkup(await ouvrir())).toContain("Aucun Territoire pour l&#x27;instant.");
  });

  describe("stocks d'un joueur (US-0208)", () => {
    const connecte = () => {
      entetes.authorization = `Basic ${Buffer.from(`dev:${MOT_DE_PASSE}`).toString("base64")}`;
    };

    it("montre ses Stocks exacts, après la mise à l'heure de son Territoire, avec de quoi les fixer", async () => {
      connecte();
      chefs.chefParNom.mockResolvedValueOnce({ nom: "Ourse Brune", territoireId: 12 });
      temps.rattraper.mockClear();
      const html = renderToStaticMarkup(await ouvrir({ chef: "ourse brune" }));
      expect(chefs.chefParNom).toHaveBeenCalledWith(expect.anything(), "ourse brune");
      expect(temps.rattraper).toHaveBeenCalledWith("territoire", 12);
      expect(html).toContain("Ourse Brune · Territoire 12");
      expect(html).toMatch(/<td>Viande<\/td><td>100<\/td>/);
      expect(html).toMatch(/<td>Bois<\/td><td>1\u00a0234,4<\/td>/);
      expect(html.match(/>Fixer<\/button>/g)).toHaveLength(2);
    });

    it("les montre sans pouvoir les fixer en production", async () => {
      connecte();
      vi.stubEnv("VERCEL_ENV", "production");
      chefs.chefParNom.mockResolvedValueOnce({ nom: "Ourse Brune", territoireId: 12 });
      const html = renderToStaticMarkup(await ouvrir({ chef: "Ourse Brune" }));
      expect(html).toMatch(/<td>Bois<\/td><td>1\u00a0234,4<\/td>/);
      expect(html).not.toContain("Fixer");
    });

    it("dit quand personne ne porte ce nom, ou quand le chef n'a pas encore de Territoire", async () => {
      connecte();
      chefs.chefParNom.mockResolvedValueOnce(null);
      expect(renderToStaticMarkup(await ouvrir({ chef: "Personne" }))).toContain("Aucun chef de ce nom.");
      chefs.chefParNom.mockResolvedValueOnce({ nom: "Lynx", territoireId: null });
      expect(renderToStaticMarkup(await ouvrir({ chef: "Lynx" }))).toContain("Lynx n&#x27;a pas encore de Territoire.");
    });

    it("ne cherche personne sans nom", async () => {
      connecte();
      chefs.chefParNom.mockClear();
      const html = renderToStaticMarkup(await ouvrir());
      expect(chefs.chefParNom).not.toHaveBeenCalled();
      expect(html).toMatch(/<input[^>]*name="chef"/);
    });
  });

  it("montre ce que chaque Biome produit par heure (US-0209)", async () => {
    entetes.authorization = `Basic ${Buffer.from(`dev:${MOT_DE_PASSE}`).toString("base64")}`;
    const html = renderToStaticMarkup(await ouvrir());
    expect(html).toContain("8 Viande · 14,5 Végétaux · 4 Bois · 0 Pierre par heure");
  });

  it("propose de sauter d'une heure, d'un jour ou d'une semaine, sauf en production (US-0038)", async () => {
    entetes.authorization = `Basic ${Buffer.from(`dev:${MOT_DE_PASSE}`).toString("base64")}`;
    const boutons = (html: string) => [...html.matchAll(/<button(?=[^>]*name="saut")[^>]*value="([a-z]+)"[^>]*>([^<]+)<\/button>/g)].map((m) => [m[1], m[2]]);
    expect(boutons(renderToStaticMarkup(await ouvrir()))).toEqual([
      ["heure", "+1 heure"],
      ["jour", "+1 jour"],
      ["semaine", "+1 semaine"],
    ]);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(boutons(renderToStaticMarkup(await ouvrir()))).toEqual([]);
  });
});

