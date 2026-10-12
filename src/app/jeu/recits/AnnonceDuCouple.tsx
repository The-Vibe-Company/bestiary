import Link from "next/link";
import { IllustrationEspece } from "@/components/IllustrationEspece";
import styles from "./AnnonceDuCouple.module.css";

/**
 * US-0958 : un Couple réuni tel que le Récit du retour qui l'a réuni l'annonce : le nom et l'illustration de son Espèce ;
 * US-0812 : et son identifiant, pour mener au bloc « Élever » de sa fiche.
 */
export type CoupleAffiche = { especeId: string; nom: string; illustration: string | null };

/**
 * US-0958 : l'annonce du Couple réuni, en tête du Récit du retour qui l'a réuni, visible sans le déplier : l'illustration
 * de l'Espèce en grand, « Couple réuni » et son nom ; une par Couple quand un même retour en réunit plusieurs. Sur un
 * téléphone, elle tient sur un seul écran. US-0812 : le lien « Élever » mène au bloc « Élever » de la fiche de l'Espèce
 * (/jeu/reserve/<Espèce>#elever) ; un lecteur d'écran l'entend avec le nom de l'Espèce.
 */
export function AnnonceDuCouple({ couples }: { couples: CoupleAffiche[] }) {
  return (
    <div className={styles.annonce} data-plusieurs={couples.length > 1 ? "" : undefined}>
      {couples.map((couple) => (
        <figure key={couple.especeId} className={styles.couple}>
          <IllustrationEspece espece={couple} format="moyen" className={styles.illustration} />
          <figcaption className={styles.legende}>
            <span className={styles.etiquette}>Couple réuni</span> <strong className={styles.espece}>{couple.nom}</strong>{" "}
            <Link href={`/jeu/reserve/${couple.especeId}#elever`} className={styles.elever} aria-label={`Élever : ${couple.nom}`}>
              Élever
            </Link>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
