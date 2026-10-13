// L'échantillon de la carte (US-0432) : une Case dessinée par la carte elle-même, en SVG, pour la légende de la carte et,
// US-0806, pour le pictogramme d'un Biome sur la fiche d'une Espèce. Un dessin pur, sans état ni rien du navigateur : la
// légende (composant du navigateur) comme la fiche (rendue sur le serveur) l'importent.
import type { CSSProperties } from "react";
import { couleur } from "@/monde/couleurs-de-la-carte";
import type { Coordonnees } from "@/monde/hex";
import { type CarteADessiner, dessinerLaCarte, enSvg, type Peinture, type TraitSvg, vueSurLeFoyer } from "./dessin";
import styles from "./Legende.module.css";

/** Les couleurs de la carte en CSS, que le SVG comprend telles quelles : celles que CarteDuJeu donne au <canvas> (un test le vérifie). */
const PEINTURE: Omit<Peinture, "fonds"> = {
  bord: "color-mix(in oklch, var(--bois-sombre) 38%, transparent)",
  motifSombre: "color-mix(in oklch, var(--bois-sombre) 30%, transparent)",
  motifClair: "color-mix(in oklch, var(--ivoire) 50%, transparent)",
  encre: "var(--encre)",
  repere: "var(--citron)",
  // Aucune Case n'est choisie dans un échantillon.
  surlignage: {
    voile: "color-mix(in oklch, var(--cuivre-pale) 22%, transparent)",
    halo: "color-mix(in oklch, var(--cuivre) 65%, transparent)",
    trait: "var(--cuivre-pale)",
    anneau: "color-mix(in oklch, var(--cuivre-clair) 75%, transparent)",
  },
};

/** La Case d'un échantillon, et un Foyer assez loin pour ne pas y paraître. */
export const ICI: Coordonnees = { q: 0, r: 0 };
const AILLEURS: Coordonnees = { q: 1000, r: 0 };
/** La carte à la taille de son ouverture, sur 120 pixels de côté : les deux Cases d'une limite y tiennent. */
const VUE = vueSurLeFoyer(ICI, 120, 120);
/** Une seule Case, en (0, 0), hors de la Couronne et du Cœur sauvage. */
const UNE_CASE = { q: [ICI.q], r: [ICI.r], teinte: [0], zone: [0] };
/** Un nombre de style SVG, au centième de pixel. */
const auCentieme = (n: number) => Math.round(n * 100) / 100;
/** US-0433 : l'opacité d'un remplissage ou d'un trait, quand il n'est pas opaque. */
const opacite = (t: TraitSvg) => (t.opacite < 1 ? t.opacite : undefined);

/** Le style SVG d'un trait de la carte : sa couleur, son épaisseur, ses bouts et ses jointures ; US-0433 : ses tirets et son opacité. */
function trait(t: TraitSvg): CSSProperties {
  return {
    fill: "none",
    stroke: t.couleur,
    strokeWidth: t.epaisseur,
    strokeLinecap: t.bouts,
    strokeLinejoin: t.jointures,
    strokeDasharray: t.tirets.length > 0 ? t.tirets.map(auCentieme).join(" ") : undefined,
    strokeDashoffset: t.tirets.length > 0 ? auCentieme(t.decalage) : undefined,
    opacity: opacite(t),
  };
}

/**
 * US-0432 : un échantillon de la carte, une seule Case de `teinte` (ou les Cases `cases`, toutes de cette teinte),
 * dessinée par la carte elle-même à la taille de son ouverture, écrite en SVG : la même couleur, le même motif, le
 * même bord ; avec son Foyer ou celui d'un autre chef. US-0433 : avec le liseré d'une limite. US-0806 : le pictogramme
 * d'un Biome, sur la fiche d'une Espèce, rendu sur le serveur : ce module n'a rien du navigateur.
 */
export function Echantillon({ teinte, cases = UNE_CASE, foyer = AILLEURS, foyers = [] }: { teinte: string; cases?: CarteADessiner["cases"]; foyer?: Coordonnees; foyers?: Coordonnees[] }) {
  const carte = { teintes: [teinte], cases, foyer, foyers };
  const { traits, cadre } = enSvg((pinceau) => dessinerLaCarte(pinceau, carte, VUE, { ...PEINTURE, fonds: [couleur(teinte)] }));
  const [x, y, largeur, hauteur] = [cadre.x, cadre.y, cadre.largeur, cadre.hauteur].map(auCentieme);
  return (
    <svg
      className={styles.echantillon}
      viewBox={`${x} ${y} ${largeur} ${hauteur}`}
      width={largeur}
      height={hauteur}
      preserveAspectRatio="xMinYMid meet"
      aria-hidden="true"
    >
      {traits.map((t, i) => (
        <path key={i} d={t.d} style={t.geste === "remplir" ? { fill: t.couleur, opacity: opacite(t) } : trait(t)} />
      ))}
    </svg>
  );
}
