import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, URL_TEST } from "@/test/base";
import { decouvrir } from "./brouillard";
import { ficheDUneCase } from "./fiche";
import { creerUnMonde } from "./generer";
import { type Coordonnees, distance } from "./hex";
import { ZONE_COEUR, ZONE_COURONNE } from "./zones";

/** Le Monde généré des essais de la carte (carte.db.test.ts), créé une fois pour toutes dans la base de test : un Monde ne s'efface pas. */
const MONDE_GENERE = "Essai de la carte (US-0417)";
const GRAINE = 417;

describe.skipIf(!URL_TEST)("la fiche d'une Case (US-0428, sur base)", () => {
  let pool: Pool;
  let genereId: number;
  const lancement = `fiche-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Un nom de chef propre à ce lancement, pour ne pas croiser les autres essais. */
  const nomUnique = () => nomDEssai("Fiche", suffixe, numero);
  /** Un chef qui naît dans le Monde du jeu, ou dans le Monde `mondeId` : son nom, son Territoire et la Case de son Foyer. */
  const naitre = async (mondeId: number | null = null) => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const { rows } = await pool.query<{ nom: string; territoire: number; q: number; r: number }>(
      "select ch.nom, t.id as territoire, c.q, c.r from chef ch join territoire t on t.chef_id = ch.id join case_du_monde c on c.id = t.foyer_case_id where ch.compte_id = $1",
      [compte.id],
    );
    return { nom: rows[0].nom, territoireId: rows[0].territoire, foyer: { q: rows[0].q, r: rows[0].r } };
  };
  /** La première Case du Monde généré, par q puis r, qui répond à `condition` (sur la Case c). */
  const uneCase = async (condition: string) => {
    const { rows } = await pool.query<{ q: number; r: number }>(`select q, r from case_du_monde c where monde_id = $1 and ${condition} order by q, r limit 1`, [genereId]);
    return rows[0];
  };

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(4153)");
      const { rows } = await client.query<{ id: number }>("select id from monde where nom = $1", [MONDE_GENERE]);
      genereId = rows[0]?.id ?? (await creerUnMonde(client, { nom: MONDE_GENERE, graine: GRAINE })).mondeId;
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

  it("donne le Biome d'une Case de terre par son nom, et personne pour la posséder quand elle est libre", async () => {
    const moi = await naitre(genereId);
    const foret = await uneCase("biome_id = 'foret' and chef_id is null");
    await decouvrir(pool, moi.territoireId, [foret]);
    expect(await ficheDUneCase(pool, moi.territoireId, foret)).toMatchObject({ ...foret, biome: "Forêt", chef: null, aVous: false });
  });

  it("donne une eau par le nom de sa variante, comme la légende", async () => {
    const moi = await naitre(genereId);
    const lac = await uneCase("variante_id = 'lac'");
    await decouvrir(pool, moi.territoireId, [lac]);
    expect(await ficheDUneCase(pool, moi.territoireId, lac)).toMatchObject({ ...lac, biome: "Lac", chef: null, aVous: false });
  });

  it("dit du Foyer du joueur qu'il est à lui", async () => {
    const moi = await naitre(genereId);
    expect(await ficheDUneCase(pool, moi.territoireId, moi.foyer)).toMatchObject({ ...moi.foyer, biome: "Prairie", chef: moi.nom, aVous: true });
  });

  it("donne le nom du chef à qui appartient la Case : le Foyer d'un autre chef", async () => {
    const [moi, voisin] = [await naitre(genereId), await naitre(genereId)];
    await decouvrir(pool, moi.territoireId, [voisin.foyer]);
    expect(await ficheDUneCase(pool, moi.territoireId, voisin.foyer)).toMatchObject({ ...voisin.foyer, chef: voisin.nom, aVous: false });
  });

  it("ne lit que le Monde du joueur : une Case qui n'en est pas n'a pas de fiche", async () => {
    // Aube n'a en base que sa Couronne : pas de Cœur sauvage, alors que le Monde généré en a un.
    const surAube = await naitre();
    expect(await ficheDUneCase(pool, surAube.territoireId, { q: 0, r: 0 })).toBeNull();
    expect(await ficheDUneCase(pool, surAube.territoireId, { q: 1000, r: 0 })).toBeNull();
  });

  it("ne lit rien pour un Territoire qui n'existe pas", async () => {
    expect(await ficheDUneCase(pool, -1, { q: 0, r: 0 })).toBeNull();
  });

  it("dit si la Case est de la Couronne, du Cœur sauvage, ou entre les deux (US-0429)", async () => {
    const moi = await naitre(genereId);
    const entre = await uneCase("not couronne and not coeur");
    await decouvrir(pool, moi.territoireId, [{ q: 0, r: 0 }, entre]);
    expect(await ficheDUneCase(pool, moi.territoireId, moi.foyer)).toMatchObject({ zone: ZONE_COURONNE });
    expect(await ficheDUneCase(pool, moi.territoireId, { q: 0, r: 0 })).toMatchObject({ zone: ZONE_COEUR });
    expect(await ficheDUneCase(pool, moi.territoireId, entre)).toMatchObject({ zone: 0 });
  });

  it("donne la distance de la Case au Foyer du joueur, en Cases, par la seule formule du jeu (US-0429)", async () => {
    const moi = await naitre(genereId);
    expect(await ficheDUneCase(pool, moi.territoireId, moi.foyer)).toMatchObject({ distance: 0 });
    for (const c of [{ q: 0, r: 0 }, await uneCase("anneau = 50"), await uneCase("variante_id = 'lac'")]) {
      expect(await ficheDUneCase(pool, moi.territoireId, c)).toMatchObject({ distance: distance(c, moi.foyer) });
    }
    expect(distance({ q: 0, r: 0 }, moi.foyer)).toBeGreaterThanOrEqual(55);
  });

  it("donne l'Anneau de la Case, de la Couronne (1) au Cœur sauvage (6) (US-0923)", async () => {
    const moi = await naitre(genereId);
    await decouvrir(pool, moi.territoireId, [{ q: 0, r: 0 }, { q: 30, r: 0 }]);
    expect(await ficheDUneCase(pool, moi.territoireId, moi.foyer)).toMatchObject({ zone: ZONE_COURONNE, anneau: 1 });
    expect(await ficheDUneCase(pool, moi.territoireId, { q: 0, r: 0 })).toMatchObject({ zone: ZONE_COEUR, anneau: 6 });
    // Le 30e anneau de Cases, au milieu des 47 qui séparent la Couronne du Cœur sauvage : l'Anneau 4.
    expect(await ficheDUneCase(pool, moi.territoireId, { q: 30, r: 0 })).toMatchObject({ zone: 0, anneau: 4 });
  });

  describe("une Case sous le brouillard du joueur (US-0438)", () => {
    /** Ce que la fiche d'une Case cachée doit dire : sa place et sa distance au Foyer, rien d'autre. */
    const inconnue = (c: Coordonnees, foyer: Coordonnees) => ({ q: c.q, r: c.r, inconnue: true, distance: distance(c, foyer) });
    /** La première Case du Monde généré, par q puis r, qui répond à `condition`, hors des abords du Foyer `foyer`. */
    const cachee = (foyer: Coordonnees, condition: string) => uneCase(`${condition} and greatest(abs(q - ${foyer.q}), abs(r - ${foyer.r}), abs(q + r - ${foyer.q + foyer.r})) > 4`);

    it("ne dit que « Case inconnue » et sa distance au Foyer : ni Biome, ni propriétaire, ni Couronne ou Cœur sauvage", async () => {
      const moi = await naitre(genereId);
      for (const c of [await cachee(moi.foyer, "variante_id = 'lac'"), { q: 0, r: 0 }, await cachee(moi.foyer, "couronne and biome_id = 'montagne'")]) {
        expect(await ficheDUneCase(pool, moi.territoireId, c)).toEqual(inconnue(c, moi.foyer));
      }
    });

    it("ne dit pas à qui elle est, même quand un autre chef la possède ; découverte, si", async () => {
      const [moi, voisin] = [await naitre(genereId), await naitre(genereId)];
      const client = await pool.connect();
      try {
        // Le milieu du Monde, loin de tout Foyer, pris un instant par le voisin.
        await client.query("begin");
        await client.query("update case_du_monde set chef_id = (select chef_id from territoire where id = $1) where monde_id = $2 and q = 0 and r = 0", [voisin.territoireId, genereId]);
        expect(await ficheDUneCase(client, moi.territoireId, { q: 0, r: 0 })).toEqual(inconnue({ q: 0, r: 0 }, moi.foyer));
        await decouvrir(client, moi.territoireId, [{ q: 0, r: 0 }]);
        expect(await ficheDUneCase(client, moi.territoireId, { q: 0, r: 0 })).toMatchObject({ chef: voisin.nom, zone: ZONE_COEUR });
      } finally {
        await client.query("rollback");
        client.release();
      }
    });

    it("se montre tout entière une fois découverte", async () => {
      const moi = await naitre(genereId);
      const lac = await cachee(moi.foyer, "variante_id = 'lac'");
      await decouvrir(pool, moi.territoireId, [lac]);
      expect(await ficheDUneCase(pool, moi.territoireId, lac)).toEqual({ ...lac, biome: "Lac", chef: null, aVous: false, zone: expect.any(Number), distance: distance(lac, moi.foyer), anneau: expect.any(Number) });
    });
  });
});
