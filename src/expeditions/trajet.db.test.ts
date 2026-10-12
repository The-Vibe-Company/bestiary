import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { chefDuCompte, enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { prochainRetourDUnExplorateur } from "@/monde/explorateurs";
import type { Coordonnees } from "@/monde/hex";
import { PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE } from "@/reglages";
import { nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, URL_TEST } from "@/test/base";
import { type ChoixDuDepart, lancerLExpedition } from "./depart";
import { expeditionsEnCours } from "./en-cours";

// Aucune Espèce du jeu ne va encore moins vite que la marche des explorateurs, 5 km/h : ici, ils marchent à 26 km/h, deux
// fois plus vite que la souris (13 km/h), plus vite aussi que la poule (14 km/h) ; le pigeon (80 km/h) les dépasse
// toujours. Leur pas reste de 20 minutes de jeu par Case.
vi.mock("@/reglages", async (original) => ({ ...(await original<typeof import("@/reglages")>()), MARCHE_DES_EXPLORATEURS_KMH: 26 }));

const MINUTE_MS = 60_000;

describe.skipIf(!URL_TEST)("la durée du trajet d'une escorte (US-0912, sur base)", () => {
  let pool: Pool;
  const lancement = `trajet-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** L'heure du jeu du départ. */
  const INSTANT = new Date("2026-10-09T07:42:00.000Z");
  /** Une heure du jeu, `minutes` après le départ. */
  const apres = (minutes: number) => new Date(INSTANT.getTime() + minutes * MINUTE_MS);

  /** Un joueur qui vient de naître, avec un explorateur et des Bêtes dans son effectif, Espèce par Espèce. */
  const nouveauTerritoire = async (betes: [string, number][]) => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Tra", suffixe, numero);
    expect(await enregistrerNomDeChef(pool, compte.id, nom)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await chefDuCompte(pool, compte.id))!.territoireId!;
    await pool.query(`insert into habitant (territoire_id, prenom, metier) values ($1, 'Essai', 'explorateur')`, [territoireId]);
    await pool.query(
      `insert into effectif (territoire_id, espece_id, sexe, nombre) select $1, e, 'femelle', n from unnest($2::text[], $3::int[]) as l(e, n)`,
      [territoireId, betes.map(([e]) => e), betes.map(([, n]) => n)],
    );
    return territoireId;
  };
  /** Une Case libre du Monde du Territoire, à `ecart` Cases de son Foyer. */
  const aLEcart = async (territoireId: number, ecart: number): Promise<Coordonnees> => {
    const { rows } = await pool.query<Coordonnees>(
      `select c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = $2
       order by c.q, c.r limit 1`,
      [territoireId, ecart],
    );
    return rows[0];
  };
  /** Le départ de l'explorateur vers une Case à 3 Cases du Foyer, avec l'escorte donnée, pour 4 h de séjour ; rend son trajet. */
  const partir = async (territoireId: number, escorte: [string, number][]) => {
    const choix: ChoixDuDepart = { destination: await aLEcart(territoireId, 3), explorateurs: 1, escorte: new Map(escorte), sejourMinutes: 240 };
    const depart = await lancerLExpedition(pool, territoireId, choix, INSTANT);
    expect(depart).toEqual({ expeditionId: expect.any(Number) });
    const { rows } = await pool.query<{ trajet: number }>("select trajet_minutes as trajet from expedition where id = $1", [(depart as { expeditionId: number }).expeditionId]);
    return rows[0].trajet;
  };

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("avance au pas de la Bête la plus lente de l'escorte, d'après la vitesse de son Espèce : à l'aller, puis au retour, qui dure autant", async () => {
    const t = await nouveauTerritoire([
      ["pigeon", 2],
      ["souris", 1],
    ]);
    // La souris, deux fois plus lente que les explorateurs : 40 minutes par Case, 3 Cases.
    expect(await partir(t, [["pigeon", 2], ["souris", 1]])).toBe(120);
    expect((await expeditionsEnCours(pool, t, apres(119))).map((x) => x.phase)).toEqual(["aller"]);
    expect((await expeditionsEnCours(pool, t, apres(120))).map((x) => x.phase)).toEqual(["sejour"]);
    expect((await expeditionsEnCours(pool, t, apres(120 + 240))).map((x) => x.phase)).toEqual(["retour"]);
    expect(await prochainRetourDUnExplorateur(pool, t)).toEqual(apres(120 + 240 + 120));
  });

  it("garde le pas des explorateurs quand toutes les Bêtes de l'escorte vont plus vite qu'eux", async () => {
    const t = await nouveauTerritoire([["pigeon", 1]]);
    expect(await partir(t, [["pigeon", 1]])).toBe(3 * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE);
  });

  it("arrondit l'allure à la minute supérieure : 20 × 26 / 14 minutes par Case pour la poule, soit 38", async () => {
    const t = await nouveauTerritoire([["poule", 1]]);
    expect(await partir(t, [["poule", 1]])).toBe(3 * 38);
  });
});
