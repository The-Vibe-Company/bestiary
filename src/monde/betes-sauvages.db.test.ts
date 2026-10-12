import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { ANNEAUX_DU_MONDE } from "@/reglages";
import { nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, URL_TEST } from "@/test/base";
import { apparitions, betesSauvages, betesSauvagesDesCases, betesSauvagesDUneCase, emmenerUneBete, type EspeceSauvage, rangerLesEspeces } from "./betes-sauvages";
import { creerUnMonde } from "./generer";
import type { Coordonnees } from "./hex";

const HEURE = 3_600_000;
const JOUR = 24 * HEURE;
const DEBUT = new Date("2026-10-08T09:17:23.456Z");
const apres = (ms: number) => new Date(DEBUT.getTime() + ms);

type CaseEnBase = Coordonnees & { id: number; graine: number; biome: string };

/** Le Monde généré des essais de la carte (carte.db.test.ts), créé une fois pour toutes dans la base de test : un Monde ne s'efface pas. */
const MONDE_GENERE = "Essai de la carte (US-0417)";
/** Une Case c dont le Biome a, en base, des Espèces communes et d'autres plus rares (US-0928) : les Espèces d'essai en donnent. */
const BIOME_VARIE = `c.biome_id in (select biome_id from espece where rarete_id = 'commune')
  and c.biome_id in (select biome_id from espece where rarete_id <> 'commune')`;

describe.skipIf(!URL_TEST)("les Bêtes sauvages d'une Case en base (US-0925)", () => {
  let pool: Pool;
  let genereId: number;
  const lancement = `betes-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let numero = 0;
  /**
   * Un nom de chef propre à ce lancement, pour ne pas croiser les autres essais, qu'aucun mot interdit ne refuse : « Betes »
   * suivi d'un « exe » tiré au hasard ne naissait pas.
   */
  const suffixe = suffixeDEssai();
  const nomUnique = () => nomDEssai("Betes", suffixe, numero);
  /**
   * Un chef qui naît dans le Monde généré des essais, pour ne pas prendre de place au Monde du jeu : la Case de son Foyer,
   * et une Case libre de ce Monde, au Cœur sauvage, où aucun Foyer ne naît : elle le reste.
   */
  const naitre = async (): Promise<{ foyer: CaseEnBase; libre: CaseEnBase }> => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, genereId)).toMatchObject({ statut: "enregistre" });
    const { rows } = await pool.query<CaseEnBase & { foyer: boolean }>(
      `select c.id, c.q, c.r, c.biome_id as biome, m.graine::float8 as graine, c.id = t.foyer_case_id as foyer
       from chef ch join territoire t on t.chef_id = ch.id join case_du_monde f on f.id = t.foyer_case_id join monde m on m.id = f.monde_id
       join lateral (select * from case_du_monde c where c.monde_id = f.monde_id and (c.id = f.id or (c.coeur and ${BIOME_VARIE}))
                     order by c.id = f.id desc, c.id limit 2) c on true
       where ch.compte_id = $1`,
      [compte.id],
    );
    const [foyer, libre] = [rows.find((c) => c.foyer)!, rows.find((c) => !c.foyer)!];
    return { foyer, libre };
  };
  /** Les Cases du Monde généré des essais qui répondent à `condition` (sur la Case c), rangées par identifiant. */
  const desCases = async (condition: string): Promise<CaseEnBase[]> =>
    (
      await pool.query<CaseEnBase>(
        `select c.id, c.q, c.r, c.biome_id as biome, m.graine::float8 as graine from case_du_monde c join monde m on m.id = c.monde_id
         where m.id = $1 and ${condition} order by c.id`,
        [genereId],
      )
    ).rows;
  /** Une Case du Cœur sauvage du Monde généré des essais, libre pour toujours, d'un Biome aux Espèces variées. */
  const uneCaseLibre = async (): Promise<CaseEnBase> => (await desCases(`c.coeur and ${BIOME_VARIE}`))[0];
  /** Les Espèces de la base, rangées pour les tirages (US-0928). */
  const especesEnBase = async () =>
    rangerLesEspeces((await pool.query<EspeceSauvage>(`select id, rarete_id as "rareteId", biome_id as "biomeId" from espece`)).rows);

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(4153)");
      const { rows } = await client.query<{ id: number }>("select id from monde where nom = $1", [MONDE_GENERE]);
      genereId = rows[0]?.id ?? (await creerUnMonde(client, { nom: MONDE_GENERE, graine: 417 })).mondeId;
      await client.query("commit");
    } catch (erreur) {
      await client.query("rollback");
      throw erreur;
    } finally {
      client.release();
    }
  }, 60_000);
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("en fait apparaître sur une Case libre, celles que donnent la graine du Monde, la Case et le temps du jeu", async () => {
    const { libre } = await naitre();
    const betes = await betesSauvagesDUneCase(pool, libre.id, DEBUT, apres(30 * JOUR));
    expect(betes.length).toBeGreaterThan(5);
    expect(betes).toEqual(betesSauvages({ ...libre, anneau: ANNEAUX_DU_MONDE }, DEBUT, apres(30 * JOUR), await especesEnBase()));
  });

  it("tire la Rareté de chaque Bête selon l'Anneau de sa Case, d'après la forme de son Monde (US-0927)", async () => {
    const [rarete, especes] = [(betes: { rareteId: string }[]) => betes.map((b) => b.rareteId), await especesEnBase()];
    const auCoeur = await uneCaseLibre();
    const betes = await betesSauvagesDUneCase(pool, auCoeur.id, DEBUT, apres(120 * JOUR));
    expect(rarete(betes)).toEqual(rarete(betesSauvages({ ...auCoeur, anneau: ANNEAUX_DU_MONDE }, DEBUT, apres(120 * JOUR), especes)));
    expect(rarete(betes)).not.toEqual(rarete(betesSauvages({ ...auCoeur, anneau: 1 }, DEBUT, apres(120 * JOUR), especes)));
    // Une Case de la Couronne hors de la prairie, où aucun Foyer ne naît : l'Anneau 1.
    const [couronne] = await desCases(`c.couronne and c.biome_id <> 'prairie' and c.chef_id is null and ${BIOME_VARIE}`);
    expect(rarete(await betesSauvagesDUneCase(pool, couronne.id, DEBUT, apres(120 * JOUR)))).toEqual(
      rarete(betesSauvages({ ...couronne, anneau: 1 }, DEBUT, apres(120 * JOUR), especes)),
    );
  });

  it("tire l'Espèce de chaque Bête parmi celles de la base qui vivent dans le Biome de sa Case (US-0928)", async () => {
    const especes = await especesEnBase();
    const { rows } = await pool.query<EspeceSauvage>(`select id, rarete_id as "rareteId", biome_id as "biomeId" from espece`);
    const biomeDe = new Map(rows.map((e) => [e.id, e.biomeId]));
    const laCase = await uneCaseLibre();
    const betes = await betesSauvagesDUneCase(pool, laCase.id, DEBUT, apres(120 * JOUR));
    expect(betes.length).toBeGreaterThan(50);
    expect(new Set(betes.map((b) => biomeDe.get(b.especeId)))).toEqual(new Set([laCase.biome]));
    expect(betes).toEqual(betesSauvages({ ...laCase, anneau: ANNEAUX_DU_MONDE }, DEBUT, apres(120 * JOUR), especes));
  });

  it("compte côte, lac, rivière et mer ensemble, comme l'eau : leurs Bêtes sont toutes des Espèces de l'eau (US-0928)", async () => {
    const { rows } = await pool.query<{ id: string }>("select id from espece where biome_id = 'eau'");
    const deLEau = new Set(rows.map((e) => e.id));
    expect(deLEau.size).toBeGreaterThan(0);
    const vues = new Set<string>();
    for (const variante of ["cote", "lac", "riviere", "mer"]) {
      const [laCase] = await desCases(`c.variante_id = '${variante}' and c.chef_id is null`);
      expect(laCase.biome, variante).toBe("eau");
      const betes = await betesSauvagesDUneCase(pool, laCase.id, DEBUT, apres(120 * JOUR));
      expect(betes.length, variante).toBeGreaterThan(50);
      for (const b of betes) expect(deLEau, `${variante} : ${b.especeId}`).toContain(b.especeId);
      for (const b of betes) vues.add(b.especeId);
    }
    expect(vues.size).toBeGreaterThan(1);
  });

  it("ne fait apparaître aucune Bête sur une Case dont le Biome n'a aucune Espèce, pas même commune (US-0928)", async () => {
    const sansCommune = await desCases("c.coeur and c.biome_id not in (select biome_id from espece where rarete_id = 'commune')");
    for (const laCase of sansCommune.slice(0, 3)) expect(await betesSauvagesDUneCase(pool, laCase.id, DEBUT, apres(120 * JOUR))).toEqual([]);
    const { rows } = await pool.query<{ id: string }>("select id from biome where id not in (select biome_id from espece where rarete_id = 'commune')");
    for (const { id } of rows) {
      const [laCase] = await desCases(`c.biome_id = '${id}' and c.chef_id is null`);
      if (laCase) expect(await betesSauvagesDUneCase(pool, laCase.id, DEBUT, apres(120 * JOUR)), id).toEqual([]);
    }
  });

  it("n'en fait jamais apparaître sur une Case qui appartient à un Territoire", async () => {
    const { foyer } = await naitre();
    expect(apparitions(foyer.graine, foyer, DEBUT, apres(30 * JOUR)).length).toBeGreaterThan(5);
    expect(await betesSauvagesDUneCase(pool, foyer.id, DEBUT, apres(30 * JOUR))).toEqual([]);
  });

  it("calcule plusieurs Cases à la fois, chacune comme seule ; une Case inconnue n'en a pas", async () => {
    const { foyer, libre } = await naitre();
    const ensemble = await betesSauvagesDesCases(pool, [libre.id, foyer.id, -1], DEBUT, apres(7 * JOUR));
    expect([...ensemble.keys()]).toEqual([libre.id, foyer.id, -1]);
    expect(ensemble.get(libre.id)).toEqual(await betesSauvagesDUneCase(pool, libre.id, DEBUT, apres(7 * JOUR)));
    expect(ensemble.get(foyer.id)).toEqual([]);
    expect(ensemble.get(-1)).toEqual([]);
  });

  it("calcule une Case seule comme toutes les Cases d'un Monde à la fois : le résultat ne change pas (US-0930)", async () => {
    // Les deux calculs dans un même état de la base : d'autres fichiers font naître et effacent des Foyers dans ce Monde au
    // même moment, et une Case prise entre les deux n'aurait plus de Bêtes.
    const client = await pool.connect();
    try {
      await client.query("begin isolation level repeatable read read only");
      const { rows } = await client.query<{ id: number }>("select id from case_du_monde where monde_id = $1 order by id", [genereId]);
      const ids = rows.map((c) => c.id);
      const toutes = await betesSauvagesDesCases(client, ids, DEBUT, apres(JOUR));
      expect(toutes.size).toBe(ids.length);
      expect([...toutes.values()].flat().length).toBeGreaterThan(1000);
      for (const id of ids.filter((_, i) => i % 211 === 0)) expect(await betesSauvagesDUneCase(client, id, DEBUT, apres(JOUR)), `${id}`).toEqual(toutes.get(id));
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  describe("une Bête qui suit une Expédition (US-0926)", () => {
    /** Une période propre à chaque lancement, des années plus tard : les Bêtes emmenées d'un essai ne croisent pas les autres. */
    const PERIODE = new Date(Date.UTC(2031, 0, 1) + Math.floor(Math.random() * 3650) * JOUR + 1234);
    const ensuite = (ms: number) => new Date(PERIODE.getTime() + ms);
    let laCase: CaseEnBase;
    /** Les lignes écrites pour la Case pendant la période : les Bêtes qui en sont parties. */
    const parties = async () =>
      (
        await pool.query<{ numero: number; partie_le: Date }>(
          "select numero::float8 as numero, partie_le from bete_partie where case_id = $1 and partie_le >= $2 and partie_le < $3 order by partie_le",
          [laCase.id, PERIODE, ensuite(60 * JOUR)],
        )
      ).rows;
    const numeros = async (de: Date, a: Date) => (await betesSauvagesDUneCase(pool, laCase.id, de, a)).map((b) => b.numero);

    beforeAll(async () => {
      laCase = await uneCaseLibre();
    });
    afterAll(async () => {
      await pool.query("delete from bete_partie where case_id = $1 and partie_le >= $2 and partie_le < $3", [laCase.id, PERIODE, ensuite(60 * JOUR)]);
    });

    it("quitte aussitôt sa Case, pour toujours : c'est la seule écriture des Bêtes sauvages", async () => {
      const suivie = (await betesSauvagesDUneCase(pool, laCase.id, PERIODE, ensuite(7 * JOUR))).find((b) => b.arrivee >= PERIODE)!;
      const instant = new Date(suivie.arrivee.getTime() + HEURE);
      expect(await emmenerUneBete(pool, laCase.id, suivie.numero, instant)).toBe(true);
      expect(await numeros(instant, new Date(instant.getTime() + 1))).not.toContain(suivie.numero);
      expect(await numeros(instant, ensuite(60 * JOUR))).not.toContain(suivie.numero);
      // Jusque-là, elle était bien sur sa Case.
      expect((await betesSauvagesDUneCase(pool, laCase.id, suivie.arrivee, instant)).find((b) => b.numero === suivie.numero)).toEqual({ ...suivie, depart: instant });
      expect(await parties()).toEqual([{ numero: suivie.numero, partie_le: instant }]);
    });

    it("ne part pas si elle n'est pas là : pas encore arrivée, déjà partie, inconnue, ou déjà emmenée, même au même instant", async () => {
      const b = (await betesSauvagesDUneCase(pool, laCase.id, ensuite(10 * JOUR), ensuite(20 * JOUR)))[0];
      const avant = await parties();
      expect(await emmenerUneBete(pool, laCase.id, b.numero, new Date(b.arrivee.getTime() - 1))).toBe(false);
      expect(await emmenerUneBete(pool, laCase.id, b.numero, b.depart)).toBe(false);
      expect(await emmenerUneBete(pool, laCase.id, 7, b.arrivee)).toBe(false);
      expect(await parties()).toEqual(avant);
      // Deux Expéditions en même temps : une seule l'emmène.
      const [une, autre] = await Promise.all([emmenerUneBete(pool, laCase.id, b.numero, b.arrivee), emmenerUneBete(pool, laCase.id, b.numero, b.arrivee)]);
      expect([une, autre].sort()).toEqual([false, true]);
      expect(await emmenerUneBete(pool, laCase.id, b.numero, new Date(b.arrivee.getTime() + HEURE))).toBe(false);
      expect((await parties()).filter((p) => p.numero === b.numero)).toEqual([{ numero: b.numero, partie_le: b.arrivee }]);
    });
  });
});
