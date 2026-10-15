import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";
import { donneesDeReferenceTenues, poolDeTest, URL_TEST } from "@/test/base";
import { chargerJeu, lireJeu } from "./charger";
import { biomesEnBase, especesEnBase, raretesEnBase, rolesEnBase } from "./en-base";
import { lireDonnees, PRODUCTIONS } from "./jeux";

describe.skipIf(!URL_TEST)("données de référence lues en base", () => {
  let pool: Pool;
  let client: PoolClient;

  beforeAll(() => {
    pool = poolDeTest();
  });
  afterAll(async () => {
    await pool.end();
  });
  // Chaque essai charge les vrais fichiers dans une transaction annulée à la fin : la base de test reste intacte. Il les
  // charge dans une copie des tables propre à cette transaction, que Postgres lit avant celles du jeu : tous les fichiers
  // rechargent celles-ci en même temps (preparerMondeDeTest), et les tenir le temps de l'essai les faisait attendre.
  beforeEach(async () => {
    client = await pool.connect();
    await client.query("begin");
    const lots = lireDonnees();
    for (const table of new Set(lots.map(({ jeu }) => jeu.table))) {
      await client.query(`create temp table "${table}" (like public."${table}" including all) on commit drop`);
      await client.query(`insert into "${table}" select * from public."${table}"`);
    }
    for (const { jeu, entrees } of lots) await chargerJeu(client, jeu, entrees);
  });
  afterEach(async () => {
    await client.query("rollback");
    client.release();
  });

  it("donne chaque Biome dans son ordre, avec son nom et son identifiant", async () => {
    const biomes = await biomesEnBase(client);
    expect(biomes.map((b) => b.id)).toEqual(["prairie", "foret", "jungle", "savane", "desert", "montagne", "toundra", "banquise", "eau"]);
    expect(biomes[1]).toMatchObject({ id: "foret", nom: "Forêt", variantes: [] });
    // US-0209 : sa production horaire, telle que biomes.yaml la règle, dans l'ordre des Ressources.
    expect(biomes[1].production.map((p) => p.ressource)).toEqual(["Viande", "Végétaux", "Bois", "Pierre"]);
    const reglee = lireJeu(PRODUCTIONS).filter((p) => p.biomeId === "foret");
    expect(biomes[1].production.map((p) => Number(p.parHeure))).toEqual(reglee.map((p) => p.parHeure));
  });

  it("range les quatre formes de l'eau sous l'Eau", async () => {
    const eau = (await biomesEnBase(client)).find((b) => b.id === "eau");
    expect(eau?.variantes).toEqual([
      { id: "cote", nom: "Côte" },
      { id: "lac", nom: "Lac" },
      { id: "riviere", nom: "Rivière" },
      { id: "mer", nom: "Mer" },
    ]);
  });

  it("montre ce qui est en base, même quand la base diffère des fichiers", async () => {
    await client.query("update biome set nom = 'Prairie modifiée en base' where id = 'prairie'");
    expect((await biomesEnBase(client))[0].nom).toBe("Prairie modifiée en base");
  });

  it("donne chaque Espèce avec le nom de son Biome, de sa Rareté et de son Rôle, et toutes ses caractéristiques", async () => {
    const especes = (await especesEnBase(client)).filter((e) => ["souris", "poule", "pigeon"].includes(e.id));
    expect(especes.map((e) => e.id)).toEqual(["pigeon", "poule", "souris"]);
    expect(especes.find((e) => e.id === "poule")).toMatchObject({
      nom: "Poule",
      attaque: 5981,
      vie: 14953,
      vitesse: 14,
      taille: 31.623,
      regime: "omnivore",
      entretienParHeure: 5,
      biome: { id: "prairie", nom: "Prairie" },
      rarete: { id: "commune", nom: "Commune" },
      role: { id: "nourricier", nom: "Nourricier" },
      masseG: 2000,
      facteurArme: 0.4,
      illustration: "especes/poule.webp",
    });
    expect(especes.find((e) => e.id === "souris")?.role).toBeNull();
  });

  it("garde vides les champs vides, pour qu'on les repère", async () => {
    await client.query("update espece set source = null, illustration = null where id = 'souris'");
    expect((await especesEnBase(client)).find((e) => e.id === "souris")).toMatchObject({ source: null, illustration: null });
  });

  it("ne tient aucune donnée de référence du jeu, que les autres fichiers rechargent en même temps", async () => {
    await client.query("update biome set nom = 'Prairie modifiée en base' where id = 'prairie'");
    await client.query("update espece set source = null, illustration = null where id = 'souris'");
    expect(await donneesDeReferenceTenues(client)).toEqual([]);
  });

  it("donne les Raretés dans leur rang et les Rôles dans leur ordre", async () => {
    expect((await raretesEnBase(client)).map((r) => [r.id, r.selevent])).toEqual([
      ["commune", true],
      ["peu_commune", true],
      ["rare", true],
      ["epique", true],
      ["legendaire", true],
      ["mythique", false],
    ]);
    expect((await rolesEnBase(client)).map((r) => r.id)).toEqual(["porteur", "eclaireur", "nourricier", "batisseur"]);
  });
});

