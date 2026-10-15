// Les statistiques des comptes, en lecture seule, pour /api/stats. Côté serveur uniquement.
import "server-only";
import type { Pool } from "pg";

export type Statistiques = {
  total_users: number | null;
  new_users_1d: number | null;
  new_users_7d: number | null;
  active_users_1d: number | null;
  active_users_7d: number | null;
};

/**
 * Les comptes, ceux créés depuis un jour et depuis sept jours (en temps réel, comme leur date de
 * création), et ceux dont le joueur a eu une page du jeu ouverte dans le même temps : la présence
 * notée sur son Territoire (US-0216, `vu_le`), à l'heure du jeu, d'où `instant` (maintenant()). Un
 * joueur sans Territoire, ou avant son récit d'arrivée, n'a pas de présence notée : il n'y compte pas.
 */
export async function statistiques(pool: Pool, instant: Date): Promise<Statistiques> {
  const { rows } = await pool.query<{ total: number; jour: number; semaine: number; actifs_jour: number; actifs_semaine: number }>(
    `select count(*)::int as total,
            count(*) filter (where cree_le > now() - interval '1 day')::int as jour,
            count(*) filter (where cree_le > now() - interval '7 days')::int as semaine,
            (select count(distinct ch.compte_id)::int from chef ch join territoire t on t.chef_id = ch.id
              where t.vu_le > $1::timestamptz - interval '1 day') as actifs_jour,
            (select count(distinct ch.compte_id)::int from chef ch join territoire t on t.chef_id = ch.id
              where t.vu_le > $1::timestamptz - interval '7 days') as actifs_semaine
     from compte`,
    [instant],
  );
  const { total, jour, semaine, actifs_jour, actifs_semaine } = rows[0];
  return { total_users: total, new_users_1d: jour, new_users_7d: semaine, active_users_1d: actifs_jour, active_users_7d: actifs_semaine };
}
