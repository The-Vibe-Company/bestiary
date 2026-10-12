import type { Pool } from "pg";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { decouvrir } from "@/monde/brouillard";
import type { CarteDuJoueur } from "@/monde/carte";
import { BROUILLARD, couleur } from "@/monde/couleurs-de-la-carte";
import { creerUnMonde } from "@/monde/generer";
import { type Coordonnees, distance } from "@/monde/hex";
import { ABORDS_DU_FOYER_CASES } from "@/reglages";
import { nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, URL_TEST } from "@/test/base";

// La garde dit qui est connecté ; la page lit pour de bon la base de test.
const garde = vi.hoisted(() => ({ exigerCompte: vi.fn() }));
vi.mock("@/comptes/garde", () => garde);
const base = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/db", async (original) => ({ ...(await original<object>()), getPool: () => base.pool }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));
// Ce que la page envoie au navigateur pour la carte : les propriétés de CarteDuJeu, telles quelles.
vi.mock("./CarteDuJeu", () => ({ CarteDuJeu: (proprietes: object) => <canvas data-proprietes={JSON.stringify(proprietes)} /> }));
vi.mock("./Legende", () => ({ Legende: () => <aside /> }));
vi.mock("./Attente", () => ({ Attente: () => <div /> }));

import Carte from "./page";

/** Le Monde généré des essais de la carte (src/monde/carte.db.test.ts), créé une fois pour toutes dans la base de test. */
const MONDE_GENERE = "Essai de la carte (US-0417)";
const GRAINE = 417;

describe.skipIf(!URL_TEST)("ce que la page de la carte envoie au navigateur, sur base (US-0439)", () => {
  let pool: Pool;
  let genereId: number;
  const lancement = `page-carte-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  const nomUnique = () => nomDEssai("Bru", suffixe, numero);
  /** Un chef qui naît dans le Monde généré : son nom, son Territoire et la Case de son Foyer. */
  const naitre = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, genereId)).toMatchObject({ statut: "enregistre" });
    const { rows } = await pool.query<{ territoire: number; q: number; r: number }>(
      "select t.id as territoire, c.q, c.r from chef ch join territoire t on t.chef_id = ch.id join case_du_monde c on c.id = t.foyer_case_id where ch.compte_id = $1",
      [compte.id],
    );
    return { territoireId: rows[0].territoire, foyer: { q: rows[0].q, r: rows[0].r } };
  };
  /** Ce que la page donne à la carte du Territoire, lu dans le HTML qu'elle envoie, et ce HTML. */
  const envoye = async (territoireId: number) => {
    garde.exigerCompte.mockResolvedValue({ id: 1, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId, recitLu: true });
    const html = renderToStaticMarkup(await Carte({ params: Promise.resolve({}), searchParams: Promise.resolve({}) } as PageProps<"/jeu/carte">));
    const brut = html.match(/data-proprietes="([^"]*)"/)![1].replace(/&quot;/g, '"');
    return { brut, proprietes: JSON.parse(brut) as { carte: CarteDuJoueur; fonds: string[] } };
  };
  /** Chaque Case du Monde, avec sa teinte, son nom affiché, et si le Territoire l'a découverte. */
  const casesDuMonde = async (territoireId: number) =>
    (
      await pool.query<Coordonnees & { teinte: string; nom: string; decouverte: boolean }>(
        `select c.q, c.r, coalesce(c.variante_id, c.biome_id) as teinte, coalesce(v.nom, b.nom) as nom,
           exists (select 1 from case_decouverte d where d.territoire_id = $2 and d.case_id = c.id) as decouverte
         from case_du_monde c join biome b on b.id = c.biome_id left join variante_biome v on v.id = c.variante_id
         where c.monde_id = $1 order by c.q, c.r`,
        [genereId, territoireId],
      )
    ).rows;

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

  it("ne donne au navigateur ni le Biome ni la zone d'une Case sous le brouillard : seules les Cases découvertes ont un Biome", async () => {
    const { territoireId } = await naitre();
    const { brut, proprietes } = await envoye(territoireId);
    const { carte, fonds } = proprietes;
    const cases = await casesDuMonde(territoireId);
    // La forme du Monde, toutes ses Cases, pour dessiner la brume.
    expect(carte.cases.q).toEqual(cases.map((c) => c.q));
    expect(carte.cases.r).toEqual(cases.map((c) => c.r));
    // Chaque Case découverte de sa teinte ; chaque autre du brouillard, sans zone.
    expect(carte.cases.teinte.map((t) => carte.teintes[t])).toEqual(cases.map((c) => (c.decouverte ? c.teinte : BROUILLARD)));
    cases.forEach((c, i) => {
      if (!c.decouverte) expect(carte.cases.zone[i]).toBe(0);
    });
    // Les teintes et leurs couleurs : celles des Cases découvertes, et la brume.
    expect([...carte.teintes].sort()).toEqual([...new Set([...cases.filter((c) => c.decouverte).map((c) => c.teinte), BROUILLARD])].sort());
    expect(fonds).toEqual(carte.teintes.map(couleur));
    // Rien, nulle part dans ce qui part, d'un Biome que seul le brouillard couvre : ni son nom en base, ni son nom affiché, ni sa couleur.
    const vues = new Set(cases.filter((c) => c.decouverte).map((c) => c.teinte));
    const cachees = cases.filter((c) => !c.decouverte && !vues.has(c.teinte));
    expect(new Set(cachees.map((c) => c.teinte)).size).toBeGreaterThanOrEqual(5);
    for (const { teinte, nom } of cachees) {
      expect(brut).not.toContain(`"${teinte}"`);
      expect(brut).not.toContain(nom);
      expect(brut).not.toContain(couleur(teinte));
    }
  });

  it("ne donne au navigateur aucun Foyer d'un autre chef sous le brouillard : seulement ceux qu'il a découverts", async () => {
    const moi = await naitre();
    // Un voisin dont le Foyer est sous le brouillard : chacun naît près du dernier arrivé.
    let voisin = await naitre();
    for (let i = 0; i < 8 && distance(voisin.foyer, moi.foyer) <= ABORDS_DU_FOYER_CASES; i++) voisin = await naitre();
    expect(distance(voisin.foyer, moi.foyer)).toBeGreaterThan(ABORDS_DU_FOYER_CASES);
    const avant = (await envoye(moi.territoireId)).proprietes.carte;
    expect(avant.foyers).not.toContainEqual(voisin.foyer);
    for (const f of avant.foyers) expect(distance(f, moi.foyer)).toBeLessThanOrEqual(ABORDS_DU_FOYER_CASES);
    await decouvrir(pool, moi.territoireId, [voisin.foyer]);
    expect((await envoye(moi.territoireId)).proprietes.carte.foyers).toContainEqual(voisin.foyer);
  });
});
