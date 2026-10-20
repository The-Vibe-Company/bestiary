// Le Récit d'un Élevage fini (US-0817) : une note courte sur la page Récits, datée de la dernière naissance, qui dit
// combien de Bêtes de l'Espèce ont rejoint l'effectif. US-0821 : tant qu'il n'est pas lu, les Élevages finis ensuite s'y
// ajoutent, un seul Récit récapitulant ceux d'une absence. Côté serveur comme dans le navigateur, qui le reconnaît à son
// titre.
import { formaterJourEtHeure } from "@/temps/affichage";
import type { NouveauRecit } from "./recits";

/** Le fuseau des joueurs, pour l'heure de chaque fin d'Élevage. */
const FUSEAU = "Europe/Paris";

/** Les noms de Bêtes au h muet, qui s'élident (« d'Hirondelle ») ; les autres h sont aspirés (« de Hibou », « de Héron »). */
const H_MUET = /^(hirondelle|hippopotame|hippocampe|hermine|huître|hu[iî]trier|hémione|hévéa)/i;

/**
 * « de Poule », « d'Aigle », « d'Hirondelle » : l'élision devant une voyelle ou un h muet ; pas devant un y (« de Yack »),
 * ni devant un h aspiré, celui de la plupart des noms de Bêtes (« de Hibou », « de Hérisson »).
 */
const de = (nom: string) => (/^[aeiouàâäéèêëîïôöùûüœæ]/i.test(nom) || H_MUET.test(nom) ? `d'${nom}` : `de ${nom}`);

/** US-0817 : le titre d'un Récit de fin d'Élevage, à quoi la page Récits le reconnaît (son médaillon : l'éleveur). */
export const FIN_D_ELEVAGE = "Élevage terminé";
/** US-0821 : le titre du même Récit quand il dit plusieurs Élevages finis, ceux d'une absence. */
export const FINS_D_ELEVAGE = "Élevages terminés";

/** US-0821 : un Élevage fini, tel que le Récit le dit : combien de Bêtes, de quelle Espèce (son nom), et à quel instant. */
export type ElevageFini = { nombre: number; espece: string; fin: Date };

/** « 3 Bêtes », « 1 Bête », « 1 200 Bêtes », à la française, sans coupure. */
const betes = (nombre: number) => `${new Intl.NumberFormat("fr-FR").format(nombre).replace(/\s/g, " ")} ${nombre > 1 ? "Bêtes" : "Bête"}`;

/**
 * US-0817 : le Récit de la fin d'un Élevage de `nombre` Bêtes de l'Espèce `espece` (son nom), à l'instant du jeu
 * `instant`, celui de sa dernière naissance : « 3 Bêtes de Poule ont rejoint votre effectif. » ; une seule :
 * « 1 Bête de Poule a rejoint votre effectif. ».
 */
export function recitDElevage(nombre: number, espece: string, instant: Date): NouveauRecit {
  const texte = `${betes(nombre)} ${de(espece)} ${nombre > 1 ? "ont" : "a"} rejoint votre effectif.`;
  return { titre: FIN_D_ELEVAGE, texte, survenuLe: instant };
}

/**
 * US-0821 : le Récit des Élevages finis `fins`, dans l'ordre de leurs fins, daté de la dernière : d'un seul, celui
 * d'US-0817 ; de plusieurs, « Élevages terminés », qui compte toutes les Bêtes puis dit chaque Élevage sur sa ligne,
 * avec l'heure de sa fin : « 5 Bêtes ont rejoint votre effectif : / 3 Bêtes de Souris grise, le 20 octobre à 15:31 /
 * 2 Bêtes de Poule, le 21 octobre à 03:12 ».
 */
export function recitDesElevages(fins: readonly ElevageFini[]): NouveauRecit {
  const dernier = fins.at(-1)!;
  if (fins.length === 1) return recitDElevage(dernier.nombre, dernier.espece, dernier.fin);
  const total = fins.reduce((somme, fin) => somme + fin.nombre, 0);
  return {
    titre: FINS_D_ELEVAGE,
    texte: [`${betes(total)} ont rejoint votre effectif :`, ...fins.map((fin) => `${betes(fin.nombre)} ${de(fin.espece)}, le ${formaterJourEtHeure(fin.fin, FUSEAU)}`)].join("\n"),
    survenuLe: dernier.fin,
  };
}
