import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { BETES_DE_NAISSANCE, PORTEE_D_EXPLORATION_CASES, PRESENCE_D_UNE_BETE_DE_NAISSANCE_HEURES, PRESENCE_D_UNE_BETE_HEURES } from "@/reglages";
import { nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, URL_TEST } from "@/test/base";
import { betesDeNaissanceDesCases, betesDeNaissancePresentes, poserLesBetesDeNaissance, recevoirLesBetesDeNaissance } from "./betes-de-naissance";
import { creerUnMonde } from "./generer";
import { type Coordonnees, distance } from "./hex";

const HEURE = 3_600_000;

/**
 * Le Monde généré des essais de ce fichier, créé une fois pour toutes dans la base de test (un Monde ne s'efface pas) : à
 * lui seul, aucun Foyer d'un autre fichier n'y naît sur les Cases de ses Bêtes de naissance pendant un essai.
 */
const MONDE_GENERE = "Essai des Bêtes de naissance (US-0975)";

/** Une Bête de naissance telle que la base la garde, avec sa Case et son Espèce. */
type BeteEnBase = Coordonnees & {
  caseId: number;
  monde: number;
  libre: boolean;
  biome: string;
  especeId: string;
  rarete: string;
  biomeDeLEspece: string;
  arrivee: Date;
  depart: Date;
};

describe.skipIf(!URL_TEST)("les Bêtes de naissance d'un Foyer (US-0975, sur base)", () => {
  let pool: Pool;
  let genereId: number;
  const lancement = `naissance-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Un nom de chef propre à ce lancement, pour ne pas croiser les autres essais. */
  const nomUnique = () => nomDEssai("Portee", suffixe, numero);

  /**
   * Un chef qui naît dans le Monde généré des essais, pour ne pas prendre de place au Monde du jeu : son Territoire, sa
   * naissance, son Foyer et l'instant où il a reçu ses Bêtes de naissance.
   */
  const naitre = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, genereId)).toMatchObject({ statut: "enregistre" });
    const { rows } = await pool.query<{ id: number; neLe: Date; recues: Date | null; foyer: Coordonnees & { id: number; monde: number } }>(
      `select t.id, t.ne_le as "neLe", t.betes_de_naissance_le as recues, json_build_object('id', f.id, 'q', f.q, 'r', f.r, 'monde', f.monde_id) as foyer
       from chef ch join territoire t on t.chef_id = ch.id join case_du_monde f on f.id = t.foyer_case_id where ch.compte_id = $1`,
      [compte.id],
    );
    return rows[0];
  };

  /** Les Bêtes de naissance du Territoire en base, dans l'ordre de leurs Cases. */
  const betesDu = async (territoireId: number, base: Pick<Pool, "query"> = pool): Promise<BeteEnBase[]> =>
    (
      await base.query<BeteEnBase>(
        `select c.id as "caseId", c.q, c.r, c.monde_id as monde, c.chef_id is null as libre, c.biome_id as biome, e.id as "especeId",
           e.rarete_id as rarete, e.biome_id as "biomeDeLEspece", b.arrivee, b.depart
         from bete_de_naissance b join case_du_monde c on c.id = b.case_id join espece e on e.id = b.espece_id
         where b.territoire_id = $1 order by c.id`,
        [territoireId],
      )
    ).rows;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(4153)");
      const { rows } = await client.query<{ id: number }>("select id from monde where nom = $1", [MONDE_GENERE]);
      genereId = rows[0]?.id ?? (await creerUnMonde(client, { nom: MONDE_GENERE, graine: 975 })).mondeId;
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

  it(`en pose ${BETES_DE_NAISSANCE} à la naissance d'un Foyer, communes, sur des Cases libres à portée d'exploration de départ, une par Case`, async () => {
    const territoire = await naitre();
    const betes = await betesDu(territoire.id);
    expect(betes).toHaveLength(BETES_DE_NAISSANCE);
    expect(new Set(betes.map((b) => b.caseId)).size).toBe(BETES_DE_NAISSANCE);
    for (const b of betes) {
      expect(b).toMatchObject({ monde: territoire.foyer.monde, libre: true, rarete: "commune" });
      expect(distance(b, territoire.foyer)).toBeGreaterThanOrEqual(1);
      expect(distance(b, territoire.foyer)).toBeLessThanOrEqual(PORTEE_D_EXPLORATION_CASES);
      // US-0928 : une commune qui vit dans le Biome de sa Case.
      expect(b.biomeDeLEspece).toBe(b.biome);
    }
    // Le Territoire les a reçues en naissant : il ne les attend plus.
    expect(territoire.recues).toEqual(territoire.neLe);
  });

  it(`les y laisse ${PRESENCE_D_UNE_BETE_DE_NAISSANCE_HEURES} heures de jeu depuis la naissance, plus longtemps qu'une apparition ordinaire`, async () => {
    const territoire = await naitre();
    const betes = await betesDu(territoire.id);
    expect(PRESENCE_D_UNE_BETE_DE_NAISSANCE_HEURES).toBeGreaterThan(PRESENCE_D_UNE_BETE_HEURES);
    for (const b of betes) {
      expect(b.arrivee).toEqual(territoire.neLe);
      expect(b.depart.getTime() - b.arrivee.getTime()).toBe(PRESENCE_D_UNE_BETE_DE_NAISSANCE_HEURES * HEURE);
    }
    const [arrivee, depart] = [territoire.neLe.getTime(), betes[0].depart.getTime()];
    const presentes = (instant: number) => betesDeNaissancePresentes(pool, territoire.id, new Date(instant));
    expect(await presentes(arrivee - 1)).toBe(0);
    expect(await presentes(arrivee)).toBe(BETES_DE_NAISSANCE);
    expect(await presentes(depart - 1)).toBe(BETES_DE_NAISSANCE);
    expect(await presentes(depart)).toBe(0);
  });

  it("les réserve au nouveau chef : les Expéditions d'un autre Territoire n'en rencontrent aucune sur leurs Cases", async () => {
    const [lui, autre] = [await naitre(), await naitre()];
    // L'autre, né tout près, pourrait avoir posé les siennes sur les mêmes Cases : ici, il n'en a aucune. Son Foyer a pu
    // naître sur l'une des Cases du premier : seules comptent celles qui sont restées libres.
    await pool.query("delete from bete_de_naissance where territoire_id = $1", [autre.id]);
    const betes = (await betesDu(lui.id)).filter((b) => b.libre);
    expect(betes.length).toBeGreaterThan(0);
    const caseIds = betes.map((b) => b.caseId);
    const [arrivee, depart] = [betes[0].arrivee, betes[0].depart];
    const siennes = await betesDeNaissanceDesCases(pool, lui.id, caseIds, arrivee, depart);
    expect([...siennes.keys()]).toEqual(caseIds);
    for (const b of betes) {
      expect(siennes.get(b.caseId)).toEqual([{ id: expect.any(Number), arrivee, depart, especeId: b.especeId, rareteId: "commune" }]);
    }
    // Un autre Territoire, au même moment, sur les mêmes Cases : rien.
    expect([...(await betesDeNaissanceDesCases(pool, autre.id, caseIds, arrivee, depart)).values()]).toEqual(caseIds.map(() => []));
    // Ni avant leur arrivée, ni dès leur départ.
    expect([...(await betesDeNaissanceDesCases(pool, lui.id, caseIds, new Date(arrivee.getTime() - HEURE), arrivee)).values()].flat()).toEqual([]);
    expect([...(await betesDeNaissanceDesCases(pool, lui.id, caseIds, depart, new Date(depart.getTime() + HEURE))).values()].flat()).toEqual([]);
  });

  it("les perd sur une Case prise depuis par un Territoire, comme toute Bête sauvage (US-0925)", async () => {
    const territoire = await naitre();
    const [prise, ...restees] = await betesDu(territoire.id);
    const [arrivee, depart] = [prise.arrivee, prise.depart];
    const client = await pool.connect();
    try {
      await client.query("begin");
      // Un Foyer né juste après, sur l'une de ses Cases : ici, son propre Territoire la prend, le temps de l'essai.
      await client.query("update case_du_monde set chef_id = (select chef_id from territoire where id = $1) where id = $2", [territoire.id, prise.caseId]);
      const siennes = await betesDeNaissanceDesCases(client, territoire.id, [prise.caseId, ...restees.map((b) => b.caseId)], arrivee, depart);
      expect(siennes.get(prise.caseId)).toEqual([]);
      for (const b of restees) expect(siennes.get(b.caseId)).toHaveLength(1);
      expect(await betesDeNaissancePresentes(client, territoire.id, arrivee)).toBe(restees.length);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  it("ne choisit ni une Case prise, ni une Case dont le Biome n'a aucune commune", async () => {
    const territoire = await naitre();
    const client = await pool.connect();
    try {
      await client.query("begin");
      // Autour de son Foyer, toutes les Cases à portée sont prises, sauf deux : une prairie, et une Case d'un autre Biome
      // qui, le temps de l'essai, n'a plus aucune commune.
      const { rows: cases } = await client.query<Coordonnees & { id: number; biome: string }>(
        "select id, q, r, biome_id as biome from case_du_monde where monde_id = $1 and chef_id is null and q between $2 and $3 and r between $4 and $5 order by id",
        [genereId, ...[territoire.foyer.q, territoire.foyer.r].flatMap((x) => [x - PORTEE_D_EXPLORATION_CASES, x + PORTEE_D_EXPLORATION_CASES])],
      );
      const aPortee = cases.filter((c) => distance(c, territoire.foyer) <= PORTEE_D_EXPLORATION_CASES);
      // Une Case d'un Biome qui a des communes, quand il y en a une à portée : leur rendre rares éprouve le filtre des
      // communes ; sinon, une Case d'un Biome qui n'en a jamais eu (la banquise, la jungle).
      const { rows: avecCommunes } = await client.query<{ biome: string }>("select distinct biome_id as biome from espece where rarete_id = 'commune'");
      const aDesCommunes = new Set(avecCommunes.map((b) => b.biome));
      const prairie = aPortee.find((c) => c.biome === "prairie")!;
      const sansCommune = aPortee.find((c) => c.biome !== "prairie" && aDesCommunes.has(c.biome)) ?? aPortee.find((c) => c.biome !== "prairie")!;
      // Ses communes deviennent rares dans une copie des Espèces propre à cette transaction : une table temporaire, que
      // Postgres lit avant celle du jeu. Les Espèces du jeu, que les autres fichiers rechargent en même temps
      // (preparerMondeDeTest), ne sont jamais verrouillées : les modifier elles-mêmes, le temps de l'essai, interbloquait
      // ce rechargement.
      await client.query("create temp table espece on commit drop as table public.espece");
      await client.query("update espece set rarete_id = 'rare' where biome_id = $1 and rarete_id = 'commune'", [sansCommune.biome]);
      const prises = aPortee.filter((c) => c !== prairie && c !== sansCommune).map((c) => c.id);
      // Une portée de 8 Cases en compte plus de 200, mais 80 seulement autour d'un Foyer né au coin du Monde, environ une
      // naissance sur soixante.
      expect(prises.length).toBeGreaterThan(50);
      await client.query("update case_du_monde set chef_id = (select chef_id from territoire where id = $1) where id = any($2::int[])", [territoire.id, prises]);
      await client.query("delete from bete_de_naissance where territoire_id = $1", [territoire.id]);
      for (const hasard of [0, 0.5, 0.999]) {
        await client.query("savepoint essai");
        expect(await poserLesBetesDeNaissance(client, territoire.id, new Date(), () => hasard)).toBe(1);
        expect((await betesDu(territoire.id, client)).map((b) => b.caseId)).toEqual([prairie.id]);
        await client.query("rollback to savepoint essai");
      }
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  it("les donne une seule fois à un Territoire né avant elles, à son retour, même à plusieurs demandes au même moment", async () => {
    const territoire = await naitre();
    // Un Territoire d'avant cette story : sans Bêtes de naissance, et qui ne les a jamais reçues.
    await pool.query("delete from bete_de_naissance where territoire_id = $1", [territoire.id]);
    await pool.query("update territoire set betes_de_naissance_le = null where id = $1", [territoire.id]);
    const retour = new Date(territoire.neLe.getTime() + 30 * 24 * HEURE);
    await Promise.all(Array.from({ length: 4 }, () => pool.query("select pg_sleep(0.1)")));
    const posees = await Promise.all(Array.from({ length: 4 }, () => recevoirLesBetesDeNaissance(pool, territoire.id, retour)));
    expect(posees.sort()).toEqual([0, 0, 0, BETES_DE_NAISSANCE]);
    const betes = await betesDu(territoire.id);
    expect(betes).toHaveLength(BETES_DE_NAISSANCE);
    for (const b of betes) expect(b).toMatchObject({ arrivee: retour, depart: new Date(retour.getTime() + PRESENCE_D_UNE_BETE_DE_NAISSANCE_HEURES * HEURE) });
    expect((await pool.query("select betes_de_naissance_le as recues from territoire where id = $1", [territoire.id])).rows[0].recues).toEqual(retour);
    // Plus jamais ensuite.
    expect(await recevoirLesBetesDeNaissance(pool, territoire.id, new Date(retour.getTime() + HEURE))).toBe(0);
    expect(await betesDu(territoire.id)).toEqual(betes);
  });

  it("partent avec leur Territoire", async () => {
    const territoire = await naitre();
    expect(await betesDu(territoire.id)).toHaveLength(BETES_DE_NAISSANCE);
    await pool.query("delete from compte where id = (select ch.compte_id from chef ch join territoire t on t.chef_id = ch.id where t.id = $1)", [territoire.id]);
    expect(await betesDu(territoire.id)).toEqual([]);
  });
});
