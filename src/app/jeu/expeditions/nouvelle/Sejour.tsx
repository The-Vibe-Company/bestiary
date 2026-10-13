"use client";

import { useSearchParams } from "next/navigation";
import { type CSSProperties, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Bloc } from "@/components/Bloc";
import kit from "@/components/kit.module.css";
import { SEJOUR_PAR_DEFAUT_MINUTES, sejourChoisi } from "@/expeditions/sejour";
import { SEJOUR_MINUTES, SEJOURS_TOUT_PRETS_MINUTES } from "@/reglages";
import { formaterMinutes } from "@/temps/affichage";
import { FORMULAIRE_DE_DEPART } from "./formulaire";
import styles from "./Sejour.module.css";

/** US-0906 : le paramètre de l'adresse qui garde la durée choisie, en minutes (« ?sejour=240 »). */
const PARAMETRE_DU_SEJOUR = "sejour";

/** La durée que dit l'adresse, ou la première toute prête si elle n'en dit aucune qu'on aurait pu choisir. */
const dureeDeLAdresse = (valeur: string | null) => sejourChoisi(valeur) ?? SEJOUR_PAR_DEFAUT_MINUTES;

/**
 * US-0910 : la durée que le bloc Séjour montre, à chaque pas du curseur, avant même que l'adresse la garde (au lâcher) ;
 * null tant qu'aucun bloc Séjour n'est affiché. Ses abonnés, le récapitulatif, la suivent ainsi au fil du geste.
 */
let dureeAffichee: number | null = null;
const abonnes = new Set<() => void>();
function afficher(minutes: number | null) {
  dureeAffichee = minutes;
  abonnes.forEach((prevenir) => prevenir());
}
const suivre = (prevenir: () => void) => {
  abonnes.add(prevenir);
  return () => abonnes.delete(prevenir);
};

/**
 * US-0910 : la durée du séjour telle que le bloc Séjour la montre, curseur encore tenu compris, sinon celle que l'adresse
 * `recherche` garde : celle du récapitulatif. Au rendu du serveur, celle de l'adresse, que le bloc Séjour montre aussi.
 */
export function useSejourAffiche(recherche: URLSearchParams): number {
  const affichee = useSyncExternalStore(suivre, () => dureeAffichee, () => null);
  return affichee ?? dureeDeLAdresse(recherche.get(PARAMETRE_DU_SEJOUR));
}

/**
 * US-0906 : l'adresse garde `minutes`, sans toucher à ses autres paramètres, si elle ne les garde pas déjà. replaceState,
 * que Next.js relie à useSearchParams : ni requête, ni historique ; Safari en limite les réécritures (une centaine en
 * 10 secondes), d'où une seule par geste au curseur.
 */
function garderDansLAdresse(minutes: number) {
  const parametres = new URLSearchParams(window.location.search);
  if (parametres.get(PARAMETRE_DU_SEJOUR) === String(minutes)) return;
  parametres.set(PARAMETRE_DU_SEJOUR, String(minutes));
  try {
    window.history.replaceState(null, "", `?${parametres}`);
  } catch {
    // Une flèche du clavier tenue enfonce la limite de Safari : l'adresse garde l'ancienne durée, réécrite au choix suivant.
  }
}

/**
 * US-0906 : le bloc Séjour de l'écran d'Expédition : la durée choisie, en grand ; un curseur de la plus courte à la plus
 * longue, par pas réguliers, rempli de cuivre jusqu'à son losange ; puis, d'un doigt, les durées toutes prêtes en
 * segments, la choisie pressée. Il suit la durée de l'adresse, sinon la première toute prête, et l'adresse la garde,
 * pour un rechargement ou un retour arrière : aussitôt pour une durée toute prête ; au curseur, une fois le geste fini
 * (l'évènement natif « change », au lâcher ou à chaque flèche du clavier, ou la perte de la main), jamais plus tard, où
 * l'écriture annulerait un lien touché entre-temps. Le curseur porte la durée au formulaire de départ (US-0911, attribut
 * form), où le séjour ne commencera qu'à l'arrivée.
 */
export function Sejour() {
  const dansLAdresse = useSearchParams()?.get(PARAMETRE_DU_SEJOUR) ?? null;
  const [minutes, setMinutes] = useState(() => dureeDeLAdresse(dansLAdresse));
  // Un lien vers l'écran rouvre la même page sans la remonter : la durée suit alors l'adresse, comme la destination.
  const [lue, setLue] = useState(dansLAdresse);
  if (dansLAdresse !== lue) {
    setLue(dansLAdresse);
    setMinutes(dureeDeLAdresse(dansLAdresse));
  }
  // US-0910 : le récapitulatif suit la durée montrée, pas après pas ; plus rien quand le bloc disparaît.
  useEffect(() => afficher(minutes), [minutes]);
  useEffect(() => () => afficher(null), []);
  const curseur = useId();
  const champ = useRef<HTMLInputElement>(null);
  // React fait de onChange l'évènement « input », à chaque pas : la fin du geste s'écoute sur le champ lui-même.
  useEffect(() => {
    const leCurseur = champ.current;
    if (!leCurseur) return;
    const lache = () => garderDansLAdresse(Number(leCurseur.value));
    leCurseur.addEventListener("change", lache);
    return () => leCurseur.removeEventListener("change", lache);
  }, []);

  function choisir(choisies: number) {
    setMinutes(choisies);
    garderDansLAdresse(choisies);
  }

  return (
    <Bloc titre="Séjour" className={styles.sejour}>
      <div className={styles.reglage}>
        {/* Le curseur annonce déjà la durée : l'affichage ne la répète pas. */}
        <output htmlFor={curseur} className={styles.duree} aria-live="off">
          {formaterMinutes(minutes)}
        </output>
        <input
          ref={champ}
          id={curseur}
          className={styles.curseur}
          // Le cuivre du curseur, de sa borne à son losange : la part de la durée choisie, de la plus courte à la plus longue.
          style={{ "--part": (minutes - SEJOUR_MINUTES.min) / (SEJOUR_MINUTES.max - SEJOUR_MINUTES.min) } as CSSProperties}
          type="range"
          name={PARAMETRE_DU_SEJOUR}
          form={FORMULAIRE_DE_DEPART}
          min={SEJOUR_MINUTES.min}
          max={SEJOUR_MINUTES.max}
          step={SEJOUR_MINUTES.pas}
          value={minutes}
          aria-label="Durée du séjour"
          aria-valuetext={formaterMinutes(minutes)}
          onChange={(e) => setMinutes(Number(e.target.value))}
          onBlur={(e) => garderDansLAdresse(Number(e.target.value))}
        />
        <div className={styles.bornes} aria-hidden="true">
          <span>{formaterMinutes(SEJOUR_MINUTES.min)}</span>
          <span>{formaterMinutes(SEJOUR_MINUTES.max)}</span>
        </div>
        <div className={`${kit.segments} ${styles.prets}`} role="group" aria-label="Durées toutes prêtes">
          {SEJOURS_TOUT_PRETS_MINUTES.map((m) => (
            <button key={m} type="button" className={styles.pret} aria-pressed={m === minutes} onClick={() => choisir(m)}>
              {formaterMinutes(m)}
            </button>
          ))}
        </div>
      </div>
    </Bloc>
  );
}
