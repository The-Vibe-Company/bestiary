// Ce que montre la carte du Monde d'un geste à l'autre (US-0420) : où regarde le milieu de l'écran, et de quelle
// taille sont les Cases. Des calculs seuls, sans rien demander au navigateur : ils se vérifient à part. Le dessin
// (dessin.ts) reçoit la vue telle quelle ; son milieu est une Case en coordonnées non entières, entre deux Cases.
import { anneau, centre, DIRECTIONS, type Coordonnees } from "@/monde/hex";
import { CARTE_DEBORD_CASES, CARTE_PAS_CLAVIER_CASES, CARTE_ZOOM_LARGE_CASES, CARTE_ZOOM_PROCHE_CASES, MONDE_RAYON } from "@/reglages";
import { aLEcran, type Cadre, type CarteADessiner, type Vue, vueSurLeFoyer } from "./dessin";

/** Un point du plan de `centre`, où une Case a un rayon de 1. */
type Point = { x: number; y: number };

/** L'inverse de `centre` : la Case, en coordonnées non entières, dont le centre tombe en p. */
function depuisLePlan(p: Point): Coordonnees {
  const r = p.y / 1.5;
  return { q: p.x / Math.sqrt(3) - r / 2, r };
}

/** Le point du segment [a, b] le plus proche de p. */
function surLeSegment(p: Point, a: Point, b: Point): Point {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/**
 * L'anneau de la Case de la carte la plus éloignée du centre (ou de son Foyer) : le bord du Monde, même sur Aube, qui
 * n'a en base que sa Couronne.
 */
export function rayonDuMonde(carte: CarteADessiner): number {
  let plusLoin = anneau(carte.foyer);
  for (let i = 0; i < carte.cases.q.length; i++) plusLoin = Math.max(plusLoin, anneau({ q: carte.cases.q[i], r: carte.cases.r[i] }));
  return plusLoin;
}

/** US-0420 : jusqu'où peut aller le milieu de l'écran, en anneau : CARTE_DEBORD_CASES au-delà du bord du Monde. */
export function limiteDeLaCarte(carte: CarteADessiner): number {
  return rayonDuMonde(carte) + CARTE_DEBORD_CASES;
}

/**
 * US-0420 : la vue, son milieu ramené à au plus `limite` Cases du centre du Monde : au point le plus proche du
 * grand hexagone de ce rayon. Arrêtée contre son bord, la carte glisse encore le long de lui. Retour d'Antoine
 * (2026-10-15) : éloignée au-delà de la vue large, la limite se resserre avec le zoom (recentrage), jusqu'au centre du
 * Monde au plus loin, où le Monde entier tient à l'écran.
 */
export function borner(vue: Vue, limite: number): Vue {
  const resserree = recentrage(vue) * limite;
  if (anneau(vue.milieu) <= resserree) return vue;
  if (resserree <= 0) return { ...vue, milieu: { q: 0, r: 0 } };
  const ici = centre(vue.milieu);
  const coins = DIRECTIONS.map((d) => centre({ q: d.q * resserree, r: d.r * resserree }));
  const auBord = coins
    .map((coin, i) => surLeSegment(ici, coin, coins[(i + 1) % coins.length]))
    .reduce((a, b) => (Math.hypot(a.x - ici.x, a.y - ici.y) <= Math.hypot(b.x - ici.x, b.y - ici.y) ? a : b));
  return { ...vue, milieu: depuisLePlan(auBord) };
}

/**
 * US-0420 : la vue après avoir fait glisser la carte de (dx, dy) pixels : chaque Case se déplace d'autant à
 * l'écran, sans que le milieu sorte des limites.
 */
export function deplacer(vue: Vue, dx: number, dy: number, limite: number): Vue {
  const ici = centre(vue.milieu);
  return borner({ ...vue, milieu: depuisLePlan({ x: ici.x - dx / vue.rayon, y: ici.y - dy / vue.rayon }) }, limite);
}

/**
 * US-0422 : la vue après un appui sur une flèche du clavier : elle regarde CARTE_PAS_CLAVIER_CASES Cases plus loin,
 * en colonnes vers l'est (1) ou l'ouest (-1), en rangées vers le sud (1) ou le nord (-1), dans les mêmes limites.
 */
export function avancer(vue: Vue, colonnes: number, rangees: number, limite: number): Vue {
  // D'une colonne à l'autre, la largeur d'une Case ; d'une rangée à l'autre, une fois et demie son rayon.
  const [colonne, rangee] = [Math.sqrt(3) * vue.rayon, 1.5 * vue.rayon];
  return deplacer(vue, -colonnes * CARTE_PAS_CLAVIER_CASES * colonne, -rangees * CARTE_PAS_CLAVIER_CASES * rangee, limite);
}

/** US-0423 : le rayon d'une Case à l'écran, en pixels, quand la moitié de la plus petite dimension de la carte couvre `cases` largeurs de Case. */
const rayonPour = (largeur: number, hauteur: number, cases: number) => Math.min(largeur, hauteur) / 2 / cases / Math.sqrt(3);

/**
 * Retour d'Antoine (2026-10-15) : le rayon d'une Case à l'écran, en pixels, où le Monde entier tient sur une carte de
 * `largeur` × `hauteur` pixels, au milieu, sous ses `haut` premiers pixels cachés par la barre du haut (autant laissés
 * en bas, où se posent aussi des boutons) : le grand hexagone de MONDE_RAYON Cases, pointe en haut, fait √3 (2 R + 1)
 * rayons de large et 3 R + 2 de haut ; une Case de marge tout autour.
 */
export function rayonPourToutLeMonde(largeur: number, hauteur: number, haut = 0): number {
  const r = MONDE_RAYON + 1;
  const visible = hauteur - 2 * haut > 0 ? hauteur - 2 * haut : hauteur;
  return Math.min(largeur / (Math.sqrt(3) * (2 * r + 1)), visible / (3 * r + 2));
}

/**
 * US-0423 : le plus petit et le plus grand rayon d'une Case à l'écran, en pixels, sur une carte de `largeur` ×
 * `hauteur` pixels : de la vue la plus éloignée à la vue rapprochée, où la moitié de sa plus petite dimension ne couvre
 * que CARTE_ZOOM_PROCHE_CASES largeurs de Case. Retour d'Antoine (2026-10-15) : au plus loin, le Monde entier tient à
 * l'écran (rayonPourToutLeMonde), sur un téléphone aussi ; jamais moins loin que la vue large d'avant
 * (CARTE_ZOOM_LARGE_CASES).
 */
export function bornesDuZoom(largeur: number, hauteur: number, haut = 0): { min: number; max: number } {
  return {
    min: Math.min(rayonPourToutLeMonde(largeur, hauteur, haut), rayonPour(largeur, hauteur, CARTE_ZOOM_LARGE_CASES)),
    max: rayonPour(largeur, hauteur, CARTE_ZOOM_PROCHE_CASES),
  };
}

/**
 * Retour d'Antoine (2026-10-15) : de combien la limite du milieu de la vue (borner) se resserre à ce zoom : pas du tout
 * jusqu'à la vue large (CARTE_ZOOM_LARGE_CASES), comme avant ; au-delà, d'autant plus que la carte s'éloigne, jusqu'à
 * ramener le milieu au centre du Monde au plus loin (bornesDuZoom), où le Monde entier tient à l'écran. Entre 0 et 1.
 */
export function recentrage(vue: Vue): number {
  if (Math.min(vue.largeur, vue.hauteur) <= 0) return 1;
  const large = rayonPour(vue.largeur, vue.hauteur, CARTE_ZOOM_LARGE_CASES);
  const min = bornesDuZoom(vue.largeur, vue.hauteur, vue.haut).min;
  if (vue.rayon >= large || large <= min) return 1;
  return Math.min(1, Math.max(0, (vue.rayon - min) / (large - min)));
}

/** US-0423 : le rayon d'une Case ramené dans les bornes du zoom ; tel quel tant que la carte n'a pas de place à l'écran. */
function dansLesBornes(rayon: number, largeur: number, hauteur: number, haut = 0): number {
  if (Math.min(largeur, hauteur) <= 0) return rayon;
  const { min, max } = bornesDuZoom(largeur, hauteur, haut);
  return Math.min(max, Math.max(min, rayon));
}

/**
 * US-0425 : si l'on peut encore rapprocher la carte, ou l'éloigner, ou si le zoom est à sa borne (à un milliardième
 * près, les calculs n'y arrivant pas toujours tout juste). Une carte sans place à l'écran ne zoome pas.
 */
export function zoomPossible(vue: Vue): { rapprocher: boolean; eloigner: boolean } {
  if (Math.min(vue.largeur, vue.hauteur) <= 0) return { rapprocher: false, eloigner: false };
  const { min, max } = bornesDuZoom(vue.largeur, vue.hauteur, vue.haut);
  return { rapprocher: vue.rayon < max * (1 - 1e-9), eloigner: vue.rayon > min * (1 + 1e-9) };
}

/**
 * US-0423 : la vue sur une carte de `largeur` × `hauteur` pixels, à l'ouverture ou quand l'écran change de taille :
 * le même endroit au milieu, le zoom ramené dans ses bornes pour cette taille. Retour d'Antoine (2026-10-15) : et `haut`
 * pixels cachés en haut, sous la barre du haut (ceux de la vue si rien n'est dit).
 */
export function cadrer(vue: Vue, largeur: number, hauteur: number, haut = vue.haut): Vue {
  return { ...vue, largeur, hauteur, ...(haut !== undefined && { haut }), rayon: dansLesBornes(vue.rayon, largeur, hauteur, haut) };
}

/**
 * US-0423 : la vue après avoir zoomé d'un `facteur` (plus de 1 : rapprocher) autour du point (x, y) de la carte, en
 * pixels depuis son coin en haut à gauche : ce qui était sous ce point y reste. Le zoom s'arrête à ses bornes, le
 * milieu aux limites de la carte.
 */
export function zoomer(vue: Vue, facteur: number, x: number, y: number, limite: number): Vue {
  const rayon = dansLesBornes(vue.rayon * facteur, vue.largeur, vue.hauteur, vue.haut);
  const [dx, dy] = [x - vue.largeur / 2, y - vue.hauteur / 2];
  const ici = centre(vue.milieu);
  const vise = { x: ici.x + dx / vue.rayon, y: ici.y + dy / vue.rayon };
  return borner({ ...vue, rayon, milieu: depuisLePlan({ x: vise.x - dx / rayon, y: vise.y - dy / rayon }) }, limite);
}

/** US-0426 : la vue au retour sur le Foyer : lui au milieu, au zoom de l'ouverture, ramené dans les bornes de cet écran. */
export function retourAuFoyer(vue: Vue, foyer: Coordonnees): Vue {
  return cadrer(vueSurLeFoyer(foyer, vue.largeur, vue.hauteur), vue.largeur, vue.hauteur, vue.haut);
}

/**
 * US-0426 : la vue à l'instant `t` (de 0 à 1) d'un mouvement de `depart` à `arrivee`, en douceur : lent au départ
 * et à l'arrivée, vif entre les deux. Le milieu de l'écran va droit de l'un à l'autre ; le zoom, d'autant de crans
 * à chaque pas.
 */
export function enChemin(depart: Vue, arrivee: Vue, t: number): Vue {
  const e = t < 0.5 ? 4 * t ** 3 : 1 - (2 - 2 * t) ** 3 / 2;
  const entre = (a: number, b: number) => a * (1 - e) + b * e;
  return { ...arrivee, milieu: { q: entre(depart.milieu.q, arrivee.milieu.q), r: entre(depart.milieu.r, arrivee.milieu.r) }, rayon: depart.rayon ** (1 - e) * arrivee.rayon ** e };
}

/** US-0426 : un rectangle posé sur la carte, en pixels depuis son coin en haut à gauche. */
export type Rectangle = { gauche: number; haut: number; droite: number; bas: number };

/**
 * US-0426 : sur la droite qui part de (x, y) dans la direction (dx, dy), la part de (dx, dy) à faire pour entrer
 * dans le rectangle `r` ; Infinity si elle n'y entre pas, ou si elle part de dedans.
 */
function entreeDans(x: number, y: number, dx: number, dy: number, r: Rectangle): number {
  let [entree, sortie] = [-Infinity, Infinity];
  for (const [depuis, vers, debut, fin] of [
    [x, dx, r.gauche, r.droite],
    [y, dy, r.haut, r.bas],
  ]) {
    if (vers === 0) {
      if (depuis <= debut || depuis >= fin) return Infinity;
      continue;
    }
    const [a, b] = [(debut - depuis) / vers, (fin - depuis) / vers];
    [entree, sortie] = [Math.max(entree, Math.min(a, b)), Math.min(sortie, Math.max(a, b))];
  }
  return entree > 0 && entree < sortie ? entree : Infinity;
}

/**
 * US-0426 : où poser la flèche qui montre le Foyer quand il n'est pas à l'écran (ou qu'il est caché sous ce qui est
 * posé sur la carte, `obstacles`) : sur la droite qui va du milieu de l'écran au Foyer, au plus loin vers lui, son
 * centre à au moins `marge` pixels des bords de la carte et des obstacles ; tournée vers lui (`angle`, en radians,
 * 0 vers la droite, dans le sens des aiguilles d'une montre). null quand le Foyer se voit, ou que la place manque.
 */
export function flecheVersLeFoyer(vue: Vue, foyer: Coordonnees, obstacles: Rectangle[], marge: number): { x: number; y: number; angle: number } | null {
  const { x, y } = aLEcran(foyer, vue);
  const dessous = (r: Rectangle) => x >= r.gauche && x <= r.droite && y >= r.haut && y <= r.bas;
  if (dessous({ gauche: 0, haut: 0, droite: vue.largeur, bas: vue.hauteur }) && !obstacles.some(dessous)) return null;
  const [milieuX, milieuY] = [vue.largeur / 2, vue.hauteur / 2];
  const [dx, dy] = [x - milieuX, y - milieuY];
  // Jusqu'au bord de la carte, moins la marge…
  let t = Math.min(dx === 0 ? Infinity : (milieuX - marge) / Math.abs(dx), dy === 0 ? Infinity : (milieuY - marge) / Math.abs(dy));
  // … ou jusqu'au premier obstacle, élargi de la marge.
  for (const o of obstacles) t = Math.min(t, entreeDans(milieuX, milieuY, dx, dy, { gauche: o.gauche - marge, haut: o.haut - marge, droite: o.droite + marge, bas: o.bas + marge }));
  if (!Number.isFinite(t) || t <= 0) return null;
  return { x: milieuX + t * dx, y: milieuY + t * dy, angle: Math.atan2(dy, dx) };
}

/** US-0428 : la Case entière dont l'hexagone contient la Case non entière c : arrondie sur ses trois axes, dont la somme est nulle. */
function arrondir({ q, r }: Coordonnees): Coordonnees {
  const s = -q - r;
  const [qe, re, se] = [Math.round(q), Math.round(r), Math.round(s)];
  const [dq, dr, ds] = [Math.abs(qe - q), Math.abs(re - r), Math.abs(se - s)];
  // La coordonnée la plus mal arrondie se déduit des deux autres ; + 0 : jamais de « -0 ».
  if (dq > dr && dq > ds) return { q: -re - se + 0, r: re + 0 };
  if (dr > ds) return { q: qe + 0, r: -qe - se + 0 };
  return { q: qe + 0, r: re + 0 };
}

/**
 * US-0428 : la Case de la carte sous le point (x, y), en pixels depuis son coin en haut à gauche : celle dont
 * l'hexagone le contient ; null hors de ses Cases (au-delà du bord du Monde).
 */
export function caseSous(carte: CarteADessiner, vue: Vue, x: number, y: number): Coordonnees | null {
  const ici = centre(vue.milieu);
  const c = arrondir(depuisLePlan({ x: ici.x + (x - vue.largeur / 2) / vue.rayon, y: ici.y + (y - vue.hauteur / 2) / vue.rayon }));
  const { q, r } = carte.cases;
  for (let i = 0; i < q.length; i++) if (q[i] === c.q && r[i] === c.r) return c;
  return null;
}

/** US-0428 : l'écart laissé entre la Case choisie et la fiche qui la cachait, ou le bord de l'écran, en pixels. */
const MARGE_AUTOUR_DE_LA_CASE = 12;

/**
 * US-0428 : la vue où la Case c n'est plus sous `cache` (sa fiche, un rectangle de la carte en pixels depuis son coin
 * en haut à gauche) : la carte glisse juste assez, du côté qui demande le moins, pour que l'hexagone de la Case en
 * sorte sans quitter l'écran, à MARGE_AUTOUR_DE_LA_CASE pixels de l'un et de l'autre. La même vue si la Case n'est
 * pas cachée, ou ne peut pas être montrée ; le milieu reste dans les limites de la carte.
 */
export function devoiler(vue: Vue, c: Coordonnees, cache: Cadre, limite: number): Vue {
  const { x, y } = aLEcran(c, vue);
  // L'hexagone, pointe en haut, et sa marge : sa demi-largeur et sa demi-hauteur.
  const [l, h] = [(Math.sqrt(3) / 2) * vue.rayon + MARGE_AUTOUR_DE_LA_CASE, vue.rayon + MARGE_AUTOUR_DE_LA_CASE];
  if (x + l <= cache.x || x - l >= cache.x + cache.largeur || y + h <= cache.y || y - h >= cache.y + cache.hauteur) return vue;
  // Vers la gauche, la droite, le haut ou le bas : chacun tant que la Case reste à l'écran de ce côté.
  const [gauche, droite, haut, bas] = [cache.x - (x + l), cache.x + cache.largeur - (x - l), cache.y - (y + h), cache.y + cache.hauteur - (y - h)];
  const glissements = [
    ...(x + gauche - l >= 0 ? [[gauche, 0]] : []),
    ...(x + droite + l <= vue.largeur ? [[droite, 0]] : []),
    ...(y + haut - h >= 0 ? [[0, haut]] : []),
    ...(y + bas + h <= vue.hauteur ? [[0, bas]] : []),
  ];
  if (glissements.length === 0) return vue;
  const [dx, dy] = glissements.reduce((a, b) => (Math.hypot(a[0], a[1]) <= Math.hypot(b[0], b[1]) ? a : b));
  return deplacer(vue, dx, dy, limite);
}
