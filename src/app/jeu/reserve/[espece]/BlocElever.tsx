"use client";

import { useActionState, useId } from "react";
import { Bloc } from "@/components/Bloc";
import { type EtatDeLElevage, elever } from "./actions";
import styles from "./BlocElever.module.css";

const SANS_REFUS: EtatDeLElevage = { refus: null };

/**
 * US-0812 : le bloc « Élever » de la fiche d'une Espèce dont le joueur a réuni le Couple (la fiche ne le pose que pour
 * elles), ancré en « #elever » pour que le récit du Couple réuni y mène (US-0958). Son bouton « Élever » demande
 * l'Élevage de l'Espèce (actions.ts), qui refuse toute Espèce sans Couple et le dit, juste dessous ; il reste grisé tant
 * que l'Élevage ne se lance pas : l'éleveur (US-0843), la quantité (US-0813) et le lancement (US-0815) arrivent ensuite.
 */
export function BlocElever({ especeId }: { especeId: string }) {
  const [{ refus }, envoyer] = useActionState(elever, SANS_REFUS);
  const idRefus = useId();
  return (
    <div id="elever" className={styles.elever}>
      <Bloc titre="Élever">
        <form action={envoyer}>
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
