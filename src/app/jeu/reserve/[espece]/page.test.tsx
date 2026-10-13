import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Echantillon } from "@/app/jeu/carte/Echantillon";
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
// US-0952 : les Blessés au Foyer, lus sur base (src/monde/blesses.db.test.ts), à l'heure du jeu de la fiche.
const blesses = vi.hoisted(() => ({
  blessesAuFoyer: vi.fn(async (): Promise<Map<string, { nombre: number; gueriLe: Date; soignes?: true }[]>> => new Map()),
}));
vi.mock("@/monde/blesses", () => blesses);
const MAINTENANT = vi.hoisted(() => new Date("2026-10-09T07:42:13.250Z"));
// US-0814 : et la vitesse du jeu, que le bloc « Élever » reçoit pour faire avancer l'heure de la dernière Bête.
vi.mock("@/temps/horloge", async (original) => ({ ...(await original<object>()), maintenant: () => MAINTENANT, vitesse: () => 3 }));
// US-0812 : l'Élevage de l'Espèce, acquis ou non, lu sur base (page.db.test.tsx).
// US-0843 : et l'éleveur libre du Territoire (src/monde/eleveur.db.test.ts).
const elevage = vi.hoisted(() => ({
  elevageAcquis: vi.fn(async () => false),
  eleveurLibre: vi.fn(async (): Promise<{ id: number; prenom: string } | null> => ({ id: 5, prenom: "Brune" })),
}));
vi.mock("@/monde/elevage", async (original) => ({ ...(await original<object>()), elevageAcquis: elevage.elevageAcquis, eleveurLibre: elevage.eleveurLibre }));
// US-0822 : les Places de l'Habitat du Foyer, lues sur base (src/monde/habitat.db.test.ts).
const habitat = vi.hoisted(() => ({ placesDeLHabitat: vi.fn(async () => ({ occupees: 21, total: 500 })) }));
vi.mock("@/monde/habitat", () => habitat);
// US-0813 : les Bêtes que les Stocks de Nourriture permettent de payer, lues sur base (src/monde/cout-d-elevage.db.test.ts).
const cout = vi.hoisted(() => ({ maxAElever: vi.fn(async () => 7) }));
// US-0814 : le coût et la durée d'une Bête, eux, se calculent pour de bon (src/monde/cout-d-elevage.test.ts).
vi.mock("@/monde/cout-d-elevage", async (original) => ({ ...(await original<object>()), maxAElever: cout.maxAElever }));
vi.mock("@/temps/rattraper", () => ({ rattraper: vi.fn(async () => new Date()) }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));

import { coutDUneBeteElevee, dureeDUneBeteEleveeMinutes } from "@/monde/cout-d-elevage";
import { formaterJourEtHeure, formaterMinutes } from "@/temps/affichage";
import { BlocElever } from "./BlocElever";
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
  taille: 31.623,
  regime: "omnivore",
  entretienParHeure: 5,
  biome: { id: "prairie", nom: "Prairie" },
  role: { id: "nourricier", nom: "Nourricier" },
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

  it("distingue, sous l'effectif, chaque groupe de Blessés au Foyer et le temps qui lui reste avant sa guérison (US-0952)", async () => {
    connecte();
    blesses.blessesAuFoyer.mockResolvedValueOnce(new Map([["poule", [{ nombre: 3, gueriLe: new Date("2026-10-09T12:42:13.250Z") }]]]));
    const html = await ouvrir("poule");
    expect(blesses.blessesAuFoyer).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12, MAINTENANT);
    expect(html).toMatch(/<strong[^>]*>12<\/strong><\/p><p[^>]*>dont 3 Blessés, guéris dans 5 h<\/p>/);
    // Sans Blessé, rien de plus.
    connecte();
    expect(await ouvrir("poule")).not.toContain("Blessé");
  });

  it("dit les Blessés soignés à leur retour, et le temps plus court qui leur reste (US-0955)", async () => {
    connecte();
    blesses.blessesAuFoyer.mockResolvedValueOnce(new Map([["poule", [{ nombre: 2, gueriLe: new Date("2026-10-09T12:42:13.250Z"), soignes: true }]]]));
    expect(await ouvrir("poule")).toMatch(/<strong[^>]*>12<\/strong><\/p><p[^>]*>dont 2 Blessés soignés, guéris dans 5 h<\/p>/);
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

  it("y propose la quantité, et « Max » au nombre de Bêtes que les Stocks du joueur permettent de payer (US-0813)", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValueOnce(true);
    const html = await ouvrir("poule");
    expect(cout.maxAElever).toHaveBeenLastCalledWith(expect.anything(), 12, "poule");
    const bloc = html.slice(html.indexOf('id="elever"'));
    expect(bloc).toMatch(/<input[^>]*name="quantite"[^>]*value="1"/);
    expect(bloc).toMatch(/<button type="button"[^>]*>Max<\/button>/);
    expect(bloc).not.toMatch(/<button[^>]*disabled=""[^>]*>Max<\/button>/);
    // Des Stocks qui ne paient pas une Bête : « Max » est grisé.
    cout.maxAElever.mockResolvedValueOnce(0);
    elevage.elevageAcquis.mockResolvedValueOnce(true);
    expect(await ouvrir("poule")).toMatch(/<button[^>]*disabled=""[^>]*>Max<\/button>/);
  });

  it("y dit l'éleveur libre du joueur, ou qu'il n'en a aucun, le bloc restant proposé (US-0843)", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValueOnce(true);
    const avec = await ouvrir("poule");
    expect(elevage.eleveurLibre).toHaveBeenLastCalledWith(expect.anything(), 12);
    expect(avec.slice(avec.indexOf('id="elever"')).replace(/<[^>]+>/g, "")).toContain("Éleveur : Brune");
    elevage.elevageAcquis.mockResolvedValueOnce(true);
    elevage.eleveurLibre.mockResolvedValueOnce(null);
    const sans = await ouvrir("poule");
    expect(sans).toContain('id="elever"');
    expect(sans.slice(sans.indexOf('id="elever"')).replace(/<[^>]+>/g, "")).toContain("Aucun éleveur libre. Habitants");
    expect(sans).toMatch(/<a[^>]*href="\/jeu\/habitants"[^>]*>Habitants<\/a>/);
  });

  it("y chiffre l'Élevage d'une Bête de l'Espèce : son coût dans la Nourriture de son régime, sa durée, et l'heure de la dernière (US-0814)", async () => {
    /** Les lignes du coût et de la durée du bloc « Élever », libellé et valeur. */
    const chiffres = (html: string) =>
      [...html.slice(html.indexOf('id="elever"')).matchAll(/<dt>([^<]+)<\/dt><dd>([^<]+)<\/dd>/g)].map(([, libelle, valeur]) => [libelle, valeur]);
    /** Ce que le bloc doit dire d'une Bête de l'Espèce, d'après son Entretien et sa taille, aux réglages du moment. */
    const attendus = (entretienParHeure: number, taille: number, nourriture: string) => {
      const duree = dureeDUneBeteEleveeMinutes(taille);
      return [
        // Le coût à la française, comme le bloc l'écrit (« 1 080 » à espace insécable dès le millier).
        ["Coût", `${new Intl.NumberFormat("fr-FR").format(coutDUneBeteElevee(entretienParHeure)).replace(/\s/g, "\u00a0")} ${nourriture}`],
        ["Durée par Bête", formaterMinutes(duree)],
        ["Durée totale", formaterMinutes(duree)],
        ["Dernière Bête", formaterJourEtHeure(new Date(MAINTENANT.getTime() + duree * 60_000), "Europe/Paris")],
      ];
    };
    connecte();
    elevage.elevageAcquis.mockResolvedValueOnce(true);
    // La poule : son Entretien pour le coût, sa taille pour la durée, son régime pour la Nourriture, l'heure de la fiche.
    expect(chiffres(await ouvrir("poule"))).toEqual(attendus(5, 31.623, "Viande ou Végétaux"));
    connecte({ ...POULE, especeId: "pigeon", nom: "Pigeon biset", taille: 8.556, regime: "herbivore", entretienParHeure: 1.25 });
    elevage.elevageAcquis.mockResolvedValueOnce(true);
    expect(chiffres(await ouvrir("pigeon"))).toEqual(attendus(1.25, 8.556, "Végétaux"));
  });

  it("donne au bloc « Élever » l'heure et la vitesse du jeu, pour que l'heure de la dernière Bête avance à son rythme (US-0814)", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValueOnce(true);
    /** Le bloc « Élever » dans l'arbre que rend la page, avant tout rendu en HTML. */
    const trouver = (noeud: unknown): { props: Record<string, unknown> } | null => {
      if (Array.isArray(noeud)) return noeud.map(trouver).find(Boolean) ?? null;
      if (!isValidElement(noeud)) return null;
      if (noeud.type === BlocElever) return noeud as { props: Record<string, unknown> };
      return trouver((noeud.props as { children?: unknown }).children);
    };
    const bloc = trouver(await FicheDeLEspece({ params: Promise.resolve({ espece: "poule" }), searchParams: Promise.resolve({}) }));
    expect(bloc?.props.maintenant).toEqual(MAINTENANT);
    expect(bloc?.props.vitesse).toBe(3);
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
    expect(caracteristiques(await ouvrir("poule")).slice(0, 4)).toEqual([
      ["Attaque", "5 981"],
      ["Vie", "14 953"],
      ["Vitesse", "14 km/h"],
      ["Charge", "500"],
    ]);
  });

  it("écrit une valeur décimale à la française : « 87,5 »", async () => {
    connecte({ ...POULE, especeId: "pigeon", nom: "Pigeon biset", attaque: 1214, vie: 4046, vitesse: 80, charge: 87.5 });
    expect(caracteristiques(await ouvrir("pigeon")).slice(0, 4)).toEqual([
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

describe("lire la taille, le régime et l'Entretien (US-0805)", () => {
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
  /** Les caractéristiques de US-0805, après celles de US-0804. */
  const dernieres = async (fiche: FicheDEspece) => {
    connecte(fiche);
    return caracteristiques(await ouvrir(fiche.especeId)).slice(4, 7);
  };

  it("affiche la taille en Places occupées par Bête, le régime et l'Entretien par heure dans la Nourriture du régime", async () => {
    expect(await dernieres(POULE)).toEqual([
      ["Taille", "31,623 Places"],
      ["Régime", "Omnivore"],
      ["Entretien", "5 Viande ou Végétaux / h"],
    ]);
  });

  it("nourrit un herbivore de Végétaux et un carnivore de Viande", async () => {
    expect(await dernieres({ ...POULE, especeId: "pigeon", nom: "Pigeon biset", taille: 8.556, regime: "herbivore", entretienParHeure: 1.25 })).toEqual([
      ["Taille", "8,556 Places"],
      ["Régime", "Herbivore"],
      ["Entretien", "1,25 Végétaux / h"],
    ]);
    expect(await dernieres({ ...POULE, especeId: "chasseur", nom: "Chasseur", taille: 2, regime: "carnivore", entretienParHeure: 0.5 })).toEqual([
      ["Taille", "2 Places"],
      ["Régime", "Carnivore"],
      ["Entretien", "0,5 Viande / h"],
    ]);
  });

  it("accorde la Place au singulier sous deux : « 1 Place », « 1,5 Place »", async () => {
    expect((await dernieres({ ...POULE, taille: 1 }))[0]).toEqual(["Taille", "1 Place"]);
    expect((await dernieres({ ...POULE, taille: 1.5 }))[0]).toEqual(["Taille", "1,5 Place"]);
  });

  it("colle la valeur à son unité d'espaces insécables : « 31,623 Places » et « 5 Viande ou Végétaux / h » ne se coupent pas", async () => {
    connecte(POULE);
    const html = await ouvrir("poule");
    expect(html).toContain("<dd>31,623\u00a0Places</dd>");
    expect(html).toContain("<dd>5\u00a0Viande ou Végétaux\u00a0/\u00a0h</dd>");
  });
});

describe("lire le Biome d'Habitat et le Rôle (US-0806)", () => {
  afterEach(() => {
    session.compteDeLaSession.mockReset();
    cookie.jetonDeSession.mockReset();
    effectif.especeDuTerritoire.mockReset();
  });

  /** La fiche telle que la page l'envoie, et ses deux dernières caractéristiques, celles de US-0806. */
  const fiche = async (donnee: FicheDEspece) => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
    effectif.especeDuTerritoire.mockResolvedValue(donnee);
    const html = await ouvrir(donnee.especeId);
    return { html, dernieres: caracteristiques(html).slice(7) };
  };

  it("affiche le Biome d'Habitat, son nom avec son pictogramme, puis le Rôle", async () => {
    const { html, dernieres } = await fiche(POULE);
    expect(dernieres).toEqual([
      ["Habitat", "Prairie"],
      ["Rôle", "Nourricier"],
    ]);
    // Le pictogramme du Biome : sa Case, dessinée comme sur la carte et sa légende, de la couleur du Biome.
    const habitat = html.match(/<dt>Habitat<\/dt><dd[^>]*>(.*?)<\/dd>/)?.[1] ?? "";
    expect(habitat).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(habitat).toContain("fill:var(--biome-prairie)");
  });

  it("donne à chaque Biome son pictogramme : sa Case de la carte, de sa couleur et de son motif", async () => {
    const habitat = async (biome: { id: string; nom: string }) =>
      (await fiche({ ...POULE, biome })).html.match(/<dt>Habitat<\/dt><dd[^>]*>(.*?)<\/dd>/)?.[1] ?? "";
    const foret = await habitat({ id: "foret", nom: "Forêt" });
    expect(foret).toBe(`${renderToStaticMarkup(<Echantillon teinte="foret" />)}Forêt`);
    expect(foret).toContain("fill:var(--biome-foret)");
    expect(await habitat({ id: "prairie", nom: "Prairie" })).toBe(`${renderToStaticMarkup(<Echantillon teinte="prairie" />)}Prairie`);
    // L'eau, que la carte ne dessine que par ses formes : la mer, de la couleur de l'eau, la représente.
    expect(await habitat({ id: "eau", nom: "Eau" })).toBe(`${renderToStaticMarkup(<Echantillon teinte="mer" />)}Eau`);
  });

  it("dit « Aucun Rôle » pour une Espèce qui n'en a pas", async () => {
    expect((await fiche({ ...POULE, especeId: "souris", nom: "Souris grise", role: null })).dernieres).toEqual([
      ["Habitat", "Prairie"],
      ["Rôle", "Aucun Rôle"],
    ]);
  });
});
