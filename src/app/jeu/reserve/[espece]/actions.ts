"use server";

import { refresh } from "next/cache";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { getPool } from "@/db";
import { ELEVAGE_SANS_COUPLE, ELEVAGE_SANS_ELEVEUR, elevageAcquis, eleveurLibre } from "@/monde/elevage";
import { lancerUnElevage } from "@/monde/lancer-un-elevage";
import { maintenant } from "@/temps/horloge";
import { lireUneQuantite, QUANTITE_REFUSEE } from "./quantite";

/**
 * US-0812 : ce que le bloc « Élever » dit après une demande d'Élevage : pourquoi le jeu la refuse, ou rien. US-0815 : ou
 * l'Élevage qu'elle a lancé, combien de Bêtes, et l'éleveur qui s'en occupe.
 */
export type EtatDeLElevage = { refus: string | null; lance?: { quantite: number; eleveur: string } };

/** US-0803 : un identifiant d'Espèce, tel que les données du jeu les écrivent (« souris », « peu_commune »). */
const IDENTIFIANT = /^[a-z0-9_]{1,64}$/;

/**
 * US-0812 : une demande d'Élevage, celle du bouton « Élever » de la fiche d'une Espèce, ou toute autre requête envoyée
 * ici. Le Territoire vient de la garde, jamais du formulaire, et l'Élevage acquis se relit sur le serveur (elevageAcquis,
 * US-0957) : l'Élevage d'une Espèce sans Couple réuni est refusé, et le refus le dit, quel que soit le chemin de la
 * demande. US-0813 : la quantité aussi se relit ici, et une quantité nulle, négative ou non entière est refusée avec le
 * même message que le bloc. US-0843 : le lancement demande un éleveur libre au Territoire, relu ici, après le Couple et
 * avant la quantité ; sans lui, refus. US-0815 : puis l'Élevage se lance, à l'heure du jeu du clic : lancerUnElevage relit
 * tout dans la transaction du paiement (Couple, Élevage déjà en cours, éleveur libre, Nourriture), confie l'Espèce à
 * l'éleveur et retire le coût des Stocks ; la page est relue, la barre du haut avec ses Stocks. Un refus de ce moment-là
 * (la Nourriture qui manque, un autre clic passé avant) se dit de même.
 */
export async function elever(_avant: EtatDeLElevage, formulaire: FormData): Promise<EtatDeLElevage> {
  if (!entreeDuJeuOuverte()) return { refus: null };
  const especes = formulaire.getAll("espece");
  const especeId = especes.length === 1 && typeof especes[0] === "string" && IDENTIFIANT.test(especes[0]) ? especes[0] : null;
  const { territoireId } = await exigerCompte(especeId ? `/jeu/reserve/${especeId}` : "/jeu/reserve");
  const etat = await demander(territoireId, especeId, formulaire);
  // La page relue fait foi, refus compris : un autre appareil a pu lancer l'Élevage ou occuper l'éleveur entre-temps.
  refresh();
  return etat;
}

/** US-0815 : la demande, une fois le joueur connu : ses refus d'avance, puis le lancement, qui relit tout. */
async function demander(territoireId: number | null, especeId: string | null, formulaire: FormData): Promise<EtatDeLElevage> {
  if (territoireId === null || especeId === null || !(await elevageAcquis(getPool(), territoireId, especeId))) return { refus: ELEVAGE_SANS_COUPLE };
  if ((await eleveurLibre(getPool(), territoireId)) === null) return { refus: ELEVAGE_SANS_ELEVEUR };
  const quantites = formulaire.getAll("quantite");
  const quantite = quantites.length === 1 && typeof quantites[0] === "string" ? lireUneQuantite(quantites[0]) : null;
  if (quantite === null) return { refus: QUANTITE_REFUSEE };
  const lancement = await lancerUnElevage(getPool(), territoireId, especeId, quantite, maintenant());
  return "refus" in lancement ? { refus: lancement.refus } : { refus: null, lance: lancement.lance };
}
