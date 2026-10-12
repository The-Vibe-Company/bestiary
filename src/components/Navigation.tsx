"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./BarreHaut.module.css";

/** La page Habitants, dont l'entrée signale les Habitants sans Métier (US-0313) et les Voyageurs aux portes (US-0332). */
const PAGE_HABITANTS = "/jeu/habitants";
/** La page Récits (US-0324), dont l'entrée porte le nombre de Récits non lus. */
const PAGE_RECITS = "/jeu/recits";

/**
 * Les pages du jeu qu'on ouvre depuis la navigation, dans leur ordre ; la carte du Monde juste après le Foyer (US-0417).
 * US-0901 : puis l'écran d'Expédition, le même que depuis la fiche d'une Case, sans destination choisie. US-0911 : son
 * entrée vaut pour toutes les pages des Expéditions (`section`), la liste des Expéditions en cours comprise. US-0801 :
 * puis la Réserve, le lieu protégé où vivent les Couples.
 */
const ENTREES_DU_JEU: readonly { chemin: string; section?: string; libelle: string }[] = [
  { chemin: "/jeu", libelle: "Foyer" },
  { chemin: "/jeu/carte", libelle: "Carte" },
  { chemin: "/jeu/expeditions/nouvelle", section: "/jeu/expeditions", libelle: "Expéditions" },
  { chemin: "/jeu/reserve", libelle: "Réserve" },
  { chemin: PAGE_HABITANTS, libelle: "Habitants" },
  { chemin: PAGE_RECITS, libelle: "Récits" },
];

/** L'entrée de la page affichée : « /jeu » pour le Foyer seul, une autre entrée pour ses pages filles aussi. */
function estOuverte(chemin: string, page: string): boolean {
  if (chemin === "/jeu") return page === chemin;
  return page === chemin || page.startsWith(`${chemin}/`);
}

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
 * US-0302 : la navigation du jeu, une fois le joueur entré dans son Foyer. Sur ordinateur, dans la
 * barre du haut à droite du logo ; sur mobile, en onglets fixés en bas de l'écran, au pouce (voir
 * BarreHaut.module.css). L'entrée de la page affichée est marquée, d'un trait et pas de la couleur seule.
 * US-0324 : l'entrée « Récits » porte en pastille le nombre de Récits non lus, s'il y en a, et le dit
 * dans son nom (« Récits, 2 non lus »). US-0332 : l'entrée « Habitants » porte un point, sans chiffre,
 * quand des Voyageurs attendent aux portes, et le dit dans son nom (« Habitants, un Voyageur attend »).
 * US-0313 : le même point, un seul, quand des Habitants sont sans Métier ; le nom dit alors les deux
 * (« Habitants, 2 sans Métier, un Voyageur attend »).
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
            <li key={entree.chemin}>
              <Link
                href={entree.chemin}
                className={styles.entree}
                aria-current={estOuverte(entree.section ?? entree.chemin, page) ? "page" : undefined}
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
