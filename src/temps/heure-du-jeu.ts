// L'heure du jeu qui avance dans le navigateur, pour les comptes à rebours en direct, et la page relue à son heure. Dans le navigateur seulement.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * US-0918 : l'heure du jeu, partie de `maintenant`, donnée par le serveur à l'affichage, et qui avance chaque seconde au
 * rythme du jeu (`vitesse`, donnée par le serveur aussi) sur l'horloge du navigateur, comme le compte à rebours des
 * Voyageurs (US-0333) : jamais l'heure du téléphone ou de l'ordinateur, seulement le temps écoulé depuis l'affichage.
 * Quand la page est relue, tout repart de la nouvelle heure.
 */
export function useHeureDuJeu(maintenant: Date, vitesse = 1): Date {
  const base = maintenant.getTime();
  // Le temps écoulé depuis l'affichage, mesuré pour cette heure du jeu-là : celui d'une heure déjà dépassée ne compte plus.
  const [ecoule, setEcoule] = useState<{ base: number; ms: number } | null>(null);
  useEffect(() => {
    const depart = performance.now();
    const battement = setInterval(() => setEcoule({ base, ms: performance.now() - depart }), 1000);
    return () => clearInterval(battement);
  }, [base]);
  return new Date(base + (ecoule?.base === base ? vitesse * ecoule.ms : 0));
}

/** Le plus long délai qu'un minuteur du navigateur sache attendre : au-delà, il partirait aussitôt. */
const DELAI_MAX_MS = 2_147_483_647;
/** Le temps réel laissé au serveur après l'instant attendu, avant de relire la page (comme après un retour, US-0916). */
const RELIRE_APRES_MS = 1_000;

/**
 * US-0818 : relit la page une seconde réelle après l'instant du jeu `quand` (une naissance), le temps que le serveur y
 * soit : elle repart alors de la nouvelle heure du jeu, et de ce qu'elle a changé. L'attente se compte depuis l'heure du
 * jeu à l'affichage (`maintenant`), au rythme du jeu (`vitesse`). Rien sans instant, pour un instant déjà passé à
 * l'affichage, ou trop lointain pour un minuteur du navigateur.
 */
export function useRelireLaPageA(quand: Date | null, maintenant: Date, vitesse = 1): void {
  const routeur = useRouter();
  const attendu = quand?.getTime() ?? null;
  const lecture = maintenant.getTime();
  useEffect(() => {
    if (attendu === null || attendu <= lecture) return;
    const releve = (attendu - lecture) / vitesse + RELIRE_APRES_MS;
    if (releve > DELAI_MAX_MS) return;
    const minuteur = setTimeout(() => routeur.refresh(), Math.ceil(releve));
    return () => clearTimeout(minuteur);
  }, [attendu, lecture, vitesse, routeur]);
}
