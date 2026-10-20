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
 * libres. Quand l'adresse n'en dit rien (ou rien qui soit un nombre d'explorateurs), un explorateur part, s'il y en a un
 * de libre : le joueur n'a pas à le choisir (retour d'Antoine, 2026-10-15) ; zéro, choisi, se garde dans l'adresse.
 */
export function explorateursChoisis(recherche: URLSearchParams, libres: number): number {
  const texte = recherche.get(PARAMETRE) ?? "";
  return Math.min(/^\d{1,6}$/.test(texte) ? Number(texte) : 1, libres);
}

/**
 * US-0902 : le bloc Explorateurs de l'écran d'Expédition. Seuls les Habitants au Métier d'explorateur qui ne sont
 * pas déjà partis sont proposés, avec le compteur « libres / total », un losange par explorateur devant lui, allumé
 * pour chaque libre (tant qu'ils tiennent : LOSANGES_AU_PLUS). Le joueur choisit combien partent, au pouce,
 * entre « − » et « + », à partir d'un s'il y a un libre (de zéro sinon) : « + » se grise quand tous les libres sont
 * choisis, « − » à zéro. Le nombre choisi, zéro compris, vit dans l'adresse (replaceState, que Next.js relie à
 * useSearchParams, comme le filtre de la page Habitants) : il survit à un rechargement, sans charger l'historique de
 * chaque essai, et le départ (Partir) le relit. Choisir ne retient personne : rien ne change avant le départ (US-0911).
 */
export function Explorateurs({ libres, total }: ExplorateursDuTerritoire) {
  const recherche = useSearchParams();
  const nombre = explorateursChoisis(recherche, libres);

  /** Garde `n` explorateurs choisis dans l'adresse, avec ses autres choix, zéro compris (sans lui, un explorateur part). */
  function choisir(n: number) {
    const parametres = new URLSearchParams(recherche.toString());
    parametres.set(PARAMETRE, String(n));
    window.history.replaceState(null, "", `?${parametres.toString()}`);
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
