"use server";

import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { getPool } from "@/db";
import { ELEVAGE_SANS_COUPLE, ELEVAGE_SANS_ELEVEUR, elevageAcquis, eleveurLibre } from "@/monde/elevage";
import { lireUneQuantite, QUANTITE_REFUSEE } from "./quantite";

/** US-0812 : ce que le bloc « Élever » dit après une demande d'Élevage : pourquoi le jeu la refuse, ou rien. */
export type EtatDeLElevage = { refus: string | null };

/** US-0803 : un identifiant d'Espèce, tel que les données du jeu les écrivent (« souris », « peu_commune »). */
const IDENTIFIANT = /^[a-z0-9_]{1,64}$/;

/**
 * US-0812 : une demande d'Élevage, celle du bouton « Élever » de la fiche d'une Espèce, ou toute autre requête envoyée
 * ici. Le Territoire vient de la garde, jamais du formulaire, et l'Élevage acquis se relit sur le serveur (elevageAcquis,
 * US-0957) : l'Élevage d'une Espèce sans Couple réuni est refusé, et le refus le dit, quel que soit le chemin de la
 * demande. US-0813 : la quantité aussi se relit ici, et une quantité nulle, négative ou non entière est refusée avec le
 * même message que le bloc. US-0843 : le lancement demande un éleveur libre au Territoire, relu ici, après le Couple et
 * avant la quantité ; sans lui, refus. Rien ne se lance encore : le lancement arrive avec US-0815, qui devra relire
 * l'éleveur libre dans la transaction du paiement et lui confier l'Espèce (habitant.espece_elevee).
 */
export async function elever(_avant: EtatDeLElevage, formulaire: FormData): Promise<EtatDeLElevage> {
  if (!entreeDuJeuOuverte()) return { refus: null };
  const especes = formulaire.getAll("espece");
  const especeId = especes.length === 1 && typeof especes[0] === "string" && IDENTIFIANT.test(especes[0]) ? especes[0] : null;
  const { territoireId } = await exigerCompte(especeId ? `/jeu/reserve/${especeId}` : "/jeu/reserve");
  if (territoireId === null || especeId === null || !(await elevageAcquis(getPool(), territoireId, especeId))) return { refus: ELEVAGE_SANS_COUPLE };
  if ((await eleveurLibre(getPool(), territoireId)) === null) return { refus: ELEVAGE_SANS_ELEVEUR };
  const quantites = formulaire.getAll("quantite");
  if (quantites.length !== 1 || typeof quantites[0] !== "string" || lireUneQuantite(quantites[0]) === null) return { refus: QUANTITE_REFUSEE };
  return { refus: null };
}
