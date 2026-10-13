import kit from "@/components/kit.module.css";
import { centre, SOMMETS_DE_CASE } from "@/monde/hex";
import etats from "./etats.module.css";
import styles from "./page.module.css";

/** Trois Cases en trèfle, de 14 pixels de rayon, chacune de la couleur de son Biome. */
const CASES = [
  { q: 0, r: 0, couleur: "var(--biome-prairie)" },
  { q: 1, r: 0, couleur: "var(--biome-foret)" },
  { q: 0, r: 1, couleur: "var(--biome-eau)" },
].map(({ couleur, ...c }) => {
  const { x, y } = centre(c);
  return { couleur, points: SOMMETS_DE_CASE.map((s) => `${((x + s.x) * 14).toFixed(2)},${((y + s.y) * 14).toFixed(2)}`).join(" ") };
});

/**
 * US-0434 : l'attente de la carte, un petit panneau de verre au milieu de sa place, sur la mer du soir, où trois Cases
 * palpitent, sans un mot (les lecteurs d'écran entendent « Chargement de la carte »). Elle vient avec la page, dès son premier affichage, et la couvre
 * jusqu'à ce que la carte soit dessinée : son <canvas> prend alors sa taille, et la feuille de style la cache. Aucune
 * frontière de chargement (loading.tsx) : React en remettrait l'éveil de la carte après la présence que note la
 * barre du haut, un aller-retour de plus.
 */
export function Attente() {
  return (
    <div className={etats.attente}>
      <section className={`${kit.panneau} ${kit.verre} ${etats.etat}`}>
        <p role="status" className={styles.annonce}>
          Chargement de la carte
        </p>
        <svg viewBox="-14 -15 52 50" width="52" height="50" aria-hidden="true">
          {CASES.map(({ couleur, points }) => (
            <polygon key={points} className={etats.case} points={points} style={{ fill: couleur }} />
          ))}
        </svg>
      </section>
    </div>
  );
}
