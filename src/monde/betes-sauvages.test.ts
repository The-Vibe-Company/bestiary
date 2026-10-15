import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lireRaretesParAnneau } from "@/donnees/jeux";
import { ANNEAUX_DU_MONDE, APPARITIONS_PAR_CASE_PAR_JOUR, COEUR_SAUVAGE_RAYON, COURONNE_ANNEAUX, MONDE_RAYON, PRESENCE_D_UNE_BETE_HEURES } from "@/reglages";
import { definirAncre, maintenant } from "@/temps/horloge";
import { anneauDUneCase } from "./anneaux";
import { apparitions, type BeteSauvage, betesSauvages, rangerLesEspeces, tirerUneEspece, tirerUneRarete } from "./betes-sauvages";
import { hacher } from "./couronne";
import { genererLeMonde } from "./generer";
import { casesDesAnneaux } from "./hex";

const HEURE = 3_600_000;
const JOUR = 24 * HEURE;
/** Un instant du jeu quelconque, pas à l'heure pile. */
const DEBUT = new Date("2026-10-08T09:17:23.456Z");
const apres = (ms: number) => new Date(DEBUT.getTime() + ms);
const GRAINE = 12345;
const ICI = { q: 7, r: -3 };
/** La même Case, telle que les Bêtes sauvages la voient : dans la Couronne d'un Monde de graine GRAINE. */
const LA_CASE = { ...ICI, graine: GRAINE, anneau: 1, biome: "prairie" };
/**
 * Des Espèces pour les essais (US-0928) : une de chaque Rareté en prairie (deux communes) et une mythique ; dans l'eau, une
 * commune et une rare ; en forêt, une légendaire seule.
 */
const CATALOGUE = [
  { id: "p1", rareteId: "commune", biomeId: "prairie" },
  { id: "p2", rareteId: "commune", biomeId: "prairie" },
  { id: "p3", rareteId: "peu_commune", biomeId: "prairie" },
  { id: "p4", rareteId: "rare", biomeId: "prairie" },
  { id: "p5", rareteId: "epique", biomeId: "prairie" },
  { id: "p6", rareteId: "legendaire", biomeId: "prairie" },
  { id: "p7", rareteId: "mythique", biomeId: "prairie" },
  { id: "e1", rareteId: "commune", biomeId: "eau" },
  { id: "e2", rareteId: "rare", biomeId: "eau" },
  { id: "f1", rareteId: "legendaire", biomeId: "foret" },
];
const ESPECES = rangerLesEspeces(CATALOGUE);

describe("des Bêtes sauvages apparaissent de temps en temps (US-0925)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`en fait apparaître en moyenne ${APPARITIONS_PAR_CASE_PAR_JOUR} par Case et par jour du jeu`, () => {
    const cases = casesDesAnneaux(0, 12); // 469 Cases
    const jours = 60;
    const total = cases.reduce((n, c) => n + apparitions(GRAINE, c, DEBUT, apres(jours * JOUR)).length, 0);
    expect(total / (cases.length * jours)).toBeCloseTo(APPARITIONS_PAR_CASE_PAR_JOUR, 1);
    // Chaque Case en voit, aucune n'en voit sans cesse.
    for (const c of cases.slice(0, 50)) expect(apparitions(GRAINE, c, DEBUT, apres(jours * JOUR)).length).toBeGreaterThan(jours / 4);
  });

  it("se règle : deux fois plus d'apparitions par jour en donnent deux fois plus", () => {
    const cases = casesDesAnneaux(0, 8);
    const compter = (parJour: number) => cases.reduce((n, c) => n + apparitions(GRAINE, c, DEBUT, apres(30 * JOUR), parJour).length, 0);
    expect(compter(2) / compter(1)).toBeCloseTo(2, 0);
    expect(compter(24) / (cases.length * 30)).toBeCloseTo(24, 0);
  });

  it("les fait apparaître à des moments au hasard, indépendants : parfois deux dans la même heure, parfois rien pendant des jours", () => {
    const liste = apparitions(GRAINE, ICI, DEBUT, apres(365 * JOUR));
    const ecarts = liste.slice(1).map((x, i) => x.arrivee.getTime() - liste[i].arrivee.getTime());
    expect(Math.min(...ecarts)).toBeLessThan(HEURE);
    expect(Math.max(...ecarts)).toBeGreaterThan(3 * JOUR);
    // Les minutes des arrivées se répartissent sur toute l'heure.
    const quarts = new Set(liste.map((x) => Math.floor(x.arrivee.getUTCMinutes() / 15)));
    expect(quarts.size).toBe(4);
  });

  it("donne à chaque apparition une seule Bête, et un numéro propre à sa Case qui ne revient jamais", () => {
    const liste = apparitions(GRAINE, ICI, DEBUT, apres(365 * JOUR));
    expect(new Set(liste.map((x) => x.numero)).size).toBe(liste.length);
    // Rangées dans l'ordre du temps, leurs numéros ne font que croître.
    for (let i = 1; i < liste.length; i++) {
      expect(liste[i].arrivee.getTime()).toBeGreaterThanOrEqual(liste[i - 1].arrivee.getTime());
      expect(liste[i].numero).toBeGreaterThan(liste[i - 1].numero);
    }
  });

  it("ne garde que les apparitions de la période, bornes comprises au début, exclues à la fin", () => {
    const liste = apparitions(GRAINE, ICI, DEBUT, apres(30 * JOUR));
    const [premiere, derniere] = [liste[0], liste.at(-1)!];
    expect(apparitions(GRAINE, ICI, premiere.arrivee, derniere.arrivee)).toEqual(liste.slice(0, -1));
    expect(apparitions(GRAINE, ICI, premiere.arrivee, new Date(derniere.arrivee.getTime() + 1))).toEqual(liste);
    expect(apparitions(GRAINE, ICI, DEBUT, DEBUT)).toEqual([]);
  });

  it("a lieu que les joueurs soient là ou non : calculées après coup, ce sont les mêmes qu'en direct", () => {
    vi.useFakeTimers();
    vi.setSystemTime(apres(JOUR));
    const enDirect = apparitions(GRAINE, ICI, DEBUT, apres(JOUR));
    vi.setSystemTime(apres(400 * JOUR));
    expect(apparitions(GRAINE, ICI, DEBUT, apres(JOUR))).toEqual(enDirect);
  });

  it("donne à chaque Case, et à chaque Monde, ses propres apparitions", () => {
    const moments = (graine: number, c: { q: number; r: number }) => apparitions(graine, c, DEBUT, apres(30 * JOUR)).map((x) => x.arrivee.getTime());
    expect(moments(GRAINE, ICI)).toEqual(moments(GRAINE, { ...ICI }));
    expect(moments(GRAINE, ICI)).not.toEqual(moments(GRAINE, { q: 7, r: -2 }));
    expect(moments(GRAINE, ICI)).not.toEqual(moments(GRAINE + 1, ICI));
  });

  it("ne montre aucune Bête sauvage sur la carte : rien de la carte ne les lit", () => {
    const carte = [
      ...readdirSync("src/app/jeu/carte").map((f) => join("src/app/jeu/carte", f)),
      "src/monde/carte.ts",
      "src/monde/brouillard.ts",
      "src/monde/fiche.ts",
    ];
    for (const fichier of carte) expect(readFileSync(fichier, "utf8"), fichier).not.toMatch(/betes-sauvages/);
  });
});

describe("une présence limitée dans le temps (US-0926)", () => {
  const PRESENCE = PRESENCE_D_UNE_BETE_HEURES * HEURE;
  /** Les numéros des Bêtes présentes sur la Case à l'instant `t`. */
  const presentes = (t: Date, parties?: Map<number, Date>) => betesSauvages(LA_CASE, t, new Date(t.getTime() + 1), ESPECES, { parties }).map((b) => b.numero);
  const betes = betesSauvages(LA_CASE, DEBUT, apres(30 * JOUR), ESPECES);

  it(`garde chaque Bête ${PRESENCE_D_UNE_BETE_HEURES} heures sur sa Case, la même durée pour toutes, puis elle disparaît`, () => {
    expect(betes.length).toBeGreaterThan(10);
    for (const b of betes) {
      expect(b.depart.getTime() - b.arrivee.getTime()).toBe(PRESENCE);
      expect(presentes(new Date(b.arrivee.getTime() - 1))).not.toContain(b.numero);
      expect(presentes(b.arrivee)).toContain(b.numero);
      expect(presentes(new Date(b.depart.getTime() - 1))).toContain(b.numero);
      expect(presentes(b.depart)).not.toContain(b.numero);
    }
  });

  it("compte toutes les Bêtes présentes pendant la période, même arrivées avant elle", () => {
    // Une période qui commence une heure après l'arrivée d'une Bête : elle y est encore.
    const de = new Date(betes[5].arrivee.getTime() + HEURE);
    const pendant = betesSauvages(LA_CASE, de, new Date(de.getTime() + JOUR), ESPECES);
    expect(pendant.map((b) => b.numero)).toContain(betes[5].numero);
    expect(pendant.map((b) => b.numero)).toEqual(apparitions(GRAINE, ICI, new Date(de.getTime() - PRESENCE + 1), new Date(de.getTime() + JOUR)).map((x) => x.numero));
  });

  it("laisse parfois plusieurs Bêtes ensemble sur une même Case", () => {
    const annee = betesSauvages(LA_CASE, DEBUT, apres(365 * JOUR), ESPECES);
    expect(Math.max(...annee.map((b) => presentes(b.arrivee).length))).toBeGreaterThanOrEqual(2);
  });

  it("ne fait jamais revenir une Bête disparue : chacune n'est là que pendant sa présence, d'un seul tenant", () => {
    const quarts = new Map<number, number[]>();
    for (let k = 0; k < 30 * 24 * 4; k++) {
      for (const numero of presentes(apres((k * HEURE) / 4))) quarts.set(numero, [...(quarts.get(numero) ?? []), k]);
    }
    expect(quarts.size).toBeGreaterThan(10);
    for (const [numero, vus] of quarts) {
      expect(vus.at(-1)! - vus[0] + 1, `${numero}`).toBe(vus.length);
      expect(vus.length).toBeLessThanOrEqual(PRESENCE_D_UNE_BETE_HEURES * 4 + 1);
    }
  });

  it("fait quitter aussitôt sa Case à une Bête qui suit une Expédition, pour toujours, sans rien changer aux autres", () => {
    const suivie = betes[3];
    const instant = new Date(suivie.arrivee.getTime() + 2 * HEURE);
    const parties = new Map([[suivie.numero, instant]]);
    expect(presentes(new Date(instant.getTime() - 1), parties)).toContain(suivie.numero);
    expect(presentes(instant, parties)).not.toContain(suivie.numero);
    expect(betesSauvages(LA_CASE, instant, apres(60 * JOUR), ESPECES, { parties }).map((b) => b.numero)).not.toContain(suivie.numero);
    // US-0970 : elle garde l'instant où elle a suivi l'Expédition, au-delà duquel nul ne la garde en vue.
    expect(betesSauvages(LA_CASE, DEBUT, apres(30 * JOUR), ESPECES, { parties })).toEqual(betes.map((b) => (b === suivie ? { ...b, depart: instant, emmeneeLe: instant } : b)));
  });
});

describe("la Rareté tirée selon l'Anneau (US-0927)", () => {
  const chances = lireRaretesParAnneau();
  /** Combien de Bêtes de chaque Rareté apparaissent dans l'Anneau `anneau`, sur 271 Cases et 120 jours du jeu : quelque 32 000. */
  const simuler = (anneau: number) => {
    const comptes = new Map<string, number>();
    for (const c of casesDesAnneaux(0, 9)) {
      for (const b of betesSauvages({ ...c, graine: GRAINE, anneau, biome: "prairie" }, DEBUT, apres(120 * JOUR), ESPECES)) comptes.set(b.rareteId, (comptes.get(b.rareteId) ?? 0) + 1);
    }
    const total = [...comptes.values()].reduce((s, n) => s + n, 0);
    return { comptes, total, part: (rareteId: string) => (comptes.get(rareteId) ?? 0) / total };
  };
  const simulations = Array.from({ length: ANNEAUX_DU_MONDE }, (_, i) => simuler(i + 1));

  it("tire la Rareté de chaque Bête aux pourcentages de l'Anneau de sa Case, sur une longue simulation", () => {
    simulations.forEach(({ total, part }, i) => {
      expect(total).toBeGreaterThan(30_000);
      for (const { rareteId, pourcent } of chances[i]) {
        // À quatre écarts types près : un tirage juste n'en sort pratiquement jamais.
        const p = pourcent / 100;
        expect(Math.abs(part(rareteId) - p), `Anneau ${i + 1}, ${rareteId}`).toBeLessThan(4 * Math.sqrt((p * (1 - p)) / total));
      }
    });
  });

  it("fait apparaître partout toutes les Raretés de commune à légendaire, les communes toujours les plus nombreuses", () => {
    for (const { comptes, part } of simulations) {
      expect([...comptes.keys()].sort()).toEqual(["commune", "epique", "legendaire", "peu_commune", "rare"]);
      for (const rareteId of comptes.keys()) expect(part("commune")).toBeGreaterThanOrEqual(part(rareteId));
      expect(part("commune")).toBeGreaterThan(0.5);
    }
  });

  it("en fait apparaître de plus rares à mesure qu'on approche du Cœur sauvage", () => {
    for (const rareteId of ["peu_commune", "rare", "epique", "legendaire"]) {
      const parts = simulations.map(({ part }) => part(rareteId));
      for (let i = 1; i < parts.length; i++) expect(parts[i], `${rareteId}, Anneau ${i + 1}`).toBeGreaterThan(parts[i - 1]);
    }
  });

  it("ne fait jamais apparaître une Bête mythique ainsi, quel que soit le hasard", () => {
    for (const { comptes } of simulations) expect(comptes.has("mythique")).toBe(false);
    for (const ligne of chances) {
      for (const hasard of [0, 0.5, 0.999999, 1 - Number.EPSILON]) expect(tirerUneRarete(ligne, hasard)).not.toBe("mythique");
    }
    expect(tirerUneRarete(chances[0], 0)).toBe("commune");
    expect(tirerUneRarete(chances[0], 1 - Number.EPSILON)).toBe("legendaire");
  });

  it("garde la même Rareté à une Bête, quelle que soit la période où on la calcule", () => {
    const anneau6 = { ...LA_CASE, anneau: ANNEAUX_DU_MONDE };
    const mois = betesSauvages(anneau6, DEBUT, apres(30 * JOUR), ESPECES);
    for (const b of mois) {
      expect(betesSauvages(anneau6, b.arrivee, new Date(b.arrivee.getTime() + 1), ESPECES).find((x) => x.numero === b.numero)).toEqual(b);
    }
  });
});

describe("l'Espèce tirée selon le Biome (US-0928)", () => {
  const chances = lireRaretesParAnneau();
  const biomeDe = new Map(CATALOGUE.map((e) => [e.id, e.biomeId]));
  const rareteDe = new Map(CATALOGUE.map((e) => [e.id, e.rareteId]));
  /** Combien de Bêtes de chaque Espèce apparaissent dans le Biome `biome`, au Cœur sauvage, sur 271 Cases et 120 jours du jeu. */
  const simuler = (biome: string) => {
    const comptes = new Map<string, number>();
    let apparues = 0;
    for (const c of casesDesAnneaux(0, 9)) {
      const laCase = { ...c, graine: GRAINE, anneau: ANNEAUX_DU_MONDE, biome };
      apparues += apparitions(GRAINE, c, DEBUT, apres(120 * JOUR)).length;
      for (const b of betesSauvages(laCase, apres(PRESENCE_D_UNE_BETE_HEURES * HEURE), apres(120 * JOUR), ESPECES)) {
        expect(b.rareteId).toBe(rareteDe.get(b.especeId));
        comptes.set(b.especeId, (comptes.get(b.especeId) ?? 0) + 1);
      }
    }
    return { comptes, apparues, part: (id: string) => (comptes.get(id) ?? 0) / apparues };
  };
  /** La chance d'une Rareté au Cœur sauvage. */
  const auCoeur = (rareteId: string) => chances[ANNEAUX_DU_MONDE - 1].find((c) => c.rareteId === rareteId)!.pourcent / 100;
  /** À quatre écarts types près : un tirage juste n'en sort pratiquement jamais. */
  const proche = (observee: number, attendue: number, n: number) => expect(Math.abs(observee - attendue)).toBeLessThan(4 * Math.sqrt((attendue * (1 - attendue)) / n));

  it("tire l'Espèce parmi celles de la Rareté tirée qui vivent dans le Biome de la Case", () => {
    const { comptes, apparues, part } = simuler("prairie");
    for (const id of comptes.keys()) expect(biomeDe.get(id)).toBe("prairie");
    for (const [id, rareteId] of [["p3", "peu_commune"], ["p4", "rare"], ["p5", "epique"], ["p6", "legendaire"]]) proche(part(id), auCoeur(rareteId), apparues);
  });

  it("donne à chaque Espèce de même Rareté la même chance", () => {
    const { apparues, part } = simuler("prairie");
    proche(part("p1"), auCoeur("commune") / 2, apparues);
    proche(part("p2"), auCoeur("commune") / 2, apparues);
  });

  it("retombe sur la Rareté inférieure quand le Biome n'en a aucune de la Rareté tirée, jusqu'aux communes", () => {
    const { comptes, apparues, part } = simuler("eau");
    expect([...comptes.keys()].sort()).toEqual(["e1", "e2"]);
    // Les peu communes tirées deviennent des communes ; les épiques et les légendaires, des rares.
    proche(part("e1"), auCoeur("commune") + auCoeur("peu_commune"), apparues);
    proche(part("e2"), auCoeur("rare") + auCoeur("epique") + auCoeur("legendaire"), apparues);
  });

  it("n'amène aucune Bête quand même les communes manquent au Biome", () => {
    const foret = simuler("foret");
    expect([...foret.comptes.keys()]).toEqual(["f1"]);
    proche(foret.part("f1"), auCoeur("legendaire"), foret.apparues);
    expect(simuler("desert").comptes.size).toBe(0);
    expect(tirerUneEspece(ESPECES, chances[0], "foret", "rare", 0.5)).toBeNull();
    expect(tirerUneEspece(ESPECES, chances[0], "lune", "commune", 0.5)).toBeNull();
  });

  it("ne tire jamais une Espèce mythique, même présente dans le Biome", () => {
    expect(simuler("prairie").comptes.has("p7")).toBe(false);
  });

  it("tire de même quel que soit l'ordre où les Espèces arrivent", () => {
    const melangees = rangerLesEspeces([...CATALOGUE].reverse());
    expect(betesSauvages(LA_CASE, DEBUT, apres(60 * JOUR), melangees)).toEqual(betesSauvages(LA_CASE, DEBUT, apres(60 * JOUR), ESPECES));
  });
});

describe("des apparitions identiques en direct et au rattrapage (US-0930)", () => {
  /** Les Bêtes vues en parcourant [de, a) par morceaux, coupés aux instants `coupures`, chacune une fois, dans l'ordre de leur arrivée. */
  const parMorceaux = (de: Date, a: Date, coupures: number[]) => {
    const bornes = [de.getTime(), ...coupures.filter((t) => t > de.getTime() && t < a.getTime()).sort((x, y) => x - y), a.getTime()];
    const vues = new Map<number, BeteSauvage>();
    for (let i = 1; i < bornes.length; i++) {
      for (const b of betesSauvages(LA_CASE, new Date(bornes[i - 1]), new Date(bornes[i]), ESPECES)) vues.set(b.numero, b);
    }
    return [...vues.values()].sort((x, y) => x.numero - y.numero);
  };

  it("donne pour une Case et une période les mêmes Bêtes (Espèce, moment, durée), quel que soit le découpage du temps", () => {
    const [de, a] = [DEBUT, apres(30 * JOUR)];
    const dUnBloc = betesSauvages(LA_CASE, de, a, ESPECES);
    expect(dUnBloc.length).toBeGreaterThan(20);
    // Par pas de cinq minutes, comme la tâche planifiée ; par heures ; par jours ; à des instants quelconques.
    const pas = (ms: number) => Array.from({ length: Math.ceil((a.getTime() - de.getTime()) / ms) }, (_, i) => de.getTime() + i * ms);
    const auHasard = Array.from({ length: 40 }, (_, i) => de.getTime() + Math.floor(hacher(i, 930) * (a.getTime() - de.getTime())));
    for (const coupures of [pas(5 * 60_000), pas(HEURE), pas(JOUR), auHasard]) expect(parMorceaux(de, a, coupures)).toEqual(dUnBloc);
    // Les arrivées se mettent bout à bout, jour après jour, sans manque ni doublon.
    const parJour = pas(JOUR).flatMap((t) => apparitions(GRAINE, ICI, new Date(t), new Date(Math.min(t + JOUR, a.getTime()))));
    expect(parJour).toEqual(apparitions(GRAINE, ICI, de, a));
  });

  it("calcule une Case seule comme au milieu de tout le Monde : le reste du Monde n'y change rien, et c'est vite fait", () => {
    const forme = { rayon: MONDE_RAYON, anneauxCouronne: COURONNE_ANNEAUX, rayonCoeur: COEUR_SAUVAGE_RAYON };
    const monde = genererLeMonde({ rayon: MONDE_RAYON, anneaux: COURONNE_ANNEAUX, rayonCoeur: COEUR_SAUVAGE_RAYON, graine: 417 });
    const laCase = (c: (typeof monde)[number]) => ({ q: c.q, r: c.r, graine: 417, anneau: anneauDUneCase(c, forme), biome: c.biome });
    const debut = performance.now();
    const toutLeMonde = monde.map((c) => betesSauvages(laCase(c), DEBUT, apres(JOUR), ESPECES));
    // Un jour de tout le Monde, près de onze mille Cases, se calcule en un instant ; une Case seule, à plus forte raison.
    expect(performance.now() - debut).toBeLessThan(3000);
    expect(toutLeMonde.flat().length).toBeGreaterThan(1000);
    for (let i = 0; i < monde.length; i += 97) expect(betesSauvages(laCase(monde[i]), DEBUT, apres(JOUR), ESPECES)).toEqual(toutLeMonde[i]);
  });

  it("accélère les apparitions et leurs durées avec la vitesse du temps : à ×100, une heure réelle en vaut cent du jeu", () => {
    vi.useFakeTimers();
    const reel = Date.UTC(2026, 9, 8, 12);
    /** Les Bêtes de la Case pendant `heures` heures réelles à la vitesse `facteur`, l'horloge du jeu partant de DEBUT. */
    const pendant = (facteur: number, heures: number) => {
      definirAncre({ facteur, reel, jeu: DEBUT.getTime() });
      vi.setSystemTime(reel);
      const de = maintenant();
      vi.setSystemTime(reel + heures * HEURE);
      return betesSauvages(LA_CASE, de, maintenant(), ESPECES);
    };
    try {
      const enCentHeures = pendant(1, 100);
      expect(enCentHeures.length).toBeGreaterThan(2);
      expect(pendant(100, 1)).toEqual(enCentHeures);
      // À ×100, une Bête ne reste que 3 minutes 36 secondes réelles sur sa Case.
      const b = enCentHeures.find((x) => x.arrivee >= DEBUT)!;
      const auReel = (jeu: Date) => reel + (jeu.getTime() - DEBUT.getTime()) / 100;
      const presente = (instantReel: number) => {
        vi.setSystemTime(instantReel);
        const t = maintenant();
        return betesSauvages(LA_CASE, t, new Date(t.getTime() + 1), ESPECES).some((x) => x.numero === b.numero);
      };
      definirAncre({ facteur: 100, reel, jeu: DEBUT.getTime() });
      expect(presente(auReel(b.arrivee) + 1000)).toBe(true);
      expect(presente(auReel(b.arrivee) + 3.5 * 60_000)).toBe(true);
      expect(presente(auReel(b.arrivee) + 3.7 * 60_000)).toBe(false);
    } finally {
      definirAncre(null);
    }
  });
});
