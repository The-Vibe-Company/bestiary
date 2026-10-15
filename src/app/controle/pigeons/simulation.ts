// US-0974 : la simulation des pigeons éclaireurs : sur une longue période, des Expéditions identiques, avec et sans
// Éclaireurs, pour vérifier que leur effet se mesure : plus de Rencontres, les Bêtes gardées en vue plus longtemps
// (US-0970), et plus de Cases sorties du brouillard (US-0969). Un calcul pur, par les fonctions mêmes du jeu : les
// apparitions des Bêtes sauvages (US-0925), ce qu'une Expédition en voit (vueLe), la vue de ses Éclaireurs
// (vueProlongee) et le brouillard qu'elle lève (casesRevelees). Rien n'est lu ni écrit en base. Une Rencontre simulée est
// une apparition ordinaire de Bête sauvage qu'une Expédition seule voit pendant son séjour : ni Rareté ni Espèce tirée, ni
// Bête de naissance, ni autre Expédition sur la Case. Rien de tout cela ne dépend des pigeons : l'écart reste le leur.
import { type BeteSurLaCase, vueLe } from "@/expeditions/apprivoisement";
import { casesRevelees, rayonDesEclaireurs } from "@/expeditions/brouillard";
import { type HorairesDUneExpedition, retourDUneExpedition, sejourDUneExpedition } from "@/expeditions/phase";
import { vueProlongee } from "@/expeditions/vue-des-eclaireurs";
import { apparitions } from "@/monde/betes-sauvages";
import { casesDansLeRayon, type Coordonnees } from "@/monde/hex";
import {
  ABORDS_DU_FOYER_CASES,
  BROUILLARD_LEVE_PAR_ECLAIREUR_CASES,
  BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES,
  MINUTES_DE_VUE_AU_PLUS,
  MINUTES_DE_VUE_PAR_ECLAIREUR,
  PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE,
  PORTEE_D_EXPLORATION_CASES,
  PRESENCE_D_UNE_BETE_HEURES,
  SEJOURS_TOUT_PRETS_MINUTES,
  SIMULATION_DES_PIGEONS_ECART_MINIMAL_POURCENT,
  SIMULATION_DES_PIGEONS_EXPEDITIONS,
  SIMULATION_DES_PIGEONS_JOURS,
} from "@/reglages";

const MINUTE_MS = 60_000;
const JOUR_MS = 86_400_000;
const PRESENCE_MS = PRESENCE_D_UNE_BETE_HEURES * 60 * MINUTE_MS;

/** La graine du Monde simulé, et son Foyer : toutes les Expéditions en partent. */
const GRAINE = 974;
const FOYER: Coordonnees = { q: 0, r: 0 };
/** Le premier départ simulé ; les autres suivent, également répartis sur SIMULATION_DES_PIGEONS_JOURS jours. */
const DEBUT = Date.UTC(2031, 0, 1);
/** Le séjour de chaque Expédition simulée : 4 h, la deuxième des durées toutes prêtes. */
const SEJOUR_MINUTES = SEJOURS_TOUT_PRETS_MINUTES[1];
/**
 * Les abords du Foyer, découverts à sa naissance : le jeu ne les attribue jamais à une Expédition. Leur forme seule, sans
 * abordsDuFoyer, que seules la naissance et la bascule d'un Monde appellent, pour découvrir (src/monde/brouillard.test.ts).
 */
const ABORDS = new Set(casesDansLeRayon(FOYER, ABORDS_DU_FOYER_CASES).map((c) => `${c.q},${c.r}`));
/** La plus proche destination simulée : au-delà des Cases voisines du Foyer. */
const DISTANCE_MINIMALE = 2;

/**
 * US-0974 : les nombres d'Éclaireurs comparés à l'Expédition sans pigeon, de 1 jusqu'à ce que leurs deux effets
 * atteignent leur plafond : la vue (MINUTES_DE_VUE_AU_PLUS) et le brouillard (BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES).
 */
export const ECLAIREURS_SIMULES = Array.from(
  {
    length: Math.max(
      Math.ceil(MINUTES_DE_VUE_AU_PLUS / MINUTES_DE_VUE_PAR_ECLAIREUR),
      Math.ceil(BROUILLARD_LEVE_PAR_LES_ECLAIREURS_PLAFOND_CASES / BROUILLARD_LEVE_PAR_ECLAIREUR_CASES),
    ),
  },
  (_, i) => i + 1,
);

/** US-0974 : une Expédition simulée : sa destination et ses horaires, les mêmes avec ou sans pigeons. */
export type ExpeditionSimulee = { destination: Coordonnees; horaires: HorairesDUneExpedition };

/**
 * US-0974 : l'Expédition simulée numéro `i` sur `expeditions` : vers une Case à 2 Cases du Foyer jusqu'à la portée
 * d'exploration (PORTEE_D_EXPLORATION_CASES), une autre à chaque fois, au pas des explorateurs, pour un séjour de 4 h ;
 * partie à son tour, les départs également répartis sur SIMULATION_DES_PIGEONS_JOURS jours.
 */
export function expeditionSimulee(i: number, expeditions = SIMULATION_DES_PIGEONS_EXPEDITIONS): ExpeditionSimulee {
  const distance = DISTANCE_MINIMALE + (i % (PORTEE_D_EXPLORATION_CASES - DISTANCE_MINIMALE + 1));
  const destination = { q: distance, r: -(Math.floor(i / (PORTEE_D_EXPLORATION_CASES - DISTANCE_MINIMALE + 1)) % (distance + 1)) };
  const partLe = new Date(DEBUT + Math.floor((i * SIMULATION_DES_PIGEONS_JOURS * JOUR_MS) / expeditions));
  return { destination, horaires: { partLe, trajetMinutes: distance * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE, sejourMinutes: SEJOUR_MINUTES } };
}

/**
 * US-0974 : combien des Bêtes `betes` une Expédition rencontre pendant son `sejour`, avec `eclaireurs` Éclaireurs : celles
 * qu'elle voit (vueLe), ses Éclaireurs les gardant en vue un temps après leur départ (vueProlongee).
 */
export function rencontresVues(betes: readonly Pick<BeteSurLaCase, "arrivee" | "depart">[], sejour: { debut: Date; fin: Date }, eclaireurs: number): number {
  const expedition = { arrivee: sejour.debut, depart: sejour.fin, vueProlongee: vueProlongee(eclaireurs) };
  return betes.filter((bete) => vueLe(bete, expedition) !== null).length;
}

/**
 * US-0974 : les Cases qu'une Expédition vers `destination` sort du brouillard jusqu'à son retour, avec `eclaireurs`
 * Éclaireurs (casesRevelees), comme le jeu les lui attribue : sans les abords du Foyer, déjà découverts.
 */
export function casesDeLExpedition(destination: Coordonnees, horaires: HorairesDUneExpedition, eclaireurs: number): number {
  return casesRevelees(FOYER, destination, horaires, retourDUneExpedition(horaires)!, eclaireurs).filter((c) => !ABORDS.has(`${c.q},${c.r}`)).length;
}

/** US-0974 : une ligne de la simulation : un nombre d'Éclaireurs, et ce qu'il donne à côté de l'Expédition sans pigeon. */
export type LigneDesPigeons = {
  eclaireurs: number;
  /** La vue en plus, en minutes du jeu (vueProlongee). */
  vueMinutes: number;
  /** Les Cases de rayon en plus (rayonDesEclaireurs). */
  rayonEnPlus: number;
  rencontres: number;
  /** Les Rencontres en plus, en pourcentage de celles sans pigeon. */
  ecart: number;
  /** Les Cases sorties du brouillard en moyenne par Expédition, et celles en plus. */
  casesRevelees: number;
  casesEnPlus: number;
  sousLEcart: boolean;
};

export type SimulationDesPigeons = {
  expeditions: number;
  jours: number;
  sejourMinutes: number;
  ecartMinimal: number;
  sans: { rencontres: number; casesRevelees: number };
  lignes: LigneDesPigeons[];
  reussie: boolean;
};

/**
 * US-0974 : `expeditions` Expéditions identiques, chacune vécue sans pigeon puis avec chaque nombre d'Éclaireurs de
 * ECLAIREURS_SIMULES : leurs Rencontres, et leurs Cases sorties du brouillard en moyenne au retour. Le contrôle échoue si,
 * pour un nombre d'Éclaireurs, les Rencontres en plus restent sous `ecartMinimal` pour cent de celles sans pigeon. Les
 * mêmes Bêtes et les mêmes Expéditions à chaque fois : le résultat ne change pas d'une ouverture à l'autre.
 */
export function simulerLesPigeons({
  expeditions = SIMULATION_DES_PIGEONS_EXPEDITIONS,
  ecartMinimal = SIMULATION_DES_PIGEONS_ECART_MINIMAL_POURCENT,
}: { expeditions?: number; ecartMinimal?: number } = {}): SimulationDesPigeons {
  const comptes = [0, ...ECLAIREURS_SIMULES];
  const rencontres = comptes.map(() => 0);
  const cases = comptes.map(() => 0);
  const vueMaximale = vueProlongee(Math.max(...comptes));
  for (let i = 0; i < expeditions; i++) {
    const { destination, horaires } = expeditionSimulee(i, expeditions);
    const sejour = sejourDUneExpedition(horaires)!;
    // Toutes les Bêtes que l'une ou l'autre peut voir : arrivées avant la fin du séjour, parties au plus tôt la vue la
    // plus longue avant son début.
    const betes = apparitions(GRAINE, destination, new Date(sejour.debut.getTime() - PRESENCE_MS - vueMaximale), sejour.fin).map((x) => ({
      arrivee: x.arrivee,
      depart: new Date(x.arrivee.getTime() + PRESENCE_MS),
    }));
    // Le brouillard ne dépend des Éclaireurs que par son rayon : un calcul par rayon.
    const parRayon = new Map<number, number>();
    comptes.forEach((eclaireurs, k) => {
      rencontres[k] += rencontresVues(betes, sejour, eclaireurs);
      const rayon = rayonDesEclaireurs(eclaireurs);
      if (!parRayon.has(rayon)) parRayon.set(rayon, casesDeLExpedition(destination, horaires, eclaireurs));
      cases[k] += parRayon.get(rayon)!;
    });
  }
  const sans = { rencontres: rencontres[0], casesRevelees: cases[0] / expeditions };
  const lignes = ECLAIREURS_SIMULES.map((eclaireurs, j) => {
    const k = j + 1;
    const ecart = sans.rencontres === 0 ? 0 : (100 * (rencontres[k] - sans.rencontres)) / sans.rencontres;
    return {
      eclaireurs,
      vueMinutes: vueProlongee(eclaireurs) / MINUTE_MS,
      rayonEnPlus: rayonDesEclaireurs(eclaireurs),
      rencontres: rencontres[k],
      ecart,
      casesRevelees: cases[k] / expeditions,
      casesEnPlus: (cases[k] - cases[0]) / expeditions,
      sousLEcart: ecart < ecartMinimal,
    };
  });
  return {
    expeditions,
    jours: SIMULATION_DES_PIGEONS_JOURS,
    sejourMinutes: SEJOUR_MINUTES,
    ecartMinimal,
    sans,
    lignes,
    reussie: lignes.every((l) => !l.sousLEcart),
  };
}
