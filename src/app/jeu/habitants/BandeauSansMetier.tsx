import Link from "next/link";
import kit from "@/components/kit.module.css";
import styles from "./ListeDesHabitants.module.css";

/** US-0313 : « 1 Habitant sans Métier », « 2 Habitants sans Métier ». */
const sansMetierEnMots = (nombre: number) => `${nombre} ${nombre > 1 ? "Habitants" : "Habitant"} sans Métier`;

/**
 * US-0313 : en tête des Habitants, à droite de leur titre, le nombre d'Habitants sans Métier et « Voir », qui mène à la
 * liste filtrée sur eux (US-0314) : un avertissement court, sur son filet de braise, le point de braise devant. Compté
 * par la liste sur les Habitants qu'elle montre (ListeDesHabitants) : il baisse dès qu'un Métier est donné et s'en va
 * avec le dernier, sans recharger la page.
 */
export function BandeauSansMetier({ nombre }: { nombre: number }) {
  if (nombre === 0) return null;
  return (
    <p className={`${kit.alerte} ${styles.sansMetier}`}>
      <span className={kit.repere} aria-hidden="true" />
      <strong className={styles.nombreSansMetier}>{sansMetierEnMots(nombre)}</strong>
      <Link href="/jeu/habitants?metier=sans" className={styles.voirSansMetier}>
        Voir
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M4.5 3 7.5 6 4.5 9" />
        </svg>
      </Link>
    </p>
  );
}
