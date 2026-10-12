"use server";

import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { getPool } from "@/db";
import { ELEVAGE_SANS_COUPLE, elevageAcquis } from "@/monde/elevage";

/** US-0812 : ce que le bloc « Élever » dit après une demande d'Élevage : pourquoi le jeu la refuse, ou rien. */
export type EtatDeLElevage = { refus: string | null };

/** US-0803 : un identifiant d'Espèce, tel que les données du jeu les écrivent (« souris », « peu_commune »). */
const IDENTIFIANT = /^[a-z0-9_]{1,64}$/;

/**
 * US-0812 : une demande d'Élevage, celle du bouton « Élever » de la fiche d'une Espèce, ou toute autre requête envoyée
 * ici. Le Territoire vient de la garde, jamais du formulaire, et l'Élevage acquis se relit sur le serveur (elevageAcquis,
 * US-0957) : l'Élevage d'une Espèce sans Couple réuni est refusé, et le refus le dit, quel que soit le chemin de la
 * demande. Acquis, rien ne se lance encore : l'éleveur (US-0843), la quantité (US-0813) et le lancement (US-0815)
 * arrivent ensuite.
 */
export async function elever(_avant: EtatDeLElevage, formulaire: FormData): Promise<EtatDeLElevage> {
  if (!entreeDuJeuOuverte()) return { refus: null };
  const especes = formulaire.getAll("espece");
  const especeId = especes.length === 1 && typeof especes[0] === "string" && IDENTIFIANT.test(especes[0]) ? especes[0] : null;
  const { territoireId } = await exigerCompte(especeId ? `/jeu/reserve/${especeId}` : "/jeu/reserve");
  if (territoireId === null || especeId === null || !(await elevageAcquis(getPool(), territoireId, especeId))) return { refus: ELEVAGE_SANS_COUPLE };
  return { refus: null };
}
