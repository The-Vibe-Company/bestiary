import { IllustrationEspece } from "@/components/IllustrationEspece";
import styles from "./AnnonceDuCouple.module.css";

/** US-0958 : un Couple réuni tel que le Récit du retour qui l'a réuni l'annonce : le nom et l'illustration de son Espèce. */
export type CoupleAffiche = { nom: string; illustration: string | null };

/**
 * US-0958 : l'annonce du Couple réuni, en tête du Récit du retour qui l'a réuni, visible sans le déplier : l'illustration
 * de l'Espèce en grand, « Couple réuni » et son nom ; une par Couple quand un même retour en réunit plusieurs. Sur un
 * téléphone, elle tient sur un seul écran. Le bouton vers l'Élevage de l'Espèce s'y ajoutera à l'étape 34.
 */
export function AnnonceDuCouple({ couples }: { couples: CoupleAffiche[] }) {
  return (
    <div className={styles.annonce} data-plusieurs={couples.length > 1 ? "" : undefined}>
      {couples.map((couple) => (
        <figure key={couple.nom} className={styles.couple}>
          <IllustrationEspece espece={couple} format="moyen" className={styles.illustration} />
          <figcaption className={styles.legende}>
            <span className={styles.etiquette}>Couple réuni</span> <strong className={styles.espece}>{couple.nom}</strong>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
