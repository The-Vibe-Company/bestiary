"use server";

import { refresh } from "next/cache";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { getPool } from "@/db";
import { affecterUneBete, retirerUneBete } from "@/monde/roles";
import { maintenant } from "@/temps/horloge";

/** US-0837 : un identifiant d'Espèce, tel que les données du jeu les écrivent (« poule », « ours_brun »). */
const IDENTIFIANT = /^[a-z0-9_]{1,64}$/;

/** Vrai pour un identifiant d'Espèce écrit comme dans donnees/. */
function especeValable(especeId: string): boolean {
  return typeof especeId === "string" && IDENTIFIANT.test(especeId);
}

/**
 * US-0837 : « + » du Rôle d'une Espèce sur la page Bêtes : le joueur affecte une Bête de plus à son Rôle, gratuitement et
 * aussitôt (affecterUneBete). Le Territoire vient de la garde, qui l'a mis à l'heure, jamais du navigateur : seules ses
 * Bêtes sont touchées. La page est ensuite relue, même quand rien n'a changé (plus de Bête valide, Rôle qui ne sert pas
 * au Foyer) : c'est elle qui fait foi, à la place du compte montré d'avance.
 */
export async function affecterAuRole(especeId: string): Promise<void> {
  if (!entreeDuJeuOuverte()) return;
  const { territoireId } = await exigerCompte("/jeu/betes");
  if (territoireId === null || !especeValable(especeId)) return;
  await affecterUneBete(getPool(), territoireId, especeId, maintenant());
  refresh();
}

/**
 * US-0837 : « − » du Rôle d'une Espèce sur la page Bêtes : le joueur retire de son Rôle une Bête affectée, gratuitement
 * et aussitôt (retirerUneBete). Mêmes gardes que « + », et la page relue fait foi, même quand aucune n'était affectée.
 */
export async function retirerDuRole(especeId: string): Promise<void> {
  if (!entreeDuJeuOuverte()) return;
  const { territoireId } = await exigerCompte("/jeu/betes");
  if (territoireId === null || !especeValable(especeId)) return;
  await retirerUneBete(getPool(), territoireId, especeId, maintenant());
  refresh();
}
