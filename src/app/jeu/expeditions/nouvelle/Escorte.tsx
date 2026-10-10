"use client";

import { useSearchParams } from "next/navigation";
import { useId } from "react";
import { Bloc } from "@/components/Bloc";
import { IllustrationEspece } from "@/components/IllustrationEspece";
import { forceDeLEscorte } from "@/expeditions/force";
import type { EspeceDisponible } from "@/monde/effectif";
import styles from "./Escorte.module.css";

/** US-0904 : le paramètre de l'adresse qui garde l'escorte choisie, une fois par Espèce (« ?escorte=souris.3&escorte=poule.1 »). */
const PARAMETRE = "escorte";

/** US-0904 : une Espèce de l'escorte et son nombre de Bêtes, dans l'adresse (« souris.3 »). */
const ENTREE = /^([a-z0-9_]+)\.(\d{1,6})$/;

/**
 * US-0904 : l'escorte choisie, lue dans l'adresse sans la croire : pour chaque Espèce proposée, un entier de zéro à ses
 * Bêtes disponibles ; zéro quand l'adresse n'en dit rien ou rien qui vaille. Une Espèce que l'écran ne propose pas ne
 * compte pas ; dite deux fois, c'est la première qui compte.
 */
export function escorteChoisie(recherche: URLSearchParams, especes: Pick<EspeceDisponible, "id" | "disponibles">[]): Map<string, number> {
  const dites = new Map<string, number>();
  for (const valeur of recherche.getAll(PARAMETRE)) {
    const [, id, nombre] = ENTREE.exec(valeur) ?? [];
    if (id && !dites.has(id)) dites.set(id, Number(nombre));
  }
  return new Map(especes.map((e) => [e.id, Math.min(dites.get(e.id) ?? 0, e.disponibles)]));
}

/** « 3 disponibles », « 1 disponible ». */
const disponibles = (n: number) => `${n} disponible${n > 1 ? "s" : ""}`;

/** US-0937 : « 2 mâles · 1 femelle », « 0 mâle · 3 femelles ». */
const sexes = ({ males, femelles }: Pick<EspeceDisponible, "males" | "femelles">) =>
  `${males} mâle${males > 1 ? "s" : ""} · ${femelles} femelle${femelles > 1 ? "s" : ""}`;

/** « 10 403 » : les milliers séparés d'une espace insécable, que le total ne se coupe jamais ; US-0910 : de même au récapitulatif. */
export const entier = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/ /g, " ");

/**
 * US-0904 : le bloc Escorte de l'écran d'Expédition, après les Explorateurs. Chaque Espèce de l'effectif qui a des Bêtes
 * disponibles y a sa ligne : son illustration, son nom et ce nombre, puis combien de ses Bêtes partent, au pouce, entre
 * « − » et « + », à partir de zéro et jamais plus que les disponibles ; « Toutes » les prend toutes, « Aucune » remet à
 * zéro. Comme les explorateurs, l'escorte vit dans l'adresse (replaceState) : elle survit à un rechargement, et le départ
 * la relira (US-0911). Choisir ne retient aucune Bête : les disponibles ne bougent pas avant le départ. Sans aucune Bête
 * disponible, pas d'escorte : le bloc n'apparaît pas, et l'Expédition part sans (US-0909).
 * US-0905 : sous les Espèces, la force de l'escorte choisie, la simple somme des forces de ses Bêtes, recomptée à chaque
 * Bête ajoutée ou retirée, comme au rechargement ; zéro tant qu'aucune Bête n'est choisie.
 * US-0937 : sous les disponibles de chaque Espèce, combien de mâles et de femelles le joueur en possède, Bêtes sorties
 * comprises, pour savoir lequel lui manque pour réunir son Couple. US-0956 : plus rien une fois son Couple réuni.
 */
export function Escorte({ especes }: { especes: EspeceDisponible[] }) {
  const recherche = useSearchParams();
  const id = useId();
  if (especes.length === 0) return null;
  const choix = escorteChoisie(recherche, especes);
  const force = forceDeLEscorte(especes.map((e) => ({ force: e.force, nombre: choix.get(e.id)! })));

  /** Garde `n` Bêtes de l'Espèce `especeId` dans l'adresse, avec le reste de l'escorte et les autres choix ; zéro n'y est pas écrit. */
  function choisir(especeId: string, n: number) {
    const parametres = new URLSearchParams(recherche.toString());
    parametres.delete(PARAMETRE);
    for (const e of especes) {
      const nombre = e.id === especeId ? n : choix.get(e.id)!;
      if (nombre > 0) parametres.append(PARAMETRE, `${e.id}.${nombre}`);
    }
    const suite = parametres.toString();
    window.history.replaceState(null, "", suite ? `?${suite}` : window.location.pathname);
  }

  return (
    <Bloc titre="Escorte" className={styles.bloc}>
      <ul className={styles.especes}>
        {especes.map((e) => {
          const nombre = choix.get(e.id)!;
          const idNom = `${id}-${e.id}`;
          return (
            <li key={e.id} className={styles.espece}>
              <IllustrationEspece espece={e} format="vignette" className={styles.vignette} />
              <p className={styles.nom}>
                <span id={idNom}>{e.nom}</span>
                <span className={styles.disponibles}>{disponibles(e.disponibles)}</span>
                {!e.coupleReuni && <span className={styles.disponibles}>{sexes(e)}</span>}
              </p>
              <div role="group" aria-labelledby={idNom} className={styles.choix}>
                <span className={styles.paire}>
                  <button type="button" className={styles.bouton} aria-label="Une Bête de moins" disabled={nombre === 0} onClick={() => choisir(e.id, nombre - 1)}>
                    −
                  </button>
                  <output className={styles.nombre}>{nombre}</output>
                  <button type="button" className={styles.bouton} aria-label="Une Bête de plus" disabled={nombre >= e.disponibles} onClick={() => choisir(e.id, nombre + 1)}>
                    +
                  </button>
                </span>
                <span className={styles.paire}>
                  <button type="button" className={`${styles.bouton} ${styles.mot}`} disabled={nombre >= e.disponibles} onClick={() => choisir(e.id, e.disponibles)}>
                    Toutes
                  </button>
                  <button type="button" className={`${styles.bouton} ${styles.mot}`} disabled={nombre === 0} onClick={() => choisir(e.id, 0)}>
                    Aucune
                  </button>
                </span>
              </div>
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
