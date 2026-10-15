"use client";

import Link from "next/link";
import { Bloc } from "@/components/Bloc";
import { Medaillon } from "@/components/Medaillon";
import { type ElevageEnCours, ouEnEstLElevage, prochaineNaissance, tempsAvant } from "@/monde/suivi-d-elevage";
import { useHeureDuJeu, useRelireLaPageA } from "@/temps/heure-du-jeu";
import styles from "./page.module.css";

/** Un nombre de Bêtes à la française, « 1 200 », à espace insécable. */
const entier = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/\s/g, " ");

/**
 * US-0818 : le bloc « Élevages » de l'accueil, sous les Bêtes : chaque Élevage en cours du Territoire, un par éleveur
 * (elevagesEnCours), sur sa ligne : le médaillon de la peinture de son Espèce, son nom, son éleveur et le temps avant la
 * prochaine Bête, puis les Bêtes nées sur la quantité demandée ; la ligne mène au bloc « Élever » de la fiche de l'Espèce.
 * Sans Élevage en cours : « Aucun Élevage en cours ». Tout se lit de l'heure du jeu, partie de `maintenant` et qui avance
 * au rythme du jeu (`vitesse`, useHeureDuJeu) : le décompte avance sans recharger, un Élevage fini quitte le bloc, et la
 * page se relit une seconde réelle après chaque naissance (le total des Bêtes).
 */
export function ElevagesEnCours({ elevages, maintenant, vitesse = 1 }: { elevages: ElevageEnCours[]; maintenant: Date; vitesse?: number }) {
  const instant = useHeureDuJeu(maintenant, vitesse);
  useRelireLaPageA(prochaineNaissance(elevages, maintenant), maintenant, vitesse);
  const enCours = elevages.map((elevage) => ({ elevage, ...ouEnEstLElevage(elevage, instant) })).filter(({ prochaine }) => prochaine !== null);
  return (
    <Bloc titre="Élevages" verre className={styles.elevages}>
      {enCours.length === 0 ? (
        <p className={styles.aucunElevage}>Aucun Élevage en cours</p>
      ) : (
        <ul className={styles.listeElevages}>
          {enCours.map(({ elevage, nees, prochaine }) => (
            <li key={elevage.especeId}>
              <Link href={`/jeu/reserve/${elevage.especeId}#elever`} className={styles.ligneElevage}>
                <Medaillon src={elevage.illustration ? `/illustrations/${elevage.illustration}` : undefined} taille="md" plein />
                <span className={styles.especeElevee}>
                  <span className={styles.nomElevage}>{elevage.espece}</span>
                  <span className={styles.detailElevage}>{`${elevage.eleveur ?? "Aucun éleveur"} · prochaine dans ${tempsAvant(prochaine!, instant)}`}</span>
                </span>
                <span className={styles.neesElevage}>{`${entier(nees)} / ${entier(elevage.quantite)}`}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Bloc>
  );
}
