import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chefParNom, enregistrerNomDeChef, naitreSurLaCouronne } from "@/chefs/chef";
import { cleDuNom } from "@/chefs/nom";
import { creerCompte } from "@/comptes/compte";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { fixerStock, stocksDuTerritoire } from "./stocks";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai des Stocks (US-0201)";

describe.skipIf(!URL_TEST)("Stocks du Territoire (US-0201, US-0202, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `stocks-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let numero = 0;
  const nouveauCompte = async () => (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
  /**
   * Un nom de chef propre à ce lancement, pour ne pas croiser les autres essais, qu'aucun mot interdit ne refuse : « Stock »
   * suivi d'un « kk » tiré au hasard ne naissait pas.
   */
  const suffixe = suffixeDEssai();
  const nomUnique = () => nomDEssai("Stock", suffixe, numero);

  /** Un chef qui naît dans le Monde d'essai, ou dans le Monde du jeu avec `null`. */
  const naitre = async (monde: number | null = mondeId) => {
    const compte = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, monde)).toMatchObject({ statut: "enregistre" });
    return { compte, territoireId: (await territoireDuCompte(pool, compte.id))! };
  };
  const stocks = async (territoireId: number) =>
    (
      await pool.query<{ ressource: string; quantite: string }>(
        `select s.ressource_id as ressource, s.quantite from stock s join ressource r on r.id = s.ressource_id
         where s.territoire_id = $1 order by r.ordre`,
        [territoireId],
      )
    ).rows.map((s) => [s.ressource, s.quantite]);
  /** Les quantités de départ, telles que la base les tient de donnees/ressources.yaml. */
  const auDepart = async () =>
    (await pool.query<{ id: string; au_depart: string }>("select id, au_depart from ressource order by ordre")).rows.map((r) => [r.id, r.au_depart]);
  const ajouter = (territoireId: number, ressource: string, quantite: string) =>
    pool.query("update stock set quantite = quantite + $3 where territoire_id = $1 and ressource_id = $2", [territoireId, ressource, quantite]);

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("range en base la Viande et les Végétaux en Nourriture, le Bois et la Pierre en Matériaux", async () => {
    const { rows } = await pool.query("select id, famille from ressource order by ordre");
    expect(rows).toEqual([
      { id: "viande", famille: "nourriture" },
      { id: "vegetaux", famille: "nourriture" },
      { id: "bois", famille: "materiaux" },
      { id: "pierre", famille: "materiaux" },
    ]);
  });

  it("donne à un Territoire, dès sa naissance, un Stock de chacune des quatre Ressources, garni de sa quantité de départ (US-0202)", async () => {
    const { territoireId } = await naitre();
    expect((await stocks(territoireId)).map(([ressource]) => ressource)).toEqual(["viande", "vegetaux", "bois", "pierre"]);
    expect(await stocks(territoireId)).toEqual(await auDepart());
  });

  it("donne à chaque Stock, à la naissance, la limite de départ de sa Ressource, enregistrée pour ce Territoire (US-0220)", async () => {
    const { territoireId } = await naitre();
    const { rows } = await pool.query(
      `select s.ressource_id, s.limite = r.limite_au_depart as egale, s.limite > s.quantite as sous_la_limite
       from stock s join ressource r on r.id = s.ressource_id where s.territoire_id = $1 order by r.ordre`,
      [territoireId],
    );
    expect(rows).toEqual(["viande", "vegetaux", "bois", "pierre"].map((ressource_id) => ({ ressource_id, egale: true, sous_la_limite: true })));
    // Propre au Territoire : la relever chez l'un ne touche pas les autres.
    const autre = await naitre();
    await pool.query("update stock set limite = 5000 where territoire_id = $1 and ressource_id = 'bois'", [territoireId]);
    const { rows: autres } = await pool.query("select limite::text from stock where territoire_id = $1 and ressource_id = 'bois'", [autre.territoireId]);
    expect(autres[0].limite).toBe((await pool.query("select limite_au_depart::text as l from ressource where id = 'bois'")).rows[0].l);
  });

  it("verse les quantités de départ réglées dans les données de référence, sans toucher au code", async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("update ressource set au_depart = 250.5 where id = 'pierre'");
      const compte = (await creerCompte(client, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
      const nom = nomUnique();
      await client.query("insert into chef (compte_id, monde_id, nom, cle_nom) values ($1, (select id from monde order by id limit 1), $2, $3)", [
        compte.id,
        nom,
        cleDuNom(nom),
      ]);
      const { rows } = await client.query<{ id: number }>(
        `insert into territoire (chef_id, foyer_case_id)
         select (select id from chef where compte_id = $1),
           (select id from case_du_monde where chef_id is null and not imprenable order by id limit 1)
         returning id`,
        [compte.id],
      );
      const { rows: pierre } = await client.query("select quantite from stock where territoire_id = $1 and ressource_id = 'pierre'", [rows[0].id]);
      expect(pierre).toEqual([{ quantite: "250.500000" }]);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  it("les donne aussi au chef né avant la Couronne, quand il reçoit son Foyer", async () => {
    const compte = await nouveauCompte();
    const nom = nomUnique();
    await pool.query("insert into chef (compte_id, monde_id, nom, cle_nom) values ($1, (select id from monde order by id limit 1), $2, $3)", [
      compte.id,
      nom,
      cleDuNom(nom),
    ]);
    const territoireId = await naitreSurLaCouronne(pool, compte.id);
    expect(territoireId).not.toBeNull();
    expect((await stocks(territoireId!)).map(([ressource]) => ressource)).toEqual(["viande", "vegetaux", "bois", "pierre"]);
  });

  it("garde les fractions : trois fois 0,4 Bois font 1,2 Bois, sans rien perdre", async () => {
    const { territoireId } = await naitre();
    await pool.query("update stock set quantite = 0 where territoire_id = $1", [territoireId]);
    for (let i = 0; i < 3; i++) await ajouter(territoireId, "bois", "0.4");
    await ajouter(territoireId, "pierre", "0.000001");
    expect(await stocks(territoireId)).toEqual([
      ["viande", "0.000000"],
      ["vegetaux", "0.000000"],
      ["bois", "1.200000"],
      ["pierre", "0.000001"],
    ]);
  });

  it("refuse un Stock négatif, même d'un millionième", async () => {
    const { territoireId } = await naitre();
    await pool.query("update stock set quantite = 2 where territoire_id = $1", [territoireId]);
    await expect(ajouter(territoireId, "viande", "-2.000001")).rejects.toMatchObject({ constraint: "stock_jamais_negatif" });
    await ajouter(territoireId, "viande", "-2");
    expect((await stocks(territoireId))[0]).toEqual(["viande", "0.000000"]);
  });

  it("se lisent dans l'ordre des Ressources, avec leur nom, leur famille (US-0205) et leur quantité exacte (US-0203)", async () => {
    const { territoireId } = await naitre();
    await ajouter(territoireId, "bois", "0.4");
    expect((await stocksDuTerritoire(pool, territoireId)).map((s) => ({ id: s.id, nom: s.nom, famille: s.famille, quantite: s.quantite }))).toEqual([
      { id: "viande", nom: "Viande", famille: "nourriture", quantite: (await auDepart())[0][1] },
      { id: "vegetaux", nom: "Végétaux", famille: "nourriture", quantite: (await auDepart())[1][1] },
      { id: "bois", nom: "Bois", famille: "materiaux", quantite: (Number((await auDepart())[2][1]) + 0.4).toFixed(6) },
      { id: "pierre", nom: "Pierre", famille: "materiaux", quantite: (await auDepart())[3][1] },
    ]);
  });

  it("se fixent à la main, au millionième, en rendant l'ancienne et la nouvelle quantité (US-0208)", async () => {
    const { territoireId } = await naitre();
    const nom = (await pool.query("select ch.nom from chef ch join territoire t on t.chef_id = ch.id where t.id = $1", [territoireId])).rows[0].nom;
    await pool.query("update stock set quantite = 100 where territoire_id = $1", [territoireId]);
    expect(await fixerStock(pool, territoireId, "bois", "5000.1234567")).toEqual({ chef: nom, ressource: "Bois", avant: "100.000000", apres: "5000.123457" });
    expect((await stocks(territoireId))[2]).toEqual(["bois", "5000.123457"]);
    expect(await fixerStock(pool, territoireId, "or", "5")).toBeNull();
    await expect(fixerStock(pool, territoireId, "bois", "-1")).rejects.toMatchObject({ constraint: "stock_jamais_negatif" });
  });

  it("retrouvent leur chef par son nom, majuscules, accents et signes mis à part (US-0208)", async () => {
    // chefParNom ne cherche que dans le Monde du jeu.
    const { territoireId } = await naitre(null);
    const nom: string = (await pool.query("select ch.nom from chef ch join territoire t on t.chef_id = ch.id where t.id = $1", [territoireId])).rows[0].nom;
    expect(await chefParNom(pool, `  ${nom.toUpperCase()} `)).toEqual({ nom, territoireId });
    expect(await chefParNom(pool, "Personne Ici Zz")).toBeNull();
    expect(await chefParNom(pool, "!!!")).toBeNull();
  });

  it("disent d'où vient leur production : le Foyer et son Biome, puis les autres Cases par Biome (US-0214)", async () => {
    const { territoireId } = await naitre();
    const client = await pool.connect();
    try {
      await client.query("begin");
      const parHeure = async (biome: string) =>
        (await client.query("select par_heure::text as p from production_biome where biome_id = $1 and ressource_id = 'bois'", [biome])).rows[0].p;
      const bois = async () => (await stocksDuTerritoire(client, territoireId)).find((s) => s.id === "bois")!.sources;
      expect(await bois()).toEqual([{ libelle: "Foyer · prairie", parHeure: await parHeure("prairie") }]);
      await client.query(
        `update case_du_monde set chef_id = (select chef_id from territoire where id = $1)
         where id in (select id from case_du_monde where chef_id is null and biome_id = 'foret' order by id limit 2)`,
        [territoireId],
      );
      const deuxForets = (Number(await parHeure("foret")) * 2).toFixed(6);
      expect(await bois()).toEqual([
        { libelle: "Foyer · prairie", parHeure: await parHeure("prairie") },
        { libelle: "2 Cases de forêt", parHeure: deuxForets },
      ]);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  it("disparaissent avec leur Territoire", async () => {
    const { compte, territoireId } = await naitre();
    await pool.query("delete from compte where id = $1", [compte.id]);
    expect(await stocks(territoireId)).toEqual([]);
  });
});
