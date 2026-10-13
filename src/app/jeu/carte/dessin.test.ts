import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BROUILLARD, COULEURS } from "@/monde/couleurs-de-la-carte";
import { anneau, casesDesAnneaux, distance, SOMMETS_DE_CASE, voisines, type Coordonnees } from "@/monde/hex";
import { ZONE_COEUR, ZONE_COURONNE } from "@/monde/zones";
import { aLEcran, type CarteADessiner, dessinerLaCarte, enSvg, LARGEUR_DE_CASE, MOTIFS, tailleDuRepere, vueSurLeFoyer, type Peinture, type Pinceau, type Vue } from "./dessin";
import { bornesDuZoom, deplacer, limiteDeLaCarte, zoomer } from "./vue";

type Point = { x: number; y: number };
/**
 * Ce qu'un remplissage ou un trait a peint : sa couleur, son épaisseur, et ses tracés, chacun la liste de ses points.
 * US-0433 : pour un trait, ses tirets (vide s'il est plein), leur décalage, ses bouts, et l'opacité du pinceau.
 * US-0908 : pour un remplissage, sa règle (« nonzero » ou « evenodd ») ; et la façon dont il se pose sur ce qui est déjà
 * peint (« source-over » : par-dessus).
 */
type Peint = {
  geste: "remplir" | "border";
  couleur: string;
  epaisseur: number;
  traces: Point[][];
  tirets: number[];
  decalage: number;
  bouts: string;
  opacite: number;
  regle: string;
  composition: string;
};

/**
 * Un pinceau qui retient ce qu'on lui fait dessiner : chaque effacement, chaque remplissage ou trait avec ses
 * tracés, et chaque image posée avec la découpe (les tracés) qui la borne. Comme un <canvas>, restore() rend
 * l'opacité et les tirets d'avant save(), et ôte la découpe. US-0435 : il compte aussi les closePath, et ce que save()
 * a mis de côté sans que restore() l'ait rendu. US-0908 : restore() rend aussi la façon de poser.
 */
function pinceauDEssai() {
  const effacements: number[][] = [];
  const peints: Peint[] = [];
  const images: { image: unknown; valeurs: number[]; decoupe: Point[][] | null }[] = [];
  let traces: Point[][] = [];
  let decoupe: Point[][] | null = null;
  let tirets: number[] = [];
  const mis: { opacite: number; tirets: number[]; decalage: number; composition: GlobalCompositeOperation }[] = [];
  let fermetures = 0;
  const peint = (geste: Peint["geste"], couleur: unknown, regle = "nonzero") =>
    void peints.push({
      geste,
      couleur: String(couleur),
      epaisseur: pinceau.lineWidth,
      traces,
      tirets,
      decalage: pinceau.lineDashOffset,
      bouts: pinceau.lineCap,
      opacite: pinceau.globalAlpha,
      regle,
      composition: pinceau.globalCompositeOperation,
    });
  const pinceau: Pinceau = {
    save: () => void mis.push({ opacite: pinceau.globalAlpha, tirets, decalage: pinceau.lineDashOffset, composition: pinceau.globalCompositeOperation }),
    restore: () => {
      decoupe = null;
      const avant = mis.pop();
      if (avant) [pinceau.globalAlpha, tirets, pinceau.lineDashOffset, pinceau.globalCompositeOperation] = [avant.opacite, avant.tirets, avant.decalage, avant.composition];
    },
    clip: () => void (decoupe = traces),
    drawImage: (image: unknown, ...valeurs: number[]) => void images.push({ image, valeurs, decoupe }),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    lineDashOffset: 0,
    setLineDash: (valeurs) => void (tirets = [...valeurs]),
    clearRect: (...valeurs) => void effacements.push(valeurs),
    beginPath: () => void (traces = []),
    moveTo: (x, y) => void traces.push([{ x, y }]),
    lineTo: (x, y) => void traces.at(-1)!.push({ x, y }),
    quadraticCurveTo: (_, __, x, y) => void traces.at(-1)!.push({ x, y }),
    // Un rond : son centre, et le point de son bord où il commence.
    arc: (x, y, rayon) => void traces.at(-1)!.push({ x, y }, { x: x + rayon, y }),
    closePath: () => void fermetures++,
    fill: (regle?: CanvasFillRule | Path2D) => peint("remplir", pinceau.fillStyle, typeof regle === "string" ? regle : undefined),
    stroke: () => peint("border", pinceau.strokeStyle),
  } as Pinceau;
  return { pinceau, effacements, peints, images, fermetures: () => fermetures, misDeCote: () => mis.length };
}

/**
 * Des Cases en colonnes, comme la carte les reçoit du serveur, toutes de la teinte `teinte` des teintes données ;
 * US-0433 : hors de la Couronne et du Cœur sauvage, ou de la zone `zone`.
 */
const enColonnes = (cases: Coordonnees[], teinte: (c: Coordonnees) => number = () => 0, zone: (c: Coordonnees) => number = () => 0) => ({
  q: cases.map((c) => c.q),
  r: cases.map((c) => c.r),
  teinte: cases.map(teinte),
  zone: cases.map(zone),
});
/** Le milieu d'un tracé : la moyenne de ses sommets, chacun compté une fois (US-0435 : un bord repasse sur son premier côté). */
const milieu = (tous: Point[]) => {
  const points = [...new Map(tous.map((p) => [`${p.x},${p.y}`, p])).values()];
  return { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length };
};
const cle = (p: Point) => `${Math.round(p.x)},${Math.round(p.y)}`;
/** Des couleurs d'essai, nommées pour se reconnaître. */
const peinture = (fonds: string[]): Peinture => ({
  fonds,
  bord: "bord",
  motifSombre: "encre",
  motifClair: "ivoire",
  encre: "Encre",
  repere: "citron",
  surlignage: { voile: "voile crème", halo: "halo de cuivre", trait: "crème", anneau: "anneau de cuivre" },
});
/** Une teinte que la carte ne connaît pas : sans motif, pour regarder les hexagones seuls. */
const SANS_MOTIF = ["inconnue"];
/** Un Foyer loin de l'écran, sans autre Foyer : pour regarder les Cases seules. */
const FOYER_LOIN = { foyer: { q: 60, r: -30 }, foyers: [] };

describe("carte du Monde à l'ouverture (US-0417)", () => {
  const FOYER = { q: 31, r: -57 };

  it("place le Foyer au milieu de l'écran, ses voisines à une largeur de Case autour", () => {
    const vue = vueSurLeFoyer(FOYER, 1280, 720);
    expect(aLEcran(FOYER, vue)).toEqual({ x: 640, y: 360 });
    const est = aLEcran({ q: FOYER.q + 1, r: FOYER.r }, vue);
    expect(est.x - 640).toBeCloseTo(LARGEUR_DE_CASE, 9);
    expect(est.y).toBeCloseTo(360, 9);
    // Sur un téléphone aussi, au milieu de la place qu'on lui laisse.
    expect(aLEcran(FOYER, vueSurLeFoyer(FOYER, 375, 559))).toEqual({ x: 187.5, y: 279.5 });
  });

  it("dessine chaque Case en hexagone d'environ 28 px de large, pointe en haut, le Foyer au milieu", () => {
    const { pinceau, peints } = pinceauDEssai();
    const autour = casesDesAnneaux(0, 2).map((c) => ({ q: c.q + FOYER.q, r: c.r + FOYER.r }));
    dessinerLaCarte(pinceau, { ...FOYER_LOIN, teintes: SANS_MOTIF, cases: enColonnes(autour) }, vueSurLeFoyer(FOYER, 1280, 720), peinture(["blanc"]));
    const { traces } = peints[0];
    expect(traces).toHaveLength(autour.length);
    for (const trace of traces) {
      expect(trace).toHaveLength(6);
      const xs = trace.map((p) => p.x);
      const ys = trace.map((p) => p.y);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(LARGEUR_DE_CASE, 9);
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo((2 * LARGEUR_DE_CASE) / Math.sqrt(3), 9);
      // La pointe en haut : le premier sommet, au-dessus du milieu.
      expect(trace[0].x).toBeCloseTo(milieu(trace).x, 9);
      expect(trace[0].y).toBeLessThan(milieu(trace).y);
    }
    const auMilieu = traces.filter((t) => Math.abs(milieu(t).x - 640) < 1e-9 && Math.abs(milieu(t).y - 360) < 1e-9);
    expect(auMilieu).toHaveLength(1);
  });

  it("efface l'écran, remplit les Cases, puis trace leurs bords", () => {
    const { pinceau, effacements, peints } = pinceauDEssai();
    dessinerLaCarte(pinceau, { ...FOYER_LOIN, teintes: SANS_MOTIF, cases: enColonnes(casesDesAnneaux(0, 3)) }, vueSurLeFoyer({ q: 0, r: 0 }, 800, 600), peinture(["blanc"]));
    expect(effacements).toEqual([[0, 0, 800, 600]]);
    expect(peints.map((p) => `${p.geste} ${p.couleur}`)).toEqual(["remplir blanc", "border bord"]);
  });

  it("ne dessine que les Cases à l'écran ou qui le touchent : toutes sont là, sans en dessiner 10 981", () => {
    const { pinceau, peints } = pinceauDEssai();
    const monde = casesDesAnneaux(0, 60);
    const vue = vueSurLeFoyer(FOYER, 1280, 720);
    dessinerLaCarte(pinceau, { ...FOYER_LOIN, teintes: SANS_MOTIF, cases: enColonnes(monde) }, vue, peinture(["blanc"]));
    // Chaque Case dont un bout tombe dans l'écran est dessinée ; aucune qui en est loin.
    const touchent = monde.filter((c) => {
      const { x, y } = aLEcran(c, vue);
      return x > -LARGEUR_DE_CASE / 2 && x < 1280 + LARGEUR_DE_CASE / 2 && y > -vue.rayon && y < 720 + vue.rayon;
    });
    const dessinees = new Set(peints[0].traces.map((t) => cle(milieu(t))));
    for (const c of touchent) expect(dessinees).toContain(cle(aLEcran(c, vue)));
    expect(peints[0].traces.length).toBeLessThan(touchent.length * 1.2);
  });
});

describe("chaque Case selon son Biome (US-0418)", () => {
  const TEINTES = ["prairie", "foret", "jungle", "savane", "desert", "montagne", "toundra", "banquise", "cote", "lac", "riviere", "mer"];
  const vue = vueSurLeFoyer({ q: 0, r: 0 }, 800, 600);

  it("remplit chaque Case de la couleur de sa teinte, d'un seul geste par teinte", () => {
    const { pinceau, peints } = pinceauDEssai();
    const cases = casesDesAnneaux(0, 4);
    // Une Case sur deux en prairie, les autres en mer, selon leur q.
    const teinte = (c: Coordonnees) => Math.abs(c.q) % 2;
    dessinerLaCarte(pinceau, { ...FOYER_LOIN, teintes: ["prairie", "mer"], cases: enColonnes(cases, teinte) }, vue, peinture(["vert", "bleu"]));
    const fonds = peints.filter((p) => p.geste === "remplir" && ["vert", "bleu"].includes(p.couleur));
    expect(fonds.map((p) => p.couleur)).toEqual(["vert", "bleu"]);
    for (const [i, fond] of fonds.entries()) {
      expect(fond.traces.every((t) => t.length === 6)).toBe(true);
      expect(new Set(fond.traces.map((t) => cle(milieu(t))))).toEqual(new Set(cases.filter((c) => teinte(c) === i).map((c) => cle(aLEcran(c, vue)))));
    }
  });

  it("a un motif pour chacun des huit Biomes de terre et chacune des quatre eaux", () => {
    expect(Object.keys(MOTIFS).sort()).toEqual([...TEINTES].sort());
  });

  it("pose sur chaque Case, par-dessus sa couleur, le motif de sa teinte, au milieu de la Case : douze motifs différents", () => {
    const signatures = TEINTES.map((teinte) => {
      const { pinceau, peints } = pinceauDEssai();
      dessinerLaCarte(pinceau, { ...FOYER_LOIN, teintes: [teinte], cases: enColonnes([{ q: 0, r: 0 }]) }, vue, peinture(["fond"]));
      expect(peints[0]).toMatchObject({ geste: "remplir", couleur: "fond" });
      const motif = peints.slice(1, -1);
      expect(motif.length).toBeGreaterThan(0);
      for (const p of motif) {
        // Sombre sur les teintes claires, clair sur les sombres : jamais une autre couleur.
        expect(["encre", "ivoire"]).toContain(p.couleur);
        // Le motif reste dans sa Case, loin de ses bords.
        for (const point of p.traces.flat()) expect(Math.hypot(point.x - 400, point.y - 300)).toBeLessThan(0.62 * vue.rayon);
      }
      return JSON.stringify(motif.map((p) => [p.geste, p.couleur, p.traces.map((t) => t.map(cle))]));
    });
    expect(new Set(signatures).size).toBe(TEINTES.length);
  });

  it("met les motifs d'une même teinte d'un seul geste, à la même place dans chaque Case", () => {
    const { pinceau, peints } = pinceauDEssai();
    const cases = casesDesAnneaux(0, 1);
    dessinerLaCarte(pinceau, { ...FOYER_LOIN, teintes: ["foret"], cases: enColonnes(cases) }, vue, peinture(["vert"]));
    const motif = peints.slice(1, -1);
    expect(motif).toHaveLength(1);
    expect(motif[0].traces.length % cases.length).toBe(0);
  });

  it("trace par-dessus tout une légère bordure entre les Cases, d'un pixel", () => {
    const { pinceau, peints } = pinceauDEssai();
    const cases = casesDesAnneaux(0, 2);
    dessinerLaCarte(pinceau, { ...FOYER_LOIN, teintes: ["prairie", "foret"], cases: enColonnes(cases, (c) => (c.r > 0 ? 1 : 0)) }, vue, peinture(["vert", "sapin"]));
    const bord = peints.at(-1)!;
    expect(bord).toMatchObject({ geste: "border", couleur: "bord", epaisseur: 1 });
    expect(bord.traces.map((t) => cle(milieu(t))).sort()).toEqual(cases.map((c) => cle(aLEcran(c, vue))).sort());
    // US-0435 : chacune tout autour, ses six sommets, puis à nouveau son premier côté : son bord est refermé.
    for (const t of bord.traces) {
      expect(new Set(t.map(cle)).size).toBe(6);
      expect(t.slice(6)).toEqual(t.slice(0, 2));
    }
  });
});

describe("son Foyer sur la carte (US-0419)", () => {
  const FOYER = { q: -47, r: 56 };
  const VOISINS = [
    { q: -43, r: 55 },
    { q: -50, r: 57 },
  ];
  const vue = vueSurLeFoyer(FOYER, 800, 600);
  const autour = casesDesAnneaux(0, 6).map((c) => ({ q: c.q + FOYER.q, r: c.r + FOYER.r }));
  const carte = { teintes: ["prairie"], cases: enColonnes(autour), foyer: FOYER, foyers: VOISINS };
  /** L'illustration de la hutte, telle que le navigateur l'a chargée : 384 × 256 pixels. */
  const HUTTE = { image: "hutte" as unknown as CanvasImageSource, largeur: 384, hauteur: 256 };
  const hexagones = (p: Peint) => p.traces.every((t) => t.length === 6);

  it("montre sur la Case du Foyer l'illustration de la hutte du chef, découpée à la forme de la Case", () => {
    const { pinceau, images } = pinceauDEssai();
    dessinerLaCarte(pinceau, carte, vue, peinture(["vert"]), HUTTE);
    expect(images).toHaveLength(1);
    const [{ image, valeurs, decoupe }] = images;
    expect(image).toBe("hutte");
    // Découpée à l'hexagone du Foyer, au milieu de l'écran.
    expect(decoupe).toHaveLength(1);
    expect(decoupe![0]).toHaveLength(6);
    expect(cle(milieu(decoupe![0]))).toBe("400,300");
    // Posée sur toute la Case : un rectangle de sa largeur et de sa hauteur, autour de son centre…
    const [sx, sy, sl, sh, x, y, l, h] = valeurs;
    expect(x + l / 2).toBeCloseTo(400, 9);
    expect(y + h / 2).toBeCloseTo(300, 9);
    expect(l).toBeCloseTo(LARGEUR_DE_CASE, 9);
    expect(h).toBeCloseTo(2 * vue.rayon, 9);
    // … recadrée dans l'image autour de la hutte, aux proportions de la Case : rien d'étiré.
    expect(sx).toBeGreaterThan(0);
    expect(sy).toBeGreaterThanOrEqual(0);
    expect(sx + sl).toBeLessThan(384);
    expect(sy + sh).toBeLessThanOrEqual(256);
    expect(sl / sh).toBeCloseTo(l / h, 9);
  });

  it("marque son Foyer d'un repère citron cerné d'Encre, la pointe sur la Case et la tête au-dessus, par-dessus tout", () => {
    const { pinceau, peints } = pinceauDEssai();
    dessinerLaCarte(pinceau, carte, vue, peinture(["vert"]), HUTTE);
    expect(peints.slice(-3).map((p) => `${p.geste} ${p.couleur}`)).toEqual(["remplir citron", "border Encre", "remplir Encre"]);
    const [repere, contour, oeil] = peints.slice(-3);
    expect(contour.traces).toBe(repere.traces);
    const points = repere.traces.flat();
    // La pointe dans la Case du Foyer, la tête au-dessus de la Case ; l'œil d'Encre au milieu de la tête.
    expect(points.some((p) => Math.hypot(p.x - 400, p.y - 300) < 0.6 * vue.rayon)).toBe(true);
    expect(Math.min(...points.map((p) => p.y))).toBeLessThan(300 - vue.rayon);
    expect(oeil.traces.flat().every((p) => Math.abs(p.x - 400) < tailleDuRepere(vue.rayon))).toBe(true);
    // La Case du Foyer est cernée d'Encre, sous le repère.
    expect(peints.filter((p) => p.geste === "border" && p.couleur === "Encre" && hexagones(p)).map((p) => p.traces.map((t) => cle(milieu(t))))).toEqual([["400,300"]]);
  });

  it("marque son Foyer même avant que la hutte soit chargée", () => {
    const { pinceau, peints, images } = pinceauDEssai();
    dessinerLaCarte(pinceau, carte, vue, peinture(["vert"]), null);
    expect(images).toEqual([]);
    expect(peints.filter((p) => p.couleur === "citron")).toHaveLength(1);
  });

  it("grossit le repère par rapport aux Cases quand elles rapetissent, jamais sous 9 pixels, pour le voir à tout zoom", () => {
    const rayons = [40, 16, 8, 4, 2];
    for (const rayon of rayons) expect(tailleDuRepere(rayon)).toBeGreaterThanOrEqual(9);
    const parCase = rayons.map((rayon) => tailleDuRepere(rayon) / rayon);
    for (let i = 1; i < parCase.length; i++) expect(parCase[i]).toBeGreaterThan(parCase[i - 1]);
    // Avec de grandes Cases, il grandit avec elles.
    expect(tailleDuRepere(40)).toBeGreaterThan(tailleDuRepere(16));
    // Sur une carte vue de loin, des Cases de 3 pixels de rayon : le repère en couvre plusieurs.
    const { pinceau, peints } = pinceauDEssai();
    dessinerLaCarte(pinceau, carte, { ...vue, rayon: 3 }, peinture(["vert"]), HUTTE);
    const ys = peints.find((p) => p.couleur === "citron")!.traces.flat().map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(4 * 3);
  });

  it("marque les Foyers des autres joueurs d'un petit hexagone d'Encre, sans hutte ni repère : ils ne se confondent pas avec le sien", () => {
    const { pinceau, peints, images } = pinceauDEssai();
    dessinerLaCarte(pinceau, carte, vue, peinture(["vert"]), HUTTE);
    const autres = peints.filter((p) => p.geste === "remplir" && p.couleur === "Encre" && hexagones(p));
    expect(autres).toHaveLength(1);
    expect(autres[0].traces.map((t) => cle(milieu(t))).sort()).toEqual(VOISINS.map((c) => cle(aLEcran(c, vue))).sort());
    for (const t of autres[0].traces) expect(Math.max(...t.map((p) => p.x)) - Math.min(...t.map((p) => p.x))).toBeLessThan(LARGEUR_DE_CASE / 2);
    // La hutte et le repère ne vont qu'au Foyer du joueur.
    expect(images.map((i) => cle(milieu(i.decoupe![0])))).toEqual(["400,300"]);
    expect(peints.filter((p) => p.couleur === "citron")).toHaveLength(1);
  });

  it("ne marque pas un Foyer loin de l'écran", () => {
    const { pinceau, peints, images } = pinceauDEssai();
    dessinerLaCarte(pinceau, carte, vueSurLeFoyer({ q: 0, r: 0 }, 800, 600), peinture(["vert"]), HUTTE);
    expect(images).toEqual([]);
    expect(peints.filter((p) => ["citron", "Encre"].includes(p.couleur))).toEqual([]);
  });
});

describe("couleurs des Biomes sur la carte (US-0418)", () => {
  /** Chaque couleur oklch de la palette, par son nom : [clarté, chroma, teinte en degrés]. */
  const palette = new Map(
    [...readFileSync(join(process.cwd(), "src/styles/palette.css"), "utf8").matchAll(/(--[\w-]+): oklch\(([\d.]+) ([\d.]+) ([\d.]+)\);/g)].map(([, nom, l, c, h]) => [
      nom,
      [Number(l), Number(c), Number(h)],
    ]),
  );
  /** La couleur d'une teinte sur la carte, celle de la page de contrôle du Monde, en coordonnées OKLab. */
  const oklab = (teinte: string) => {
    const [l, c, h] = palette.get(COULEURS[teinte].match(/var\((--[\w-]+)\)/)![1])!;
    return [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
  };

  it("donne à chaque teinte une couleur qui se distingue d'un coup d'œil de toutes les autres", () => {
    const teintes = Object.keys(MOTIFS);
    for (const [i, a] of teintes.entries()) {
      for (const b of teintes.slice(i + 1)) {
        const ecart = Math.hypot(...oklab(a).map((v, k) => v - oklab(b)[k]));
        expect(ecart, `${a} et ${b}`).toBeGreaterThanOrEqual(0.07);
      }
    }
  });

  it("donne au brouillard un neutre de la palette, qui se distingue de chaque teinte et du fond de la page au-delà du Monde (US-0437)", () => {
    const [, chroma] = palette.get(COULEURS[BROUILLARD].match(/var\((--[\w-]+)\)/)![1])!;
    expect(chroma).toBeLessThanOrEqual(0.02);
    for (const teinte of Object.keys(MOTIFS)) {
      expect(Math.hypot(...oklab(BROUILLARD).map((v, k) => v - oklab(teinte)[k])), teinte).toBeGreaterThanOrEqual(0.07);
    }
    const [l, c, h] = palette.get("--fond")!;
    const fond = [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
    expect(Math.hypot(...oklab(BROUILLARD).map((v, k) => v - fond[k]))).toBeGreaterThanOrEqual(0.07);
  });
});

describe("le brouillard (US-0437)", () => {
  const vue = vueSurLeFoyer({ q: 0, r: 0 }, 800, 600);
  // Un petit Monde de 4 Cases de rayon : découvert jusqu'à 2 Cases du milieu, sous le brouillard au-delà.
  const monde = casesDesAnneaux(0, 4);
  const decouverte = (c: Coordonnees) => anneau(c) <= 2;
  // Les teintes de la carte : la prairie, la forêt, puis le brouillard.
  const TEINTES = ["prairie", "foret", BROUILLARD];
  const teinteDe = (c: Coordonnees) => (!decouverte(c) ? 2 : c.q > 0 ? 1 : 0);
  const FONDS = ["vert", "sapin", "brume"];
  /** La carte : sa Couronne sur les deux derniers anneaux, sous le brouillard, et le premier qui y touche, découvert. */
  const zoneDe = (c: Coordonnees) => (anneau(c) >= 2 ? ZONE_COURONNE : 0);
  const carte = { ...FOYER_LOIN, teintes: TEINTES, cases: enColonnes(monde, teinteDe, zoneDe) };
  const auCentre = (cases: Coordonnees[]) => cases.map((c) => cle(aLEcran(c, vue))).sort();
  const centres = (p: Peint) => p.traces.map((t) => cle(milieu(t))).sort();

  it("peint toutes les Cases sous le brouillard d'une seule teinte unie, d'un seul geste, sans motif ni bord entre elles", () => {
    const { pinceau, peints } = pinceauDEssai();
    dessinerLaCarte(pinceau, carte, vue, peinture(FONDS));
    const brume = peints.filter((p) => p.couleur === "brume");
    expect(brume).toHaveLength(1);
    expect(brume[0].geste).toBe("remplir");
    expect(centres(brume[0])).toEqual(auCentre(monde.filter((c) => !decouverte(c))));
    // Aucun motif ni aucun bord ne touche une Case sous le brouillard : rien que les Cases découvertes.
    const cachees = new Set(auCentre(monde.filter((c) => !decouverte(c))));
    const bord = peints.find((p) => p.couleur === "bord")!;
    expect(centres(bord)).toEqual(auCentre(monde.filter(decouverte)));
    for (const motif of peints.filter((p) => ["encre", "ivoire"].includes(p.couleur))) {
      for (const point of motif.traces.flat()) {
        const [proche] = monde.map((c) => ({ c, d: Math.hypot(point.x - aLEcran(c, vue).x, point.y - aLEcran(c, vue).y) })).sort((a, b) => a.d - b.d);
        expect(cachees.has(cle(aLEcran(proche.c, vue)))).toBe(false);
      }
    }
  });

  it("ne trace aucun liseré sous le brouillard ni à son bord : seulement entre deux Cases découvertes", () => {
    const { pinceau, peints } = pinceauDEssai();
    dessinerLaCarte(pinceau, carte, vue, peinture(FONDS));
    const [couronne, ...autres] = peints.filter((p) => p.tirets.length > 0);
    expect(autres).toEqual([]);
    // Entre l'anneau 1, découvert, et l'anneau 2, découvert et de la Couronne : ses 6 × 3 côtés, et rien au-delà.
    const attendus = monde
      .filter((c) => anneau(c) === 2)
      .flatMap((c) => voisines(c).filter((v) => anneau(v) === 1).map((v) => [aLEcran(c, vue), aLEcran(v, vue)]))
      .map(([a, b]) => cle({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }))
      .sort();
    expect(couronne.traces.map((t) => cle(milieu(t))).sort()).toEqual(attendus);
    expect(attendus).toHaveLength(6 * 3);
  });

  it("ne laisse rien deviner de ce qu'il cache : sa zone et un Foyer dessous ne changent rien au dessin", () => {
    const sous = { q: 4, r: -1 };
    const montre = pinceauDEssai();
    dessinerLaCarte(montre.pinceau, { ...carte, foyers: [sous], cases: enColonnes(monde, teinteDe, (c) => (decouverte(c) ? zoneDe(c) : anneau(c) === 4 ? ZONE_COEUR : 0)) }, vue, peinture(FONDS));
    const cache = pinceauDEssai();
    dessinerLaCarte(cache.pinceau, { ...carte, cases: enColonnes(monde, teinteDe, (c) => (decouverte(c) ? zoneDe(c) : 0)) }, vue, peinture(FONDS));
    expect(montre.peints).toEqual(cache.peints);
    // Un Foyer d'un autre chef sur une Case découverte, lui, se voit.
    const voisin = pinceauDEssai();
    dessinerLaCarte(voisin.pinceau, { ...carte, foyers: [sous, { q: 1, r: 0 }] }, vue, peinture(FONDS));
    expect(voisin.peints.filter((p) => p.couleur === "Encre" && p.geste === "remplir").map(centres)).toEqual([auCentre([{ q: 1, r: 0 }])]);
  });
});

describe("la carte écrite en SVG, pour sa légende (US-0432)", () => {
  /** Une vue de la carte centrée sur la Case (0, 0), posée en (0, 0) : rien d'autre n'y touche. */
  const vue = vueSurLeFoyer({ q: 0, r: 0 }, 0, 0);
  /** Les nombres d'un chemin SVG, dans l'ordre. */
  const nombres = (d: string) => [...d.matchAll(/-?[\d.]+/g)].map(([n]) => Number(n));

  it("écrit chaque remplissage et chaque trait de la carte en chemin SVG, de sa couleur, dans l'ordre où la carte les peint", () => {
    const { traits } = enSvg((p) => dessinerLaCarte(p, { ...FOYER_LOIN, teintes: ["foret"], cases: enColonnes([{ q: 0, r: 0 }]) }, vue, peinture(["vert"])));
    expect(traits.map((t) => `${t.geste} ${t.couleur}`)).toEqual(["remplir vert", "remplir encre", "tracer bord"]);
    // L'hexagone de la Case : six sommets autour de son centre, la pointe en haut ; son bord suit le même chemin, et
    // US-0435 : repasse sur son premier côté pour se refermer, quand le remplissage se referme de lui-même.
    const [fond, , bord] = traits;
    expect(fond.d).toMatch(/^M[^A-Z]+(L[^A-Z]+){5}$/);
    const sommets = nombres(fond.d);
    for (let i = 0; i < 12; i += 2) expect(Math.hypot(sommets[i], sommets[i + 1])).toBeCloseTo(vue.rayon, 2);
    expect(sommets.slice(0, 2).map((n) => Math.round(n))).toEqual([0, -Math.round(vue.rayon)]);
    const [premier, second] = fond.d.slice(1).split("L");
    expect(bord).toMatchObject({ d: `${fond.d}L${premier}L${second}`, epaisseur: 1 });
  });

  it("écrit les ronds en arcs, et garde les bouts et les jointures arrondis des motifs", () => {
    const { traits } = enSvg((p) => {
      p.beginPath();
      p.moveTo(10, 0);
      p.arc(0, 0, 10, 0, 2 * Math.PI);
      p.lineCap = "round";
      p.lineJoin = "round";
      p.lineWidth = 2;
      p.strokeStyle = "ivoire";
      p.stroke();
    });
    expect(traits).toHaveLength(1);
    expect(traits[0]).toMatchObject({ geste: "tracer", couleur: "ivoire", epaisseur: 2, bouts: "round", jointures: "round" });
    // Un tour entier en quarts de cercle, dans le sens des aiguilles d'une montre : chacun finit sur le cercle.
    const arcs = [...traits[0].d.matchAll(/A([^A-Z]+)/g)].map(([, a]) => nombres(a));
    expect(arcs).toHaveLength(4);
    for (const [rx, ry, rotation, grand, sens, x, y] of arcs) {
      expect([rx, ry, rotation, grand, sens]).toEqual([10, 10, 0, 0, 1]);
      expect(Math.hypot(x, y)).toBeCloseTo(10, 2);
    }
    expect(arcs.at(-1)!.slice(5)).toEqual([10, 0]);
  });

  it("donne le cadre de tout ce qui est dessiné, traits compris", () => {
    const { cadre } = enSvg((p) => dessinerLaCarte(p, { ...FOYER_LOIN, teintes: SANS_MOTIF, cases: enColonnes([{ q: 0, r: 0 }]) }, vue, peinture(["blanc"])));
    // L'hexagone, LARGEUR_DE_CASE de large et deux rayons de haut, et la moitié de son bord d'un pixel tout autour.
    expect(cadre.x).toBeCloseTo(-LARGEUR_DE_CASE / 2 - 0.5, 9);
    expect(cadre.y).toBeCloseTo(-vue.rayon - 0.5, 9);
    expect(cadre.largeur).toBeCloseTo(LARGEUR_DE_CASE + 1, 9);
    expect(cadre.hauteur).toBeCloseTo(2 * vue.rayon + 1, 9);
  });

  it("met dans le cadre le repère du Foyer, dont la tête dépasse au-dessus de sa Case", () => {
    const carte = { teintes: ["prairie"], cases: enColonnes([{ q: 0, r: 0 }]), foyer: { q: 0, r: 0 }, foyers: [] };
    const { traits, cadre } = enSvg((p) => dessinerLaCarte(p, carte, vue, peinture(["vert"])));
    expect(traits.slice(-3).map((t) => `${t.geste} ${t.couleur}`)).toEqual(["remplir citron", "tracer Encre", "remplir Encre"]);
    // La tête du repère, d'au moins sa taille au-dessus de la pointe de la Case, est dans le cadre.
    expect(cadre.y).toBeLessThan(-vue.rayon - tailleDuRepere(vue.rayon));
    expect(cadre.y + cadre.hauteur).toBeGreaterThan(vue.rayon);
  });

  it("écrit les tirets d'un trait, leur décalage et l'opacité du pinceau, que restore() rend comme avant save() (US-0433)", () => {
    const { traits } = enSvg((p) => {
      const trait = () => {
        p.beginPath();
        p.moveTo(0, 0);
        p.lineTo(10, 0);
        p.stroke();
      };
      p.save();
      p.globalAlpha = 0.5;
      p.setLineDash([3, 2]);
      p.lineDashOffset = 4;
      trait();
      p.restore();
      trait();
    });
    expect(traits.map(({ tirets, decalage, opacite }) => ({ tirets, decalage, opacite }))).toEqual([
      { tirets: [3, 2], decalage: 4, opacite: 0.5 },
      { tirets: [], decalage: 0, opacite: 1 },
    ]);
  });
});

describe("les limites de la Couronne et du Cœur sauvage (US-0433)", () => {
  const vue = vueSurLeFoyer({ q: 0, r: 0 }, 800, 600);
  // Un petit Monde de 4 Cases de rayon : son Cœur sauvage à moins de 2 Cases du milieu, sa Couronne sur le dernier anneau.
  const monde = casesDesAnneaux(0, 4);
  const zoneDe = (c: Coordonnees) => (anneau(c) < 2 ? ZONE_COEUR : anneau(c) === 4 ? ZONE_COURONNE : 0);
  const carte = { ...FOYER_LOIN, teintes: ["prairie"], cases: enColonnes(monde, () => 0, zoneDe) };
  /** Les liserés : les traits en tirets. */
  const liseres = (peints: Peint[]) => peints.filter((p) => p.tirets.length > 0);
  /** Le milieu, à l'écran, de chaque côté entre une Case de `zone` et une voisine de la carte qui n'en est pas. */
  const cotes = (zone: number, v = vue) =>
    monde
      .filter((c) => zoneDe(c) === zone)
      .flatMap((c) => voisines(c).filter((voisine) => anneau(voisine) <= 4 && zoneDe(voisine) !== zone).map((voisine) => [aLEcran(c, v), aLEcran(voisine, v)]))
      .map(([a, b]) => cle({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }))
      .sort();

  it("trace un liseré sur chaque côté entre une Case de la Couronne et une Case qui n'en est pas, et un autre pour le Cœur sauvage", () => {
    const { pinceau, peints } = pinceauDEssai();
    dessinerLaCarte(pinceau, carte, vue, peinture(["vert"]));
    expect(liseres(peints)).toHaveLength(2);
    const [couronne, coeur] = liseres(peints);
    // Chaque côté d'un seul trait, d'un sommet de sa Case au suivant : la longueur d'un côté est le rayon d'une Case.
    for (const trait of [...couronne.traces, ...coeur.traces]) {
      expect(trait).toHaveLength(2);
      expect(Math.hypot(trait[1].x - trait[0].x, trait[1].y - trait[0].y)).toBeCloseTo(vue.rayon, 9);
    }
    expect(couronne.traces.map((t) => cle(milieu(t))).sort()).toEqual(cotes(ZONE_COURONNE));
    expect(coeur.traces.map((t) => cle(milieu(t))).sort()).toEqual(cotes(ZONE_COEUR));
    // Entre les anneaux 3 et 4, et entre les anneaux 1 et 2 : rien au bord de la carte, au-delà duquel il n'y a plus de Case.
    expect(couronne.traces).toHaveLength(6 * 7);
    expect(coeur.traces).toHaveLength(6 * 3);
  });

  it("ne cache pas les Biomes : un trait fin et à demi transparent, posé sur le bord des Cases après leur couleur et leur motif", () => {
    const { pinceau, peints } = pinceauDEssai();
    dessinerLaCarte(pinceau, carte, vue, peinture(["vert"]));
    const premier = peints.findIndex((p) => p.tirets.length > 0);
    expect(peints.slice(0, premier).map((p) => p.couleur)).toEqual(["vert", "encre", "bord"]);
    for (const lisere of liseres(peints)) {
      expect(lisere).toMatchObject({ geste: "border", couleur: "Encre" });
      expect(lisere.epaisseur).toBeLessThanOrEqual(2.5);
      expect(lisere.opacite).toBeLessThan(1);
    }
    // Le pinceau retrouve ensuite son opacité et ses traits pleins.
    expect(pinceau.globalAlpha).toBe(1);
    expect(pinceau.lineDashOffset).toBe(0);
  });

  it("distingue les deux limites : des tirets pour la Couronne, des points ronds pour le Cœur sauvage", () => {
    const { pinceau, peints } = pinceauDEssai();
    dessinerLaCarte(pinceau, carte, vue, peinture(["vert"]));
    const [couronne, coeur] = liseres(peints);
    expect(couronne.tirets[0]).toBeGreaterThan(2 * couronne.epaisseur);
    expect(coeur.tirets[0]).toBeLessThan(0.1);
    expect(coeur.bouts).toBe("round");
  });

  it("garde le même rythme d'un côté à l'autre, à toute taille de Case : chaque côté commence et finit au milieu d'un vide", () => {
    for (const rayon of [vue.rayon, 8, 3, 30]) {
      const { pinceau, peints } = pinceauDEssai();
      dessinerLaCarte(pinceau, carte, { ...vue, rayon }, peinture(["vert"]));
      expect(liseres(peints)).toHaveLength(2);
      for (const { tirets, decalage } of liseres(peints)) {
        const [plein, vide] = tirets;
        // Un nombre entier de motifs (un trait, un vide) par côté…
        const motifs = rayon / (plein + vide);
        expect(motifs).toBeGreaterThanOrEqual(1);
        expect(motifs).toBeCloseTo(Math.round(motifs), 9);
        // … et chaque côté commence au milieu d'un vide.
        expect(decalage).toBeCloseTo(plein + vide / 2, 9);
      }
    }
  });

  it("ne trace aucune limite sur une carte sans Couronne ni Cœur sauvage, ni loin de l'écran", () => {
    const sansZone = pinceauDEssai();
    dessinerLaCarte(sansZone.pinceau, { ...carte, cases: enColonnes(monde) }, vue, peinture(["vert"]));
    expect(liseres(sansZone.peints)).toEqual([]);
    const loin = pinceauDEssai();
    dessinerLaCarte(loin.pinceau, carte, vueSurLeFoyer({ q: 60, r: -30 }, 800, 600), peinture(["vert"]));
    expect(liseres(loin.peints)).toEqual([]);
  });
});

describe("la Case choisie, surlignée (US-0428)", () => {
  const FOYER = { q: -47, r: 56 };
  const vue = vueSurLeFoyer(FOYER, 800, 600);
  const autour = casesDesAnneaux(0, 6).map((c) => ({ q: c.q + FOYER.q, r: c.r + FOYER.r }));
  const carte = { teintes: ["prairie"], cases: enColonnes(autour), foyer: FOYER, foyers: [{ q: -43, r: 55 }] };
  const HUTTE = { image: "hutte" as unknown as CanvasImageSource, largeur: 384, hauteur: 256 };
  /** Les traits qui cernent la seule Case c : un hexagone autour de son centre. */
  const cernent = (peints: Peint[], c: Coordonnees) =>
    peints.filter((p) => p.geste === "border" && p.traces.length === 1 && p.traces[0].length === 6 && cle(milieu(p.traces[0])) === cle(aLEcran(c, vue)));

  it("cerne la Case choisie d'un trait crème sur un halo de cuivre, plus épais que tout autre trait de la carte, sous un voile crème, dans un anneau de tirets", () => {
    const choisie = { q: FOYER.q + 2, r: FOYER.r - 1 };
    const { pinceau, peints } = pinceauDEssai();
    dessinerLaCarte(pinceau, carte, vue, peinture(["vert"]), HUTTE, choisie);
    const [anneau, halo, trait] = cernent(peints, choisie);
    expect([anneau.couleur, halo.couleur, trait.couleur]).toEqual(["anneau de cuivre", "halo de cuivre", "crème"]);
    expect(halo.traces).toBe(trait.traces);
    expect(halo.epaisseur).toBeGreaterThan(trait.epaisseur);
    expect(trait.epaisseur).toBeGreaterThan(Math.max(...peints.filter((p) => p.geste === "border" && p !== halo && p !== trait).map((p) => p.epaisseur)));
    // La Case elle-même sous un voile crème.
    expect(peints.find((p) => p.geste === "remplir" && p.couleur === "voile crème")!.traces).toBe(halo.traces);
    // Sur le bord même de la Case : son premier sommet est sa pointe du haut ; l'anneau, en tirets, un peu au-dessus.
    const { x, y } = aLEcran(choisie, vue);
    expect(cle(halo.traces[0][0])).toBe(cle({ x, y: y - vue.rayon }));
    expect(anneau.tirets).toHaveLength(2);
    expect(anneau.traces[0][0].y).toBeLessThan(y - vue.rayon);
  });

  it("surligne le Foyer choisi par-dessus sa hutte et son contour, sous son repère", () => {
    const { pinceau, peints } = pinceauDEssai();
    dessinerLaCarte(pinceau, carte, vue, peinture(["vert"]), HUTTE, FOYER);
    expect(cernent(peints, FOYER).map((p) => p.couleur)).toEqual(["Encre", "anneau de cuivre", "halo de cuivre", "crème"]);
    expect(peints.slice(-7).map((p) => `${p.geste} ${p.couleur}`)).toEqual([
      "border anneau de cuivre",
      "remplir voile crème",
      "border halo de cuivre",
      "border crème",
      "remplir citron",
      "border Encre",
      "remplir Encre",
    ]);
  });

  it("ne surligne rien sans Case choisie, ni une Case loin de l'écran", () => {
    const sans = pinceauDEssai();
    dessinerLaCarte(sans.pinceau, carte, vue, peinture(["vert"]), HUTTE);
    const loin = pinceauDEssai();
    dessinerLaCarte(loin.pinceau, carte, vue, peinture(["vert"]), HUTTE, { q: 0, r: 0 });
    expect(loin.peints).toEqual(sans.peints);
    expect(sans.peints.filter((p) => p.geste === "border" && p.couleur === "crème")).toEqual([]);
  });
});

describe("une carte fluide sur mobile (US-0435)", () => {
  // Le téléphone de référence : 390 × 844 pixels, la carte sous la barre du haut, sur 688 pixels de haut.
  const [LARGEUR, HAUTEUR] = [390, 688];
  const MONDE = casesDesAnneaux(0, 60);
  const TEINTES = [...Object.keys(MOTIFS), BROUILLARD];
  /** Un Monde de toutes les teintes, la Couronne sur ses anneaux 50 à 52, le brouillard au-delà du 55e ; deux Foyers au milieu. */
  const carte = (cases: Coordonnees[]): CarteADessiner => ({
    teintes: TEINTES,
    cases: enColonnes(
      cases,
      (c) => (anneau(c) > 55 ? TEINTES.length - 1 : Math.abs(7 * c.q + c.r) % (TEINTES.length - 1)),
      (c) => (anneau(c) >= 50 && anneau(c) <= 52 ? ZONE_COURONNE : 0),
    ),
    foyer: { q: 0, r: 0 },
    foyers: [{ q: 2, r: -1 }],
  });
  const HUTTE = { image: "hutte" as unknown as CanvasImageSource, largeur: 384, hauteur: 256 };
  /** La vue dézoomée au maximum sur ce téléphone, sur la Case `milieu`. */
  const dezoomee = (milieu: Coordonnees): Vue => ({ ...vueSurLeFoyer(milieu, LARGEUR, HAUTEUR), rayon: bornesDuZoom(LARGEUR, HAUTEUR).min });

  it("ne referme aucune Case par closePath, qui coûte dans Chrome d'autant plus que le tracé en cours est long : pas un de plus pour tout le Monde que pour une seule Case", () => {
    const fermetures = (cases: Coordonnees[]) => {
      const essai = pinceauDEssai();
      dessinerLaCarte(essai.pinceau, carte(cases), dezoomee({ q: 0, r: 0 }), peinture(TEINTES), HUTTE, { q: 1, r: 0 });
      return essai.fermetures();
    };
    expect(fermetures(MONDE)).toBe(fermetures([{ q: 0, r: 0 }]));
  });

  it("dézoomée au maximum, ne dessine encore que les Cases à l'écran, et un peu autour : à moins d'une Case de son bord", () => {
    const vue = dezoomee({ q: 0, r: 0 });
    const { pinceau, peints } = pinceauDEssai();
    dessinerLaCarte(pinceau, { ...FOYER_LOIN, teintes: SANS_MOTIF, cases: enColonnes(MONDE) }, vue, peinture(["blanc"]));
    const dessinees = new Set(peints[0].traces.map((t) => cle(milieu(t))));
    const centres = MONDE.map((c) => aLEcran(c, vue));
    // Toutes celles dont un bout touche l'écran…
    const demiLargeur = (Math.sqrt(3) / 2) * vue.rayon;
    const touchent = centres.filter(({ x, y }) => x > -demiLargeur && x < LARGEUR + demiLargeur && y > -vue.rayon && y < HAUTEUR + vue.rayon);
    expect(touchent.map(cle).filter((ici) => !dessinees.has(ici))).toEqual([]);
    // … et aucune plus loin qu'une Case : le Monde, plus large que ce téléphone, n'est pas dessiné en entier.
    const autour = new Set(centres.filter(({ x, y }) => x > -2 * vue.rayon && x < LARGEUR + 2 * vue.rayon && y > -2 * vue.rayon && y < HAUTEUR + 2 * vue.rayon).map(cle));
    expect([...dessinees].filter((ici) => !autour.has(ici))).toEqual([]);
    expect(dessinees.size).toBeLessThan(MONDE.length);
  });

  it("ne garde rien d'une image à l'autre : après des milliers d'images, glissée et zoomée, la même vue se redessine des mêmes gestes", () => {
    const monde = carte(casesDesAnneaux(0, 30));
    const limite = limiteDeLaCarte(monde);
    const depart = vueSurLeFoyer({ q: 0, r: 0 }, LARGEUR, HAUTEUR);
    const { pinceau, peints, images, misDeCote } = pinceauDEssai();
    const dessiner = (vue: Vue) => dessinerLaCarte(pinceau, monde, vue, peinture(TEINTES), HUTTE, { q: 1, r: 0 });
    dessiner(depart);
    const premiere = peints.splice(0);
    let vue = depart;
    for (let i = 0; i < 2000; i++) {
      // Une image sur quatre zoome, tantôt en éloignant, tantôt en rapprochant ; les autres glissent, en tournant.
      const facteur = i % 8 === 0 ? 1 / 1.2 : 1.2;
      if (i % 4 === 0) vue = zoomer(vue, facteur, 100, 300, limite);
      else vue = deplacer(vue, 9 * Math.cos(i / 40), 9 * Math.sin(i / 40), limite);
      dessiner(vue);
      peints.length = 0;
      images.length = 0;
    }
    dessiner(depart);
    // Ce qui se voit : d'un remplissage, sa couleur, son opacité et ses tracés (l'épaisseur et les bouts du trait n'y font rien).
    const vu = ({ geste, couleur, opacite, traces, ...trait }: Peint) => ({ geste, couleur, opacite, traces, ...(geste === "border" ? trait : {}) });
    expect(peints.map(vu)).toEqual(premiere.map(vu));
    // Rien de mis de côté par save() qui n'ait été rendu par restore() : le pinceau ne s'alourdit pas.
    expect(misDeCote()).toBe(0);
  });
});

describe("la portée d'exploration, en choisissant la destination (US-0908)", () => {
  // Un Foyer près du bord d'un Monde de 60 Cases de rayon : sa portée en déborde.
  const FOYER = { q: -20, r: 57 };
  const PORTEE = { cases: 8, voile: "grisé" };
  const vue = vueSurLeFoyer(FOYER, 800, 600);
  /** Les Cases du Monde à 12 Cases du Foyer ou moins. */
  const autour = casesDesAnneaux(0, 12)
    .map((c) => ({ q: c.q + FOYER.q, r: c.r + FOYER.r }))
    .filter((c) => anneau(c) <= 60);
  /** Ses abords découverts, en prairie et en forêt, la Couronne sur le bord du Monde ; le brouillard au-delà. */
  const carte: CarteADessiner = {
    teintes: ["prairie", "foret", BROUILLARD],
    cases: enColonnes(
      autour,
      (c) => (distance(c, FOYER) > 4 ? 2 : c.q % 2 === 0 ? 0 : 1),
      (c) => (anneau(c) >= 58 ? ZONE_COURONNE : 0),
    ),
    foyer: FOYER,
    // Un autre Foyer dans les abords, à portée ; un autre au-delà.
    foyers: [
      { q: FOYER.q + 3, r: FOYER.r - 1 },
      { q: FOYER.q + 10, r: FOYER.r - 10 },
    ],
  };
  const HUTTE = { image: "hutte" as unknown as CanvasImageSource, largeur: 384, hauteur: 256 };
  /** Si un remplissage pair-impair couvre le point : il est à l'intérieur d'un nombre impair de ses tracés, chacun refermé. */
  const couvre = (traces: Point[][], { x, y }: Point) => {
    const traversees = traces.flatMap((trace) =>
      trace.filter((a, i) => {
        const b = trace[(i + 1) % trace.length];
        return a.y > y !== b.y > y && x < a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y);
      }),
    );
    return traversees.length % 2 === 1;
  };
  /** Le centre d'une Case, et ses sommets un peu ramenés vers lui : toute la Case, sans son bord, là où elle est à l'écran. */
  const pointsDe = (c: Coordonnees, ici: Vue) => {
    const { x, y } = aLEcran(c, ici);
    const points = [{ x, y }, ...SOMMETS_DE_CASE.map((s) => ({ x: x + 0.8 * s.x * ici.rayon, y: y + 0.8 * s.y * ici.rayon }))];
    return points.filter((p) => p.x > 0 && p.x < ici.largeur && p.y > 0 && p.y < ici.hauteur);
  };
  /** La carte dessinée sur la vue `ici`, une Case hors de portée choisie, avec la portée ou sans (null). */
  const dessiner = (ici: Vue, portee: typeof PORTEE | null, monde = carte) => {
    const essai = pinceauDEssai();
    dessinerLaCarte(essai.pinceau, monde, ici, peinture(["vert", "sapin", "brume"]), HUTTE, { q: FOYER.q + 9, r: FOYER.r - 2 }, portee);
    return essai;
  };

  it("grise d'un seul remplissage chaque Case à plus de 8 Cases du Foyer, en entier, et elles seules", () => {
    const dezoomee = { ...vue, rayon: bornesDuZoom(800, 600).min };
    for (const ici of [vue, dezoomee]) {
      const voiles = dessiner(ici, PORTEE).peints.filter((p) => p.couleur === "grisé");
      expect(voiles).toHaveLength(1);
      const [voile] = voiles;
      expect([voile.geste, voile.regle]).toEqual(["remplir", "evenodd"]);
      for (const c of autour) for (const point of pointsDe(c, ici)) expect(couvre(voile.traces, point), `${c.q},${c.r}`).toBe(distance(c, FOYER) > PORTEE.cases);
      // Jusqu'aux coins de l'écran, loin du Foyer.
      expect(couvre(voile.traces, { x: 1, y: 1 })).toBe(true);
    }
  });

  it("ne grise que là où des Cases sont déjà peintes, rien au-delà du bord du Monde ; puis pose le reste par-dessus, comme avant", () => {
    const { peints, misDeCote } = dessiner(vue, PORTEE);
    const voile = peints.find((p) => p.couleur === "grisé")!;
    expect(voile.composition).toBe("source-atop");
    expect(new Set(peints.filter((p) => p !== voile).map((p) => p.composition))).toEqual(new Set(["source-over"]));
    expect(misDeCote()).toBe(0);
  });

  it("grise les Cases, leurs motifs, leurs bords, les liserés et les autres Foyers ; ni le Foyer du joueur, ni la Case choisie, ni le repère", () => {
    const sans = dessiner(vue, null).peints;
    const avec = dessiner(vue, PORTEE).peints;
    expect(sans.some((p) => p.couleur === "grisé")).toBe(false);
    const voile = avec.find((p) => p.couleur === "grisé")!;
    expect(avec.filter((p) => p !== voile)).toEqual(sans);
    // Juste après les autres Foyers, de petits hexagones d'Encre ; juste avant le contour d'Encre du Foyer du joueur.
    const ici = avec.indexOf(voile);
    expect(avec[ici - 1]).toMatchObject({ geste: "remplir", couleur: "Encre" });
    expect(avec[ici + 1]).toMatchObject({ geste: "border", couleur: "Encre", epaisseur: 2 });
  });

  it("coûte autant à tout zoom : l'écran et le contour de la portée, sans un tracé par Case ni closePath de plus", () => {
    const monde = { ...carte, teintes: ["prairie"], cases: enColonnes(casesDesAnneaux(0, 60)) };
    const dezoomee = { ...vueSurLeFoyer(FOYER, 390, 688), rayon: bornesDuZoom(390, 688).min };
    const avec = dessiner(dezoomee, PORTEE, monde);
    const { traces } = avec.peints.find((p) => p.couleur === "grisé")!;
    expect(traces).toHaveLength(2);
    expect(traces[0]).toEqual([
      { x: 0, y: 0 },
      { x: 390, y: 0 },
      { x: 390, y: 688 },
      { x: 0, y: 688 },
    ]);
    // Le tour de la portée : 17 côtés de Case par côté de son grand hexagone.
    expect(traces[1]).toHaveLength(6 * (2 * PORTEE.cases + 1));
    expect(avec.fermetures()).toBe(dessiner(dezoomee, null, monde).fermetures());
  });
});

describe("les Expéditions en cours sur la carte (US-0913)", () => {
  const FOYER = { q: -47, r: 56 };
  const vue = vueSurLeFoyer(FOYER, 800, 600);
  const autour = casesDesAnneaux(0, 8).map((c) => ({ q: c.q + FOYER.q, r: c.r + FOYER.r }));
  const carte = { teintes: ["prairie"], cases: enColonnes(autour), foyer: FOYER, foyers: [] };
  const HUTTE = { image: "hutte" as unknown as CanvasImageSource, largeur: 384, hauteur: 256 };
  /** Deux Expéditions : l'une à 3 Cases à l'est, l'autre à 2 Cases au sud-ouest ; chacune de son chemin, Foyer exclu. */
  const CHEMINS = [
    [1, 2, 3].map((n) => ({ q: FOYER.q + n, r: FOYER.r })),
    [1, 2].map((n) => ({ q: FOYER.q - n, r: FOYER.r + n })),
  ];
  const EXPEDITIONS = { chemins: CHEMINS, fanion: "ciel" };
  const dessiner = (expeditions: typeof EXPEDITIONS | null, ici: Vue = vue, choisie: Coordonnees | null = null, portee: { cases: number; voile: string } | null = null) => {
    const essai = pinceauDEssai();
    dessinerLaCarte(essai.pinceau, carte, ici, peinture(["vert"]), HUTTE, choisie, portee, expeditions);
    return essai;
  };
  /** Le trait pointillé des chemins : des points ronds, seul trait de la carte à tirets si serrés. */
  const chemins = (peints: Peint[]) => peints.filter((p) => p.geste === "border" && p.bouts === "round" && p.tirets.length === 2 && p.tirets[0] < 0.1);

  it("trace le chemin de chaque Expédition d'un trait de points d'Encre, de centre en centre, du Foyer à sa destination, d'un seul geste", () => {
    const traits = chemins(dessiner(EXPEDITIONS).peints);
    expect(traits).toHaveLength(1);
    const [trait] = traits;
    expect(trait.couleur).toBe("Encre");
    expect(trait.traces.map((t) => t.map(cle))).toEqual(CHEMINS.map((chemin) => [FOYER, ...chemin].map((c) => cle(aLEcran(c, vue)))));
    // Des points, à quelques pixels l'un de l'autre, à tout zoom : le vide entre eux ne dépend pas de la taille des Cases.
    expect(trait.tirets[1]).toBeGreaterThan(trait.epaisseur);
    expect(chemins(dessiner(EXPEDITIONS, { ...vue, rayon: 3 }).peints)[0].tirets).toEqual(trait.tirets);
    // Léger, pour ne pas cacher les Biomes : à demi transparent.
    expect(trait.opacite).toBeGreaterThan(0.3);
    expect(trait.opacite).toBeLessThan(1);
  });

  it("marque la destination de chaque Expédition d'un fanion ciel cerné d'Encre, planté sur la Case, à la taille du repère du Foyer", () => {
    const { peints } = dessiner(EXPEDITIONS);
    const fanions = peints.filter((p) => p.couleur === "ciel");
    expect(fanions).toHaveLength(1);
    const [fanion] = fanions;
    expect(fanion.geste).toBe("remplir");
    expect(fanion.traces).toHaveLength(2);
    expect(peints[peints.indexOf(fanion) + 1]).toMatchObject({ geste: "border", couleur: "Encre", traces: fanion.traces });
    // Chaque fanion au-dessus de sa destination, à droite de la hampe qui part de son centre.
    const taille = tailleDuRepere(vue.rayon);
    CHEMINS.forEach((chemin, i) => {
      const { x, y } = aLEcran(chemin.at(-1)!, vue);
      for (const p of fanion.traces[i]) {
        expect(p.x).toBeGreaterThanOrEqual(x - 1e-9);
        expect(p.x).toBeLessThanOrEqual(x + 1.5 * taille);
        expect(p.y).toBeLessThan(y);
        expect(p.y).toBeGreaterThan(y - 2.5 * taille);
      }
    });
    const hampes = peints.find((p) => p.geste === "border" && p.couleur === "Encre" && p.traces.length === 2 && p.traces.every((t) => t.length === 2))!;
    expect(hampes.traces.map((t) => cle(t[0]))).toEqual(CHEMINS.map((chemin) => cle(aLEcran(chemin.at(-1)!, vue))));
  });

  it("se voit à tout zoom : le fanion garde la taille du repère du Foyer quand les Cases rapetissent", () => {
    const petite = { ...vue, rayon: 3 };
    const fanion = dessiner(EXPEDITIONS, petite).peints.find((p) => p.couleur === "ciel")!;
    const ys = fanion.traces[0].map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.5 * tailleDuRepere(3));
  });

  it("pose les chemins et les fanions par-dessus les Cases et le voile de la portée, sous le Foyer, la Case choisie et le repère du Foyer", () => {
    const sans = dessiner(null, vue, CHEMINS[0][1], { cases: 8, voile: "grisé" }).peints;
    const avec = dessiner(EXPEDITIONS, vue, CHEMINS[0][1], { cases: 8, voile: "grisé" }).peints;
    const debut = avec.findIndex((p, i) => JSON.stringify(p) !== JSON.stringify(sans[i]));
    const ajoutes = avec.slice(debut, debut + avec.length - sans.length);
    expect(ajoutes.map((p) => `${p.geste} ${p.couleur}`)).toEqual(["border Encre", "remplir ciel", "border Encre", "border Encre"]);
    expect(avec.slice(debut + ajoutes.length)).toEqual(sans.slice(debut));
    expect(avec[debut - 1].couleur).toBe("grisé");
  });

  it("ne dessine rien de plus sans Expédition en cours, ni d'un chemin vide", () => {
    expect(dessiner({ chemins: [], fanion: "ciel" }).peints).toEqual(dessiner(null).peints);
    expect(dessiner({ chemins: [[]], fanion: "ciel" }).peints).toEqual(dessiner(null).peints);
    expect(dessiner({ chemins: [CHEMINS[0], []], fanion: "ciel" }).peints).toEqual(dessiner({ chemins: [CHEMINS[0]], fanion: "ciel" }).peints);
  });

  it("ne garde rien d'un dessin à l'autre : tout ce que save() met de côté, restore() le rend", () => {
    expect(dessiner(EXPEDITIONS).misDeCote()).toBe(0);
  });
});
