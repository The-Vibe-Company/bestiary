"use server";

import { refresh } from "next/cache";
import { RedirectType, redirect } from "next/navigation";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { getPool } from "@/db";
import { type ChoixDuDepart, lancerLExpedition } from "@/expeditions/depart";
import { sejourChoisi } from "@/expeditions/sejour";
import { coordonneeValable } from "@/monde/hex";
import { maintenant } from "@/temps/horloge";

/** US-0911 : ce que « Partir » dit après un départ refusé : pourquoi, ou rien. */
export type EtatDuDepart = { refus: string | null };

/** L'écran d'Expédition, et la liste des Expéditions en cours, où mène un départ fait. */
const ECRAN = "/jeu/expeditions/nouvelle";
const EN_COURS = "/jeu/expeditions";

/** Le seul texte que dit un champ du formulaire, ou null s'il n'en dit aucun, ou plusieurs. */
function champ(formulaire: FormData, nom: string): string | null {
  const valeurs = formulaire.getAll(nom);
  return valeurs.length === 1 && typeof valeurs[0] === "string" ? valeurs[0] : null;
}

/** Un entier du formulaire, écrit en chiffres (« -5 »), qu'une colonne de la base peut tenir ; null sinon. */
function entier(texte: string | null): number | null {
  if (texte === null || !/^-?\d{1,10}$/.test(texte)) return null;
  const n = Number(texte);
  return coordonneeValable(n) ? n : null;
}

/** US-0904 : une Espèce de l'escorte et son nombre de Bêtes, comme l'écran les écrit (« souris.3 »). */
const ENTREE_D_ESCORTE = /^([a-z0-9_]+)\.(\d{1,6})$/;

/**
 * US-0911 : ce que le formulaire de départ dit des choix de l'écran, lu sans le croire : la destination (q, r),
 * le nombre d'explorateurs, l'escorte (« souris.3 », une fois par Espèce : la première compte) et le séjour, une durée
 * qu'on aurait pu choisir (US-0906). US-0976 : et les Éclaireurs (« pigeon.2 »), de même. Null pour un formulaire que
 * l'écran n'enverrait pas. Ce qui reste libre ou disponible, et la destination elle-même, le départ le relit.
 */
function choixDuFormulaire(formulaire: FormData): ChoixDuDepart | null {
  const [q, r] = [entier(champ(formulaire, "q")), entier(champ(formulaire, "r"))];
  const explorateurs = entier(champ(formulaire, "explorateurs"));
  const sejourMinutes = sejourChoisi(champ(formulaire, "sejour"));
  if (q === null || r === null || explorateurs === null || sejourMinutes === null) return null;
  const [escorte, eclaireurs] = [betesDuFormulaire(formulaire, "escorte"), betesDuFormulaire(formulaire, "eclaireurs")];
  if (!escorte || !eclaireurs) return null;
  return { destination: { q, r }, explorateurs, escorte, eclaireurs, sejourMinutes };
}

/**
 * US-0911 : les Bêtes que le formulaire dit sous le champ `nom`, Espèce par Espèce (« souris.3 », la première fois
 * comptant) ; null pour une valeur que l'écran n'écrirait pas. US-0976 : l'escorte, ou les Éclaireurs.
 */
function betesDuFormulaire(formulaire: FormData, nom: "escorte" | "eclaireurs"): Map<string, number> | null {
  const betes = new Map<string, number>();
  for (const valeur of formulaire.getAll(nom)) {
    const [, especeId, nombre] = (typeof valeur === "string" && ENTREE_D_ESCORTE.exec(valeur)) || [];
    if (!especeId) return null;
    if (!betes.has(especeId)) betes.set(especeId, Number(nombre));
  }
  return betes;
}

/**
 * US-0911 : « Partir » : le joueur confirme le départ de l'Expédition qu'il a composée sur l'écran. Le Territoire vient
 * de la garde, jamais du navigateur, et l'heure du départ est celle du jeu. Fait, il mène à la liste des Expéditions en
 * cours, où elle apparaît aussitôt, à l'aller. Refusé (un explorateur ou une Bête n'est plus disponible, une
 * destination désormais refusée), rien n'est retenu : « Partir » dit pourquoi, et l'écran est relu, avec ce qui reste.
 */
export async function partir(_avant: EtatDuDepart, formulaire: FormData): Promise<EtatDuDepart> {
  if (!entreeDuJeuOuverte()) return { refus: null };
  const { territoireId } = await exigerCompte(ECRAN);
  const choix = choixDuFormulaire(formulaire);
  if (territoireId === null || !choix) return { refus: null };
  const depart = await lancerLExpedition(getPool(), territoireId, choix, maintenant());
  if ("refus" in depart) {
    refresh();
    return { refus: depart.refus };
  }
  // À la place de l'écran composé, dans l'historique : un retour arrière n'y ramène pas, prêt à repartir une seconde fois.
  redirect(EN_COURS, RedirectType.replace);
}
