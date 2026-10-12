"use client";

import { useActionState, useId } from "react";
import { Bloc } from "@/components/Bloc";
import { PlacesDeLHabitat } from "@/components/PlacesDeLHabitat";
import { type EtatDeLElevage, elever } from "./actions";
import styles from "./BlocElever.module.css";

const SANS_REFUS: EtatDeLElevage = { refus: null };

/**
 * US-0812 : le bloc « Élever » de la fiche d'une Espèce dont le joueur a réuni le Couple (la fiche ne le pose que pour
 * elles), ancré en « #elever » pour que le récit du Couple réuni y mène (US-0958). Son bouton « Élever » demande
 * l'Élevage de l'Espèce (actions.ts), qui refuse toute Espèce sans Couple et le dit, juste dessous ; il reste grisé tant
 * que l'Élevage ne se lance pas : l'éleveur (US-0843), la quantité (US-0813) et le lancement (US-0815) arrivent ensuite.
 * US-0822 : au-dessus du bouton, le même compteur des Places de l'Habitat du Foyer que la page Bêtes.
 */
export function BlocElever({ especeId, places }: { especeId: string; places: { occupees: number; total: number } }) {
  const [{ refus }, envoyer] = useActionState(elever, SANS_REFUS);
  const idRefus = useId();
  return (
    <div id="elever" className={styles.elever}>
      <Bloc titre="Élever">
        <PlacesDeLHabitat {...places} />
        <form action={envoyer} className={styles.formulaire}>
          <input type="hidden" name="espece" value={especeId} />
          <button type="submit" className={styles.bouton} disabled aria-describedby={refus ? idRefus : undefined}>
            Élever
          </button>
          {refus ? (
            <p id={idRefus} className={styles.refus} role="alert">
              {refus}
            </p>
          ) : null}
        </form>
      </Bloc>
    </div>
  );
}
