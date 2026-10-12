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
type Recit = { id: number; titre: string; texte: string; survenuLe: Date; luLe: Date | null };
const recits = vi.hoisted(() => ({ recitsDuTerritoire: vi.fn(async (): Promise<Recit[]> => []), marquerUnRecitLu: vi.fn() }));
vi.mock("@/monde/recits", () => recits);
vi.mock("@/temps/rattraper", () => ({ rattraper: vi.fn(async () => new Date()) }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));

import Recits, { metadata } from "./page";

/** Trois Récits, du plus récent au plus ancien comme la lecture les rend ; le deuxième déjà lu. */
const TROIS_RECITS: Recit[] = [
  { id: 43, titre: "Famine", texte: "Deux Habitants sont partis.", survenuLe: new Date("2026-10-07T12:05:00Z"), luLe: null },
  { id: 41, titre: "Retour de Récolte", texte: "Du Bois.", survenuLe: new Date("2026-10-06T22:30:00Z"), luLe: new Date("2026-10-07T08:00:00Z") },
  { id: 42, titre: "Incursion", texte: "Des loups, repoussés.", survenuLe: new Date("2026-03-01T09:00:00Z"), luLe: null },
];

describe("page Récits (US-0324)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    recits.recitsDuTerritoire.mockReset();
  });

  const connecte = (lesRecits: Recit[] = TROIS_RECITS) => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    recits.recitsDuTerritoire.mockResolvedValue(lesRecits);
  };
  /** Le texte de chaque ligne de Récit, ses morceaux séparés par « · ». */
  const lignes = (html: string) =>
    [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map(([, ligne]) => ligne.replace(/<[^>]+>/g, "|").split("|").filter(Boolean).join(" · "));

  it("titre la page « Récits », dans l'onglet comme sur la page", async () => {
    connecte();
    expect(metadata.title).toBe("Récits");
    expect(renderToStaticMarkup(await Recits())).toMatch(/<main[^>]*><h1[^>]*>Récits<\/h1>/);
  });

  it("sans aucun Récit, dit « Rien à raconter pour l'instant. », dans un bloc Bento, sans liste", async () => {
    connecte([]);
    const html = renderToStaticMarkup(await Recits());
    expect(html).toMatch(/<section[^>]*><p[^>]*>Rien à raconter pour l(&#x27;|')instant\.<\/p><\/section>/);
    expect(html).not.toContain("<ul");
  });

  it("liste les Récits du Territoire du joueur dans l'ordre de la lecture, chacun avec son titre, sa date et son heure", async () => {
    connecte();
    const html = renderToStaticMarkup(await Recits());
    expect(recits.recitsDuTerritoire).toHaveBeenCalledWith(expect.anything(), 12);
    expect(lignes(html)).toEqual([
      "Famine · nouveau · 7 octobre 2026 à 14:05 · Deux Habitants sont partis.",
      "Retour de Récolte · 7 octobre 2026 à 00:30 · Du Bois.",
      "Incursion · nouveau · 1 mars 2026 à 10:00 · Des loups, repoussés.",
    ]);
    // L'instant exact, lisible par la machine, à côté de la date écrite pour le joueur.
    expect(html).toMatch(/<time[^>]* datetime="2026-10-07T12:05:00.000Z"[^>]*>7 octobre 2026 à 14:05<\/time>/i);
  });

  it("marque les Récits non lus, et eux seuls, d'un mot et pas de la couleur seule", async () => {
    connecte();
    const html = renderToStaticMarkup(await Recits());
    const marques = [...html.matchAll(/<li([^>]*)>.*?<\/li>/g)].map(([ligne, attributs]) => [/data-non-lu/.test(attributs), ligne.includes(">nouveau<")]);
    expect(marques).toEqual([
      [true, true],
      [false, false],
      [true, true],
    ]);
  });

  it("garde le texte de chaque Récit replié, à déplier d'un toucher sur sa ligne", async () => {
    connecte();
    const html = renderToStaticMarkup(await Recits());
    const lignesRepliees = [...html.matchAll(/<button[^>]*aria-expanded="false"[^>]*aria-controls="([^"]+)"[^>]*>.*?<\/button><p id="([^"]+)"[^>]*hidden=""/g)];
    expect(lignesRepliees).toHaveLength(3);
    for (const [, controle, id] of lignesRepliees) expect(controle).toBe(id);
  });

  it("n'ajoute aucune phrase d'explication : le titre, puis les Récits", async () => {
    connecte([TROIS_RECITS[1]]);
    const html = renderToStaticMarkup(await Recits());
    expect(html.replace(/<[^>]+>/g, "|").split("|").filter(Boolean)).toEqual(["Récits", "Retour de Récolte", "7 octobre 2026 à 00:30", "Du Bois."]);
  });

  it("joint au retour d'une Expédition ses Rencontres, chacune à son heure dans le fuseau du joueur, repliées avec son texte (US-0940)", async () => {
    connecte([
      {
        id: 51,
        titre: "Retour d'Expédition",
        texte: "Une Bête s'est montrée.",
        survenuLe: new Date("2026-10-09T16:05:00Z"),
        luLe: null,
        rencontres: [
          {
            especeId: "souris_grise",
            vueLe: new Date("2026-10-09T12:05:00Z"),
            issue: "apprivoisee",
            sexe: "femelle",
            nouvelleEspece: true,
            nom: "Souris grise",
            illustration: "especes/souris.webp",
            rarete: { id: "commune", nom: "Commune" },
          },
        ],
      } as Recit,
      TROIS_RECITS[1],
    ]);
    const html = renderToStaticMarkup(await Recits());
    const liste = html.match(/<ol [^>]*aria-label="Rencontres"[^>]*>.*?<\/ol>/)?.[0] ?? "";
    expect(liste).toMatch(/^<ol [^>]*hidden=""/);
    expect(liste).toMatch(/<time[^>]* datetime="2026-10-09T12:05:00.000Z"[^>]*>14:05<\/time>/i);
    expect(liste.replace(/<[^>]+>/g, "|").split("|").filter(Boolean)).toEqual(["14:05", "Souris grise", "Commune", "Apprivoisée, femelle", "Nouvelle Espèce au Bestiaire"]);
    expect(liste).toContain('alt="Souris grise"');
    // Un seul retour a des Rencontres : les autres Récits restent du texte.
    expect(html.match(/aria-label="Rencontres"/g)).toHaveLength(1);
  });

  it("dit aussi le jour d'une Rencontre quand il n'est plus celui de la précédente, ou du retour pour la première (US-0940)", async () => {
    const rencontre = (vueLe: string) => ({
      especeId: "goupil",
      vueLe: new Date(vueLe),
      issue: "restee" as const,
      sexe: null,
      nouvelleEspece: false,
      manque: 37_340,
      nom: "Renard roux",
      illustration: null,
      rarete: { id: "peu_commune", nom: "Peu commune" },
    });
    connecte([
      {
        id: 52,
        titre: "Retour d'Expédition",
        texte: "3 Bêtes se sont montrées.",
        survenuLe: new Date("2026-10-12T21:00:00Z"),
        luLe: null,
        rencontres: [rencontre("2026-10-11T19:00:00Z"), rencontre("2026-10-12T12:04:00Z"), rencontre("2026-10-12T18:46:00Z")],
      } as Recit,
    ]);
    const html = renderToStaticMarkup(await Recits());
    expect([...html.matchAll(/<time[^>]*>([^<]*)<\/time>/g)].map(([, heure]) => heure)).toEqual([
      "12 octobre 2026 à 23:00",
      "11 octobre à 21:00",
      "12 octobre à 14:04",
      "20:46",
    ]);
    // Restée sur sa Case, la force qui manquait à l'escorte (US-0942).
    expect(html).toContain("Trop forte, restée sur sa Case : il manquait 37 340 de force");
  });

  it("dit l'heure où une Bête est repartie de sa Case, dans le fuseau du joueur, et son jour s'il a changé depuis la Rencontre (US-0950)", async () => {
    const repartie = (vueLe: string, repartieLe?: string) => ({
      especeId: "pigeon",
      vueLe: new Date(vueLe),
      issue: "repartie" as const,
      ...(repartieLe && { repartieLe: new Date(repartieLe) }),
      sexe: null,
      nouvelleEspece: false,
      nom: "Pigeon biset",
      illustration: null,
      rarete: { id: "commune", nom: "Commune" },
    });
    connecte([
      {
        id: 53,
        titre: "Retour d'Expédition",
        texte: "3 Bêtes se sont montrées.",
        survenuLe: new Date("2026-10-13T06:00:00Z"),
        luLe: null,
        // Un Récit d'avant cette story ne retient pas l'heure du départ.
        rencontres: [repartie("2026-10-12T13:15:00Z", "2026-10-12T15:15:00Z"), repartie("2026-10-12T20:00:00Z", "2026-10-12T23:10:00Z"), repartie("2026-10-12T21:00:00Z")],
      } as Recit,
    ]);
    const html = renderToStaticMarkup(await Recits());
    const issues = [...html.matchAll(/<p[^>]*data-issue="repartie"[^>]*>(.*?)<\/p>/g)].map(([, issue]) => issue);
    expect(issues.map((issue) => issue.replace(/<[^>]+>/g, ""))).toEqual([
      "Repartie à 17:15, à la fin de sa durée",
      "Repartie le 13 octobre à 01:10, à la fin de sa durée",
      "Repartie à la fin de sa durée",
    ]);
    expect(issues[0]).toMatch(/<time[^>]* datetime="2026-10-12T15:15:00.000Z"[^>]*>17:15<\/time>/i);
  });

  it("résume un retour d'Expédition en une ligne en tête de son récit : Bêtes ramenées, nouvelles Espèces au Bestiaire (US-0941)", async () => {
    const rencontre = (issue: "apprivoisee" | "restee" | "repartie", nouvelleEspece: boolean) => ({
      especeId: "souris_grise",
      vueLe: new Date("2026-10-09T12:05:00Z"),
      issue,
      sexe: issue === "apprivoisee" ? ("male" as const) : null,
      nouvelleEspece,
      nom: "Souris grise",
      illustration: null,
      rarete: { id: "commune", nom: "Commune" },
    });
    const retour = (id: number, rencontres?: ReturnType<typeof rencontre>[]) =>
      ({ id, titre: "Retour d'Expédition", texte: "…", survenuLe: new Date("2026-10-09T16:05:00Z"), luLe: null, ...(rencontres && { rencontres }) }) as Recit;
    connecte([
      retour(61, [rencontre("apprivoisee", true), rencontre("restee", true), rencontre("apprivoisee", false), rencontre("repartie", false)]),
      retour(62, [rencontre("restee", true)]),
      retour(63),
      TROIS_RECITS[1],
    ]);
    const html = renderToStaticMarkup(await Recits());
    const entetes = [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(([, entete]) => entete);
    const morceaux = (entete: string) => entete.replace(/&#x27;/g, "'").replace(/<[^>]+>/g, "|").split("|").filter(Boolean);
    // Le titre et la date, puis le résumé.
    expect(entetes.map((entete) => morceaux(entete.split("</time>")[0]))).toEqual([
      ...Array(3).fill(["Retour d'Expédition", "nouveau", "9 octobre 2026 à 18:05"]),
      ["Retour de Récolte", "7 octobre 2026 à 00:30"],
    ]);
    expect(entetes.map((entete) => morceaux(entete.split("</time>")[1]).join(""))).toEqual([
      "2 Bêtes ramenées · 2 nouvelles Espèces au Bestiaire",
      "Aucune Bête ramenée · 1 nouvelle Espèce au Bestiaire",
      "Aucune Bête ramenée",
      // Les autres Récits n'ont pas de résumé : leur titre et leur date.
      "",
    ]);
  });

  it("annonce en tête du retour qui l'a réuni le Couple de l'Espèce, avec son illustration, sans le déplier (US-0958)", async () => {
    connecte([
      {
        id: 71,
        titre: "Retour d'Expédition",
        texte: "Aucune Bête ne s'est montrée.",
        survenuLe: new Date("2026-10-09T16:05:00Z"),
        luLe: null,
        couples: [{ especeId: "souris", nom: "Souris grise", illustration: "especes/souris.webp" }],
      } as Recit,
      { id: 72, titre: "Retour d'Expédition", texte: "Aucune Bête ne s'est montrée.", survenuLe: new Date("2026-10-08T16:05:00Z"), luLe: null },
      TROIS_RECITS[1],
    ]);
    const html = renderToStaticMarkup(await Recits());
    const [avec, ...sans] = [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map(([, ligne]) => ligne);
    // Sous la ligne du récit, son titre, sa date et son résumé, avant son texte replié.
    const annonce = avec.match(/<\/button>(.*?)<p id="[^"]+"[^>]*hidden=""/)?.[1] ?? "";
    expect(annonce).toMatch(/^<div[^>]*><figure[^>]*>.*<\/figure><\/div>$/);
    expect(annonce).not.toContain("hidden");
    expect(annonce).toContain('alt="Souris grise"');
    expect(annonce).toContain("url=%2Fillustrations%2Fespeces%2Fsouris.webp");
    // Servie à la taille qu'elle affiche, et non à celle de la fiche de l'Espèce.
    expect(annonce).toContain('sizes="(max-width: 540px) and (orientation: portrait) 100vw, 220px"');
    expect(annonce.replace(/<[^>]+>/g, "|").split("|").filter((morceau) => morceau.trim())).toEqual(["Couple réuni", "Souris grise"]);
    // Les retours qui n'ont réuni aucun Couple, et les autres Récits, n'annoncent rien.
    for (const ligne of sans) expect(ligne).not.toContain("<figure");
  });

  it("montre d'abord le récit d'arrivée s'il ne l'a pas été (US-0160)", async () => {
    connecte();
    chefs.chefDuCompte.mockResolvedValueOnce({ nom: "Ourse", territoireId: 12, recitLu: false });
    await expect(Recits()).rejects.toMatchObject({ digest: expect.stringContaining(";/jeu/arrivee;") });
  });

  it("renvoie vers la connexion sans session, qui ramènera ensuite ici", async () => {
    cookie.jetonDeSession.mockResolvedValue(undefined);
    await expect(Recits()).rejects.toMatchObject({ digest: expect.stringContaining(";/connexion?suite=%2Fjeu%2Frecits;") });
    expect(recits.recitsDuTerritoire).not.toHaveBeenCalled();
  });

  it("reste introuvable en production tant que l'entrée du jeu est fermée", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(Recits()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    expect(cookie.jetonDeSession).not.toHaveBeenCalled();
  });
});
