"use client";

import { type ReactNode, type Ref, useEffect, useId, useRef, useState } from "react";
import { EXPLICATIONS, type NomExplique } from "./explications";
import styles from "./page.module.css";

/** Ce qu'un toucher peut activer : un lien, un bouton, un champ. Un toucher ailleurs n'active rien. */
const INTERACTIF = "a, button, input, select, textarea, label, summary, [role='button'], [tabindex]";

/** Si un toucher sur `cible` peut activer quelque chose : un contrôle grisé, qui ne clique jamais, n'active rien. */
const activable = (cible: Element) => {
  const controle = cible.closest?.(INTERACTIF);
  return Boolean(controle && !controle.matches(":disabled"));
};

/**
 * US-0807 : le clic qui suit le toucher qui vient de fermer une explication ne va nulle part : il est arrêté avant tout le
 * reste (à la capture, sur le document). S'il ne vient pas, comme sur iPhone, le toucher suivant, ou une seconde, lève
 * l'arrêt : un clic voulu commence toujours par son propre appui.
 */
function avalerLeClicQuiSuit() {
  const arreter = (evenement: Event) => {
    evenement.preventDefault();
    evenement.stopPropagation();
    lever();
  };
  const lever = () => {
    document.removeEventListener("click", arreter, true);
    document.removeEventListener("pointerdown", lever, true);
    clearTimeout(delai);
  };
  document.addEventListener("click", arreter, true);
  document.addEventListener("pointerdown", lever, true);
  const delai = setTimeout(lever, 1_000);
}

/**
 * US-0807 : une explication qu'ouvre le nom d'une caractéristique : ouverte, un toucher ailleurs, Échap ou son bouton la
 * referment ; le bouton rend le regard au nom, Échap aussi quand le regard était sur l'explication ou son nom. Un toucher
 * sur l'explication elle-même la laisse ouverte. Une à la fois : en ouvrir une autre, c'est toucher ailleurs.
 *
 * Le toucher ailleurs ne la ferme jamais pendant le geste : fermée, elle fait remonter les lignes du dessous, et ce qui
 * passerait alors sous le doigt (« Fermer », le bloc « Élever ») recevrait le toucher. Sur un lien ou un bouton (le nom
 * d'une autre caractéristique, « Fermer »), elle se ferme à son clic, qui l'atteint avant que rien ne bouge. Ailleurs
 * (du texte, le fond, un bouton grisé), au doigt levé, car Safari sur iPhone ne remonte pas jusqu'au document le clic
 * d'un tel toucher ; et le clic qui suit, s'il vient, n'active rien : il tomberait sur ce qui a glissé sous le doigt.
 * Un défilement au doigt, que le navigateur annule comme toucher (pointercancel), ne la ferme pas.
 */
function useExplication() {
  const [ouverte, setOuverte] = useState(false);
  const nom = useRef<HTMLButtonElement>(null);
  const explication = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!ouverte) return;
    const dedans = (cible: Node) => Boolean(nom.current?.contains(cible) || explication.current?.contains(cible));
    /** Le toucher en cours, posé ailleurs sur ce qui n'active rien : son identifiant ; null sans tel toucher. */
    let toucher: { id: number | undefined } | null = null;
    const appui = (evenement: PointerEvent) => {
      const cible = evenement.target as Element;
      toucher = dedans(cible) || activable(cible) ? null : { id: evenement.pointerId };
    };
    const annulation = (evenement: PointerEvent) => {
      if (toucher?.id === evenement.pointerId) toucher = null;
    };
    const releve = (evenement: PointerEvent) => {
      if (!toucher || toucher.id !== evenement.pointerId) return;
      toucher = null;
      setOuverte(false);
      avalerLeClicQuiSuit();
    };
    const clic = (evenement: MouseEvent) => {
      if (!dedans(evenement.target as Node)) setOuverte(false);
    };
    const touche = (evenement: KeyboardEvent) => {
      if (evenement.key !== "Escape") return;
      const regard = document.activeElement;
      setOuverte(false);
      if (!regard || regard === document.body || dedans(regard)) nom.current?.focus();
    };
    document.addEventListener("pointerdown", appui);
    document.addEventListener("pointercancel", annulation);
    document.addEventListener("pointerup", releve);
    document.addEventListener("click", clic);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("pointerdown", appui);
      document.removeEventListener("pointercancel", annulation);
      document.removeEventListener("pointerup", releve);
      document.removeEventListener("click", clic);
      document.removeEventListener("keydown", touche);
    };
  }, [ouverte]);

  /** L'élément de l'explication, quel qu'il soit (dd, p) : un toucher dedans ne la ferme pas. */
  const poserExplication = (element: HTMLElement | null) => {
    explication.current = element;
  };
  const basculer = () => setOuverte((etait) => !etait);
  const fermer = () => {
    setOuverte(false);
    nom.current?.focus();
  };
  return { ouverte, nom, poserExplication, basculer, fermer };
}

/** US-0807 : le nom d'une caractéristique, un bouton au pointillé de cuivre qui ouvre son explication. */
function Nom({ ref, texte, id, ouverte, basculer }: { ref: Ref<HTMLButtonElement>; texte: NomExplique; id: string; ouverte: boolean; basculer: () => void }) {
  return (
    <button ref={ref} type="button" className={styles.terme} aria-expanded={ouverte} aria-controls={id} onClick={basculer}>
      {texte}
    </button>
  );
}

/** US-0807 : la phrase de l'explication, et le bouton qui la referme. */
function Phrase({ texte, fermer }: { texte: NomExplique; fermer: () => void }) {
  return (
    <>
      <span>{EXPLICATIONS[texte]}</span>
      <button type="button" className={styles.fermerExplication} aria-label="Fermer l'explication" onClick={fermer}>
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </>
  );
}

/**
 * US-0807 : une ligne des caractéristiques de la fiche : son nom, qui ouvre son explication, puis sa valeur ; l'explication
 * dessous, de toute la largeur de la liste. Fermée, elle reste dans la page, cachée : le nom la désigne (aria-controls).
 */
export function Caracteristique({ nom, className, children }: { nom: NomExplique; className?: string; children: ReactNode }) {
  const { ouverte, nom: refNom, poserExplication, basculer, fermer } = useExplication();
  const id = useId();
  return (
    <div className={className}>
      <dt>
        <Nom ref={refNom} texte={nom} id={id} ouverte={ouverte} basculer={basculer} />
      </dt>
      <dd>{children}</dd>
      <dd ref={poserExplication} id={id} className={styles.explication} hidden={!ouverte}>
        <Phrase texte={nom} fermer={fermer} />
      </dd>
    </div>
  );
}

/** US-0807 : l'effectif de l'Espèce, son nom qui ouvre son explication, puis son nombre en grand ; l'explication dessous. */
export function Effectif({ nombre }: { nombre: number }) {
  const { ouverte, nom, poserExplication, basculer, fermer } = useExplication();
  const id = useId();
  return (
    <>
      <p className={styles.effectif}>
        <Nom ref={nom} texte="Effectif" id={id} ouverte={ouverte} basculer={basculer} /> <strong className={styles.nombre}>{nombre}</strong>
      </p>
      <p ref={poserExplication} id={id} className={styles.explication} hidden={!ouverte}>
        <Phrase texte="Effectif" fermer={fermer} />
      </p>
    </>
  );
}
