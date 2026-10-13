"use client";

import { useSearchParams } from "next/navigation";
import { Bloc } from "@/components/Bloc";
import kit from "@/components/kit.module.css";
import { Medaillon } from "@/components/Medaillon";
import type { Explorateurs as ExplorateursDuTerritoire } from "@/monde/explorateurs";
import styles from "./Explorateurs.module.css";

/** US-0902 : le paramètre de l'adresse qui garde le nombre d'explorateurs choisis (« ?explorateurs=2 »). */
const PARAMETRE = "explorateurs";

/** Au-delà, les losanges des libres deviendraient une frise illisible : le compteur suffit. */
const LOSANGES_AU_PLUS = 12;

/**
 * US-0902 : le nombre d'explorateurs choisis, lu dans l'adresse sans la croire : un entier, de zéro au nombre de
 * libres ; zéro pour tout le reste, et quand l'adresse n'en dit rien.
 */
export function explorateursChoisis(recherche: URLSearchParams, libres: number): number {
  const texte = recherche.get(PARAMETRE) ?? "";
  return /^\d{1,6}$/.test(texte) ? Math.min(Number(texte), libres) : 0;
}

/**
 * US-0902 : le bloc Explorateurs de l'écran d'Expédition. Seuls les Habitants au Métier d'explorateur qui ne sont
 * pas déjà partis sont proposés, avec le compteur « libres / total », un losange par explorateur devant lui, allumé
 * pour chaque libre (tant qu'ils tiennent : LOSANGES_AU_PLUS). Le joueur choisit combien partent, au pouce,
 * entre « − » et « + », à partir de zéro : « + » se grise quand tous les libres sont choisis, « − » à zéro. Le
 * nombre choisi vit dans l'adresse (replaceState, que Next.js relie à useSearchParams, comme le filtre de la page
 * Habitants) : il survit à un rechargement, sans charger l'historique de chaque essai, et le départ (Partir) le
 * relit. Choisir ne retient personne : rien ne change avant le départ (US-0911).
 */
export function Explorateurs({ libres, total }: ExplorateursDuTerritoire) {
  const recherche = useSearchParams();
  const nombre = explorateursChoisis(recherche, libres);

  /** Garde `n` explorateurs choisis dans l'adresse, avec ses autres choix ; à zéro, l'adresse n'en dit plus rien. */
  function choisir(n: number) {
    const parametres = new URLSearchParams(recherche.toString());
    if (n === 0) parametres.delete(PARAMETRE);
    else parametres.set(PARAMETRE, String(n));
    const suite = parametres.toString();
    window.history.replaceState(null, "", suite ? `?${suite}` : window.location.pathname);
  }

  return (
    <Bloc titre="Explorateurs" action={<Medaillon src="/illustrations/metiers/explorateur.webp" taille="xs" />} className={styles.bloc}>
      <dl className={styles.lignes}>
        <div>
          <dt>Libres</dt>
          <dd className={styles.libres}>
            {total <= LOSANGES_AU_PLUS ? (
              <span className={styles.losanges} aria-hidden="true">
                {Array.from({ length: total }, (_, i) => (
                  <i key={i} className={i < libres ? styles.libre : undefined} />
                ))}
              </span>
            ) : null}
            {`${libres} / ${total}`}
          </dd>
        </div>
        <div>
          <dt>Partent</dt>
          <dd className={`${kit.pas} ${kit.pasGrand} ${styles.choix}`}>
            <button type="button" className={`${kit.pasBouton} ${styles.plusMoins}`} aria-label="Un explorateur de moins" disabled={nombre === 0} onClick={() => choisir(nombre - 1)}>
              −
            </button>
            <output className={kit.pasValeur}>{nombre}</output>
            <button type="button" className={`${kit.pasBouton} ${styles.plusMoins}`} aria-label="Un explorateur de plus" disabled={nombre >= libres} onClick={() => choisir(nombre + 1)}>
              +
            </button>
          </dd>
        </div>
      </dl>
    </Bloc>
  );
}
