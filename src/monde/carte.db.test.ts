import { gzipSync } from "node:zlib";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chefDuCompte, enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { ABORDS_DU_FOYER_CASES, CARTE_UTILISABLE_SECONDES } from "@/reglages";
import { nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, URL_TEST } from "@/test/base";
import { casesDecouvertes, decouvrir } from "./brouillard";
import { type CarteDuJoueur, carteDuJoueur, decouvertesDuJoueur } from "./carte";
import { BROUILLARD } from "./couleurs-de-la-carte";
import { creerUnMonde, genererLeMonde } from "./generer";
import { distance } from "./hex";
import { ZONE_COEUR, ZONE_COURONNE } from "./zones";

/** Le Monde généré des essais de ce fichier, créé une fois pour toutes dans la base de test : un Monde ne s'efface pas. */
const MONDE_GENERE = "Essai de la carte (US-0417)";
const GRAINE = 417;

describe.skipIf(!URL_TEST)("la carte du Monde du joueur (US-0417, sur base)", () => {
  let pool: Pool;
  let genereId: number;
  const lancement = `carte-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Un nom de chef propre à ce lancement, pour ne pas croiser les autres essais. */
  const nomUnique = () => nomDEssai("Carte", suffixe, numero);
  /** Un chef qui naît dans le Monde du jeu, ou dans le Monde `mondeId` ; son Territoire et la Case de son Foyer. */
  const naitre = async (mondeId: number | null = null) => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const { rows } = await pool.query<{ territoire: number; q: number; r: number }>(
      "select t.id as territoire, c.q, c.r from chef ch join territoire t on t.chef_id = ch.id join case_du_monde c on c.id = t.foyer_case_id where ch.compte_id = $1",
      [compte.id],
    );
    if (mondeId === null) expect((await chefDuCompte(pool, compte.id))?.territoireId).toBe(rows[0].territoire);
    return { territoireId: rows[0].territoire, foyer: { q: rows[0].q, r: rows[0].r } };
  };
  /** Les Cases d'une carte, chacune « q,r », dans l'ordre. */
  const places = (cases: { q: number[]; r: number[] }) => cases.q.map((q, i) => `${q},${cases.r[i]}`);

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

  it("lit en une fois le Monde du Foyer du joueur : son nom, son Foyer et toutes ses Cases, chacune une fois", async () => {
    const { territoireId, foyer } = await naitre(genereId);
    const carte = await carteDuJoueur(pool, territoireId);
    expect(carte?.monde).toBe(MONDE_GENERE);
    expect(carte?.foyer).toEqual(foyer);
    // Toutes les Cases du Monde généré, sans brouillard pour l'instant : les 10 981, rangées par q puis r.
    const attendues = genererLeMonde({ rayon: 60, anneaux: 6, rayonCoeur: 8, graine: GRAINE }).map((c) => `${c.q},${c.r}`);
    expect(places(carte!.cases)).toEqual(attendues);
    expect(places(carte!.cases)).toContain(`${foyer.q},${foyer.r}`);
  });

  it("donne à chaque Case découverte sa teinte : son Biome, ou pour l'eau sa variante (US-0418) ; aux autres, le brouillard (US-0437)", async () => {
    const { territoireId, foyer } = await naitre(genereId);
    const carte = (await carteDuJoueur(pool, territoireId))!;
    const monde = genererLeMonde({ rayon: 60, anneaux: 6, rayonCoeur: 8, graine: GRAINE });
    const teinte = (c: (typeof monde)[number]) => (c.biome === "eau" ? c.variante : c.biome);
    // Au départ, les abords de son Foyer, lui compris ; tout le reste sous le brouillard.
    const attendues = monde.map((c) => (distance(c, foyer) <= ABORDS_DU_FOYER_CASES ? teinte(c) : BROUILLARD));
    expect(carte.cases.teinte.map((t) => carte.teintes[t])).toEqual(attendues);
    expect(carte.teintes[carte.cases.teinte[places(carte.cases).indexOf(`${foyer.q},${foyer.r}`)]]).toBe("prairie");
    // Chaque teinte une fois : celles des Cases découvertes, et le brouillard.
    expect([...carte.teintes].sort()).toEqual([...new Set(attendues)].sort());
    // Une Case découverte ensuite, loin de son Foyer, montre sa teinte à la lecture suivante. Le Foyer naît au hasard sur
    // la Couronne : la mer est cherchée hors de ses abords, jamais la première venue, qui peut en être.
    const loin = monde.find((c) => c.biome === "eau" && c.variante === "mer" && distance(c, foyer) > ABORDS_DU_FOYER_CASES)!;
    expect(attendues[monde.indexOf(loin)]).toBe(BROUILLARD);
    await decouvrir(pool, territoireId, [loin]);
    const apres = (await carteDuJoueur(pool, territoireId))!;
    expect(apres.cases.teinte.map((t) => apres.teintes[t])).toEqual(monde.map((c, i) => (c === loin ? "mer" : attendues[i])));
  });

  it("donne à chaque Case découverte sa zone : la Couronne, le Cœur sauvage, ou ni l'une ni l'autre (US-0433) ; aucune sous le brouillard (US-0439)", async () => {
    const { territoireId, foyer } = await naitre(genereId);
    const monde = genererLeMonde({ rayon: 60, anneaux: 6, rayonCoeur: 8, graine: GRAINE });
    const zoneDe = (c: (typeof monde)[number]) => (c.couronne ? ZONE_COURONNE : c.coeur ? ZONE_COEUR : 0);
    // Le joueur découvre le Cœur sauvage, et une Case entre les deux, en plus des abords de son Foyer, sur la Couronne.
    const entre = monde.find((c) => !c.couronne && !c.coeur)!;
    await decouvrir(pool, territoireId, [...monde.filter((c) => c.coeur), entre]);
    const carte = (await carteDuJoueur(pool, territoireId))!;
    const decouverte = (c: (typeof monde)[number]) => distance(c, foyer) <= ABORDS_DU_FOYER_CASES || c.coeur || c === entre;
    expect(carte.cases.zone).toEqual(monde.map((c) => (decouverte(c) ? zoneDe(c) : 0)));
    // Les Cases à moins de 8 du milieu ; de la Couronne, seulement ses abords : rien de ce que cache le brouillard.
    expect(carte.cases.zone.filter((z) => z === ZONE_COEUR)).toHaveLength(1 + 3 * 7 * 8);
    expect(carte.cases.zone.filter((z) => z === ZONE_COURONNE)).toHaveLength(monde.filter((c) => c.couronne && distance(c, foyer) <= ABORDS_DU_FOYER_CASES).length);
  });

  it("voyage léger, même pour les 10 981 Cases d'un Monde généré (US-0434)", async () => {
    const { territoireId } = await naitre(genereId);
    const envoyee = JSON.stringify(await carteDuJoueur(pool, territoireId));
    // En colonnes, quatre petits nombres par Case : moins de 12 octets chacune.
    expect(envoyee.length).toBeLessThan(12 * 10_981);
    // Compressée comme le serveur l'envoie, elle passe à 1,6 Mb/s (le profil « Slow 4G » de Chrome, une connexion
    // mobile ordinaire) en moins d'un vingtième du temps dans lequel la carte doit être utilisable.
    expect((gzipSync(envoyee).length * 8) / 1.6e6).toBeLessThan(CARTE_UTILISABLE_SECONDES / 20);
  });

  it("donne les Foyers des autres chefs sur les Cases qu'il a découvertes, et eux seuls, sans le sien (US-0419, US-0439)", async () => {
    const moi = await naitre(genereId);
    // Un voisin dont le Foyer est sous le brouillard du joueur : chacun naît près du dernier arrivé.
    let voisin = await naitre(genereId);
    for (let i = 0; i < 8 && distance(voisin.foyer, moi.foyer) <= ABORDS_DU_FOYER_CASES; i++) voisin = await naitre(genereId);
    expect(distance(voisin.foyer, moi.foyer)).toBeGreaterThan(ABORDS_DU_FOYER_CASES);
    const avant = (await carteDuJoueur(pool, moi.territoireId))!;
    expect(avant.foyers).not.toContainEqual(voisin.foyer);
    expect(avant.foyers).not.toContainEqual(moi.foyer);
    // Découvert, son Foyer se voit.
    await decouvrir(pool, moi.territoireId, [voisin.foyer]);
    const carte = (await carteDuJoueur(pool, moi.territoireId))!;
    expect(carte.foyers).toContainEqual(voisin.foyer);
    expect(carte.foyers).not.toContainEqual(moi.foyer);
    // Tous les autres Foyers de ce Monde sur les Cases qu'il a découvertes, et eux seuls, rangés par q puis r.
    const { rows } = await pool.query<{ q: number; r: number }>(
      `select c.q, c.r from territoire t join case_du_monde c on c.id = t.foyer_case_id
       join case_decouverte d on d.territoire_id = $2 and d.case_id = c.id
       where c.monde_id = $1 and t.id <> $2 order by c.q, c.r`,
      [genereId, moi.territoireId],
    );
    expect(carte.foyers).toEqual(rows);
  });

  it("sur Aube, qui n'a en base que sa Couronne, montre la Couronne seule", async () => {
    const { territoireId, foyer } = await naitre();
    const carte = await carteDuJoueur(pool, territoireId);
    const { rows } = await pool.query<{ nom: string; places: string[] }>(
      `select m.nom, array_agg(c.q || ',' || c.r order by c.q, c.r) as places
       from case_du_monde c join monde m on m.id = c.monde_id where m.id = (select min(id) from monde) group by m.nom`,
    );
    expect(carte?.monde).toBe(rows[0].nom);
    expect(carte?.foyer).toEqual(foyer);
    expect(places(carte!.cases)).toEqual(rows[0].places);
    expect(carte!.cases.q).toHaveLength(2070);
    // US-0418 : sa Couronne a ses Biomes et ses lacs ; US-0437 : on n'en voit que les abords de son Foyer, le reste sous le brouillard.
    expect(carte!.teintes).toContain(BROUILLARD);
    for (const teinte of carte!.teintes) expect([BROUILLARD, "desert", "foret", "lac", "montagne", "prairie", "savane"]).toContain(teinte);
    expect(carte!.cases.teinte).toHaveLength(2070);
    const decouvertes = await casesDecouvertes(pool, territoireId);
    expect(carte!.cases.teinte.filter((t) => carte!.teintes[t] !== BROUILLARD)).toHaveLength(decouvertes.length);
    // US-0433 : toutes de la Couronne ; US-0439 : ce que le joueur en a découvert.
    expect(carte!.cases.zone).toEqual(carte!.cases.teinte.map((t) => (carte!.teintes[t] === BROUILLARD ? 0 : ZONE_COURONNE)));
  });

  it("ne lit rien pour un Territoire qui n'existe pas", async () => {
    expect(await carteDuJoueur(pool, -1)).toBeNull();
    expect(await decouvertesDuJoueur(pool, -1, 0)).toBeNull();
  });

  describe("les Cases découvertes depuis la lecture de la carte (US-0442)", () => {
    /** Le nombre de Cases découvertes d'une carte : celles qui ne sont pas sous le brouillard. */
    const nombre = (carte: CarteDuJoueur) => carte.cases.teinte.filter((t) => carte.teintes[t] !== BROUILLARD).length;
    /** Les Cases découvertes d'une carte, en colonnes, chacune de sa teinte et de sa zone, et les Foyers des autres chefs. */
    const decouvertesDe = (carte: CarteDuJoueur) => {
      const rangs = carte.cases.teinte.flatMap((t, i) => (carte.teintes[t] === BROUILLARD ? [] : [i]));
      const { q, r, teinte, zone } = carte.cases;
      return { cases: { q: rangs.map((i) => q[i]), r: rangs.map((i) => r[i]), teinte: rangs.map((i) => carte.teintes[teinte[i]]), zone: rangs.map((i) => zone[i]) }, foyers: carte.foyers };
    };

    it("ne rend rien tant que le joueur n'a rien découvert de plus que la carte n'en sait, même en redécouvrant ses Cases", async () => {
      const moi = await naitre(genereId);
      const connues = nombre((await carteDuJoueur(pool, moi.territoireId))!);
      expect(connues).toBeGreaterThan(10);
      expect(await decouvertesDuJoueur(pool, moi.territoireId, connues)).toBeNull();
      expect(await decouvrir(pool, moi.territoireId, [moi.foyer])).toBe(0);
      expect(await decouvertesDuJoueur(pool, moi.territoireId, connues)).toBeNull();
    });

    it("rend, après une découverte faite à côté, les Cases découvertes telles que la carte les dessine, et les Foyers parmi elles", async () => {
      const moi = await naitre(genereId);
      let voisin = await naitre(genereId);
      for (let i = 0; i < 8 && distance(voisin.foyer, moi.foyer) <= ABORDS_DU_FOYER_CASES; i++) voisin = await naitre(genereId);
      const connues = nombre((await carteDuJoueur(pool, moi.territoireId))!);
      // Une Expédition, plus tard : le milieu du Monde et le Foyer d'un voisin, sous le brouillard jusque-là.
      expect(await decouvrir(pool, moi.territoireId, [{ q: 0, r: 0 }, voisin.foyer])).toBe(2);
      const decouvertes = await decouvertesDuJoueur(pool, moi.territoireId, connues);
      const carte = (await carteDuJoueur(pool, moi.territoireId))!;
      expect(decouvertes).toEqual(decouvertesDe(carte));
      expect(decouvertes!.cases.q).toHaveLength(connues + 2);
      expect(decouvertes!.foyers).toContainEqual(voisin.foyer);
      expect(decouvertes!.cases.zone[decouvertes!.cases.q.findIndex((q, i) => q === 0 && decouvertes!.cases.r[i] === 0)]).toBe(ZONE_COEUR);
      // Ce nombre-là connu, plus rien de nouveau.
      expect(await decouvertesDuJoueur(pool, moi.territoireId, connues + 2)).toBeNull();
    });
  });
});
