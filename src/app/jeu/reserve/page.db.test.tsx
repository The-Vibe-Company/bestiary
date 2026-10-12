import type { Pool } from "pg";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { reunirLesCouples } from "@/monde/couple";
import { lireMarquePage } from "@/temps/marque-page";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";

// La garde dit qui est connecté ; la page lit pour de bon la base de test.
const garde = vi.hoisted(() => ({ exigerCompte: vi.fn() }));
vi.mock("@/comptes/garde", () => garde);
const base = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/db", async (original) => ({ ...(await original<object>()), getPool: () => base.pool }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));

import Reserve from "./page";

const HEURE = 3_600_000;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de la Réserve (US-0802)";

describe.skipIf(!URL_TEST)("voir ses Couples réunis, sur base (US-0802)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `reserve-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];

  /** Un chef qui vient de naître dans le Monde d'essai : son Territoire et l'instant de sa naissance. */
  const naitre = async () => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Rsv", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /**
   * Réunit au Territoire, une heure après l'autre, le Couple de chaque Espèce `especes` : un mâle et une femelle entrent
   * dans l'effectif, puis le Couple se forme comme au retour d'une Expédition (US-0956).
   */
  const reunir = async (t: { territoireId: number; ne: Date }, especes: string[]) => {
    const client = await pool.connect();
    try {
      for (const [i, especeId] of especes.entries()) {
        await client.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 1), ($1, $2, 'femelle', 1)", [t.territoireId, especeId]);
        expect(await reunirLesCouples(client, t.territoireId, new Date(t.ne.getTime() + (i + 1) * HEURE))).toEqual([especeId]);
      }
    } finally {
      client.release();
    }
  };
  /** La Réserve telle que la page la montre au joueur du Territoire : chaque Couple, ses deux Bêtes et son texte. */
  const montree = async (territoireId: number) => {
    garde.exigerCompte.mockResolvedValue({ id: 1, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId, recitLu: true });
    const html = renderToStaticMarkup(await Reserve());
    return [...(html.match(/<ul[^>]*>(.*?)<\/ul>/)?.[1] ?? "").matchAll(/<li[^>]*>(.*?)<\/li>/g)].map(([, li]) => ({
      betes: [...li.matchAll(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"/g)].map(([, alt, src]) => `${alt} ${decodeURIComponent(src).match(/especes\/[a-z_]+\.webp/)?.[0]}`),
      texte: li
        .replace(/<[^>]+>/g, "|")
        .split("|")
        .filter((m) => m.trim())
        .join(" · "),
    }));
  };

  beforeAll(async () => {
    pool = poolDeTest();
    base.pool = pool;
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterEach(async () => {
    // Chaque essai rend ses Foyers à la Couronne du Monde d'essai.
    await pool.query("delete from compte where email = any($1)", [nes.splice(0)]);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("montre chaque Couple réuni avec l'illustration de son Espèce, deux fois, son nom et sa Rareté, du premier réuni au dernier", async () => {
    const t = await naitre();
    await reunir(t, ["poule", "souris"]);

    expect(await montree(t.territoireId)).toEqual([
      { betes: ["Poule especes/poule.webp", "Poule especes/poule.webp"], texte: "Poule · Commune" },
      { betes: ["Souris grise especes/souris.webp", "Souris grise especes/souris.webp"], texte: "Souris grise · Commune" },
    ]);
  });

  it("ne montre jamais à un joueur la Réserve d'un autre joueur", async () => {
    const [a, b, sansCouple] = [await naitre(), await naitre(), await naitre()];
    await reunir(a, ["poule"]);
    await reunir(b, ["pigeon", "souris"]);

    expect((await montree(a.territoireId)).map((c) => c.texte)).toEqual(["Poule · Commune"]);
    expect((await montree(b.territoireId)).map((c) => c.texte)).toEqual(["Pigeon biset · Commune", "Souris grise · Commune"]);
    expect(await montree(sansCouple.territoireId)).toEqual([]);
  });
});
