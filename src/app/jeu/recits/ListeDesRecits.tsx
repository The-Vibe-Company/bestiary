"use client";

import { useId, useState, useTransition } from "react";
import { lireUnRecit } from "./actions";
import styles from "./page.module.css";
import { type RencontreAffichee, RencontresDuRecit } from "./RencontresDuRecit";

/**
 * Un Récit tel que la liste le montre : sa date déjà écrite par le serveur, dans le fuseau du joueur. US-0940 : et les
 * Rencontres d'un retour d'Expédition, le cas échéant. US-0941 : et les faits de son résumé, pour un retour d'Expédition.
 */
export type RecitAffiche = {
  id: number;
  titre: string;
  texte: string;
  instant: string;
  quand: string;
  lu: boolean;
  resume?: string[];
  rencontres?: RencontreAffichee[];
};

/**
 * US-0324 : une ligne par Récit, son titre et sa date ; un Récit non lu porte la marque « nouveau ».
 * Le toucher déplie son texte sur place et le note comme lu : la marque s'en va aussitôt, et l'action
 * serveur relit la barre du haut, dont l'entrée « Récits » compte les non lus.
 */
export function ListeDesRecits({ recits }: { recits: RecitAffiche[] }) {
  const [ouverts, setOuverts] = useState<ReadonlySet<number>>(() => new Set());
  const [lusIci, setLusIci] = useState<ReadonlySet<number>>(() => new Set());
  const [, demarrer] = useTransition();
  const prefixe = useId();

  function basculer(recit: RecitAffiche) {
    const ouvrir = !ouverts.has(recit.id);
    setOuverts((avant) => {
      const apres = new Set(avant);
      if (ouvrir) apres.add(recit.id);
      else apres.delete(recit.id);
      return apres;
    });
    if (!ouvrir || recit.lu || lusIci.has(recit.id)) return;
    setLusIci((avant) => new Set(avant).add(recit.id));
    demarrer(() => lireUnRecit(recit.id));
  }

  return (
    <ul className={styles.recits}>
      {recits.map((recit) => {
        const ouvert = ouverts.has(recit.id);
        const nonLu = !recit.lu && !lusIci.has(recit.id);
        const idTexte = `${prefixe}-recit-${recit.id}`;
        // US-0940 : les Rencontres d'un retour se déplient sous son texte, du même toucher.
        const idRencontres = recit.rencontres?.length ? `${idTexte}-rencontres` : null;
        return (
          <li key={recit.id} className={styles.recit} data-non-lu={nonLu ? "" : undefined}>
            <button
              type="button"
              className={styles.entete}
              aria-expanded={ouvert}
              aria-controls={idRencontres ? `${idTexte} ${idRencontres}` : idTexte}
              onClick={() => basculer(recit)}
            >
              <span className={styles.titreRecit}>
                {recit.titre}
                {nonLu ? <span className={styles.nouveau}>nouveau</span> : null}
              </span>
              <time className={styles.quand} dateTime={recit.instant}>
                {recit.quand}
              </time>
              {/* US-0941 : le résumé, en tête du récit, se lit sans l'ouvrir ; le détail se déplie dessous. Chaque fait d'un
                  bloc, « 2 Bêtes ramenées · », pour qu'un téléphone ne passe à la ligne qu'entre deux. */}
              {recit.resume ? (
                <span className={styles.resume}>
                  {recit.resume.map((fait, i, faits) => (
                    <span key={fait} className={styles.fait}>
                      {i < faits.length - 1 ? `${fait} · ` : fait}
                    </span>
                  ))}
                </span>
              ) : null}
              <svg viewBox="0 0 12 12" className={styles.fleche} aria-hidden="true">
                <path d="M2.5 4.5 6 8l3.5-3.5" />
              </svg>
            </button>
            <p id={idTexte} className={styles.texte} hidden={!ouvert}>
              {recit.texte}
            </p>
            {idRencontres ? <RencontresDuRecit id={idRencontres} rencontres={recit.rencontres!} hidden={!ouvert} /> : null}
          </li>
        );
      })}
    </ul>
  );
}
