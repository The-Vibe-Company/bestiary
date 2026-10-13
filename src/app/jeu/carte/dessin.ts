// Le dessin de la carte du Monde sur un <canvas> (US-0417), sans rien demander au navigateur : il se vérifie à part.
import { BROUILLARD } from "@/monde/couleurs-de-la-carte";
import { centre, DIRECTIONS, distance, SOMMETS_DE_CASE, tourDeLAnneau, type Coordonnees } from "@/monde/hex";
import { ZONE_COEUR, ZONE_COURONNE } from "@/monde/zones";

/** US-0417 : la largeur d'une Case à l'écran, d'un côté plat à l'autre, en pixels : un hexagone confortable. */
export const LARGEUR_DE_CASE = 28;

/**
 * Ce que montre la carte : la taille de l'écran en pixels, la Case posée en son milieu, et le rayon d'une Case à
 * l'écran (de son centre à un sommet), en pixels.
 */
export type Vue = { largeur: number; hauteur: number; milieu: Coordonnees; rayon: number };

/** Ce que la carte demande au pinceau d'un <canvas> : une petite partie de CanvasRenderingContext2D. */
export type Pinceau = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "lineCap"
  | "lineJoin"
  | "globalAlpha"
  | "globalCompositeOperation"
  | "setLineDash"
  | "lineDashOffset"
  | "clearRect"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "quadraticCurveTo"
  | "arc"
  | "closePath"
  | "fill"
  | "stroke"
  | "save"
  | "restore"
  | "clip"
  | "drawImage"
>;

/**
 * Les couleurs de la carte, telles que le <canvas> les comprend : le fond de chaque teinte, dans l'ordre des
 * teintes de la carte (US-0418), le bord léger des Cases, et les deux tons des motifs : un sombre pour les teintes
 * claires, un clair pour les sombres. US-0419 : l'Encre des Foyers, et le citron du repère de son Foyer. US-0428 : le
 * surlignage de la Case choisie, au cuivre et à la crème du kit : le voile qui la remplit, le halo qui la cerne, le
 * trait posé dessus, et l'anneau de tirets autour d'elle.
 */
export type Peinture = {
  fonds: string[];
  bord: string;
  motifSombre: string;
  motifClair: string;
  encre: string;
  repere: string;
  surlignage: { voile: string; halo: string; trait: string; anneau: string };
  /**
   * Le relief peint, posé sur les Cases par-dessus leur couleur et sous leur motif (relief.ts) : pour la vue, et la Case
   * (0, 0) là où la vue la met, ce qui peint les Cases découvertes (`terre`) et celles sous le brouillard (`brume`) ;
   * rien sans lui (la légende, une carte sans navigateur).
   */
  relief?: { terre: Relief; brume: Relief };
};

/** Ce qui peint le relief d'une sorte de Cases pour une vue, la Case (0, 0) en `origine` ; null s'il n'y en a pas. */
export type Relief = (vue: Vue, origine: { x: number; y: number }) => CanvasPattern | null;

/**
 * La carte telle que le serveur l'envoie (src/monde/carte.ts) : ses teintes, ses Cases en colonnes (US-0433 : avec
 * leur zone), le Foyer du joueur et ceux des autres chefs.
 */
export type CarteADessiner = {
  teintes: string[];
  cases: { q: number[]; r: number[]; teinte: number[]; zone: number[] };
  foyer: Coordonnees;
  foyers: Coordonnees[];
};

/** US-0419 : l'illustration de la hutte du chef, telle que le navigateur l'a chargée, et sa taille en pixels. */
export type Hutte = { image: CanvasImageSource; largeur: number; hauteur: number };

/**
 * US-0908 : la portée d'exploration, pendant le choix de la destination d'une Expédition : jusqu'où elle va, en Cases
 * depuis le Foyer, et la couleur qui grise les Cases au-delà.
 */
export type Portee = { cases: number; voile: string };

/**
 * US-0913 : les Expéditions en cours du joueur : le chemin de chacune (cheminDUneExpedition, src/expeditions/chemin.ts),
 * du Foyer exclu à sa destination comprise, et la couleur de leur fanion.
 */
export type ExpeditionsADessiner = { chemins: readonly (readonly Coordonnees[])[]; fanion: string };

/**
 * US-0419 : la part de l'illustration du Foyer (foyer/prairie.webp, 3 × 2) où se tient la hutte, en fractions de sa
 * largeur : d'un peu avant le bord gauche du toit à un peu après le bord droit, depuis le haut. La hauteur suit, aux
 * proportions d'une Case (√3 × 2) : la hutte n'est jamais étirée.
 */
const HUTTE_RECADREE = { gauche: 0.314, largeur: 0.521 };

/**
 * US-0419 : le rayon de la tête du repère du Foyer, en pixels : un peu plus que la moitié d'une Case, jamais moins
 * de 9 pixels. Il grossit donc par rapport aux Cases quand on dézoome : le Foyer se voit à tout zoom.
 */
export function tailleDuRepere(rayon: number): number {
  return Math.max(9, 0.55 * rayon);
}

/** US-0417 : la carte à l'ouverture, sur un écran de `largeur` × `hauteur` pixels : le Foyer au milieu, des Cases de LARGEUR_DE_CASE pixels. */
export function vueSurLeFoyer(foyer: Coordonnees, largeur: number, hauteur: number): Vue {
  return { largeur, hauteur, milieu: foyer, rayon: LARGEUR_DE_CASE / Math.sqrt(3) };
}

/** Où tombe le centre d'une Case sur l'écran, en pixels depuis son coin en haut à gauche. */
export function aLEcran(c: Coordonnees, vue: Vue): { x: number; y: number } {
  const [ici, milieu] = [centre(c), centre(vue.milieu)];
  return { x: vue.largeur / 2 + (ici.x - milieu.x) * vue.rayon, y: vue.hauteur / 2 + (ici.y - milieu.y) * vue.rayon };
}

/**
 * Si une Case dont le centre tombe en (x, y) touche l'écran : les autres ne sont pas dessinées. `marge` : jusqu'où
 * son dessin déborde de son centre, en pixels (son rayon, ou plus pour le repère du Foyer).
 */
function aLaVue(x: number, y: number, vue: Vue, marge = vue.rayon): boolean {
  return x > -marge && x < vue.largeur + marge && y > -marge && y < vue.hauteur + marge;
}

/**
 * Ajoute au tracé en cours l'hexagone d'une Case, centré en (x, y), de rayon `rayon` en pixels, de son premier sommet
 * au dernier : à remplir, ce qui le referme de soi-même. US-0435 : sans closePath : dans Chrome, il coûte d'autant
 * plus que le tracé en cours est long, et la carte trace des milliers de Cases d'un seul geste (dézoomée au maximum,
 * une image prenait ainsi près d'une seconde sur le téléphone de référence).
 */
function tracerLaCase(pinceau: Pinceau, x: number, y: number, rayon: number) {
  pinceau.moveTo(x + SOMMETS_DE_CASE[0].x * rayon, y + SOMMETS_DE_CASE[0].y * rayon);
  for (const s of SOMMETS_DE_CASE.slice(1)) pinceau.lineTo(x + s.x * rayon, y + s.y * rayon);
}

/**
 * US-0435 : ajoute au tracé en cours l'hexagone d'une Case, à border : refermé à la main, en repassant sur son premier
 * côté, ce qui lui donne à son premier sommet le même angle qu'aux autres, sans closePath (voir tracerLaCase).
 */
function cernerLaCase(pinceau: Pinceau, x: number, y: number, rayon: number) {
  tracerLaCase(pinceau, x, y, rayon);
  for (const s of SOMMETS_DE_CASE.slice(0, 2)) pinceau.lineTo(x + s.x * rayon, y + s.y * rayon);
}

/** US-0435 : l'hexagone d'une Case seule, refermé : un tracé à lui seul, où closePath ne coûte rien (voir tracerLaCase). */
function fermerLaCase(pinceau: Pinceau, x: number, y: number, rayon: number) {
  pinceau.beginPath();
  tracerLaCase(pinceau, x, y, rayon);
  pinceau.closePath();
}

/** US-0419 : pose l'illustration de la hutte sur la Case du Foyer, centrée en (x, y), découpée à sa forme. */
function poserLaHutte(pinceau: Pinceau, hutte: Hutte, x: number, y: number, rayon: number) {
  const largeur = hutte.largeur * HUTTE_RECADREE.largeur;
  const hauteur = (largeur * 2) / Math.sqrt(3);
  pinceau.save();
  fermerLaCase(pinceau, x, y, rayon);
  pinceau.clip();
  pinceau.drawImage(hutte.image, hutte.largeur * HUTTE_RECADREE.gauche, 0, largeur, hauteur, x - (Math.sqrt(3) / 2) * rayon, y - rayon, Math.sqrt(3) * rayon, 2 * rayon);
  pinceau.restore();
}

/**
 * US-0419 : le repère du Foyer, centré en (x, y) : une épingle citron cernée d'Encre, la pointe sur le toit de la
 * hutte et la tête au-dessus de la Case, un œil d'Encre au milieu. Sa tête fait tailleDuRepere pixels de rayon.
 */
function poserLeRepere(pinceau: Pinceau, peinture: Peinture, x: number, y: number, rayon: number) {
  const taille = tailleDuRepere(rayon);
  const pointe = y - 0.45 * rayon;
  const tete = pointe - 1.8 * taille;
  // Les deux côtés de l'épingle touchent la tête là où ils lui sont tangents, de part et d'autre du bas.
  const ecart = Math.acos(1 / 1.8);
  pinceau.beginPath();
  pinceau.moveTo(x, pointe);
  pinceau.arc(x, tete, taille, Math.PI / 2 + ecart, Math.PI / 2 - ecart + 2 * Math.PI);
  pinceau.closePath();
  pinceau.fillStyle = peinture.repere;
  pinceau.fill();
  pinceau.strokeStyle = peinture.encre;
  pinceau.lineWidth = 2;
  pinceau.lineJoin = "round";
  pinceau.stroke();
  pinceau.beginPath();
  rond(pinceau, x, tete, 0.38 * taille);
  pinceau.fillStyle = peinture.encre;
  pinceau.fill();
}

/**
 * US-0418 : le motif d'une teinte, posé au milieu de chaque Case de cette teinte : un petit dessin plat, dans le
 * ton sombre sur les teintes claires et le ton clair sur les sombres, rempli ou tracé d'un trait rond. `dessiner`
 * l'ajoute au tracé en cours, la Case centrée en (x, y) et de rayon s ; il reste à moins de 0,6 s du centre.
 * US-0435 : sans closePath (voir tracerLaCase) : remplir referme de lui-même chaque forme.
 */
type Motif = { ton: "sombre" | "clair"; geste: "remplir" | "tracer"; dessiner: (p: Pinceau, x: number, y: number, s: number) => void };

/** Une touffe d'herbe : trois brins qui partent d'un même pied. */
function touffe(p: Pinceau, x: number, y: number, s: number) {
  for (const [dx, dy] of [
    [-0.13, -0.17],
    [0, -0.24],
    [0.13, -0.17],
  ]) {
    p.moveTo(x, y);
    p.lineTo(x + dx * s, y + dy * s);
  }
}

/** Un sapin : un triangle pointe en haut. */
function sapin(p: Pinceau, x: number, y: number, s: number) {
  p.moveTo(x, y - 0.3 * s);
  p.lineTo(x + 0.16 * s, y + 0.16 * s);
  p.lineTo(x - 0.16 * s, y + 0.16 * s);
}

/** Un rond plein de rayon r (en rayons de Case), centré en (x, y). */
function rond(p: Pinceau, x: number, y: number, r: number) {
  p.moveTo(x + r, y);
  p.arc(x, y, r, 0, 2 * Math.PI);
}

/** Une vague : deux creux de largeur totale 2 l (en pixels), d'amplitude a. */
function vague(p: Pinceau, x: number, y: number, l: number, a: number) {
  p.moveTo(x - l, y);
  p.quadraticCurveTo(x - l / 2, y - a, x, y);
  p.quadraticCurveTo(x + l / 2, y + a, x + l, y);
}

/** US-0418 : le motif de chaque Biome de terre et de chaque eau, tous différents. */
export const MOTIFS: Record<string, Motif> = {
  // Des touffes d'herbe.
  prairie: {
    ton: "sombre",
    geste: "tracer",
    dessiner: (p, x, y, s) => {
      touffe(p, x - 0.26 * s, y + 0.2 * s, s);
      touffe(p, x + 0.24 * s, y + 0.02 * s, s);
    },
  },
  // Deux sapins.
  foret: {
    ton: "sombre",
    geste: "remplir",
    dessiner: (p, x, y, s) => {
      sapin(p, x - 0.2 * s, y + 0.06 * s, s);
      sapin(p, x + 0.2 * s, y - 0.04 * s, s);
    },
  },
  // Des feuillages ronds, serrés.
  jungle: {
    ton: "clair",
    geste: "remplir",
    dessiner: (p, x, y, s) => {
      rond(p, x - 0.19 * s, y - 0.08 * s, 0.15 * s);
      rond(p, x + 0.19 * s, y - 0.12 * s, 0.13 * s);
      rond(p, x + 0.02 * s, y + 0.2 * s, 0.15 * s);
    },
  },
  // Un acacia : une ombrelle plate sur un tronc fin.
  savane: {
    ton: "sombre",
    geste: "remplir",
    dessiner: (p, x, y, s) => {
      p.moveTo(x - 0.34 * s, y - 0.06 * s);
      p.quadraticCurveTo(x, y - 0.36 * s, x + 0.34 * s, y - 0.06 * s);
      p.moveTo(x - 0.035 * s, y - 0.06 * s);
      p.lineTo(x + 0.035 * s, y - 0.06 * s);
      p.lineTo(x + 0.035 * s, y + 0.3 * s);
      p.lineTo(x - 0.035 * s, y + 0.3 * s);
    },
  },
  // Deux dunes.
  desert: {
    ton: "sombre",
    geste: "tracer",
    dessiner: (p, x, y, s) => {
      p.moveTo(x - 0.42 * s, y + 0.02 * s);
      p.quadraticCurveTo(x - 0.2 * s, y - 0.22 * s, x + 0.02 * s, y + 0.02 * s);
      p.moveTo(x - 0.04 * s, y + 0.3 * s);
      p.quadraticCurveTo(x + 0.18 * s, y + 0.06 * s, x + 0.4 * s, y + 0.3 * s);
    },
  },
  // Un massif à deux sommets.
  montagne: {
    ton: "sombre",
    geste: "remplir",
    dessiner: (p, x, y, s) => {
      p.moveTo(x - 0.42 * s, y + 0.24 * s);
      p.lineTo(x - 0.08 * s, y - 0.32 * s);
      p.lineTo(x + 0.1 * s, y - 0.02 * s);
      p.lineTo(x + 0.2 * s, y - 0.16 * s);
      p.lineTo(x + 0.42 * s, y + 0.24 * s);
    },
  },
  // Des lichens, en points épars.
  toundra: {
    ton: "sombre",
    geste: "remplir",
    dessiner: (p, x, y, s) => {
      rond(p, x - 0.26 * s, y - 0.1 * s, 0.06 * s);
      rond(p, x + 0.04 * s, y + 0.18 * s, 0.06 * s);
      rond(p, x + 0.3 * s, y - 0.14 * s, 0.06 * s);
      rond(p, x - 0.04 * s, y - 0.32 * s, 0.05 * s);
    },
  },
  // Une fêlure dans la glace.
  banquise: {
    ton: "sombre",
    geste: "tracer",
    dessiner: (p, x, y, s) => {
      p.moveTo(x - 0.36 * s, y - 0.18 * s);
      p.lineTo(x - 0.1 * s, y + 0.02 * s);
      p.lineTo(x + 0.06 * s, y - 0.12 * s);
      p.lineTo(x + 0.36 * s, y + 0.18 * s);
      p.moveTo(x + 0.06 * s, y - 0.12 * s);
      p.lineTo(x + 0.12 * s, y - 0.36 * s);
    },
  },
  // L'écume du rivage, en trois points.
  cote: {
    ton: "clair",
    geste: "remplir",
    dessiner: (p, x, y, s) => {
      rond(p, x - 0.26 * s, y + 0.06 * s, 0.055 * s);
      rond(p, x, y - 0.06 * s, 0.055 * s);
      rond(p, x + 0.26 * s, y + 0.06 * s, 0.055 * s);
    },
  },
  // Des ronds dans l'eau.
  lac: {
    ton: "clair",
    geste: "tracer",
    dessiner: (p, x, y, s) => {
      p.moveTo(x + 0.3 * s, y);
      p.arc(x, y, 0.3 * s, 0, 2 * Math.PI);
      p.moveTo(x + 0.12 * s, y);
      p.arc(x, y, 0.12 * s, 0, 2 * Math.PI);
    },
  },
  // Le courant, d'une seule longue ondulation.
  riviere: {
    ton: "clair",
    geste: "tracer",
    dessiner: (p, x, y, s) => vague(p, x, y, 0.44 * s, 0.3 * s),
  },
  // Deux vagues.
  mer: {
    ton: "clair",
    geste: "tracer",
    dessiner: (p, x, y, s) => {
      vague(p, x - 0.1 * s, y - 0.14 * s, 0.22 * s, 0.22 * s);
      vague(p, x + 0.1 * s, y + 0.18 * s, 0.22 * s, 0.22 * s);
    },
  },
};

/**
 * US-0433 : le liseré de chaque limite, d'Encre à demi transparente : des tirets pour la Couronne, des points ronds
 * pour le Cœur sauvage. `pas` : la longueur d'un motif (un trait et son vide), en fraction du côté d'une Case, qui en
 * compte ainsi un nombre entier ; `plein` : la part du trait dans le motif (0 : un point).
 */
const LISERES = [
  { zone: ZONE_COURONNE, epaisseur: 2, bouts: "butt", pas: 1 / 2, plein: 0.5 },
  { zone: ZONE_COEUR, epaisseur: 2.5, bouts: "round", pas: 1 / 3, plein: 0 },
] as const;
const OPACITE_DES_LISERES = 0.7;

/** US-0437 : le rang de chaque Case de la carte, par sa place « q,r », par forme de carte : calculé une fois. */
const rangsDesCartes = new WeakMap<number[], Map<string, number>>();

/** US-0437 : le rang de chaque Case de la carte dans ses colonnes, par sa place « q,r ». */
export function rangsDesCases(cases: CarteADessiner["cases"]): Map<string, number> {
  const connus = rangsDesCartes.get(cases.q);
  if (connus) return connus;
  const rangs = new Map(cases.q.map((q, i) => [`${q},${cases.r[i]}`, i]));
  rangsDesCartes.set(cases.q, rangs);
  return rangs;
}

/** US-0433 : les côtés où s'arrête chaque zone, par carte : calculés une fois, redessinés à chaque image. */
const limitesDesCartes = new WeakMap<CarteADessiner["cases"], Map<number, [number, number][]>>();

/**
 * US-0433 : les côtés où s'arrête chaque zone : ceux d'une Case de la zone qui touchent une Case de la carte hors de
 * la zone, chacun par le rang de sa Case et sa direction (DIRECTIONS). Au-delà du bord de la carte, il n'y a pas de
 * Case, et pas de limite. US-0437 : sous le brouillard non plus, ni à son bord : il ne laisse rien deviner.
 */
function limitesDe({ teintes, cases }: CarteADessiner): Map<number, [number, number][]> {
  const connues = limitesDesCartes.get(cases);
  if (connues) return connues;
  const { q, r, teinte, zone } = cases;
  const brume = teintes.indexOf(BROUILLARD);
  const rangs = rangsDesCases(cases);
  const limites = new Map(LISERES.map((l): [number, [number, number][]] => [l.zone, []]));
  for (let i = 0; i < q.length; i++) {
    const cotes = limites.get(zone[i]);
    if (!cotes || teinte[i] === brume) continue;
    DIRECTIONS.forEach((d, direction) => {
      const voisine = rangs.get(`${q[i] + d.q},${r[i] + d.r}`);
      if (voisine !== undefined && teinte[voisine] !== brume && zone[voisine] !== zone[i]) cotes.push([i, direction]);
    });
  }
  limitesDesCartes.set(cases, limites);
  return limites;
}

/**
 * US-0433 : trace par-dessus les Cases le liseré de chaque limite à l'écran, un côté après l'autre : le côté vers
 * la voisine de la direction d va du sommet (7 − d) de la Case au suivant. Chaque côté commence au milieu d'un vide :
 * le rythme ne change pas d'un côté au suivant.
 */
function tracerLesLimites(pinceau: Pinceau, carte: CarteADessiner, vue: Vue, peinture: Peinture) {
  const limites = limitesDe(carte);
  const { q, r } = carte.cases;
  pinceau.save();
  pinceau.strokeStyle = peinture.encre;
  pinceau.globalAlpha = OPACITE_DES_LISERES;
  for (const { zone, epaisseur, bouts, pas, plein } of LISERES) {
    pinceau.beginPath();
    let cotes = 0;
    for (const [i, direction] of limites.get(zone)!) {
      const { x, y } = aLEcran({ q: q[i], r: r[i] }, vue);
      if (!aLaVue(x, y, vue)) continue;
      const [a, b] = [SOMMETS_DE_CASE[(7 - direction) % 6], SOMMETS_DE_CASE[(8 - direction) % 6]];
      pinceau.moveTo(x + a.x * vue.rayon, y + a.y * vue.rayon);
      pinceau.lineTo(x + b.x * vue.rayon, y + b.y * vue.rayon);
      cotes++;
    }
    if (cotes === 0) continue;
    const motif = pas * vue.rayon;
    const trait = Math.max(0.01, plein * motif);
    pinceau.setLineDash([trait, motif - trait]);
    pinceau.lineDashOffset = trait + (motif - trait) / 2;
    pinceau.lineWidth = epaisseur;
    pinceau.lineCap = bouts;
    pinceau.stroke();
  }
  pinceau.restore();
}

/** US-0428 : l'anneau de tirets autour de la Case choisie, en rayons de Case, et ses tirets, en pixels, à tout zoom. */
const ANNEAU_DU_SURLIGNAGE = { rayon: 1.32, tiret: 3, epaisseur: 1.4 };

/**
 * US-0428 : surligne la Case dont le centre tombe en (x, y), comme la maquette du kit : un anneau de tirets de cuivre
 * autour d'elle ; son hexagone sous un voile crème, cerné d'un halo de cuivre et d'un trait crème par-dessus, plus
 * épais que tout autre trait de la carte : il se voit sur les teintes claires et sombres.
 */
function surligner(pinceau: Pinceau, { surlignage }: Peinture, x: number, y: number, rayon: number) {
  pinceau.save();
  fermerLaCase(pinceau, x, y, ANNEAU_DU_SURLIGNAGE.rayon * rayon);
  pinceau.setLineDash([ANNEAU_DU_SURLIGNAGE.tiret, ANNEAU_DU_SURLIGNAGE.tiret]);
  pinceau.lineDashOffset = 0;
  pinceau.lineJoin = "round";
  pinceau.strokeStyle = surlignage.anneau;
  pinceau.lineWidth = ANNEAU_DU_SURLIGNAGE.epaisseur;
  pinceau.stroke();
  pinceau.restore();
  fermerLaCase(pinceau, x, y, rayon);
  pinceau.fillStyle = surlignage.voile;
  pinceau.fill();
  pinceau.lineJoin = "round";
  pinceau.strokeStyle = surlignage.halo;
  pinceau.lineWidth = 6;
  pinceau.stroke();
  pinceau.strokeStyle = surlignage.trait;
  pinceau.lineWidth = 3;
  pinceau.stroke();
}

/**
 * US-0908 : ajoute au tracé en cours le contour des Cases à `portee` Cases du Foyer ou moins, en en faisant le tour :
 * chaque Case du dernier anneau autour du Foyer, dans l'ordre de tourDeLAnneau (le sens inverse des aiguilles d'une
 * montre), y met ses côtés tournés vers l'anneau d'après, dans le même sens : le côté vers la voisine de la direction d
 * va du sommet (8 − d) au sommet (7 − d) de la Case, et le premier sommet de chaque Case est le dernier de la précédente.
 */
function tracerLaPortee(pinceau: Pinceau, foyer: Coordonnees, portee: number, vue: Vue) {
  let premier = true;
  for (const pas of tourDeLAnneau(portee)) {
    const ici = { q: foyer.q + pas.q, r: foyer.r + pas.r };
    const dehors = DIRECTIONS.map((d) => distance({ q: ici.q + d.q, r: ici.r + d.r }, foyer) > portee);
    // Ses côtés tournés vers l'anneau d'après se suivent : le premier suit un côté qui ne l'est pas (à portée 0, tous le sont).
    const debut = Math.max(0, dehors.findIndex((oui, d) => oui && !dehors[(d + 5) % 6]));
    const { x, y } = aLEcran(ici, vue);
    for (let d = debut; d < debut + dehors.filter(Boolean).length; d++) {
      const s = SOMMETS_DE_CASE[(((7 - d) % 6) + 6) % 6];
      if (premier) pinceau.moveTo(x + s.x * vue.rayon, y + s.y * vue.rayon);
      else pinceau.lineTo(x + s.x * vue.rayon, y + s.y * vue.rayon);
      premier = false;
    }
  }
}

/**
 * US-0908 : grise ce qui est au-delà de la portée d'exploration, d'un seul remplissage, quel que soit le zoom : tout
 * l'écran, moins la portée (règle pair-impair), et seulement par-dessus ce qui est déjà peint (source-atop) : rien
 * au-delà du bord du Monde, où il n'y a pas de Case.
 */
function griserAuDelaDeLaPortee(pinceau: Pinceau, foyer: Coordonnees, vue: Vue, { cases, voile }: Portee) {
  pinceau.save();
  pinceau.globalCompositeOperation = "source-atop";
  pinceau.beginPath();
  pinceau.moveTo(0, 0);
  pinceau.lineTo(vue.largeur, 0);
  pinceau.lineTo(vue.largeur, vue.hauteur);
  pinceau.lineTo(0, vue.hauteur);
  tracerLaPortee(pinceau, foyer, cases, vue);
  pinceau.fillStyle = voile;
  pinceau.fill("evenodd");
  pinceau.restore();
}

/**
 * US-0913 : le chemin d'une Expédition, en points ronds d'Encre à demi transparente : leur épaisseur et le vide entre
 * eux, en pixels, les mêmes à tout zoom.
 */
const POINTS_DU_CHEMIN = { epaisseur: 3, vide: 7, opacite: 0.55 };

/**
 * US-0913 : les Expéditions en cours sur la carte : le chemin de chacune, en points de centre en centre, du Foyer à sa
 * destination, d'un seul trait pour toutes ; puis sa destination, marquée d'un fanion planté sur la Case : une hampe
 * d'Encre qui part de son centre, et un fanion de la couleur des Expéditions, cerné d'Encre, à la taille du repère du
 * Foyer (tailleDuRepere) : il se voit à tout zoom. Trois gestes de plus, quel que soit leur nombre.
 */
function tracerLesExpeditions(pinceau: Pinceau, foyer: Coordonnees, vue: Vue, peinture: Peinture, { chemins, fanion }: ExpeditionsADessiner) {
  const depart = aLEcran(foyer, vue);
  pinceau.save();
  pinceau.beginPath();
  for (const chemin of chemins) {
    pinceau.moveTo(depart.x, depart.y);
    for (const c of chemin) {
      const { x, y } = aLEcran(c, vue);
      pinceau.lineTo(x, y);
    }
  }
  pinceau.setLineDash([0.01, POINTS_DU_CHEMIN.vide]);
  pinceau.lineDashOffset = 0;
  pinceau.globalAlpha = POINTS_DU_CHEMIN.opacite;
  pinceau.strokeStyle = peinture.encre;
  pinceau.lineWidth = POINTS_DU_CHEMIN.epaisseur;
  pinceau.lineCap = "round";
  pinceau.lineJoin = "round";
  pinceau.stroke();
  pinceau.restore();
  // Les fanions, chacun au-dessus de sa destination, tournés vers la droite ; leur côté ouvert, le long de la hampe,
  // que la hampe tracée par-dessus referme.
  const taille = tailleDuRepere(vue.rayon);
  const destinations = chemins.map((chemin) => aLEcran(chemin[chemin.length - 1], vue));
  pinceau.beginPath();
  for (const { x, y } of destinations) {
    pinceau.moveTo(x, y - 2 * taille);
    pinceau.lineTo(x + 1.3 * taille, y - 1.6 * taille);
    pinceau.lineTo(x, y - 1.2 * taille);
  }
  pinceau.fillStyle = fanion;
  pinceau.fill();
  pinceau.strokeStyle = peinture.encre;
  pinceau.lineWidth = 1.5;
  pinceau.lineJoin = "round";
  pinceau.stroke();
  pinceau.beginPath();
  for (const { x, y } of destinations) {
    pinceau.moveTo(x, y);
    pinceau.lineTo(x, y - 2 * taille);
  }
  pinceau.lineWidth = 2;
  pinceau.lineCap = "round";
  pinceau.stroke();
}

/**
 * Le relief peint (Peinture.relief) : d'un geste, toutes les Cases découvertes à l'écran prennent le relief de la terre ;
 * d'un autre, celles sous le brouillard prennent sa brume. Le motif, recalé sur la Case (0, 0), tombe sur chaque Case.
 */
function poserLeRelief(pinceau: Pinceau, parTeinte: { x: number; y: number }[][], brume: number, vue: Vue, relief: { terre: Relief; brume: Relief }) {
  const origine = aLEcran({ q: 0, r: 0 }, vue);
  for (const [sorte, peindre] of [
    ["terre", relief.terre],
    ["brume", relief.brume],
  ] as const) {
    const centres = parTeinte.flatMap((liste, t) => ((t === brume) === (sorte === "brume") ? liste : []));
    const motif = centres.length > 0 ? peindre(vue, origine) : null;
    if (!motif) continue;
    pinceau.beginPath();
    for (const { x, y } of centres) tracerLaCase(pinceau, x, y, vue.rayon);
    pinceau.fillStyle = motif;
    pinceau.fill();
  }
}

/**
 * US-0417 : dessine les Cases du Monde en hexagones, en colonnes comme le serveur les envoie. Seules celles qui
 * touchent l'écran sont tracées. US-0418 : chacune de la couleur de sa teinte (son Biome, ou sa variante d'eau),
 * puis le motif de sa teinte par-dessus, d'un geste par teinte ; enfin une légère bordure d'un pixel entre toutes.
 * US-0433 : par-dessus, le liseré des limites de la Couronne et du Cœur sauvage.
 * US-0419 : les Foyers des autres chefs d'un petit hexagone d'Encre ; celui du joueur montre la hutte du chef
 * (`hutte`, une fois chargée), cernée d'Encre, et porte par-dessus tout son repère citron. US-0428 : la Case
 * `choisie` surlignée, sous ce seul repère. US-0437 : les Cases sous le brouillard (de la teinte BROUILLARD), d'une
 * brume unie, d'un seul geste : sans motif, ni bord entre elles, ni liseré, ni Foyer d'un autre chef. Le Foyer du
 * joueur, lui, est toujours découvert. US-0908 : pendant le choix de la destination d'une Expédition (`portee`), tout
 * cela grisé au-delà de la portée d'exploration ; ni le Foyer du joueur, ni la Case choisie, ni son repère. US-0913 :
 * par-dessus, les Expéditions en cours du joueur (`expeditions`) : leurs chemins et le fanion de leurs destinations,
 * sous le Foyer, la Case choisie et le repère du Foyer.
 */
export function dessinerLaCarte(
  pinceau: Pinceau,
  carte: CarteADessiner,
  vue: Vue,
  peinture: Peinture,
  hutte: Hutte | null = null,
  choisie: Coordonnees | null = null,
  portee: Portee | null = null,
  expeditions: ExpeditionsADessiner | null = null,
) {
  pinceau.clearRect(0, 0, vue.largeur, vue.hauteur);
  // Les Cases à l'écran, rangées par teinte : le centre de chacune, en pixels.
  const parTeinte = carte.teintes.map((): { x: number; y: number }[] => []);
  const { q, r, teinte } = carte.cases;
  const brume = carte.teintes.indexOf(BROUILLARD);
  for (let i = 0; i < q.length; i++) {
    const ici = aLEcran({ q: q[i], r: r[i] }, vue);
    if (aLaVue(ici.x, ici.y, vue)) parTeinte[teinte[i]].push(ici);
  }
  parTeinte.forEach((centres, t) => {
    pinceau.beginPath();
    for (const { x, y } of centres) tracerLaCase(pinceau, x, y, vue.rayon);
    pinceau.fillStyle = peinture.fonds[t];
    pinceau.fill();
  });
  if (peinture.relief) poserLeRelief(pinceau, parTeinte, brume, vue, peinture.relief);
  parTeinte.forEach((centres, t) => {
    const motif = MOTIFS[carte.teintes[t]];
    if (!motif || centres.length === 0) return;
    pinceau.beginPath();
    for (const { x, y } of centres) motif.dessiner(pinceau, x, y, vue.rayon);
    const ton = motif.ton === "sombre" ? peinture.motifSombre : peinture.motifClair;
    if (motif.geste === "remplir") {
      pinceau.fillStyle = ton;
      pinceau.fill();
    } else {
      pinceau.strokeStyle = ton;
      pinceau.lineWidth = Math.max(1, vue.rayon * 0.09);
      pinceau.lineCap = "round";
      pinceau.lineJoin = "round";
      pinceau.stroke();
    }
  });
  const bordees = parTeinte.filter((centres, t) => t !== brume && centres.length > 0);
  if (bordees.length > 0) {
    pinceau.beginPath();
    for (const centres of bordees) for (const { x, y } of centres) cernerLaCase(pinceau, x, y, vue.rayon);
    pinceau.strokeStyle = peinture.bord;
    pinceau.lineWidth = 1;
    pinceau.stroke();
  }
  tracerLesLimites(pinceau, carte, vue, peinture);

  // US-0437 : les autres Foyers des seules Cases découvertes de la carte.
  const rangs = rangsDesCases(carte.cases);
  const decouverte = ({ q, r }: Coordonnees) => {
    const i = rangs.get(`${q},${r}`);
    return i !== undefined && teinte[i] !== brume;
  };
  const autres = carte.foyers
    .filter(decouverte)
    .map((c) => aLEcran(c, vue))
    .filter(({ x, y }) => aLaVue(x, y, vue));
  if (autres.length > 0) {
    pinceau.beginPath();
    for (const { x, y } of autres) tracerLaCase(pinceau, x, y, 0.42 * vue.rayon);
    pinceau.fillStyle = peinture.encre;
    pinceau.fill();
  }
  if (portee) griserAuDelaDeLaPortee(pinceau, carte.foyer, vue, portee);
  const chemins = expeditions?.chemins.filter((chemin) => chemin.length > 0) ?? [];
  if (expeditions && chemins.length > 0) tracerLesExpeditions(pinceau, carte.foyer, vue, peinture, { ...expeditions, chemins });

  const foyer = aLEcran(carte.foyer, vue);
  const foyerEnVue = aLaVue(foyer.x, foyer.y, vue, vue.rayon + 3 * tailleDuRepere(vue.rayon));
  if (foyerEnVue) {
    if (hutte) poserLaHutte(pinceau, hutte, foyer.x, foyer.y, vue.rayon);
    fermerLaCase(pinceau, foyer.x, foyer.y, vue.rayon);
    pinceau.strokeStyle = peinture.encre;
    pinceau.lineWidth = 2;
    pinceau.lineJoin = "round";
    pinceau.stroke();
  }
  const ici = choisie && aLEcran(choisie, vue);
  if (ici && aLaVue(ici.x, ici.y, vue)) surligner(pinceau, peinture, ici.x, ici.y, vue.rayon);
  if (foyerEnVue) poserLeRepere(pinceau, peinture, foyer.x, foyer.y, vue.rayon);
}

/**
 * US-0432 : un remplissage ou un trait de la carte, écrit en SVG : son chemin, sa couleur, et pour un trait son
 * épaisseur, ses bouts et ses jointures. US-0433 : ses tirets (aucun pour un trait plein) et leur décalage, et
 * l'opacité du pinceau.
 */
export type TraitSvg = {
  d: string;
  geste: "remplir" | "tracer";
  couleur: string;
  epaisseur: number;
  bouts: CanvasLineCap;
  jointures: CanvasLineJoin;
  tirets: number[];
  decalage: number;
  opacite: number;
};

/** Un rectangle, en pixels de la carte : son coin en haut à gauche, sa largeur et sa hauteur. */
export type Cadre = { x: number; y: number; largeur: number; hauteur: number };

/** Un nombre d'un chemin SVG, au centième de pixel, jamais « -0 ». */
const auCentieme = (n: number) => String(Math.round(n * 100) / 100 + 0);

/**
 * US-0432 : ce que `dessiner` fait d'un pinceau de la carte, écrit en chemins SVG plutôt que peint : la légende
 * montre ainsi les Cases, leurs motifs et le repère du Foyer avec les gestes mêmes de la carte. Le cadre entoure tout
 * ce qui est rempli ou tracé, traits compris. Les images (la hutte) n'y viennent pas.
 */
export function enSvg(dessiner: (pinceau: Pinceau) => void): { traits: TraitSvg[]; cadre: Cadre } {
  const traits: TraitSvg[] = [];
  const tout = { gauche: Infinity, haut: Infinity, droite: -Infinity, bas: -Infinity };
  // Le tracé en cours : son chemin, s'il a un point courant, et les bornes de ses points.
  let trace = { d: "", ouvert: false, gauche: Infinity, haut: Infinity, droite: -Infinity, bas: -Infinity };
  const borner = (x: number, y: number) => {
    trace = { ...trace, gauche: Math.min(trace.gauche, x), haut: Math.min(trace.haut, y), droite: Math.max(trace.droite, x), bas: Math.max(trace.bas, y) };
  };
  const point = (commande: string, x: number, y: number) => {
    trace.d += `${commande}${auCentieme(x)} ${auCentieme(y)}`;
    trace.ouvert = true;
    borner(x, y);
  };
  // US-0433 : les tirets du pinceau, et ce que save() met de côté pour restore(), comme sur un <canvas>.
  let tirets: number[] = [];
  const misDeCote: { opacite: number; tirets: number[]; decalage: number }[] = [];
  // Ce qui est peint étend le cadre, de la moitié de son épaisseur pour un trait.
  const peindre = (geste: TraitSvg["geste"], couleur: string, marge: number) => {
    traits.push({
      d: trace.d,
      geste,
      couleur,
      epaisseur: pinceau.lineWidth,
      bouts: pinceau.lineCap,
      jointures: pinceau.lineJoin,
      tirets,
      decalage: pinceau.lineDashOffset,
      opacite: pinceau.globalAlpha,
    });
    tout.gauche = Math.min(tout.gauche, trace.gauche - marge);
    tout.haut = Math.min(tout.haut, trace.haut - marge);
    tout.droite = Math.max(tout.droite, trace.droite + marge);
    tout.bas = Math.max(tout.bas, trace.bas + marge);
  };
  const pinceau: Pinceau = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    lineDashOffset: 0,
    setLineDash: (valeurs) => void (tirets = [...valeurs]),
    clearRect: () => {},
    save: () => void misDeCote.push({ opacite: pinceau.globalAlpha, tirets, decalage: pinceau.lineDashOffset }),
    restore: () => {
      const avant = misDeCote.pop();
      if (avant) [pinceau.globalAlpha, tirets, pinceau.lineDashOffset] = [avant.opacite, avant.tirets, avant.decalage];
    },
    clip: () => {},
    drawImage: () => {},
    beginPath: () => void (trace = { d: "", ouvert: false, gauche: Infinity, haut: Infinity, droite: -Infinity, bas: -Infinity }),
    moveTo: (x, y) => point("M", x, y),
    lineTo: (x, y) => point(trace.ouvert ? "L" : "M", x, y),
    quadraticCurveTo: (cx, cy, x, y) => {
      borner(cx, cy);
      trace.d += `Q${auCentieme(cx)} ${auCentieme(cy)} `;
      point("", x, y);
    },
    // Comme sur un <canvas> : une ligne jusqu'au début de l'arc, puis l'arc dans le sens des aiguilles d'une montre,
    // en quarts de cercle au plus, que le SVG ne confond jamais avec l'arc de l'autre côté.
    arc: (x, y, rayon, debut, fin) => {
      const au = (angle: number) => [x + rayon * Math.cos(angle), y + rayon * Math.sin(angle)] as const;
      point(trace.ouvert ? "L" : "M", ...au(debut));
      const quarts = Math.max(1, Math.ceil((fin - debut) / (Math.PI / 2) - 1e-9));
      for (let i = 1; i <= quarts; i++) point(`A${auCentieme(rayon)} ${auCentieme(rayon)} 0 0 1 `, ...au(debut + ((fin - debut) * i) / quarts));
      borner(x - rayon, y - rayon);
      borner(x + rayon, y + rayon);
    },
    closePath: () => void (trace.d += "Z"),
    fill: () => peindre("remplir", String(pinceau.fillStyle), 0),
    stroke: () => peindre("tracer", String(pinceau.strokeStyle), pinceau.lineWidth / 2),
  };
  dessiner(pinceau);
  return { traits, cadre: { x: tout.gauche, y: tout.haut, largeur: tout.droite - tout.gauche, hauteur: tout.bas - tout.haut } };
}
