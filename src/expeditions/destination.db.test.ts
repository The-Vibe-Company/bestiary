import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { decouvrir } from "@/monde/brouillard";
import { ficheDUneCase } from "@/monde/fiche";
import { creerUnMonde } from "@/monde/generer";
import { type Coordonnees, distance } from "@/monde/hex";
import { PORTEE_D_EXPLORATION_CASES } from "@/reglages";
import { nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, URL_TEST } from "@/test/base";
import { CASE_D_UN_TERRITOIRE, CASE_HORS_DE_PORTEE } from "./choix-de-destination";
import { destinationDUneCase } from "./destination";

/** Le Monde généré des essais de la carte (src/monde/carte.db.test.ts), créé une fois pour toutes dans la base de test : un Monde ne s'efface pas. */
const MONDE_GENERE = "Essai de la carte (US-0417)";
const GRAINE = 417;

describe.skipIf(!URL_TEST)("la destination d'une Expédition (US-0907, US-0908, sur base)", () => {
  let pool: Pool;
  let genereId: number;
  const lancement = `destination-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Un nom de chef propre à ce lancement, pour ne pas croiser les autres essais. */
  const nomUnique = () => nomDEssai("Dest", suffixe, numero);
  /** Un chef qui naît dans le Monde généré, ou dans le Monde du jeu (`mondeId` null) : son Territoire et la Case de son Foyer. */
  const naitre = async (mondeId: number | null = genereId) => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const { rows } = await pool.query<{ territoire: number; q: number; r: number }>(
      "select t.id as territoire, c.q, c.r from chef ch join territoire t on t.chef_id = ch.id join case_du_monde c on c.id = t.foyer_case_id where ch.compte_id = $1",
      [compte.id],
    );
    return { territoireId: rows[0].territoire, foyer: { q: rows[0].q, r: rows[0].r } };
  };
  /**
   * US-0908 : la première Case libre du Monde généré, par q puis r, hors de l'eau, à `ecart` Cases du Foyer `foyer`
   * (comptées par `distance`), et le nom de son Biome.
   */
  const aLEcart = async (foyer: Coordonnees, ecart: number) => {
    const { rows } = await pool.query<Coordonnees & { biome: string }>(
      `select c.q, c.r, b.nom as biome from case_du_monde c join biome b on b.id = c.biome_id
       where c.monde_id = $1 and c.chef_id is null and c.biome_id <> 'eau' and c.q between $2 and $3 and c.r between $4 and $5
       order by c.q, c.r`,
      [genereId, foyer.q - ecart, foyer.q + ecart, foyer.r - ecart, foyer.r + ecart],
    );
    const { q, r, biome } = rows.find((c) => distance(c, foyer) === ecart)!;
    return { laCase: { q, r }, biome };
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

  it("choisit une Case libre que le joueur a découverte : son Biome et sa distance au Foyer, en Cases", async () => {
    const moi = await naitre();
    const { laCase, biome } = await aLEcart(moi.foyer, PORTEE_D_EXPLORATION_CASES - 1);
    await decouvrir(pool, moi.territoireId, [laCase]);
    expect(await destinationDUneCase(pool, moi.territoireId, laCase)).toEqual({
      fiche: expect.objectContaining({ ...laCase, biome, chef: null, distance: PORTEE_D_EXPLORATION_CASES - 1 }),
    });
  });

  it("choisit une Case encore sous le brouillard, sans rien dire d'elle que sa place et sa distance", async () => {
    const moi = await naitre();
    // Au-delà des abords du Foyer, découverts à sa naissance.
    const { laCase } = await aLEcart(moi.foyer, PORTEE_D_EXPLORATION_CASES - 1);
    expect(await destinationDUneCase(pool, moi.territoireId, laCase)).toEqual({ fiche: { ...laCase, inconnue: true, distance: PORTEE_D_EXPLORATION_CASES - 1 } });
  });

  it("choisit encore une Case au bout de la portée d'exploration, à 8 Cases du Foyer, sous le brouillard comme découverte (US-0908)", async () => {
    const moi = await naitre();
    const { laCase, biome } = await aLEcart(moi.foyer, PORTEE_D_EXPLORATION_CASES);
    expect(await destinationDUneCase(pool, moi.territoireId, laCase)).toEqual({ fiche: { ...laCase, inconnue: true, distance: PORTEE_D_EXPLORATION_CASES } });
    await decouvrir(pool, moi.territoireId, [laCase]);
    expect(await destinationDUneCase(pool, moi.territoireId, laCase)).toEqual({ fiche: expect.objectContaining({ ...laCase, biome, distance: PORTEE_D_EXPLORATION_CASES }) });
  });

  it("refuse une Case au-delà de la portée, avec le message, sous le brouillard comme découverte, quel que soit le chemin qui la demande (US-0908)", async () => {
    const moi = await naitre();
    const { laCase } = await aLEcart(moi.foyer, PORTEE_D_EXPLORATION_CASES + 1);
    expect(await destinationDUneCase(pool, moi.territoireId, laCase)).toEqual({ refus: CASE_HORS_DE_PORTEE });
    await decouvrir(pool, moi.territoireId, [laCase]);
    expect(await destinationDUneCase(pool, moi.territoireId, laCase)).toEqual({ refus: CASE_HORS_DE_PORTEE });
    // Le Cœur sauvage, au milieu du Monde : bien plus loin qu'un Foyer né sur la Couronne.
    expect(await destinationDUneCase(pool, moi.territoireId, { q: 0, r: 0 })).toEqual({ refus: CASE_HORS_DE_PORTEE });
  });

  it("refuse le Foyer du joueur, qui appartient à son Territoire", async () => {
    const moi = await naitre();
    expect(await destinationDUneCase(pool, moi.territoireId, moi.foyer)).toEqual({ refus: CASE_D_UN_TERRITOIRE });
  });

  it("refuse une Case du Territoire d'un autre joueur, sous le brouillard comme découverte", async () => {
    const [moi, voisin] = [await naitre(), await naitre()];
    // Deux Foyers voisins se découvrent souvent à la naissance : celui du voisin remis sous le brouillard du joueur.
    await pool.query(
      "delete from case_decouverte d using case_du_monde c where d.territoire_id = $1 and d.case_id = c.id and c.monde_id = $2 and c.q = $3 and c.r = $4",
      [moi.territoireId, genereId, voisin.foyer.q, voisin.foyer.r],
    );
    expect(await ficheDUneCase(pool, moi.territoireId, voisin.foyer)).toMatchObject({ inconnue: true });
    expect(await destinationDUneCase(pool, moi.territoireId, voisin.foyer)).toEqual({ refus: CASE_D_UN_TERRITOIRE });
    await decouvrir(pool, moi.territoireId, [voisin.foyer]);
    expect(await destinationDUneCase(pool, moi.territoireId, voisin.foyer)).toEqual({ refus: CASE_D_UN_TERRITOIRE });
  });

  it("ne lit que le Monde du joueur : une Case qui n'en est pas n'est pas une destination", async () => {
    // Aube n'a en base que sa Couronne : pas de Cœur sauvage, alors que le Monde généré en a un.
    const surAube = await naitre(null);
    expect(await destinationDUneCase(pool, surAube.territoireId, { q: 0, r: 0 })).toBeNull();
    expect(await destinationDUneCase(pool, surAube.territoireId, { q: 1000, r: 0 })).toBeNull();
  });

  it("ne lit rien pour un Territoire qui n'existe pas", async () => {
    expect(await destinationDUneCase(pool, -1, { q: 0, r: 0 })).toBeNull();
  });
});
