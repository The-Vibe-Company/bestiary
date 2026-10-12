import styles from "./PlacesDeLHabitat.module.css";

/** US-0822 : un nombre de Places à la française, « 12 819 », à espace insécable : il ne se coupe pas en fin de ligne. */
const entier = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/\s/g, " ");

/**
 * US-0822 : le compteur des Places de l'Habitat du Foyer, « Places : 21 / 500 » : celles que prennent les Bêtes du joueur,
 * leur somme exacte arrondie à la Place entière supérieure (une Place entamée est prise), puis toutes celles que
 * l'Habitat offre (src/monde/habitat.ts). Le même sur la page Bêtes et dans le bloc « Élever ».
 */
export function PlacesDeLHabitat({ occupees, total }: { occupees: number; total: number }) {
  return (
    <p className={styles.places}>
      Places : <strong className={styles.nombres}>{`${entier(Math.ceil(occupees))} / ${entier(total)}`}</strong>
    </p>
  );
}
