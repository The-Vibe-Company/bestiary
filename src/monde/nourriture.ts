// Combien de temps la Nourriture d'un Territoire tiendra (US-0320) : un calcul pur, sans base.
import { FAMINE_IMMINENTE_HEURES, FAMINE_IMMINENTE_MARGE_HEURES } from "@/reglages";

/** US-0320 : un Stock de Nourriture tel que le calcul le prend : sa quantité, sa production par heure et sa limite. */
export type StockDeNourriture = { quantite: number; parHeure: number; limite: number };

/**
 * US-0826 : l'Entretien des Bêtes par heure, en Nourriture : celui des carnivores, que seule la Viande paie, celui des
 * herbivores, que seuls les Végétaux paient, et celui des omnivores, que l'une ou l'autre paie, comme les Habitants.
 */
export type EntretienDesBetes = { viande: number; vegetaux: number; omnivores: number };

/** US-0826 : l'Entretien des Bêtes tel que la base le lit, en texte (numeric de Postgres ; entretienDesBetes). */
export type EntretienDesBetesLu = { viande: string; vegetaux: string; omnivores: string };

/** US-0826 : aucune Bête à nourrir. */
const AUCUNE_BETE: EntretienDesBetes = { viande: 0, vegetaux: 0, omnivores: 0 };

/**
 * Les heures avant qu'un Stock qui paie `paie` par heure soit vide (0 s'il l'est déjà), Infinity s'il ne
 * l'est jamais. Au-dessus de sa limite, il ne produit plus (US-0230) : il paie sans rien recevoir jusqu'à
 * elle, puis sa production le soutient.
 */
function heuresAvantVide(stock: StockDeNourriture, paie: number): number {
  if (stock.parHeure >= paie) return Infinity;
  return Math.max(0, stock.quantite - stock.limite) / paie + Math.min(stock.quantite, stock.limite) / (paie - stock.parHeure);
}

/** La quantité d'un Stock qui paie `paie` par heure, au bout de `heures` : jamais sous zéro, ni au-dessus de sa limite par sa production. */
function quantiteApres(stock: StockDeNourriture, paie: number, heures: number): number {
  const jusquALimite = stock.quantite > stock.limite ? (stock.quantite - stock.limite) / paie : 0;
  if (heures <= jusquALimite) return stock.quantite - paie * heures;
  const depart = Math.min(stock.quantite, stock.limite);
  return Math.max(0, Math.min(stock.limite, depart + (stock.parHeure - paie) * (heures - jusquALimite)));
}

/**
 * US-0320 : dans combien d'heures de jeu la Viande et les Végétaux ne pourront plus payer l'Entretien de
 * `entretienParHeure` Nourriture par heure, au rythme du moment ; null quand la Nourriture est assurée, la
 * production des deux couvrant l'Entretien.
 *
 * Le temps suit la règle même du calcul du jeu (US-0316, PRODUIRE), et non le stock total divisé par le
 * solde : tant que les deux le peuvent, la Viande et les Végétaux paient chacun la moitié de l'Entretien,
 * celui qui monte s'arrêtant à sa limite ; le premier vide ne donne plus que sa production, à mesure, et
 * l'autre paie tout le reste, jusqu'à se vider à son tour.
 *
 * L'Entretien est le total des Habitants, pas la somme des parts que la barre montre (stocksDuTerritoire) :
 * quand les deux Stocks sont vides, ces parts ne valent plus que leur production.
 *
 * US-0826 : avec l'Entretien des Bêtes (`betes`) : chaque Stock paie d'abord les Bêtes qui ne mangent que lui
 * (les carnivores la Viande, les herbivores les Végétaux), puis la moitié de la demande partagée, les Habitants et
 * les omnivores ; le premier vide donne sa production à ses Bêtes d'abord, et l'autre paie tout le reste. Le temps
 * rendu reste celui des Habitants : jusqu'au premier instant où ils ne reçoivent plus tout leur Entretien, les Bêtes
 * d'un Stock vide pouvant avoir faim avant eux ; null quand la production, une fois payées les Bêtes qui ne mangent
 * qu'elle, les nourrit.
 */
export function nourriturePourEncore(
  viande: StockDeNourriture,
  vegetaux: StockDeNourriture,
  entretienParHeure: number,
  betes: EntretienDesBetes = AUCUNE_BETE,
): number | null {
  const pourLesHabitants = Math.max(0, viande.parHeure - betes.viande) + Math.max(0, vegetaux.parHeure - betes.vegetaux);
  if (pourLesHabitants >= entretienParHeure) return null;
  const partage = entretienParHeure + betes.omnivores;
  const stocks = [
    { stock: viande, siennes: betes.viande },
    { stock: vegetaux, siennes: betes.vegetaux },
  ].map((s) => ({ ...s, paie: s.siennes + partage / 2 }));
  const [premier, autre] = heuresAvantVide(stocks[0].stock, stocks[0].paie) <= heuresAvantVide(stocks[1].stock, stocks[1].paie) ? stocks : [stocks[1], stocks[0]];
  const vide = heuresAvantVide(premier.stock, premier.paie);
  const ensuite = { ...autre.stock, quantite: quantiteApres(autre.stock, autre.paie, vide) };
  return vide + heuresAvantVide(ensuite, autre.siennes + partage - Math.max(0, premier.stock.parHeure - premier.siennes));
}

/** US-0321 : un Stock tel que la base le lit, en texte (stocksDuTerritoire) : sa famille, sa quantité, sa production par heure et sa limite. */
type StockLu = { famille: string; quantite: string; parHeure: string; limite: string };

/**
 * US-0321 : nourriturePourEncore sur les Stocks tels que la base les lit, la Viande puis les Végétaux, et
 * l'Entretien total en texte ; null quand la Nourriture est assurée, ou sans Stock de Nourriture. US-0826 : avec
 * l'Entretien des Bêtes tel que la base le lit (entretienDesBetes), s'il y en a.
 */
export function nourriturePourEncoreDesStocks(stocks: StockLu[], entretienParHeure: string, betes?: EntretienDesBetesLu): number | null {
  const [viande, vegetaux] = stocks
    .filter((s) => s.famille === "nourriture")
    .map((s) => ({ quantite: Number(s.quantite), parHeure: Number(s.parHeure), limite: Number(s.limite) }));
  if (!viande || !vegetaux) return null;
  return nourriturePourEncore(
    viande,
    vegetaux,
    Number(entretienParHeure),
    betes && { viande: Number(betes.viande), vegetaux: Number(betes.vegetaux), omnivores: Number(betes.omnivores) },
  );
}

/** Une heure, en millisecondes. */
const HEURE_MS = 3_600_000;

/**
 * US-0321 : dans combien de millisecondes réelles, après la lecture des Stocks, la famine devient imminente, au
 * rythme du jeu (`vitesse`) : quand la Nourriture ne couvre plus que FAMINE_IMMINENTE_HEURES heures d'Entretien,
 * ou moins ; 0 si elle l'est déjà.
 */
export function avantFamineImminente(heures: number, vitesse: number): number {
  return Math.max(0, ((heures - FAMINE_IMMINENTE_HEURES) * HEURE_MS) / vitesse);
}

/** US-0321 : les heures que la Nourriture tiendra encore `ecoule` millisecondes réelles après la lecture des Stocks, au rythme du jeu ; jamais moins de zéro. */
export function nourritureRestante(heures: number, ecoule: number, vitesse: number): number {
  return Math.max(0, heures - (vitesse * ecoule) / HEURE_MS);
}

/**
 * US-0322 : depuis combien d'heures de jeu la famine est imminente, `ecoule` millisecondes réelles après la
 * lecture des Stocks, au rythme du jeu. `depuis` : ce que le Territoire retient à la lecture (famineImminenteDepuis) ;
 * sans rien de retenu, depuis le passage du seuil, page ouverte, ou depuis la lecture si la Nourriture était déjà
 * dessous : c'est l'instant que le prochain rattrapage retiendra.
 */
export function depuisFamineImminente(heures: number, depuis: number | null, ecoule: number, vitesse: number): number {
  const passe = (vitesse * ecoule) / HEURE_MS;
  return depuis !== null ? depuis + passe : Math.max(0, passe - Math.max(0, heures - FAMINE_IMMINENTE_HEURES));
}

/**
 * US-0325 : dans combien de millisecondes réelles, après la lecture des Stocks, la Famine commence, au rythme du jeu
 * (`vitesse`) : quand la Nourriture ne paie plus l'Entretien, au bout de `heures` ; 0 si c'est déjà le cas.
 */
export function avantFamine(heures: number, vitesse: number): number {
  return Math.max(0, (heures * HEURE_MS) / vitesse);
}

/**
 * US-0325 : depuis combien d'heures de jeu la Famine dure, `ecoule` millisecondes réelles après la lecture des Stocks,
 * au rythme du jeu. `depuis` : ce que le Territoire retient à la lecture (famineDepuis) ; sans rien de retenu, depuis
 * l'instant où la Nourriture ne paie plus l'Entretien, page ouverte, ou depuis la lecture si c'était déjà le cas :
 * c'est l'instant que le prochain rattrapage retiendra.
 */
export function depuisFamine(heures: number, depuis: number | null, ecoule: number, vitesse: number): number {
  const passe = (vitesse * ecoule) / HEURE_MS;
  return depuis !== null ? depuis + passe : Math.max(0, passe - heures);
}

/**
 * US-0323 : ce que le Territoire retient de la famine imminente (`depuis`, famineImminenteDepuis) vaut tant que
 * la Nourriture ne couvre pas plus de FAMINE_IMMINENTE_HEURES + FAMINE_IMMINENTE_MARGE_HEURES heures (`heures`) ;
 * au-delà, le danger est passé : null, comme le mécanisme du temps (PRODUIRE) le notera au prochain rattrapage.
 * Quand la Nourriture est assurée, l'avertissement n'est pas posé du tout (ActionsDuJeu).
 */
export function famineImminenteRetenue(heures: number, depuis: number | null): number | null {
  return heures <= FAMINE_IMMINENTE_HEURES + FAMINE_IMMINENTE_MARGE_HEURES ? depuis : null;
}

/** La plus petite durée du jeu, la microseconde, en heures : en deçà, l'écart n'est qu'une erreur d'arrondi du calcul. */
const MICROSECONDES_PAR_HEURE = 3_600_000_000;

/** Un nombre et son unité, d'une espace insécable : ils ne se séparent jamais en passant à la ligne. */
const unite = (nombre: number, symbole: string) => `${nombre} ${symbole}`;

/**
 * US-0320 : ce que dit la page Habitants : « Nourriture assurée », ou « Nourriture pour encore 7 h », les
 * heures arrondies vers le bas, en jours et heures au-delà de 48 h (« 3 j 5 h ») ; sous une heure,
 * « moins d'une heure ». US-0325 : à zéro, la Nourriture ne paie plus l'Entretien : c'est la Famine.
 */
export function tenueDeLaNourriture(heures: number | null): string {
  if (heures === null) return "Nourriture assurée";
  if (heures <= 0) return "Famine";
  const entieres = Math.floor(Math.round(heures * MICROSECONDES_PAR_HEURE) / MICROSECONDES_PAR_HEURE);
  if (entieres < 1) return "Nourriture pour encore moins d'une heure";
  return `Nourriture pour encore ${enHeuresOuEnJours(entieres)}`;
}

/** Des heures entières : « 7 h » jusqu'à 48 h, puis en jours et heures, « 3 j 5 h », « 3 j ». */
function enHeuresOuEnJours(entieres: number): string {
  if (entieres <= 48) return unite(entieres, "h");
  const [jours, reste] = [Math.floor(entieres / 24), entieres % 24];
  return `${unite(jours, "j")}${reste ? ` ${unite(reste, "h")}` : ""}`;
}

/**
 * US-0322 : depuis quand la famine est imminente : « depuis un instant » sous une minute, puis « depuis 45 min »,
 * « depuis 3 h », et en jours au-delà de 48 h comme le temps qui reste. Arrondi vers le bas, et non au-dessus
 * comme formaterDuree, qui dit une durée à venir : on ne dit jamais plus long que ce qui s'est passé.
 */
export function depuisCombienDeTemps(heures: number): string {
  const minutes = Math.floor(Math.round(heures * MICROSECONDES_PAR_HEURE) / (MICROSECONDES_PAR_HEURE / 60));
  if (minutes < 1) return "depuis un instant";
  if (minutes < 60) return `depuis ${unite(minutes, "min")}`;
  return `depuis ${enHeuresOuEnJours(Math.floor(minutes / 60))}`;
}
