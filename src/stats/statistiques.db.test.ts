import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { statistiques } from "./statistiques";

const EMPREINTE_ESSAI = "scrypt$131072$8$1$c2Vs$Y2zDqQ==";
const MONDE_D_ESSAI = "Essai des statistiques";
const JOUR = 24 * 3_600_000;

describe.skipIf(!URL_TEST)("statistiques des comptes (sur base)", () => {
  let pool: Pool;
  const lancement = `stats-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  beforeAll(() => {
    pool = poolDeTest();
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("compte les comptes, ceux d'hier et ceux de la semaine", async () => {
    const client = await pool.connect();
    try {
      // Une seule image de la base : les comptes créés en même temps par d'autres fichiers de test n'y entrent pas.
      await client.query("begin isolation level repeatable read");
      const avant = await statistiques(client as unknown as Pool, new Date());
      for (const [n, age] of [[1, "1 hour"], [2, "3 days"], [3, "30 days"]]) {
        await client.query("insert into compte (email, empreinte_mot_de_passe, cree_le) values ($1, $2, now() - $3::interval)", [
          `${lancement}-${n}@essai.test`,
          EMPREINTE_ESSAI,
          age,
        ]);
      }
      const apres = await statistiques(client as unknown as Pool, new Date());
      expect(apres.total_users! - avant.total_users!).toBe(3);
      expect(apres.new_users_1d! - avant.new_users_1d!).toBe(1);
      expect(apres.new_users_7d! - avant.new_users_7d!).toBe(2);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  it("compte comme actifs les joueurs dont une page du jeu était ouverte depuis un jour, ou sept", async () => {
    await preparerMondeDeTest(pool);
    const mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    const suffixe = suffixeDEssai();
    // Un instant du jeu lointain : aucune autre présence notée n'en est proche.
    const instant = new Date("2100-01-01T00:00:00Z");
    const presences = [0.5 * JOUR, 3 * JOUR, 10 * JOUR, null];
    for (const [n, avant] of presences.entries()) {
      const compte = (await creerCompte(pool, `${lancement}-chef-${n}@essai.test`, "une phrase de passe"))!;
      expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Sta", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
      const vuLe = avant === null ? null : new Date(instant.getTime() - avant);
      await pool.query("update territoire set vu_le = $2 where id = $1", [await territoireDuCompte(pool, compte.id), vuLe]);
    }
    expect(await statistiques(pool, instant)).toMatchObject({ active_users_1d: 1, active_users_7d: 2 });
  });
});
