import { describe, expect, it } from "vitest";
import { aPortee, type BeteDisputee, type ExpeditionSurLaCase, forceQuiManque, lExpeditionSuivie, vueLe } from "./apprivoisement";

const HEURE_MS = 3_600_000;
/** L'instant du jeu `heures` heures après une origine quelconque. */
const h = (heures: number) => new Date(Date.UTC(2026, 9, 9) + heures * HEURE_MS);

/** Une Bête rare de force 1 000 sur sa Case de 10 h à 16 h, sauf précision : la Bête 1 de la Case 1. */
const rare = (attributs: Partial<BeteDisputee> = {}): BeteDisputee => ({
  arrivee: h(10),
  depart: h(16),
  force: 1_000,
  rareteId: "rare",
  caseId: 1,
  numero: 1,
  beteDeNaissanceId: null,
  ...attributs,
});
/** Une Expédition sur la Case de `de` à `a` heures, d'escorte de force `escorte` (null : sans escorte). */
const expedition = (id: number, de: number, a: number, escorte: number | null): ExpeditionSurLaCase => ({ id, arrivee: h(de), depart: h(a), escorte });

describe("la Bête à portée (US-0934)", () => {
  it("est à portée quand la force de l'escorte est au moins égale à celle de son Espèce", () => {
    expect(aPortee(1_000, rare())).toBe(true);
    expect(aPortee(1_001, rare())).toBe(true);
    expect(aPortee(999, rare())).toBe(false);
  });

  it("une Bête commune l'est toujours, même plus forte que l'escorte", () => {
    expect(aPortee(1, rare({ rareteId: "commune", force: 23_029 }))).toBe(true);
    expect(aPortee(0, rare({ rareteId: "commune" }))).toBe(true);
  });

  it("une escorte de force nulle a à portée les Bêtes de force nulle", () => {
    expect(aPortee(0, rare({ force: 0 }))).toBe(true);
    expect(aPortee(0, rare({ force: 1 }))).toBe(false);
  });
});

describe("sans escorte, une Bête commune (US-0935)", () => {
  it("une Bête commune est à portée de toute Expédition, même sans escorte", () => {
    expect(aPortee(null, rare({ rareteId: "commune", force: 0 }))).toBe(true);
    expect(aPortee(null, rare({ rareteId: "commune", force: 23_029 }))).toBe(true);
  });

  it("une Bête plus rare n'est jamais à portée d'une Expédition sans escorte, même de force nulle", () => {
    expect(aPortee(null, rare())).toBe(false);
    expect(aPortee(null, rare({ rareteId: "peu_commune", force: 37_340 }))).toBe(false);
    expect(aPortee(null, rare({ force: 0 }))).toBe(false);
  });

  it("une Bête commune suit l'Expédition sans escorte qui la voit ; une plus rare la voit sans la suivre", () => {
    expect(lExpeditionSuivie(rare({ rareteId: "commune", force: 473 }), [expedition(4, 8, 14, null)])).toEqual({ expeditionId: 4, le: h(10) });
    expect(lExpeditionSuivie(rare(), [expedition(4, 8, 14, null)])).toBeNull();
  });

  it("vue d'abord par une Expédition sans escorte, la Bête commune la suit plutôt qu'une escorte arrivée après", () => {
    const commune = rare({ rareteId: "commune", force: 473 });
    expect(lExpeditionSuivie(commune, [expedition(1, 12, 14, 5_000), expedition(2, 11, 14, null)])).toEqual({ expeditionId: 2, le: h(11) });
  });
});

describe("l'instant où une Expédition voit une Bête (US-0932)", () => {
  it("à son apparition, ou à l'arrivée de l'Expédition si elle était déjà là, tant qu'aucune n'est partie", () => {
    expect(vueLe(rare(), expedition(1, 8, 12, null))).toEqual(h(10));
    expect(vueLe(rare(), expedition(1, 11, 12, null))).toEqual(h(11));
    expect(vueLe(rare(), expedition(1, 6, 10, null))).toBeNull();
    expect(vueLe(rare(), expedition(1, 16, 18, null))).toBeNull();
  });
});

describe("l'Expédition que la Bête suit (US-0934)", () => {
  it("la Bête suit l'Expédition qui l'a à portée, à l'instant où elle la voit", () => {
    expect(lExpeditionSuivie(rare(), [expedition(7, 12, 14, 1_000)])).toEqual({ expeditionId: 7, le: h(12) });
    expect(lExpeditionSuivie(rare(), [expedition(7, 8, 14, 5_000)])).toEqual({ expeditionId: 7, le: h(10) });
  });

  it("une escorte trop faible la voit sans qu'elle la suive : elle reste sur sa Case", () => {
    expect(lExpeditionSuivie(rare(), [expedition(7, 8, 14, 999)])).toBeNull();
  });

  it("elle suit la première qui la voit et l'a à portée, tous Territoires confondus, après une trop faible", () => {
    const suivie = lExpeditionSuivie(rare(), [expedition(3, 13, 15, 2_000), expedition(1, 8, 20, 10), expedition(2, 11, 12, 1_000), expedition(4, 12, 13, null)]);
    expect(suivie).toEqual({ expeditionId: 2, le: h(11) });
  });

  it("à égalité d'instant, elle suit l'une d'elles, à cet instant (US-0963)", () => {
    expect([5, 9]).toContain(lExpeditionSuivie(rare(), [expedition(9, 8, 12, 1_000), expedition(5, 9, 12, 1_000)])!.expeditionId);
    expect(lExpeditionSuivie(rare(), [expedition(9, 8, 12, 1_000), expedition(5, 9, 12, 1_000)])!.le).toEqual(h(10));
  });

  it("une Expédition partie avant l'apparition, ou arrivée après le départ de la Bête, ne l'emmène pas", () => {
    expect(lExpeditionSuivie(rare(), [expedition(1, 6, 10, 5_000), expedition(2, 16, 18, 5_000)])).toBeNull();
  });
});

describe("la force qui manque à l'escorte face à une Bête trop forte (US-0942)", () => {
  it("l'écart entre la force de la Bête et celle de l'escorte, quand elle est plus forte qu'elle", () => {
    expect(forceQuiManque(999, rare())).toBe(1);
    expect(forceQuiManque(473, rare({ rareteId: "peu_commune", force: 37_340 }))).toBe(36_867);
  });

  it("sans escorte, de force nulle, toute la force de la Bête", () => {
    expect(forceQuiManque(null, rare({ rareteId: "peu_commune", force: 37_340 }))).toBe(37_340);
  });

  it("aucune quand la Bête est à portée : escorte assez forte, ou Bête commune", () => {
    expect(forceQuiManque(1_000, rare())).toBe(0);
    expect(forceQuiManque(5_000, rare())).toBe(0);
    expect(forceQuiManque(null, rare({ rareteId: "commune", force: 23_029 }))).toBe(0);
    expect(forceQuiManque(1, rare({ rareteId: "commune", force: 23_029 }))).toBe(0);
  });
});

describe("des chances proportionnelles à la force (US-0963)", () => {
  /** Combien de Bêtes, numérotées de 0 à 9 999 sur la Case 1, suivent chaque Expédition de `expeditions`, toutes à la même heure. */
  const SIMULEES = 10_000;
  const parts = (bete: Partial<BeteDisputee>, expeditions: ExpeditionSurLaCase[]) => {
    const suivies = new Map<number | null, number>();
    for (let numero = 0; numero < SIMULEES; numero++) {
      const id = lExpeditionSuivie(rare({ ...bete, numero }), expeditions)?.expeditionId ?? null;
      suivies.set(id, (suivies.get(id) ?? 0) + 1);
    }
    return suivies;
  };
  /** La part de `n` sur les Bêtes simulées, en points de pourcentage. */
  const pourcent = (n: number | undefined) => (100 * (n ?? 0)) / SIMULEES;

  it("à portée de plusieurs Expéditions au même instant, une seule l'emporte, tirée au sort à chances proportionnelles à la force de chaque escorte", () => {
    const deux = parts({}, [expedition(1, 8, 14, 1_000), expedition(2, 8, 14, 3_000)]);
    expect([...deux.keys()].sort()).toEqual([1, 2]);
    expect(Math.abs(pourcent(deux.get(1)) - 25)).toBeLessThan(2);
    const trois = parts({}, [expedition(1, 8, 14, 3_000), expedition(2, 8, 14, 1_000), expedition(3, 8, 14, 2_000)]);
    expect(Math.abs(pourcent(trois.get(1)) - 50)).toBeLessThan(2);
    expect(Math.abs(pourcent(trois.get(2)) - 100 / 6)).toBeLessThan(2);
    expect(Math.abs(pourcent(trois.get(3)) - 100 / 3)).toBeLessThan(2);
  });

  it("une Expédition pour qui la Bête est trop forte ne participe pas au tirage, si forte soit-elle presque", () => {
    expect(parts({}, [expedition(1, 8, 14, 999), expedition(2, 8, 14, 1_000)])).toEqual(new Map([[2, SIMULEES]]));
    expect(parts({}, [expedition(1, 8, 14, 999), expedition(2, 8, 14, null)])).toEqual(new Map([[null, SIMULEES]]));
  });

  it("le tirage ne se fait qu'entre celles qui la voient au même instant : la première à l'avoir à portée l'emporte, sans tirage", () => {
    expect(parts({}, [expedition(1, 11, 14, 1_000), expedition(2, 9, 14, 1_000), expedition(3, 12, 14, 900_000)])).toEqual(new Map([[2, SIMULEES]]));
  });

  it("pour une Bête commune, une Expédition sans escorte n'a aucune chance face à une escortée ; entre Expéditions sans escorte, chacune a la même chance", () => {
    const commune = { rareteId: "commune", force: 473 };
    expect(parts(commune, [expedition(1, 8, 14, null), expedition(2, 8, 14, 473)])).toEqual(new Map([[2, SIMULEES]]));
    expect(parts(commune, [expedition(1, 8, 14, null), expedition(2, 8, 14, 473), expedition(3, 8, 14, null)])).toEqual(new Map([[2, SIMULEES]]));
    const deux = parts(commune, [expedition(1, 8, 14, null), expedition(2, 8, 14, null)]);
    expect(Math.abs(pourcent(deux.get(1)) - 50)).toBeLessThan(2);
    const trois = parts(commune, [expedition(1, 8, 14, null), expedition(2, 8, 14, null), expedition(3, 8, 14, null)]);
    for (const id of [1, 2, 3]) expect(Math.abs(pourcent(trois.get(id)) - 100 / 3), `${id}`).toBeLessThan(2);
  });

  it("une escorte sans force, faite d'Espèces sans arme, n'a pas plus de chance qu'aucune escorte", () => {
    const commune = { rareteId: "commune", force: 473 };
    const deux = parts(commune, [expedition(1, 8, 14, 0), expedition(2, 8, 14, null)]);
    expect(Math.abs(pourcent(deux.get(1)) - 50)).toBeLessThan(2);
    expect(parts(commune, [expedition(1, 8, 14, 0), expedition(2, 8, 14, 1)])).toEqual(new Map([[2, SIMULEES]]));
  });

  it("le tirage d'une Bête a lieu une fois pour toutes : le même résultat à chaque calcul, quel que soit l'ordre des Expéditions", () => {
    const expeditions = [expedition(4, 8, 14, 1_000), expedition(7, 9, 14, 2_000), expedition(2, 10, 14, 1_500)];
    for (let numero = 0; numero < 200; numero++) {
      const bete = rare({ numero, arrivee: h(10) });
      const suivie = lExpeditionSuivie(bete, expeditions);
      expect(lExpeditionSuivie(bete, [...expeditions].reverse())).toEqual(suivie);
      expect(lExpeditionSuivie(bete, [expeditions[1], expeditions[2], expeditions[0]])).toEqual(suivie);
      expect(lExpeditionSuivie({ ...bete }, expeditions)).toEqual(suivie);
    }
  });

  it("chaque Bête a son propre tirage : une Bête sauvage par sa Case et son numéro, une Bête de naissance par sa ligne", () => {
    const expeditions = [expedition(1, 8, 14, 1_000), expedition(2, 8, 14, 1_000)];
    const suivies = (betes: Partial<BeteDisputee>[]) => new Set(betes.map((b) => lExpeditionSuivie(rare(b), expeditions)!.expeditionId));
    expect(suivies(Array.from({ length: 20 }, (_, numero) => ({ numero })))).toEqual(new Set([1, 2]));
    expect(suivies(Array.from({ length: 20 }, (_, caseId) => ({ caseId })))).toEqual(new Set([1, 2]));
    expect(suivies(Array.from({ length: 20 }, (_, id) => ({ numero: null, beteDeNaissanceId: id + 1 })))).toEqual(new Set([1, 2]));
  });
});
