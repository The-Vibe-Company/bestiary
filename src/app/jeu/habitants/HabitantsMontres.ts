"use client";

import { useOptimistic } from "react";
import type { HabitantAffiche } from "./ListeDesHabitants";

/**
 * US-0308 : un Métier donné à un Habitant, montré d'avance le temps que l'action l'enregistre ; US-0311 : null
 * quand il le perd.
 */
export type MetierDonne = { id: number; metier: string | null };

/** US-0330 : un Habitant renvoyé, retiré d'avance de la page le temps que l'action l'enregistre. */
export type HabitantRenvoye = { id: number; renvoye: true };

/**
 * US-0311 : vrai quand `a` passe avant `b` parmi les sans Métier, dans l'ordre de la lecture : par prénom, puis le
 * premier arrivé. Les prénoms (une majuscule, puis des minuscules sans accent) se comparent comme la base les range.
 */
const avant = (a: HabitantAffiche, b: HabitantAffiche) => (a.prenom === b.prenom ? a.id < b.id : a.prenom < b.prenom);

/**
 * Les Habitants, le Métier donné d'avance posé sur celui qui le reçoit, qui garde son rang jusqu'à la page relue.
 * US-0311 : remis sans Métier, il remonte aussitôt parmi les sans Métier, à la place que la lecture lui donnera, ou en
 * tête quand il n'y en a pas d'autre. US-0330 : renvoyé, il en est retiré.
 */
function avecLeChangement(actuels: HabitantAffiche[], changement: MetierDonne | HabitantRenvoye): HabitantAffiche[] {
  if ("renvoye" in changement) return actuels.filter((h) => h.id !== changement.id);
  const habitant = actuels.find((h) => h.id === changement.id);
  if (!habitant) return actuels;
  const change = { ...habitant, metier: changement.metier };
  if (changement.metier !== null || habitant.metier === null) return actuels.map((h) => (h.id === changement.id ? change : h));
  const autres = actuels.filter((h) => h.id !== changement.id);
  const suivant = autres.findIndex((h) => h.metier === null && avant(change, h));
  const place = suivant >= 0 ? suivant : autres.findLastIndex((h) => h.metier === null) + 1;
  return [...autres.slice(0, place), change, ...autres.slice(place)];
}

/**
 * US-0313 : les Habitants que montre la page, Métiers donnés et renvois d'avance compris, et de quoi en montrer un
 * d'avance. Le rail des Métiers, le bandeau des sans Métier, l'effectif de chaque groupe et ses lignes les lisent tous
 * (ListeDesHabitants) : un Métier donné, retiré ou réparti, un Habitant renvoyé, s'y voient aussitôt partout, le temps
 * que l'action l'enregistre et relise la page, qui fait alors foi (US-0308).
 */
export function useHabitantsMontres(habitants: HabitantAffiche[]) {
  return useOptimistic(habitants, avecLeChangement);
}
