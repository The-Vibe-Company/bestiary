import { connection } from "next/server";
import { getPool } from "@/db";
import { statistiques } from "@/stats/statistiques";
import { autoriserTache } from "@/temps/autorisation";
import { maintenant } from "@/temps/horloge";

const SANS_CACHE = { "Cache-Control": "no-store" };

// Les statistiques des comptes, en lecture seule, pour qui envoie « Authorization: Bearer <STATS_TOKEN> ».
// Sans STATS_TOKEN, tout appel est refusé.
export async function GET(request: Request) {
  await connection();
  const verdict = autoriserTache(request.headers.get("authorization"), process.env.STATS_TOKEN, "STATS_TOKEN");
  if (!verdict.autorise) return Response.json({ statut: "refusé" }, { status: 401, headers: SANS_CACHE });
  return Response.json(await statistiques(getPool(), maintenant()), { headers: SANS_CACHE });
}
