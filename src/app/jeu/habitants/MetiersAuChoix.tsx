"use client";

import { Medaillon } from "@/components/Medaillon";
import styles from "./MetiersAuChoix.module.css";

/** US-0308 : un Métier qu'on peut donner, son icône déjà nommée par le serveur. */
export type MetierAuChoix = { id: string; nom: string; icone: string };

/**
 * US-0308 : sur une ligne, le bouton qui déplie dessous les Métiers au choix, à son texte (« Choisir un Métier », ou le
 * Métier, US-0310 ; US-0335 : sur la ligne d'un Voyageur, « Sans Métier » ou le Métier choisi) ; sa flèche se retourne
 * tant qu'ils sont dépliés. `etiquette`, quand le texte seul ne dit pas de qui il s'agit. `icone` : devant le texte, le
 * médaillon du Métier, ou un médaillon vide (null) ; `aChoisir` : un Métier reste à choisir, la pastille passe au cuivre.
 */
export function BoutonDuMetier({
  id,
  texte,
  etiquette,
  icone,
  aChoisir = false,
  deplie,
  depliant,
  className,
  onClick,
}: {
  id: string;
  texte: string;
  etiquette?: string;
  icone?: string | null;
  aChoisir?: boolean;
  deplie: boolean;
  depliant: string;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      className={className ? `${styles.choisir} ${className}` : styles.choisir}
      aria-label={etiquette}
      aria-expanded={deplie}
      aria-controls={deplie ? depliant : undefined}
      data-a-choisir={aChoisir ? "" : undefined}
      onClick={onClick}
    >
      {/* Le nom est écrit juste à côté : le médaillon est muet. */}
      {icone !== undefined ? <Medaillon src={icone ?? undefined} taille="xs" /> : null}
      <span className={styles.texte}>{texte}</span>
      <svg viewBox="0 0 12 12" className={styles.fleche} aria-hidden="true">
        <path d="M3 4.5 6 7.5 9 4.5" />
      </svg>
    </button>
  );
}

/**
 * US-0308 : sous la ligne, sur toute sa largeur, les Métiers au choix, chacun un bouton à son médaillon muet et à son
 * nom ; en toucher un le choisit. US-0310 : le Métier `actuel` (son nom) est pressé, marqué d'une coche, et ne se
 * rechoisit pas. US-0311 : quand il y en a un, « Sans Métier », en dernier, le retire (null). US-0335 : les mêmes, sur la
 * ligne d'un Voyageur, pour le Métier qu'il aura en arrivant. Chaque bouton porte `data-metier` ou `data-sans-metier`,
 * pour que la ligne qui les déplie les range à sa façon.
 */
export function MetiersAuChoix({
  id,
  etiquette,
  metiers,
  actuel,
  className,
  choisir,
}: {
  id: string;
  etiquette: string;
  metiers: MetierAuChoix[];
  actuel: string | null;
  className?: string;
  choisir: (metier: MetierAuChoix | null) => void;
}) {
  return (
    <div id={id} role="group" aria-label={etiquette} className={className ? `${styles.choix} ${className}` : styles.choix}>
      {metiers.map((m) => {
        const pris = m.nom === actuel;
        return (
          <button key={m.id} type="button" className={styles.metierAuChoix} aria-pressed={pris} disabled={pris} data-metier="" onClick={() => choisir(m)}>
            <span className={styles.medaillonAuChoix}>
              <Medaillon src={m.icone} taille="md" vif={pris} />
              {pris ? (
                <svg viewBox="0 0 12 12" className={styles.coche} aria-hidden="true">
                  <path d="M2.5 6.3 5 8.6 9.6 3.6" />
                </svg>
              ) : null}
            </span>
            <span className={styles.nomAuChoix}>{m.nom}</span>
          </button>
        );
      })}
      {actuel !== null ? (
        <button type="button" className={styles.sansMetierAuChoix} data-sans-metier="" onClick={() => choisir(null)}>
          <Medaillon taille="xs" />
          Sans Métier
        </button>
      ) : null}
    </div>
  );
}
