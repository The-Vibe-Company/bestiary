"use client";

import { useSearchParams } from "next/navigation";
import { useId } from "react";
import { Bloc } from "@/components/Bloc";
import { IllustrationEspece } from "@/components/IllustrationEspece";
import kit from "@/components/kit.module.css";
import { forceDeLEscorte } from "@/expeditions/force";
import { type BlessesAffiches, blessesDans } from "@/monde/blesses-affiches";
import type { EspeceDisponible } from "@/monde/effectif";
import styles from "./Escorte.module.css";

/** US-0904 : le paramètre de l'adresse qui garde l'escorte choisie, une fois par Espèce (« ?escorte=souris.3&escorte=poule.1 »). */
const PARAMETRE = "escorte";

/** US-0976 : celui qui garde les Éclaireurs choisis, de même (« ?eclaireurs=pigeon.2 »). */
const PARAMETRE_DES_ECLAIREURS = "eclaireurs";

/** US-0904 : une Espèce de l'escorte et son nombre de Bêtes, dans l'adresse (« souris.3 »). */
const ENTREE = /^([a-z0-9_]+)\.(\d{1,6})$/;

/** US-0904 : ce que l'adresse dit sous le paramètre `parametre`, Espèce par Espèce : dite deux fois, c'est la première qui compte. */
function dites(recherche: URLSearchParams, parametre: string): Map<string, number> {
  const lues = new Map<string, number>();
  for (const valeur of recherche.getAll(parametre)) {
    const [, id, nombre] = ENTREE.exec(valeur) ?? [];
    if (id && !lues.has(id)) lues.set(id, Number(nombre));
  }
  return lues;
}

/**
 * US-0904 : l'escorte choisie, lue dans l'adresse sans la croire : pour chaque Espèce proposée, un entier de zéro à ses
 * Bêtes disponibles ; zéro quand l'adresse n'en dit rien ou rien qui vaille. Une Espèce que l'écran ne propose pas ne
 * compte pas ; dite deux fois, c'est la première qui compte.
 */
export function escorteChoisie(recherche: URLSearchParams, especes: Pick<EspeceDisponible, "id" | "disponibles">[]): Map<string, number> {
  const escorte = dites(recherche, PARAMETRE);
  return new Map(especes.map((e) => [e.id, Math.min(escorte.get(e.id) ?? 0, e.disponibles)]));
}

/**
 * US-0976 : les Éclaireurs choisis, lus dans l'adresse sans la croire, comme l'escorte : pour chaque Espèce Éclaireuse
 * proposée, un entier de zéro à ce que l'escorte laisse de ses disponibles, une même Bête étant l'un ou l'autre ; zéro
 * pour toute autre Espèce.
 */
export function eclaireursChoisis(recherche: URLSearchParams, especes: Pick<EspeceDisponible, "id" | "disponibles" | "eclaireuse">[]): Map<string, number> {
  const escorte = escorteChoisie(recherche, especes);
  const eclaireurs = dites(recherche, PARAMETRE_DES_ECLAIREURS);
  return new Map(especes.map((e) => [e.id, e.eclaireuse ? Math.min(eclaireurs.get(e.id) ?? 0, e.disponibles - escorte.get(e.id)!) : 0]));
}

/** « 3 disponibles », « 1 disponible ». */
const disponibles = (n: number) => `${n} disponible${n > 1 ? "s" : ""}`;

/** US-0842 : « 1 affectée », « 2 affectées ». */
const affectees = (n: number) => `${n} affectée${n > 1 ? "s" : ""}`;

/** US-0937 : « 2 mâles · 1 femelle », « 0 mâle · 3 femelles ». */
const sexes = ({ males, femelles }: Pick<EspeceDisponible, "males" | "femelles">) =>
  `${males} mâle${males > 1 ? "s" : ""} · ${femelles} femelle${femelles > 1 ? "s" : ""}`;

/** « 10 403 » : les milliers séparés d'une espace insécable, que le total ne se coupe jamais ; US-0910 : de même au récapitulatif. */
export const entier = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/ /g, " ");

/**
 * US-0904 : le bloc Escorte de l'écran d'Expédition, après les Explorateurs. Chaque Espèce de l'effectif qui a des Bêtes
 * au Foyer y a sa ligne : son illustration, son nom et ses disponibles, puis combien de ses Bêtes partent, au pouce, entre
 * « − » et « + », à partir de zéro et jamais plus que les disponibles ; « Toutes » les prend toutes, « Aucune » remet à
 * zéro. Comme les explorateurs, l'escorte vit dans l'adresse (replaceState) : elle survit à un rechargement, et le départ
 * la relira (US-0911). Choisir ne retient aucune Bête : les disponibles ne bougent pas avant le départ. Sans aucune Bête
 * au Foyer, pas d'escorte : le bloc n'apparaît pas, et l'Expédition part sans (US-0909).
 * US-0905 : sous les Espèces, la force de l'escorte choisie, la simple somme des forces de ses Bêtes, recomptée à chaque
 * Bête ajoutée ou retirée, comme au rechargement ; zéro tant qu'aucune Bête n'est choisie.
 * US-0937 : sous les disponibles de chaque Espèce, combien de mâles et de femelles le joueur en possède, Bêtes sorties
 * comprises, pour savoir lequel lui manque pour réunir son Couple. US-0956 : plus rien une fois son Couple réuni.
 * US-0952 : puis chaque groupe de Blessés de l'Espèce au Foyer (`blesses`, par Espèce) et le temps qui lui reste avant sa
 * guérison ; rien sans Blessé. US-0953 : les Blessés ne sont pas parmi les disponibles, et ne partent pas ; une Espèce
 * dont toutes les Bêtes au Foyer sont blessées a sa ligne, sans aucune à choisir.
 * US-0842 : avant les Blessés, combien de Bêtes de l'Espèce sont affectées à leur Rôle ; elles ne combattent plus, ne sont
 * pas parmi les disponibles et ne partent pas ; rien sans affectée.
 * US-0976 : une Espèce Éclaireuse (le pigeon) a, sous ses choix d'escorte, combien de ses Bêtes partent comme
 * Éclaireurs, entre « − » et « + » : une même Bête est l'un ou l'autre, l'escorte et les Éclaireurs ne dépassant jamais
 * ses disponibles. Ils vivent aussi dans l'adresse, et n'ajoutent rien à la force.
 */
export function Escorte({ especes, blesses = {} }: { especes: EspeceDisponible[]; blesses?: Record<string, BlessesAffiches[]> }) {
  const recherche = useSearchParams();
  const id = useId();
  if (especes.length === 0) return null;
  const choix = escorteChoisie(recherche, especes);
  const eclaireurs = eclaireursChoisis(recherche, especes);
  const force = forceDeLEscorte(especes.map((e) => ({ force: e.force, nombre: choix.get(e.id)! })));

  /**
   * Garde dans l'adresse l'escorte et les Éclaireurs, `n` Bêtes de l'Espèce `especeId` sous le paramètre `parametre` et
   * le reste tel quel, avec les autres choix ; zéro n'y est pas écrit.
   */
  function choisir(especeId: string, n: number, parametre = PARAMETRE) {
    const parametres = new URLSearchParams(recherche.toString());
    for (const [nom, choisis] of [
      [PARAMETRE, choix],
      [PARAMETRE_DES_ECLAIREURS, eclaireurs],
    ] as const) {
      parametres.delete(nom);
      for (const e of especes) {
        const nombre = nom === parametre && e.id === especeId ? n : choisis.get(e.id)!;
        if (nombre > 0) parametres.append(nom, `${e.id}.${nombre}`);
      }
    }
    const suite = parametres.toString();
    window.history.replaceState(null, "", suite ? `?${suite}` : window.location.pathname);
  }

  return (
    <Bloc titre="Escorte" className={styles.bloc}>
      <ul className={styles.especes}>
        {especes.map((e) => {
          const nombre = choix.get(e.id)!;
          const partis = eclaireurs.get(e.id)!;
          // US-0976 : ce que l'escorte peut prendre, une fois les Éclaireurs choisis.
          const pourLEscorte = e.disponibles - partis;
          const idNom = `${id}-${e.id}`;
          return (
            <li key={e.id} className={styles.espece}>
              <IllustrationEspece espece={e} format="vignette" className={styles.vignette} />
              <p className={styles.nom}>
                <span id={idNom}>{e.nom}</span>
                <span className={styles.disponibles}>{disponibles(e.disponibles)}</span>
                {!e.coupleReuni && <span className={styles.disponibles}>{sexes(e)}</span>}
                {e.affectees ? <span className={styles.disponibles}>{affectees(e.affectees)}</span> : null}
                {(blesses[e.id] ?? []).map((groupe, i) => (
                  <span key={i} className={styles.disponibles}>
                    {blessesDans(groupe)}
                  </span>
                ))}
              </p>
              <div role="group" aria-labelledby={idNom} className={styles.choix}>
                <span className={kit.pas}>
                  <button type="button" className={`${kit.pasBouton} ${styles.bouton}`} aria-label="Une Bête de moins" disabled={nombre === 0} onClick={() => choisir(e.id, nombre - 1)}>
                    −
                  </button>
                  <output className={kit.pasValeur}>{nombre}</output>
                  <button type="button" className={`${kit.pasBouton} ${styles.bouton}`} aria-label="Une Bête de plus" disabled={nombre >= pourLEscorte} onClick={() => choisir(e.id, nombre + 1)}>
                    +
                  </button>
                </span>
                <span className={styles.paire}>
                  <button type="button" className={`${kit.bouton} ${kit.discret} ${styles.mot}`} disabled={nombre >= pourLEscorte} onClick={() => choisir(e.id, pourLEscorte)}>
                    Toutes
                  </button>
                  <button type="button" className={`${kit.bouton} ${kit.discret} ${styles.mot}`} disabled={nombre === 0} onClick={() => choisir(e.id, 0)}>
                    Aucune
                  </button>
                </span>
              </div>
              {e.eclaireuse ? (
                <div role="group" aria-labelledby={`${idNom}-eclaireurs ${idNom}`} className={styles.eclaireurs}>
                  <span className={kit.pas}>
                    <button
                      type="button"
                      className={`${kit.pasBouton} ${styles.bouton}`}
                      aria-label="Un Éclaireur de moins"
                      disabled={partis === 0}
                      onClick={() => choisir(e.id, partis - 1, PARAMETRE_DES_ECLAIREURS)}
                    >
                      −
                    </button>
                    <output className={kit.pasValeur}>{partis}</output>
                    <button
                      type="button"
                      className={`${kit.pasBouton} ${styles.bouton}`}
                      aria-label="Un Éclaireur de plus"
                      disabled={nombre + partis >= e.disponibles}
                      onClick={() => choisir(e.id, partis + 1, PARAMETRE_DES_ECLAIREURS)}
                    >
                      +
                    </button>
                  </span>
                  <span id={`${idNom}-eclaireurs`} className={styles.role}>
                    Éclaireurs
                  </span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <dl className={styles.force}>
        <dt id={`${id}-force`}>Force</dt>
        <dd>
          <output aria-labelledby={`${id}-force`} className={styles.total}>
            {entier(force)}
          </output>
        </dd>
      </dl>
    </Bloc>
  );
}
