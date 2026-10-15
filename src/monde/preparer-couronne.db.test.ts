import type { Pool, PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ECART_ENTRE_FOYERS, JOUEURS_PAR_MONDE } from "@/reglages";
import { donneesDeReferenceTenues, poolDeTest, preparerMondeDeTest, URL_TEST } from "@/test/base";
import { casesDeLaCouronne, graineDuMonde } from "./couronne";
import { emplacementsDeFoyers } from "./foyers";
import { distance, type Coordonnees } from "./hex";
import { preparerCouronne } from "./preparer-couronne";

/** Les Cases d'un Monde en base, rangées comme casesDeLaCouronne les rend. */
async function casesEnBase(base: Pool | PoolClient, mondeId: number) {
  const { rows } = await base.query("select q, r, anneau, biome_id as biome, variante_id as variante from case_du_monde where monde_id = $1 order by q, r", [mondeId]);
  return rows;
}

describe.skipIf(!URL_TEST)("préparer la Couronne en base (US-0151)", () => {
  let pool: Pool;
  let client: PoolClient;
  let mondeId: number;

  // Les données de référence, chargées pour de bon comme dans les autres fichiers : les charger dans la transaction de
  // chaque essai les tenait le temps de celui-ci, et les autres fichiers, qui les rechargent en même temps, l'attendaient.
  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
  });
  afterAll(async () => {
    await pool.end();
  });
  // Chaque essai travaille dans une transaction annulée à la fin : la base de test reste intacte.
  beforeEach(async () => {
    client = await pool.connect();
    await client.query("begin");
    const { rows } = await client.query("insert into monde (nom) values ($1) returning id", [`Essai-${Date.now()}-${Math.random()}`]);
    mondeId = rows[0].id;
  });
  afterEach(async () => {
    await client.query("rollback");
    client.release();
  });

  it("crée les 2 070 Cases de la Couronne, et fixe la taille du Monde, celle de son Cœur sauvage comprise (US-0403)", async () => {
    expect(await preparerCouronne(client, mondeId)).toEqual({ ajoutees: 2070, total: 2070 });
    // Les données de référence, que les autres fichiers rechargent en même temps, ne sont pas tenues le temps de l'essai :
    // les Cases ne font que lire les Biomes et leurs formes, pour leur clé étrangère.
    expect(await donneesDeReferenceTenues(client, { lues: ["biome", "variante_biome"] })).toEqual([]);
    const { rows } = await client.query(
      `select count(*)::int as cases, bool_and(couronne) as toutes, bool_or(coeur) as "dansLeCoeur", min(anneau) as de, max(anneau) as a,
         bool_and(eloignement = anneau - 7) as "eloignees",
         (select json_build_object('rayon', rayon, 'anneaux', anneaux_couronne, 'coeur', rayon_coeur) from monde where id = $1) as taille
       from case_du_monde where monde_id = $1`,
      [mondeId],
    );
    expect(rows[0]).toEqual({ cases: 2070, toutes: true, dansLeCoeur: false, de: 55, a: 60, eloignees: true, taille: { rayon: 60, anneaux: 6, coeur: 8 } });
  });

  it("garde la taille du Cœur sauvage déjà fixée d'un Monde, et dit à chaque Case si elle en fait partie (US-0403) et à quelle distance elle en est (US-0405)", async () => {
    // Un petit Monde dont le Cœur atteint la Couronne : seules les Cases à moins de 7 Cases du milieu en sont.
    await client.query("update monde set rayon = 10, anneaux_couronne = 6, rayon_coeur = 7 where id = $1", [mondeId]);
    await preparerCouronne(client, mondeId);
    const { rows } = await client.query(
      `select anneau, bool_and(coeur) as tous, bool_or(coeur) as un, min(eloignement) as de, max(eloignement) as a
       from case_du_monde where monde_id = $1 group by anneau order by anneau`,
      [mondeId],
    );
    expect(rows).toEqual([5, 6, 7, 8, 9, 10].map((anneau) => ({ anneau, tous: anneau < 7, un: anneau < 7, de: Math.max(0, anneau - 6), a: Math.max(0, anneau - 6) })));
    expect((await client.query("select rayon_coeur from monde where id = $1", [mondeId])).rows[0].rayon_coeur).toBe(7);
  });

  it("ne touche jamais une Case existante : seules les manquantes sont ajoutées", async () => {
    await preparerCouronne(client, mondeId);
    await client.query("update case_du_monde set biome_id = 'toundra' where monde_id = $1 and q = 0 and r = -60", [mondeId]);
    await client.query("delete from case_du_monde where monde_id = $1 and q = 60 and r = 0", [mondeId]);
    expect(await preparerCouronne(client, mondeId)).toEqual({ ajoutees: 1, total: 2070 });
    const { rows } = await client.query("select biome_id from case_du_monde where monde_id = $1 and q = 0 and r = -60", [mondeId]);
    expect(rows[0].biome_id).toBe("toundra");
  });

  it("garde le rayon déjà fixé d'un Monde, et n'élargit sa Couronne que vers l'intérieur (US-0152)", async () => {
    await client.query("update monde set rayon = 10, anneaux_couronne = 2 where id = $1", [mondeId]);
    expect(await preparerCouronne(client, mondeId)).toEqual({ ajoutees: 6 * (5 + 6 + 7 + 8 + 9 + 10), total: 6 * (5 + 6 + 7 + 8 + 9 + 10) });
    const { rows } = await client.query("select rayon, anneaux_couronne from monde where id = $1", [mondeId]);
    expect(rows[0]).toEqual({ rayon: 10, anneaux_couronne: 6 });
  });

  it("élargit une Couronne existante sans toucher à ses Cases", async () => {
    // Une Couronne de 3 anneaux, telle que la première version la créait.
    await client.query("update monde set rayon = 60, anneaux_couronne = 3 where id = $1", [mondeId]);
    await client.query("insert into case_du_monde (monde_id, q, r, anneau, couronne, eloignement, biome_id) values ($1, 0, -60, 60, true, 53, 'toundra')", [mondeId]);
    expect(await preparerCouronne(client, mondeId)).toEqual({ ajoutees: 2069, total: 2070 });
    const { rows } = await client.query("select biome_id from case_du_monde where monde_id = $1 and q = 0 and r = -60", [mondeId]);
    expect(rows[0].biome_id).toBe("toundra");
  });

  it("donne sa graine à un Monde né sans graine : celle de son nom, dont sa Couronne a toujours été tirée (US-0401)", async () => {
    const { rows } = await client.query("select nom from monde where id = $1", [mondeId]);
    await preparerCouronne(client, mondeId);
    const graine = graineDuMonde(rows[0].nom);
    expect((await client.query("select graine from monde where id = $1", [mondeId])).rows[0].graine).toBe(String(graine));
    expect(await casesEnBase(client, mondeId)).toEqual(casesDeLaCouronne({ rayon: 60, anneaux: 6, graine }));
  });

  it("tire la Couronne de la graine enregistrée avec le Monde, et la garde (US-0401)", async () => {
    await client.query("update monde set graine = 12345 where id = $1", [mondeId]);
    await preparerCouronne(client, mondeId);
    expect((await client.query("select graine from monde where id = $1", [mondeId])).rows[0].graine).toBe("12345");
    expect(await casesEnBase(client, mondeId)).toEqual(casesDeLaCouronne({ rayon: 60, anneaux: 6, graine: 12345 }));
  });

  it("refuse en base une graine hors des entiers de 0 à 2³² − 1 (US-0401)", async () => {
    for (const graine of [-1, 2 ** 32]) {
      await client.query("savepoint essai");
      await expect(client.query("update monde set graine = $2 where id = $1", [mondeId, graine])).rejects.toMatchObject({ constraint: "monde_graine_sur_32_bits" });
      await client.query("rollback to savepoint essai");
    }
    await client.query("update monde set graine = $2 where id = $1", [mondeId, 2 ** 32 - 1]);
  });

  it("refuse en base deux Cases au même endroit, et un anneau faux", async () => {
    await preparerCouronne(client, mondeId);
    await client.query("savepoint essai");
    await expect(client.query("insert into case_du_monde (monde_id, q, r, anneau, couronne, eloignement, biome_id) values ($1, 60, 0, 60, true, 53, 'prairie')", [mondeId])).rejects.toMatchObject({
      constraint: "case_unique_dans_le_monde",
    });
    await client.query("rollback to savepoint essai");
    await expect(client.query("insert into case_du_monde (monde_id, q, r, anneau, couronne, eloignement, biome_id) values ($1, 1, 1, 1, false, 1, 'prairie')", [mondeId])).rejects.toMatchObject({
      constraint: "case_anneau_exact",
    });
  });

  it("refuse en base une Case du Cœur sauvage qui n'est pas à 0, une Case à 0 hors du Cœur, et une distance négative (US-0405)", async () => {
    for (const [coeur, eloignement] of [
      [true, 1],
      [false, 0],
      [false, -1],
    ]) {
      await client.query("savepoint essai");
      await expect(
        client.query("insert into case_du_monde (monde_id, q, r, anneau, couronne, coeur, eloignement, biome_id) values ($1, 1, 1, 2, false, $2, $3, 'prairie')", [mondeId, coeur, eloignement]),
      ).rejects.toMatchObject({ constraint: "case_coeur_a_zero" });
      await client.query("rollback to savepoint essai");
    }
    await client.query("insert into case_du_monde (monde_id, q, r, anneau, couronne, coeur, eloignement, biome_id) values ($1, 1, 1, 2, false, true, 0, 'prairie')", [mondeId]);
  });
});

describe.skipIf(!URL_TEST)("la Couronne du Monde du jeu, une fois sa graine enregistrée (US-0401)", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  it("reste la même, Case par Case : sa graine enregistrée est celle dont elle a été tirée", async () => {
    const { rows } = await pool.query("select id, nom, rayon, anneaux_couronne as anneaux, graine from monde order by id limit 1");
    const { id, nom, rayon, anneaux, graine } = rows[0];
    expect(graine).toBe(String(graineDuMonde(nom)));
    expect(await casesEnBase(pool, id)).toEqual(casesDeLaCouronne({ rayon, anneaux, graine: Number(graine) }));
  });

  it("connaît la taille de son Cœur sauvage, dont aucune de ses Cases ne fait partie : elles sont toutes au bord (US-0403)", async () => {
    const { rows } = await pool.query(
      `select m.rayon_coeur, count(*) filter (where c.coeur)::int as "dansLeCoeur", min(c.anneau) as "plusPres"
       from monde m join case_du_monde c on c.monde_id = m.id where m.id = (select min(id) from monde) group by m.rayon_coeur`,
    );
    expect(rows[0]).toEqual({ rayon_coeur: 8, dansLeCoeur: 0, plusPres: 55 });
  });

  it("porte sur chaque Case sa distance au Cœur sauvage, celle que donne son anneau : de 48 à 53 (US-0405)", async () => {
    const { rows } = await pool.query(
      `select bool_and(c.eloignement = c.anneau - (m.rayon_coeur - 1)) as exactes, min(c.eloignement) as de, max(c.eloignement) as a
       from monde m join case_du_monde c on c.monde_id = m.id where m.id = (select min(id) from monde)`,
    );
    expect(rows[0]).toEqual({ exactes: true, de: 48, a: 53 });
  });

  it("dit de chaque Case si elle est dans la Couronne, et y garde assez de terre, et de prairie, pour 90 joueurs (US-0404)", async () => {
    const { rows: mondes } = await pool.query("select id, rayon, anneaux_couronne as anneaux from monde order by id limit 1");
    const { id, rayon, anneaux } = mondes[0];
    const { rows: cases } = await pool.query<Coordonnees & { anneau: number; couronne: boolean; biome: string }>(
      "select q, r, anneau, couronne, biome_id as biome from case_du_monde where monde_id = $1 order by q, r",
      [id],
    );
    expect(cases).toHaveLength(2070);
    for (const c of cases) expect(c.couronne).toBe(c.anneau > rayon - anneaux);
    // Des Foyers posés un à un sur la terre de la Couronne, sur la première Case assez loin des autres.
    const surLaTerre: Coordonnees[] = [];
    for (const c of cases) if (c.biome !== "eau" && surLaTerre.every((f) => distance(f, c) >= ECART_ENTRE_FOYERS)) surLaTerre.push(c);
    expect(surLaTerre.length).toBeGreaterThanOrEqual(JOUEURS_PAR_MONDE);
    // Et selon la règle des naissances (US-0152), en prairie seulement, Cases déjà prises comprises.
    expect(emplacementsDeFoyers(cases, []).length).toBeGreaterThanOrEqual(JOUEURS_PAR_MONDE);
  });
});
