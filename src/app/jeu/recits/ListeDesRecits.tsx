"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import kit from "@/components/kit.module.css";
import { Medaillon } from "@/components/Medaillon";
import { Paysage } from "@/components/Paysage";
import { lireUnRecit } from "./actions";
import { AnnonceDuCouple, type CoupleAffiche } from "./AnnonceDuCouple";
import { MEDAILLON_DES_RECITS, medaillonDuRecit } from "./lecture-du-recit";
import { LectureDuRecit } from "./LectureDuRecit";
import styles from "./page.module.css";
import type { RencontreAffichee } from "./RencontresDuRecit";

/**
 * Un Récit tel que la liste le montre : sa date déjà écrite par le serveur, dans le fuseau du joueur. US-0940 : et les
 * Rencontres d'un retour d'Expédition, le cas échéant. US-0941 : et les faits de son résumé, pour un retour d'Expédition.
 * US-0958 : et les Couples qu'il a réunis, le cas échéant.
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
  couples?: CoupleAffiche[];
};

/**
 * US-0324 : une ligne par Récit, son médaillon, son titre et sa date ; un Récit non lu porte la marque « nouveau ». Le
 * toucher ouvre le Récit et le note comme lu : la marque s'en va aussitôt, et l'action serveur relit la barre du haut,
 * dont l'entrée « Récits » compte les non lus. Un Récit s'ouvre à la fois : sur ordinateur, il se lit à droite de la liste,
 * qui défile seule ; sur un téléphone, il se déplie sous sa ligne, qu'on ramène en vue si le Récit refermé au-dessus l'a
 * fait monter. Un second toucher le referme ; tant qu'aucun n'est ouvert, la place de la lecture montre le Monde peint
 * sur sa table, le médaillon des Récits et « Choisissez un récit. » (pour les yeux : un lecteur d'écran a les lignes ;
 * aucun Récit ne s'ouvre seul, l'ouvrir le noterait comme lu). US-0958 : sous la ligne d'un retour qui a réuni un Couple,
 * son annonce, visible sans l'ouvrir.
 */
export function ListeDesRecits({ recits }: { recits: RecitAffiche[] }) {
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [lusIci, setLusIci] = useState<ReadonlySet<number>>(() => new Set());
  const [, demarrer] = useTransition();
  const prefixe = useId();
  const lignes = useRef(new Map<number, HTMLButtonElement>());

  useEffect(() => {
    if (ouvert !== null) lignes.current.get(ouvert)?.scrollIntoView?.({ block: "nearest" });
  }, [ouvert]);

  function basculer(recit: RecitAffiche) {
    const ouvrir = ouvert !== recit.id;
    setOuvert(ouvrir ? recit.id : null);
    if (!ouvrir || recit.lu || lusIci.has(recit.id)) return;
    setLusIci((avant) => new Set(avant).add(recit.id));
    demarrer(() => lireUnRecit(recit.id));
  }

  return (
    <div className={`${kit.panneau} ${styles.lecteur}`}>
      <ul className={styles.recits}>
        {recits.map((recit) => {
          const estOuvert = ouvert === recit.id;
          const nonLu = !recit.lu && !lusIci.has(recit.id);
          const idLecture = `${prefixe}-recit-${recit.id}`;
          return (
            <li key={recit.id} className={styles.recit} data-non-lu={nonLu ? "" : undefined} data-ouvert={estOuvert ? "" : undefined}>
              <button
                type="button"
                ref={(bouton) => {
                  if (bouton) lignes.current.set(recit.id, bouton);
                  else lignes.current.delete(recit.id);
                }}
                className={styles.entete}
                aria-expanded={estOuvert}
                aria-controls={idLecture}
                onClick={() => basculer(recit)}
              >
                <Medaillon src={medaillonDuRecit(recit.titre)} className={styles.medaillon} />
                <span className={`${kit.titreServif} ${styles.titreRecit}`}>{recit.titre}</span>
                {nonLu ? <span className={`${kit.nouveau} ${styles.nouveau}`}>nouveau</span> : null}
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
              </button>
              {/* US-0958 : l'annonce du Couple réuni, en tête du récit du retour qui l'a réuni, se voit sans l'ouvrir. */}
              {recit.couples?.length ? <AnnonceDuCouple couples={recit.couples} /> : null}
              <LectureDuRecit recit={recit} id={idLecture} hidden={!estOuvert} />
            </li>
          );
        })}
      </ul>
      {ouvert === null ? (
        <div className={styles.attente} aria-hidden="true">
          <Paysage peinture="accueil/plateau.webp" sizes="(max-width: 1023px) 1px, 60vw" className={`${kit.vignette} ${styles.peintureAttente}`} />
          <Medaillon src={MEDAILLON_DES_RECITS} taille="xl" className={styles.medaillonAttente} />
          <p className={styles.choisir}>Choisissez un récit.</p>
        </div>
      ) : null}
    </div>
  );
}
