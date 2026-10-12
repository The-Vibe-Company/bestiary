"use client";

import { useEffect, useId, useRef, useState, type FocusEvent } from "react";
import styles from "./BarreHaut.module.css";
import { useDeconnexion } from "./Deconnexion";

/**
 * Le nom de chef dans la barre du haut (US-0140). Un nom long est coupé, lisible en entier au
 * survol et en tête du menu. Le nom ouvre le menu, qui contient « Se déconnecter » ; un clic
 * ailleurs, Échap ou un nouveau clic le referment. US-0958 : sous le nom en entier, le nombre de
 * Couples réunis du joueur, une fois entré dans son Foyer (`couplesReunis`, absent avant).
 */
export function MenuChef({ nom, couplesReunis }: { nom: string; couplesReunis?: number }) {
  const [ouvert, setOuvert] = useState(false);
  const { enCours, deconnecter } = useDeconnexion();
  const racine = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const premier = useRef<HTMLButtonElement>(null);
  const idMenu = useId();

  useEffect(() => {
    if (!ouvert) return;
    premier.current?.focus();
    const clicDehors = (evenement: PointerEvent) => {
      if (!racine.current?.contains(evenement.target as Node)) setOuvert(false);
    };
    const touche = (evenement: KeyboardEvent) => {
      if (evenement.key !== "Escape") return;
      setOuvert(false);
      bouton.current?.focus();
    };
    document.addEventListener("pointerdown", clicDehors);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("pointerdown", clicDehors);
      document.removeEventListener("keydown", touche);
    };
  }, [ouvert]);

  // Le regard part ailleurs au clavier : le menu se referme.
  function sortie(evenement: FocusEvent<HTMLDivElement>) {
    if (!racine.current?.contains(evenement.relatedTarget as Node | null)) setOuvert(false);
  }

  return (
    <div ref={racine} className={styles.chef} onBlur={sortie}>
      <button
        ref={bouton}
        type="button"
        className={`${styles.action} ${styles.nom}`}
        title={nom}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idMenu : undefined}
        onClick={() => setOuvert((etait) => !etait)}
      >
        <span className={styles.texteNom}>{nom}</span>
        <svg viewBox="0 0 12 12" className={styles.fleche} aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>
      {ouvert ? (
        <div className={styles.menu}>
          <p className={styles.nomComplet}>{nom}</p>
          {couplesReunis !== undefined ? (
            <p className={styles.couples}>
              <span>Couples réunis</span>
              <span className={styles.nombreCouples}>{couplesReunis}</span>
            </p>
          ) : null}
          <div id={idMenu} role="menu" aria-label={nom}>
            <button ref={premier} type="button" role="menuitem" className={styles.choix} onClick={deconnecter} disabled={enCours}>
              {enCours ? "Déconnexion…" : "Se déconnecter"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
