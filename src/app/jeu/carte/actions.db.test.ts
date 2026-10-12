import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { decouvrir } from "@/monde/brouillard";
import { creerUnMonde } from "@/monde/generer";
import { type Coordonnees, distance } from "@/monde/hex";
import { ZONE_COEUR } from "@/monde/zones";
import { ABORDS_DU_FOYER_CASES } from "@/reglages";
import { nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, URL_TEST } from "@/test/base";

// La garde dit qui est connecté ; l'action lit pour de bon la base de test.
const garde = vi.hoisted(() => ({ exigerCompte: vi.fn() }));
vi.mock("@/comptes/garde", () => garde);
const base = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/db", async (original) => ({ ...(await original<object>()), getPool: () => base.pool }));

import { decouvertesDepuis, ficheDeLaCase } from "./actions";

/** Le Monde généré des essais de la carte (src/monde/carte.db.test.ts), créé une fois pour toutes dans la base de test. */
const MONDE_GENERE = "Essai de la carte (US-0417)";
const GRAINE = 417;

describe.skipIf(!URL_TEST)("les actions de la carte appelées directement, sur base (US-0439, US-0442)", () => {
  let pool: Pool;
  let genereId: number;
  const lancement = `actions-carte-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  const nomUnique = () => nomDEssai("Act", suffixe, numero);
  /** Un chef qui naît dans le Monde généré, connecté pour la garde : son nom, son Territoire et la Case de son Foyer. */
  const naitre = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    const nom = nomUnique();
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, genereId)).toMatchObject({ statut: "enregistre" });
    const { rows } = await pool.query<{ territoire: number; q: number; r: number }>(
      "select t.id as territoire, c.q, c.r from chef ch join territoire t on t.chef_id = ch.id join case_du_monde c on c.id = t.foyer_case_id where ch.compte_id = $1",
      [compte.id],
    );
    return { nom, territoireId: rows[0].territoire, foyer: { q: rows[0].q, r: rows[0].r } };
  };
  /** Le joueur connecté, pour la garde. */
  const connecter = (territoireId: number) => garde.exigerCompte.mockResolvedValue({ id: 1, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId, recitLu: true });
  /** La première Case du Monde généré, par q puis r, qui répond à `condition`, hors des abords du Foyer `foyer`. */
  const cachee = async (foyer: Coordonnees, condition: string) => {
    const { rows } = await pool.query<Coordonnees>(
      `select q, r from case_du_monde where monde_id = $1 and ${condition} and greatest(abs(q - $2), abs(r - $3), abs(q + r - $2 - $3)) > $4 order by q, r limit 1`,
      [genereId, foyer.q, foyer.r, ABORDS_DU_FOYER_CASES],
    );
    return rows[0];
  };

  beforeAll(async () => {
    pool = poolDeTest();
    base.pool = pool;
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

  it("répond « Case inconnue » à qui demande la fiche d'une Case sous son brouillard, sans rien d'autre que sa distance", async () => {
    const moi = await naitre();
    connecter(moi.territoireId);
    for (const c of [await cachee(moi.foyer, "variante_id = 'lac'"), await cachee(moi.foyer, "biome_id = 'jungle'"), { q: 0, r: 0 }]) {
      const fiche = await ficheDeLaCase(c.q, c.r);
      expect(fiche).toEqual({ q: c.q, r: c.r, inconnue: true, distance: distance(c, moi.foyer) });
    }
    // Découverte, elle dit tout.
    const lac = await cachee(moi.foyer, "variante_id = 'lac'");
    await decouvrir(pool, moi.territoireId, [lac]);
    expect(await ficheDeLaCase(lac.q, lac.r)).toMatchObject({ ...lac, biome: "Lac", chef: null });
  });

  it("ne dit pas le nom du chef d'un Foyer sous le brouillard, même demandé directement", async () => {
    const moi = await naitre();
    // Un voisin dont le Foyer est sous le brouillard : chacun naît près du dernier arrivé.
    let voisin = await naitre();
    for (let i = 0; i < 8 && distance(voisin.foyer, moi.foyer) <= ABORDS_DU_FOYER_CASES; i++) voisin = await naitre();
    connecter(moi.territoireId);
    const fiche = await ficheDeLaCase(voisin.foyer.q, voisin.foyer.r);
    expect(fiche).toEqual({ ...voisin.foyer, inconnue: true, distance: distance(voisin.foyer, moi.foyer) });
    expect(JSON.stringify(fiche)).not.toContain(voisin.nom);
  });

  it("rend à la carte ouverte les Cases découvertes à côté depuis sa lecture, et rien tant qu'il n'y en a pas (US-0442)", async () => {
    const moi = await naitre();
    connecter(moi.territoireId);
    const { rows } = await pool.query<{ n: number }>("select count(*)::int as n from case_decouverte where territoire_id = $1", [moi.territoireId]);
    const connues = rows[0].n;
    expect(await decouvertesDepuis(connues)).toBeNull();
    // Une découverte faite à côté, pendant que la carte est ouverte : le milieu du Monde.
    await decouvrir(pool, moi.territoireId, [{ q: 0, r: 0 }]);
    const nouvelles = (await decouvertesDepuis(connues))!;
    expect(nouvelles.cases.q).toHaveLength(connues + 1);
    const milieu = nouvelles.cases.q.findIndex((q, i) => q === 0 && nouvelles.cases.r[i] === 0);
    const { rows: lu } = await pool.query<{ teinte: string }>("select coalesce(variante_id, biome_id) as teinte from case_du_monde where monde_id = $1 and q = 0 and r = 0", [genereId]);
    expect([nouvelles.cases.teinte[milieu], nouvelles.cases.zone[milieu]]).toEqual([lu[0].teinte, ZONE_COEUR]);
    expect(await decouvertesDepuis(connues + 1)).toBeNull();
  });
});
