import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { lireJeu } from "@/donnees/charger";
import { METIERS } from "@/donnees/jeux";
import { mondeDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { lesMetiers } from "./metiers";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai des Métiers (US-0307)";

describe.skipIf(!URL_TEST)("les Métiers (US-0307, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `metiers-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("rend les huit Métiers chargés depuis donnees/metiers.yaml, dans l'ordre du fichier, avec leur phrase et ce qu'ils attendent", async () => {
    const fichier = lireJeu(METIERS);
    expect(await lesMetiers(pool)).toEqual(fichier.map((m) => ({ id: m.id, nom: m.nom, phrase: m.phrase, servira: m.servira ?? null })));
    expect((await lesMetiers(pool)).map((m) => m.id)).toEqual(["explorateur", "chasseur", "cueilleur", "bucheron", "mineur", "chercheur", "batisseur", "eleveur"]);
  });

  it("rend ce qui est en base : un Métier qui sert n'attend plus rien", async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("update metier set servira = null where id = 'bucheron'");
      expect((await lesMetiers(client)).find((m) => m.id === "bucheron")).toMatchObject({ nom: "Bûcheron", servira: null });
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  it("n'accepte comme Métier d'un Habitant que l'un des Métiers, ou aucun", async () => {
    const compte = (await creerCompte(pool, `${lancement}-1@essai.test`, "une phrase de passe"))!;
    const nom = `Met${suffixe}`;
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    const donner = (metier: string | null) =>
      pool.query("update habitant set metier = $2 where id = (select min(id) from habitant where territoire_id = $1)", [territoireId, metier]);
    await expect(donner("poste")).rejects.toMatchObject({ code: "23503" });
    await expect(donner("Bûcheron")).rejects.toMatchObject({ code: "23503" });
    await donner("bucheron");
    await donner(null);
    expect((await pool.query("select metier from habitant where territoire_id = $1", [territoireId])).rows).toEqual([{ metier: null }, { metier: null }, { metier: null }]);
  });
});
