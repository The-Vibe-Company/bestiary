// La garde des pages et des actions du jeu (US-0121). Chacune l'appelle avant de lire quoi que
// ce soit : sans session, le visiteur part vers la connexion et rien du jeu ne lui est rendu ;
// sans nom de chef, le joueur part le choisir (US-0131). Un test vérifie que toutes les pages et
// actions du jeu l'appellent. Côté serveur uniquement.
import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { chefDuCompte, naitreSurLaCouronne } from "@/chefs/chef";
import { getPool } from "@/db";
import { recevoirLesBetesDeNaissance } from "@/monde/betes-de-naissance";
import { nombreDeCouples } from "@/monde/couple";
import { famineDepuis } from "@/monde/famine";
import { entretienDesHabitants, nombreDHabitants, nombreSansMetier } from "@/monde/habitants";
import { famineImminenteDepuis } from "@/monde/production";
import { nombreDeRecitsNonLus } from "@/monde/recits";
import { type Stock, stocksDuTerritoire } from "@/monde/stocks";
import { nombreDeVoyageurs } from "@/monde/voyageurs";
import { maintenant } from "@/temps/horloge";
import { rattraper } from "@/temps/rattraper";
import { jetonDeSession } from "./cookie-session";
import { compteDeLaSession } from "./session";
import { connexionPuis } from "./suite";

export type CompteConnecte = { id: number; email: string };
/** Un joueur dans le jeu : son compte, son nom de chef et son Territoire (null pour un chef né avant les Territoires). */
export type ChefConnecte = CompteConnecte & { nomDeChef: string; territoireId: number | null; recitLu: boolean };

/** L'écran où le joueur choisit son nom de chef (US-0131). */
export const PAGE_NOM_DE_CHEF = "/jeu/nom-de-chef";
/** Le récit d'arrivée (US-0158), montré une fois avant toute autre page du jeu. */
export const PAGE_ARRIVEE = "/jeu/arrivee";

/**
 * Le compte connecté, ou la connexion : `chemin` est la page demandée, où revenir une fois
 * connecté (une action, qui n'a pas de page à elle, mène à l'accueil du jeu). Une action
 * envoyée avec une session expirée s'arrête ici, sans rien appliquer ; la connexion dit alors
 * que la session a expiré (US-0125). Tant que le joueur n'a pas de nom de chef, toute page et
 * toute action mènent à l'écran qui le demande (US-0131). Sinon, son Territoire est d'abord mis
 * à l'heure (US-0156). US-0160 : l'arrivée reprend là où elle s'était arrêtée ; un chef sans Foyer
 * en reçoit un, et tant que le récit d'arrivée n'a pas été montré, il passe avant tout le reste.
 * US-0975 : un chef qui attend encore ses Bêtes de naissance les reçoit, une seule fois.
 */
export async function exigerCompte(chemin = "/jeu"): Promise<ChefConnecte> {
  const compte = await exigerSession(chemin);
  const chef = await chefDuCompte(getPool(), compte.id);
  if (!chef) redirect(PAGE_NOM_DE_CHEF);
  // Un chef né avant les Foyers (avant US-0153) reçoit le sien à son retour.
  const territoireId = chef.territoireId ?? (await naitreSurLaCouronne(getPool(), compte.id));
  // US-0975 : un chef né avant les Bêtes de naissance, ou dont le Foyer a changé de Monde, reçoit les siennes à son retour.
  if (chef.territoireId !== null && chef.betesAttendues) await recevoirLesBetesDeNaissance(getPool(), chef.territoireId, maintenant());
  // US-0156 : le Territoire du joueur est mis à l'heure avant toute page ou action du jeu.
  if (territoireId !== null) await mettreALHeure(territoireId);
  if (territoireId !== null && !chef.recitLu && chemin !== PAGE_ARRIVEE) redirect(PAGE_ARRIVEE);
  return { ...compte, nomDeChef: chef.nom, territoireId, recitLu: Boolean(chef.recitLu) };
}

/** Pour l'écran du nom de chef seulement : le compte connecté encore sans nom ; avec un nom, le jeu. */
export async function exigerCompteSansChef(): Promise<CompteConnecte> {
  const compte = await exigerSession(PAGE_NOM_DE_CHEF);
  if (await chefDuCompte(getPool(), compte.id)) redirect("/jeu");
  return compte;
}

async function exigerSession(chemin: string): Promise<CompteConnecte> {
  const jeton = await jetonDeSession();
  const compte = jeton ? await compteDeLaSession(getPool(), jeton) : null;
  if (!compte) redirect(connexionPuis(chemin, { expiree: Boolean(jeton) }));
  return compte;
}

/**
 * Le Territoire mis à l'heure une seule fois par page, même quand la page et la barre du haut, qui
 * s'affichent côte à côte, le demandent toutes les deux.
 */
const mettreALHeure = cache((territoireId: number) => rattraper("territoire", territoireId));

export type JoueurConnecte = { compte: CompteConnecte; nomDeChef: string | null; territoireId: number | null; recitLu: boolean };

/**
 * Le joueur connecté, son nom de chef (null tant qu'il ne l'a pas choisi) et son Territoire, ou null
 * sans session. Sans redirection : pour la barre du haut, qui ne fait que montrer ; les pages et les
 * actions du jeu, elles, passent par exigerCompte.
 */
export const joueurConnecte = cache(async (): Promise<JoueurConnecte | null> => {
  const jeton = await jetonDeSession();
  const compte = jeton ? await compteDeLaSession(getPool(), jeton) : null;
  if (!compte) return null;
  const chef = await chefDuCompte(getPool(), compte.id);
  return { compte, nomDeChef: chef?.nom ?? null, territoireId: chef?.territoireId ?? null, recitLu: Boolean(chef?.recitLu) };
});

/** Les Stocks du Territoire pour la barre du haut (US-0203), lus après sa mise à l'heure. */
export async function stocksALHeure(territoireId: number): Promise<Stock[]> {
  await mettreALHeure(territoireId);
  return stocksDuTerritoire(getPool(), territoireId);
}

/**
 * Le nombre d'Habitants du Territoire pour le compteur de la barre du haut (US-0304), lu après sa mise
 * à l'heure, comme les Stocks : à chaque affichage et à chaque recalage de la barre.
 */
export async function habitantsALHeure(territoireId: number): Promise<number> {
  await mettreALHeure(territoireId);
  return nombreDHabitants(getPool(), territoireId);
}

/**
 * Le nombre de Récits non lus pour l'entrée « Récits » de la navigation (US-0324), lu après la mise à
 * l'heure du Territoire : un Récit écrit en rattrapant le temps compte dès cet affichage.
 */
export async function recitsNonLusALHeure(territoireId: number): Promise<number> {
  await mettreALHeure(territoireId);
  return nombreDeRecitsNonLus(getPool(), territoireId);
}

/**
 * Le nombre de Voyageurs aux portes pour le repère de l'entrée « Habitants » de la navigation (US-0332),
 * lu après la mise à l'heure du Territoire : un Voyageur arrivé pendant l'absence compte dès cet affichage.
 */
export async function voyageursALHeure(territoireId: number): Promise<number> {
  await mettreALHeure(territoireId);
  return nombreDeVoyageurs(getPool(), territoireId);
}

/**
 * US-0313 : le nombre d'Habitants sans Métier pour le repère de l'entrée « Habitants » de la navigation, lu
 * après la mise à l'heure du Territoire, à chaque affichage : le repère s'en va dès que tous ont un Métier.
 */
export async function sansMetierALHeure(territoireId: number): Promise<number> {
  await mettreALHeure(territoireId);
  return nombreSansMetier(getPool(), territoireId);
}

/**
 * US-0321 : l'Entretien des Habitants par heure, en Nourriture (numeric de Postgres, en texte), pour
 * l'avertissement « famine imminente » de la barre du haut, lu après la mise à l'heure du Territoire, comme
 * les Stocks avec lesquels il se compte : le total même que le calcul du jeu prélève (US-0316).
 */
export async function entretienALHeure(territoireId: number): Promise<string> {
  await mettreALHeure(territoireId);
  return (await entretienDesHabitants(getPool(), territoireId)).parHeure;
}

/**
 * US-0322 : depuis combien d'heures de jeu la famine est imminente (null si elle ne l'est pas), pour
 * l'avertissement de la barre du haut, lu après la mise à l'heure du Territoire : un seuil franchi pendant
 * l'absence est noté par le rattrapage, à son instant exact, et l'avertissement est là dès l'ouverture.
 */
export async function famineImminenteALHeure(territoireId: number): Promise<number | null> {
  await mettreALHeure(territoireId);
  return famineImminenteDepuis(getPool(), territoireId);
}

/**
 * US-0325 : depuis combien d'heures de jeu le Territoire est en Famine (null hors Famine), pour la bande de la barre
 * du haut, lu après sa mise à l'heure : une Famine commencée pendant l'absence est notée par le rattrapage, à son
 * instant exact, et dite dès l'ouverture.
 */
export async function famineALHeure(territoireId: number): Promise<number | null> {
  await mettreALHeure(territoireId);
  return famineDepuis(getPool(), territoireId);
}

/**
 * US-0958 : le nombre de Couples réunis du Territoire pour le menu du chef de la barre du haut, lu après sa mise à l'heure :
 * un Couple réuni au retour d'une Expédition pendant l'absence compte dès l'ouverture.
 */
export async function couplesReunisALHeure(territoireId: number): Promise<number> {
  await mettreALHeure(territoireId);
  return nombreDeCouples(getPool(), territoireId);
}
