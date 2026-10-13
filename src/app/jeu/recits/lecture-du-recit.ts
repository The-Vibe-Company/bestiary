// La lecture d'un Récit sur la page Récits : ce que la page montre autrement que son texte, sans rien lui ajouter. Le
// médaillon de chaque sorte de Récit, et pour un retour d'Expédition (US-0917), ses faits ligne à ligne, ses durées sur
// la frise (Frise) et sa destination en paysage (Paysage), lus dans le texte que le jeu a écrit (recitDeRetour).
import type { DureesDUneExpedition } from "@/components/Frise";
import { RETOUR_D_EXPEDITION } from "@/expeditions/resume-du-retour";
import { estUnRecitDeGuerison } from "@/monde/recit-de-guerison";

/**
 * Le médaillon de chaque sorte de Récit : la carte roulée de l'explorateur, la Nourriture d'une Famine, un Habitant ; US-0954,
 * l'éleveur d'une guérison de Blessés, comme la Réserve dans la navigation.
 */
const MEDAILLONS = {
  expedition: "/illustrations/metiers/explorateur.webp",
  famine: "/illustrations/ressources/vegetaux.webp",
  guerison: "/illustrations/metiers/eleveur.webp",
  habitants: "/illustrations/icones/habitants.webp",
} as const;

/** Le médaillon des Récits eux-mêmes : la tablette et sa plume, comme dans la navigation. */
export const MEDAILLON_DES_RECITS = "/illustrations/metiers/chercheur.webp";

/**
 * Le médaillon d'un Récit, par son titre : un retour d'Expédition, la Famine et sa fin, une guérison de Blessés (US-0954),
 * et sinon un Habitant (les Voyageurs accueillis ou repartis, les Habitants partis).
 */
export function medaillonDuRecit(titre: string): string {
  if (titre === RETOUR_D_EXPEDITION) return MEDAILLONS.expedition;
  if (titre.includes("Famine")) return MEDAILLONS.famine;
  if (estUnRecitDeGuerison(titre)) return MEDAILLONS.guerison;
  return MEDAILLONS.habitants;
}

/** La ligne des durées d'un retour : « Aller 2 h 40, séjour 4 h, retour 2 h 40. », ou « …, sans séjour, … » (US-0920). */
const DUREES = /^Aller ([^,]+), (?:sans séjour|séjour ([^,]+)), retour ([^,]+)\.$/;

/** La ligne de la destination : « Destination : Prairie, à 8 Cases de votre Foyer. ». */
const DESTINATION = /^Destination : (.+), à \d/;

/** La destination jamais atteinte d'une Expédition rappelée, encore sous le brouillard (US-0920). */
export const CASE_INCONNUE = "Case inconnue";

/** Une durée écrite par formaterMinutes, en minutes : « 40 min », « 2 h », « 2 h 40 », « 1 j », « 1 j 3 h » ; null sinon. */
export function minutesDUneDuree(duree: string): number | null {
  const minutes = /^(\d+) min$/.exec(duree);
  if (minutes) return Number(minutes[1]);
  const heures = /^(\d+) h(?: (\d{2}))?$/.exec(duree);
  if (heures) return Number(heures[1]) * 60 + Number(heures[2] ?? 0);
  const jours = /^(\d+) j(?: (\d+) h)?$/.exec(duree);
  if (jours) return Number(jours[1]) * 24 * 60 + Number(jours[2] ?? 0) * 60;
  return null;
}

/**
 * Le texte d'un retour d'Expédition, tel que la page le montre : ses faits, un par ligne, sans celle des durées quand la
 * frise la reprend ; ses durées, en minutes (un séjour qu'il n'y a pas eu : 0) ; le Biome de sa destination, ou « Case
 * inconnue ». Une ligne que la page ne sait pas lire reste un fait : rien du texte ne se perd.
 */
export function lireUnRetour(texte: string): { faits: string[]; durees: DureesDUneExpedition | null; biome: string | null } {
  const lignes = texte.split("\n").filter((ligne) => ligne.trim() !== "");
  let durees: DureesDUneExpedition | null = null;
  const faits: string[] = [];
  for (const ligne of lignes) {
    const lues: RegExpExecArray | null = durees ? null : DUREES.exec(ligne);
    if (lues) {
      const [aller, sejour, retour]: (number | null)[] = [
        minutesDUneDuree(lues[1]),
        lues[2] === undefined ? 0 : minutesDUneDuree(lues[2]),
        minutesDUneDuree(lues[3]),
      ];
      if (aller !== null && sejour !== null && retour !== null) {
        durees = { aller, sejour, retour };
        continue;
      }
    }
    faits.push(ligne);
  }
  return { faits, durees, biome: DESTINATION.exec(lignes[0] ?? "")?.[1] ?? null };
}

/** La sorte d'un fait d'un retour, telle que la page le marque : un combat, ses pertes, la fuite, une Bête partie ailleurs. */
export type SorteDUnFait = "combat" | "pertes" | "fuite" | "ailleurs";

/**
 * La sorte d'un fait d'un retour d'Expédition, lue dans le texte que le jeu a écrit (recitDeRetour), pour que la page le
 * marque sans rien lui ajouter : US-0947, un combat (« Combat le … », « Attaque le … »), ses pertes (US-0951, « Pertes
 * au combat : … », « Aucune perte. » ; US-0946, « Toute votre escorte a été perdue au combat : … ») et la fuite des
 * explorateurs ; US-0964, une Bête qui a suivi une autre Expédition,
 * et US-0949, une Bête repérée partie avant l'arrivée. null pour tout autre fait.
 */
export function sorteDUnFait(fait: string): SorteDUnFait | null {
  if (/^(Combat|Attaque) le /.test(fait)) return "combat";
  if (/^(Pertes au combat|Toute votre escorte a été perdue au combat) : /.test(fait) || fait === "Aucune perte.") return "pertes";
  if (/^Vos explorateurs ont fui/.test(fait)) return "fuite";
  if (/ (a suivi une autre Expédition|ont suivi d'autres Expéditions|plus sur la Case à votre arrivée)\.$/.test(fait)) return "ailleurs";
  return null;
}
