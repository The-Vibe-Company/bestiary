// Le relief peint des Cases de la carte du Monde : la lumière du soir sur chaque Case, comme sur les pièces du plateau
// peint (public/illustrations/accueil/plateau.webp). Côté navigateur : il se peint sur une petite toile à part.
import { SOMMETS_DE_CASE } from "@/monde/hex";
import type { Vue } from "./dessin";

/** Les couleurs du relief, telles que le <canvas> les comprend : la lumière qui vient d'en haut, l'ombre des bords. */
export type CouleursDuRelief = { lumiere: string; ombre: string };

/**
 * Ce que la carte pose sur ses Cases : sur la terre et l'eau découvertes, une Case taillée comme une pièce, éclairée en
 * haut à gauche, ombrée vers le bas et sur ses bords, son arête claire au-dessus et sombre dessous ; sous le brouillard,
 * des nuages qui moutonnent d'une Case à l'autre, sans rien laisser voir des Cases dessous.
 */
export type SorteDeRelief = "terre" | "brume";

/** Les nuages du brouillard sur un motif de 12 Cases de large : où chacun se tient (en fractions du motif), sa taille (en rayons de Case), clair ou sombre. */
const NUAGES: readonly { x: number; y: number; taille: number; clair: boolean }[] = [
  { x: 0.08, y: 0.12, taille: 4.2, clair: true },
  { x: 0.42, y: 0.06, taille: 3.4, clair: false },
  { x: 0.7, y: 0.22, taille: 5, clair: true },
  { x: 0.22, y: 0.45, taille: 3.8, clair: false },
  { x: 0.55, y: 0.52, taille: 4.6, clair: true },
  { x: 0.9, y: 0.6, taille: 3.2, clair: false },
  { x: 0.12, y: 0.78, taille: 4.8, clair: true },
  { x: 0.46, y: 0.88, taille: 3.6, clair: false },
  { x: 0.78, y: 0.92, taille: 4, clair: true },
  { x: 0.33, y: 0.25, taille: 2.6, clair: true },
  { x: 0.86, y: 0.36, taille: 2.4, clair: true },
  { x: 0.64, y: 0.74, taille: 2.8, clair: false },
];

/**
 * US-0437 : le motif des nuages du brouillard, de `rayon` pixels par Case : de grands nuages doux, clairs et sombres, qui
 * se répètent sans couture (chaque nuage repeint de l'autre côté des bords qu'il passe), sur 12 Cases de large et 12 de
 * haut, pour que le motif ne se voie pas.
 */
function peindreLesNuages(rayon: number, densite: number, couleurs: CouleursDuRelief): HTMLCanvasElement | null {
  const [largeur, hauteur] = [12 * Math.sqrt(3) * rayon, 18 * rayon];
  const toile = document.createElement("canvas");
  toile.width = Math.max(1, Math.round(largeur * densite));
  toile.height = Math.max(1, Math.round(hauteur * densite));
  const pinceau = toile.getContext("2d");
  if (!pinceau || typeof pinceau.createRadialGradient !== "function" || typeof pinceau.createPattern !== "function") return null;
  pinceau.scale(toile.width / largeur, toile.height / hauteur);
  for (const { x, y, taille, clair } of NUAGES) {
    for (const dx of [-largeur, 0, largeur]) {
      for (const dy of [-hauteur, 0, hauteur]) {
        const [cx, cy, r] = [x * largeur + dx, y * hauteur + dy, taille * rayon];
        if (cx + r < 0 || cx - r > largeur || cy + r < 0 || cy - r > hauteur) continue;
        const nuage = pinceau.createRadialGradient(cx, cy - 0.2 * r, 0, cx, cy, r);
        nuage.addColorStop(0, clair ? couleurs.lumiere : couleurs.ombre);
        nuage.addColorStop(1, "transparent");
        pinceau.fillStyle = nuage;
        pinceau.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      }
    }
  }
  return toile;
}

/**
 * Le motif d'une rangée de Cases, de `rayon` pixels, sur une petite toile de `densite` pixels par pixel de la carte : il
 * se répète d'un bout à l'autre du Monde, chaque Case du motif sur une Case de la carte. Les Cases sont pointe en haut :
 * une rangée sur deux est décalée d'une demi-Case, et le motif fait deux rangées de haut (3 rayons) sur une Case de large
 * (√3 rayons). Null si le navigateur ne sait pas peindre de motif.
 */
function peindreLeMotif(rayon: number, densite: number, sorte: SorteDeRelief, couleurs: CouleursDuRelief): HTMLCanvasElement | null {
  if (sorte === "brume") return peindreLesNuages(rayon, densite, couleurs);
  const [largeur, hauteur] = [Math.sqrt(3) * rayon, 3 * rayon];
  const toile = document.createElement("canvas");
  toile.width = Math.max(1, Math.round(largeur * densite));
  toile.height = Math.max(1, Math.round(hauteur * densite));
  const pinceau = toile.getContext("2d");
  if (!pinceau || typeof pinceau.createRadialGradient !== "function" || typeof pinceau.createPattern !== "function") return null;
  pinceau.scale(toile.width / largeur, toile.height / hauteur);
  // Toutes les Cases qui touchent le motif, ses bords compris : la rangée d'au-dessus et celle d'en dessous.
  for (let rangee = -1; rangee <= 2; rangee++) {
    for (let colonne = -2; colonne <= 2; colonne++) {
      const x = largeur * (colonne + rangee / 2);
      const y = 1.5 * rayon * rangee;
      if (x < -largeur || x > 2 * largeur) continue;
      pinceau.save();
      pinceau.beginPath();
      SOMMETS_DE_CASE.forEach((s, i) => (i === 0 ? pinceau.moveTo(x + s.x * rayon, y + s.y * rayon) : pinceau.lineTo(x + s.x * rayon, y + s.y * rayon)));
      pinceau.closePath();
      pinceau.clip();
      {
        // La lumière d'en haut à gauche, puis l'ombre qui gagne les bords.
        const lumiere = pinceau.createRadialGradient(x - 0.35 * rayon, y - 0.5 * rayon, 0, x - 0.35 * rayon, y - 0.5 * rayon, 1.1 * rayon);
        lumiere.addColorStop(0, couleurs.lumiere);
        lumiere.addColorStop(1, "transparent");
        pinceau.fillStyle = lumiere;
        pinceau.fillRect(x - rayon, y - rayon, 2 * rayon, 2 * rayon);
        const ombre = pinceau.createRadialGradient(x + 0.1 * rayon, y + 0.15 * rayon, 0.45 * rayon, x + 0.1 * rayon, y + 0.15 * rayon, 1.15 * rayon);
        ombre.addColorStop(0, "transparent");
        ombre.addColorStop(1, couleurs.ombre);
        pinceau.fillStyle = ombre;
        pinceau.fillRect(x - rayon, y - rayon, 2 * rayon, 2 * rayon);
        // L'arête : claire sur les trois côtés tournés vers la lumière (de la gauche à la pointe du haut, puis à droite),
        // sombre sur les trois autres ; la Case découpe la moitié du trait qui en sort.
        pinceau.lineWidth = Math.max(1.5, 0.16 * rayon);
        pinceau.lineJoin = "round";
        for (const [sommets, couleur] of [
          [[4, 5, 0, 1], couleurs.lumiere],
          [[1, 2, 3, 4], couleurs.ombre],
        ] as const) {
          pinceau.beginPath();
          sommets.forEach((i, rang) => (rang === 0 ? pinceau.moveTo : pinceau.lineTo).call(pinceau, x + SOMMETS_DE_CASE[i].x * rayon, y + SOMMETS_DE_CASE[i].y * rayon));
          pinceau.strokeStyle = couleur;
          pinceau.stroke();
        }
      }
      pinceau.restore();
    }
  }
  return toile;
}

/**
 * Le relief à poser sur les Cases d'une `sorte`, pour une vue : le motif, recalé sur la Case (0, 0) de la carte, là où
 * la vue la met. Le motif n'est repeint que quand les Cases changent de taille (au zoom) ; sinon il n'est que recalé.
 * `pinceau` : celui de la carte, qui fait le motif ; `densite` : les pixels de l'écran par pixel de la carte.
 */
export function reliefDesCases(pinceau: CanvasRenderingContext2D, sorte: SorteDeRelief, couleurs: CouleursDuRelief): (vue: Vue, origine: { x: number; y: number }, densite: number) => CanvasPattern | null {
  let connu: { rayon: number; densite: number; motif: CanvasPattern | null; largeur: number; hauteur: number } | null = null;
  return (vue, origine, densite) => {
    if (typeof pinceau.createPattern !== "function" || typeof DOMMatrix === "undefined") return null;
    if (!connu || connu.rayon !== vue.rayon || connu.densite !== densite) {
      const toile = peindreLeMotif(vue.rayon, densite, sorte, couleurs);
      connu = { rayon: vue.rayon, densite, motif: toile && pinceau.createPattern(toile, "repeat"), largeur: toile?.width ?? 1, hauteur: toile?.height ?? 1 };
    }
    const { motif, largeur, hauteur } = connu;
    if (!motif) return null;
    // La taille du motif sur la carte : une Case et deux rangées pour la terre, 12 Cases et 12 rangées pour les nuages.
    const [cases, rangees] = sorte === "brume" ? [12, 12] : [1, 2];
    motif.setTransform(new DOMMatrix([(cases * Math.sqrt(3) * vue.rayon) / largeur, 0, 0, (rangees * 1.5 * vue.rayon) / hauteur, origine.x, origine.y]));
    return motif;
  };
}
