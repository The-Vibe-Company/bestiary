// Seule la tâche planifiée de Vercel peut déclencher le rattrapage des absents : elle
// envoie « Authorization: Bearer <CRON_SECRET> », secret lu dans une variable d'environnement.
// Les statistiques (/api/stats) vérifient de même leur jeton, STATS_TOKEN.
import { timingSafeEqual } from "node:crypto";

export type Verdict = { autorise: true } | { autorise: false; raison: string };

/** Vérifie l'appel, sans jamais recopier le secret reçu. `nomDuSecret` : sa variable, nommée dans le refus. */
export function autoriserTache(autorisation: string | null, secret: string | undefined, nomDuSecret = "CRON_SECRET"): Verdict {
  if (!secret) return { autorise: false, raison: `${nomDuSecret} n'est pas configuré` };
  if (!autorisation) return { autorise: false, raison: "secret absent" };
  const attendu = Buffer.from(`Bearer ${secret}`);
  const recu = Buffer.from(autorisation);
  // Comparaison à durée constante : la réponse ne trahit pas combien de caractères sont justes.
  if (recu.length !== attendu.length || !timingSafeEqual(recu, attendu)) {
    return { autorise: false, raison: "secret incorrect" };
  }
  return { autorise: true };
}
