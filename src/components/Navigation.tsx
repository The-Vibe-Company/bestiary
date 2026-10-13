"use client";

import { getImageProps } from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import styles from "./BarreHaut.module.css";
import { ENTREES_DU_JEU, entreeOuverte, PAGE_HABITANTS, PAGE_RECITS } from "./entrees-du-jeu";

/**
 * Le médaillon de chaque entrée, son illustration servie par Next en petit, assez pour un rond net sur un écran haute
 * densité ; la hutte du chef plus grande, pour la recadrer sur son toit. Il ne sert qu'aux yeux : il est peint par la
 * feuille de style autour du nom de l'entrée, qui seul se lit.
 */
const MEDAILLONS = new Map(
  ENTREES_DU_JEU.map((entree) => {
    const { src } = getImageProps({ src: entree.icone, alt: "", width: entree.hutte ? 288 : 96, height: entree.hutte ? 192 : 96 }).props;
    return [entree.chemin, { "--icone": `url("${src}")` } as CSSProperties];
  }),
);

/** « 1 non lu », « 2 non lus » : le nombre tel qu'un lecteur d'écran le dit. */
const nonLusEnMots = (nombre: number) => `${nombre} ${nombre > 1 ? "non lus" : "non lu"}`;

/** US-0332 : « un Voyageur attend », « 2 Voyageurs attendent ». */
const voyageursEnMots = (nombre: number) => (nombre > 1 ? `${nombre} Voyageurs attendent` : "un Voyageur attend");

/** US-0313 : ce que signale le repère de l'entrée « Habitants » : « 2 sans Métier, un Voyageur attend », ou rien. */
function signalesEnMots(sansMetier: number, voyageurs: number): string | null {
  const signales = [sansMetier > 0 ? `${sansMetier} sans Métier` : null, voyageurs > 0 ? voyageursEnMots(voyageurs) : null].filter(Boolean);
  return signales.length > 0 ? signales.join(", ") : null;
}

/**
 * US-0302 : la navigation du jeu, une fois le joueur entré dans son Foyer : six entrées dans la barre du haut, sur
 * toutes les tailles (sur un téléphone, une rangée sous les Stocks ; voir BarreHaut.module.css). Chaque entrée, son
 * médaillon peint (dessiné par la feuille de style, il ne sert qu'aux yeux) puis son nom ; l'Expédition, l'action du jeu,
 * a l'anneau de cuivre plein. L'entrée de la page affichée passe en crème, son médaillon prend l'anneau vif et sa lueur,
 * soulignée d'un trait de cuivre et marquée d'un losange : jamais la couleur seule ; elle seule paraît choisie. US-0810 :
 * la page Bêtes, qu'ouvre le Foyer, marque le Foyer.
 * US-0324 : l'entrée « Récits » porte en pastille le nombre de Récits non lus, s'il y en a, et le dit dans son nom
 * (« Récits, 2 non lus »). US-0332 : l'entrée « Habitants » porte un point, sans chiffre, quand des Voyageurs attendent
 * aux portes, et le dit dans son nom (« Habitants, un Voyageur attend »). US-0313 : le même point, un seul, quand des
 * Habitants sont sans Métier ; le nom dit alors les deux (« Habitants, 2 sans Métier, un Voyageur attend »).
 */
export function Navigation({ recitsNonLus = 0, voyageurs = 0, sansMetier = 0 }: { recitsNonLus?: number; voyageurs?: number; sansMetier?: number }) {
  const page = usePathname();
  return (
    <nav className={styles.navigation} data-onglets="">
      <ul className={styles.entrees}>
        {ENTREES_DU_JEU.map((entree) => {
          const nonLus = entree.chemin === PAGE_RECITS ? recitsNonLus : 0;
          const signales = entree.chemin === PAGE_HABITANTS ? signalesEnMots(sansMetier, voyageurs) : null;
          const precision = nonLus > 0 ? nonLusEnMots(nonLus) : signales;
          return (
            <li key={entree.chemin} className={styles.place}>
              <Link
                href={entree.chemin}
                className={styles.entree}
                style={MEDAILLONS.get(entree.chemin)}
                data-principale={entree.section ? "" : undefined}
                data-hutte={entree.hutte ? "" : undefined}
                aria-current={entreeOuverte(entree, page) ? "page" : undefined}
                aria-label={precision ? `${entree.libelle}, ${precision}` : undefined}
              >
                <span className={styles.libelle}>{entree.libelle}</span>
                {nonLus > 0 ? (
                  <span className={styles.pastille} aria-hidden="true">
                    {nonLus > 99 ? "99+" : nonLus}
                  </span>
                ) : null}
                {signales ? <span className={styles.repere} aria-hidden="true" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
