// Le résumé du récit de retour d'une Expédition (US-0941) : en tête de son Récit, une ligne dit l'essentiel, pour faire le
// point vite sans l'ouvrir : les Bêtes ramenées au Foyer et les nouvelles Espèces au Bestiaire, comptées sur son récit de
// Rencontre (US-0940), et les Bêtes de l'escorte perdues.
import type { RencontreRacontee } from "@/monde/recits";

/** US-0917 : le titre du Récit d'un retour d'Expédition, le seul que résume cette ligne (US-0941). */
export const RETOUR_D_EXPEDITION = "Retour d'Expédition";

/** « 1 Bête ramenée », « 2 Bêtes ramenées », et « Aucune Bête ramenée » quand l'Expédition rentre bredouille. */
function betesRamenees(nombre: number): string {
  if (nombre === 0) return "Aucune Bête ramenée";
  return nombre === 1 ? "1 Bête ramenée" : `${nombre} Bêtes ramenées`;
}

/** « 1 nouvelle Espèce au Bestiaire », « 2 nouvelles Espèces au Bestiaire ». */
const nouvellesEspeces = (nombre: number) => (nombre === 1 ? "1 nouvelle Espèce au Bestiaire" : `${nombre} nouvelles Espèces au Bestiaire`);

/** « 1 Bête perdue », « 3 Bêtes perdues ». */
const betesPerdues = (nombre: number) => (nombre === 1 ? "1 Bête perdue" : `${nombre} Bêtes perdues`);

/**
 * US-0941 : les faits du résumé, « 2 Bêtes ramenées », « 1 nouvelle Espèce au Bestiaire », « 1 Bête perdue » : les Bêtes
 * apprivoisées, qui ont suivi l'Expédition jusqu'au Foyer, toujours, « Aucune » s'il n'y en a pas ; puis les Espèces
 * entrées au Bestiaire et les Bêtes de l'escorte perdues (`pertes`), s'il y en a.
 */
export function resumeDUnRetour(rencontres: readonly Pick<RencontreRacontee, "issue" | "nouvelleEspece">[], pertes: number): string[] {
  const ramenees = rencontres.filter((r) => r.issue === "apprivoisee").length;
  const nouvelles = rencontres.filter((r) => r.nouvelleEspece).length;
  return [betesRamenees(ramenees), ...(nouvelles > 0 ? [nouvellesEspeces(nouvelles)] : []), ...(pertes > 0 ? [betesPerdues(pertes)] : [])];
}
