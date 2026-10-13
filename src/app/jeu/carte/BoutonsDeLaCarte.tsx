import { CARTE_CRAN_DE_ZOOM } from "@/reglages";
import styles from "./BoutonsDeLaCarte.module.css";

/**
 * US-0425 : « + » au-dessus de « − », par-dessus la carte, en bas à droite : chaque appui la zoome d'un cran
 * (`zoomer`, du facteur du cran), autour du milieu de l'écran. Un bouton est grisé quand sa limite de zoom est
 * atteinte (`rapprocher`, `eloigner` : si l'on peut encore). US-0426 : au-dessus d'eux, le bouton qui ramène la carte
 * sur le Foyer (`revenir`), une hutte de cuivre pour icône. Tous dans une même colonne de verre, séparés de filets.
 */
export function BoutonsDeLaCarte({ rapprocher, eloigner, zoomer, revenir }: { rapprocher: boolean; eloigner: boolean; zoomer: (facteur: number) => void; revenir: () => void }) {
  return (
    <div className={styles.boutons} data-sur-la-carte="">
      <button type="button" className={`${styles.bouton} ${styles.foyer}`} aria-label="Revenir au Foyer" onClick={revenir}>
        <svg className={styles.hutte} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M1.8 8.4 8 2.6l6.2 5.8M3.6 7v6.6h8.8V7M6.6 13.6V10h2.8v3.6" />
        </svg>
      </button>
      <button type="button" className={styles.bouton} aria-label="Zoomer" disabled={!rapprocher} onClick={() => zoomer(CARTE_CRAN_DE_ZOOM)}>
        +
      </button>
      <span className={styles.filet} aria-hidden="true" />
      <button type="button" className={styles.bouton} aria-label="Dézoomer" disabled={!eloigner} onClick={() => zoomer(1 / CARTE_CRAN_DE_ZOOM)}>
        −
      </button>
    </div>
  );
}
