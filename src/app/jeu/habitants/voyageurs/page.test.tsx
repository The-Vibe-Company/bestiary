import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

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
type VoyageurPasse = import("@/monde/voyageurs").VoyageurPasse;
const voyageurs = vi.hoisted(() => ({ voyageursPasses: vi.fn(async (): Promise<VoyageurPasse[]> => []) }));
vi.mock("@/monde/voyageurs", () => voyageurs);
vi.mock("@/temps/rattraper", () => ({ rattraper: vi.fn(async () => new Date()) }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));

import { definirAncre } from "@/temps/horloge";
import Voyageurs, { metadata } from "./page";

/** Cinq Voyageurs passés, du plus récent sort au plus ancien comme la lecture les rend : deux accueillis, un refusé, deux repartis. */
const CINQ: VoyageurPasse[] = [
  { id: 75, prenom: "Maëlle", arriveLe: new Date("2026-10-07T09:00:00Z"), sort: "accueilli", sortLe: new Date("2026-10-07T12:05:00Z") },
  { id: 74, prenom: "Ilda", arriveLe: new Date("2026-10-06T22:30:00Z"), sort: "reparti", sortLe: new Date("2026-10-07T10:30:00Z") },
  { id: 73, prenom: "Joran", arriveLe: new Date("2026-10-06T20:00:00Z"), sort: "refuse", sortLe: new Date("2026-10-06T20:10:00Z") },
  { id: 71, prenom: "Ines", arriveLe: new Date("2026-10-05T23:15:00Z"), sort: "reparti", sortLe: new Date("2026-10-06T11:15:00Z") },
  { id: 70, prenom: "Arno", arriveLe: new Date("2026-10-01T08:00:00Z"), sort: "accueilli", sortLe: new Date("2026-10-01T08:40:00Z") },
];

describe("page Voyageurs, l'historique des Voyageurs (US-0342)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    voyageurs.voyageursPasses.mockReset();
    definirAncre(null);
  });

  const connecte = (passes: VoyageurPasse[] = CINQ) => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    voyageurs.voyageursPasses.mockResolvedValue(passes);
  };
  /** Les morceaux de texte d'un bout de page, tels qu'on les lit (l'apostrophe y est écrite « &#x27; »). */
  const morceaux = (html: string) =>
    html
      .replace(/<[^>]+>/g, "|")
      .split("|")
      .filter(Boolean)
      .map((t) => t.replaceAll("&#x27;", "'"));
  /** Le texte de chaque ligne de Voyageur, ses morceaux (le prénom, l'arrivée, le sort) séparés par « · ». */
  const lignes = (html: string) =>
    [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map(([, ligne]) => [...ligne.matchAll(/<span[^>]*>(.*?)<\/span>/g)].map(([, morceau]) => morceau.replace(/<[^>]+>/g, "")).join(" · "));
  /** Les deux compteurs d'en-tête, chacun son nom et son nombre. */
  const compteurs = (html: string) => [...html.matchAll(/<dt[^>]*>(.*?)<\/dt><dd[^>]*>(.*?)<\/dd>/g)].map(([, nom, nombre]) => [nom, nombre]);

  it("titre la page « Voyageurs », dans l'onglet comme sur la page", async () => {
    connecte();
    expect(metadata.title).toBe("Voyageurs");
    expect(renderToStaticMarkup(await Voyageurs())).toMatch(/<main[^>]*><h1[^>]*>Voyageurs<\/h1>/);
  });

  it("lit les Voyageurs passés du Territoire du joueur, à l'heure du jeu", async () => {
    const jeu = Date.parse("2026-10-07T18:00:00Z");
    definirAncre({ facteur: 100, reel: Date.now(), jeu });
    connecte();
    renderToStaticMarkup(await Voyageurs());
    const [, territoireId, instant] = voyageurs.voyageursPasses.mock.lastCall as unknown as [unknown, number, Date];
    expect(territoireId).toBe(12);
    expect(instant.getTime() - jeu).toBeGreaterThanOrEqual(0);
    expect(instant.getTime() - jeu).toBeLessThan(100 * 5_000);
  });

  it("liste chaque Voyageur passé dans l'ordre de la lecture, du plus récent au plus ancien : son prénom, son heure d'arrivée et son sort", async () => {
    connecte();
    const html = renderToStaticMarkup(await Voyageurs());
    expect(lignes(html)).toEqual([
      "Maëlle · arrivé le 7 octobre 2026 à 11:00 · accueilli",
      "Ilda · arrivé le 7 octobre 2026 à 00:30 · reparti",
      "Joran · arrivé le 6 octobre 2026 à 22:00 · refusé",
      "Ines · arrivé le 6 octobre 2026 à 01:15 · reparti",
      "Arno · arrivé le 1 octobre 2026 à 10:00 · accueilli",
    ]);
    // L'instant exact de l'arrivée, lisible par la machine, à côté de la date écrite pour le joueur, en heure de Paris.
    expect(html).toMatch(/<time[^>]* datetime="2026-10-07T09:00:00.000Z"[^>]*>7 octobre 2026 à 11:00<\/time>/i);
  });

  it("marque le sort de chaque ligne, d'un mot et pas de la couleur seule", async () => {
    connecte();
    const html = renderToStaticMarkup(await Voyageurs());
    const marques = [...html.matchAll(/<li[^>]*data-sort="([^"]+)"[^>]*>.*?<span[^>]*>([^<]+)<\/span><\/li>/g)].map(([, sort, mot]) => [sort, mot]);
    expect(marques).toEqual([
      ["accueilli", "accueilli"],
      ["reparti", "reparti"],
      ["refuse", "refusé"],
      ["reparti", "reparti"],
      ["accueilli", "accueilli"],
    ]);
  });

  it("compte en tête, sur la même période, les Voyageurs accueillis et les Voyageurs perdus, refusés ou repartis", async () => {
    connecte();
    const html = renderToStaticMarkup(await Voyageurs());
    expect(compteurs(html)).toEqual([
      ["Accueillis", "2"],
      ["Perdus", "3"],
    ]);
    // Les compteurs passent avant la liste, dans le même bloc, après la seule peinture (qui ne sert qu'aux yeux).
    expect(html).toMatch(/<section[^>]*>(?:<div[^>]*aria-hidden="true"[^>]*>(?:(?!<\/div>).)*<\/div>)?<dl[^>]*>.*?<\/dl><ul/);
    connecte([CINQ[2]]);
    expect(compteurs(renderToStaticMarkup(await Voyageurs()))).toEqual([
      ["Accueillis", "0"],
      ["Perdus", "1"],
    ]);
  });

  it("sans Voyageur passé, dit « Aucun Voyageur n'est encore passé. » sous les compteurs à zéro, sans liste", async () => {
    connecte([]);
    const html = renderToStaticMarkup(await Voyageurs());
    expect(compteurs(html)).toEqual([
      ["Accueillis", "0"],
      ["Perdus", "0"],
    ]);
    expect(html).toMatch(/<\/dl><p[^>]*>Aucun Voyageur n(&#x27;|')est encore passé\.<\/p><\/section>/);
    expect(html).not.toContain("<ul");
  });

  it("peint dans son panneau la hutte au bout de son chemin, pour les yeux seulement", async () => {
    connecte();
    const html = renderToStaticMarkup(await Voyageurs());
    expect(html).toMatch(/<section[^>]*><div[^>]*aria-hidden="true"[^>]*><img[^>]*alt=""[^>]*connexion\.webp/);
  });

  it("n'ajoute aucune phrase d'explication : le titre, les compteurs, puis les Voyageurs", async () => {
    connecte([CINQ[2]]);
    expect(morceaux(renderToStaticMarkup(await Voyageurs()))).toEqual([
      "Voyageurs",
      ...["Accueillis", "0", "Perdus", "1"],
      ...["Joran", "arrivé le ", "6 octobre 2026 à 22:00", "refusé"],
    ]);
  });

  it("montre d'abord le récit d'arrivée s'il ne l'a pas été (US-0160)", async () => {
    connecte();
    chefs.chefDuCompte.mockResolvedValueOnce({ nom: "Ourse", territoireId: 12, recitLu: false });
    await expect(Voyageurs()).rejects.toMatchObject({ digest: expect.stringContaining(";/jeu/arrivee;") });
  });

  it("renvoie vers la connexion sans session, qui ramènera ensuite ici", async () => {
    cookie.jetonDeSession.mockResolvedValue(undefined);
    await expect(Voyageurs()).rejects.toMatchObject({ digest: expect.stringContaining(";/connexion?suite=%2Fjeu%2Fhabitants%2Fvoyageurs;") });
    expect(voyageurs.voyageursPasses).not.toHaveBeenCalled();
  });

  it("reste introuvable en production tant que l'entrée du jeu est fermée", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(Voyageurs()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    expect(cookie.jetonDeSession).not.toHaveBeenCalled();
  });
});

describe("page Voyageurs sur le kit du jeu, et sur mobile (US-0342)", () => {
  const css = readFileSync(join(process.cwd(), "src/app/jeu/habitants/voyageurs/page.module.css"), "utf8");
  /** Les déclarations d'une règle, dans `texte` (toute la feuille par défaut). */
  const regle = (selecteur: string, texte = css) => texte.match(new RegExp(`(?:^|\\n)\\s*${selecteur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";
  const mobile = css.slice(css.indexOf("@media (max-width: 760px)"));

  it("tient sur une seule colonne, sans défilement de côté : ni largeur fixe, ni colonne qui impose la sienne, ni texte qui refuse d'aller à la ligne", () => {
    for (const [, colonnes] of css.matchAll(/grid-template-columns: ([^;]+);/g)) {
      expect(colonnes.split(/ (?![^(]*\))/).every((c) => c === "auto" || c.startsWith("minmax(0,")), colonnes).toBe(true);
    }
    // Les seuils des tailles d'écran (@media) n'en sont pas.
    expect(css.replace(/@media [^{]*\{/g, "")).not.toMatch(/(?<![\w-])(min-)?width: \d+px/);
    expect(css).not.toContain("nowrap");
    expect(regle(".voyageurs")).toContain("display: grid;");
    expect(regle(".voyageurs")).not.toContain("grid-template-columns");
  });

  it("commence à la marge des autres écrans, sur toute la largeur ; sur ordinateur, tient dans la fenêtre, la peinture et les compteurs à gauche, les Voyageurs à droite", () => {
    expect(regle(".page")).toContain("padding: 16px 18px 28px;");
    expect(regle(".page")).not.toMatch(/max-width|margin: 0 auto/);
    const ordinateur = css.slice(css.indexOf("@media (min-width: 1024px) and (min-height: 600px)"), css.indexOf("@media (max-width: 760px)"));
    expect(regle(".page", ordinateur)).toContain("height: var(--hauteur-utile);");
    expect(regle(".registre", ordinateur)).toMatch(/grid-template-areas:\s*"portes liste"\s*"compteurs liste";/);
    expect(regle(".voyageurs", ordinateur)).toContain("overflow-y: auto;");
  });

  it("met sur ordinateur le prénom, l'arrivée et le sort sur une ligne dense ; sur un téléphone, l'arrivée dessous, sur toute la largeur", () => {
    expect(regle(".voyageur")).toContain('grid-template-areas: "prenom arrivee sort";');
    expect(regle(".voyageur")).toContain("min-height: 40px;");
    expect(regle(".voyageur", mobile)).toMatch(/grid-template-areas:\s*"prenom sort"\s*"arrivee arrivee";/);
    expect(regle(".voyageur", mobile)).toContain("grid-template-columns: minmax(0, 1fr) auto;");
  });

  it("marque chaque sort d'une pastille sobre, toujours avec son mot : accueilli à la feuille, refusé en creux, reparti en braise", () => {
    expect(regle('.voyageur[data-sort="accueilli"] .sort')).toMatch(/border-color: var\(--feuille\);[^}]*color: var\(--feuille\);/);
    expect(regle('.voyageur[data-sort="refuse"] .sort')).toContain("color: var(--mousse);");
    expect(regle('.voyageur[data-sort="reparti"] .sort')).toMatch(/border-color: var\(--braise-filet\);[^}]*color: var\(--braise\);/);
  });

  it("n'écrit aucune couleur en clair, ni aucun des anciens noms : seulement ceux du kit", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|oklch\(/i);
    expect(css).not.toMatch(/var\(--(bloc|bloc-2|bloc-3|encre|menthe|menthe-fonce|rose|rose-fonce|texte-2|texte-discret|arrondi-petit)\)/);
  });
});
