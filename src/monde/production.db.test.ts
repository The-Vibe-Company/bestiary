import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { produire, PRODUIRE } from "./production";
import { stocksDuTerritoire } from "./stocks";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de la production (US-0210)";

describe.skipIf(!URL_TEST)("production continue du Foyer (US-0210, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `production-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  const HEURE = 3_600_000;

  /** Un Territoire tout neuf, aux Stocks remis à zéro et sans Habitants pour lire la production seule, sans Entretien (US-0316). */
  const naitre = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Prod", suffixe, numero);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query("update stock set quantite = 0 where territoire_id = $1", [territoireId]);
    await pool.query("delete from habitant where territoire_id = $1", [territoireId]);
    return territoireId;
  };
  const stocks = async (territoireId: number) =>
    Object.fromEntries(
      (await pool.query<{ id: string; quantite: string }>("select ressource_id as id, quantite from stock where territoire_id = $1", [territoireId])).rows.map(
        (s) => [s.id, Number(s.quantite)],
      ),
    );
  /** Ce qu'une Case de prairie produit par heure, tel que la base le tient de donnees/biomes.yaml. */
  const prairie = async () =>
    Object.fromEntries(
      (await pool.query<{ id: string; par_heure: string }>("select ressource_id as id, par_heure from production_biome where biome_id = 'prairie'")).rows.map(
        (p) => [p.id, Number(p.par_heure)],
      ),
    );
  const dans = async (territoireId: number, ms: number) => new Date((await lireMarquePage(pool, "territoire", territoireId)).getTime() + ms);

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("ajoute la production horaire du Biome du Foyer, au prorata : trente minutes donnent la moitié d'une heure", async () => {
    const territoireId = await naitre();
    await rattraper("territoire", territoireId, { pool, jusqua: await dans(territoireId, HEURE / 2) });
    const parHeure = await prairie();
    expect(await stocks(territoireId)).toEqual({ viande: parHeure.viande / 2, vegetaux: parHeure.vegetaux / 2, bois: parHeure.bois / 2, pierre: parHeure.pierre / 2 });
  });

  it("affiche exactement la production horaire qu'utilise le calcul (US-0212)", async () => {
    const territoireId = await naitre();
    const affichee = Object.fromEntries((await stocksDuTerritoire(pool, territoireId)).map((s) => [s.id, Number(s.parHeure)]));
    await rattraper("territoire", territoireId, { pool, jusqua: await dans(territoireId, HEURE) });
    expect(await stocks(territoireId)).toEqual(affichee);
    expect(affichee).toEqual(await prairie());
  });

  it("donne exactement le même total en mille rattrapages d'une minute qu'en un de mille minutes (US-0219)", async () => {
    const parMinute = await naitre();
    const dUnCoup = await naitre();
    const debut = new Date("2026-01-01T00:00:00Z");
    // Le calcul même du jeu, mille fois de suite côté base : mille minutes une à une.
    await pool.query(
      `do $do$ begin
         for i in 0..999 loop
           execute $calcul$${PRODUIRE}$calcul$
             using ${parMinute}, timestamptz '${debut.toISOString()}' + make_interval(mins => i), timestamptz '${debut.toISOString()}' + make_interval(mins => i + 1);
         end loop;
       end $do$`,
    );
    await pool.query(PRODUIRE, [dUnCoup, debut, new Date(debut.getTime() + 1000 * 60_000)]);
    const comptes = async (id: number) =>
      (await pool.query("select ressource_id, quantite::text, reste::text, produit_depuis_visite::text from stock where territoire_id = $1 order by ressource_id", [id])).rows;
    expect(await comptes(parMinute)).toEqual(await comptes(dUnCoup));
    // 8 Viande par heure pendant mille minutes : 133,333333… ; le Stock garde ses six décimales exactes, le reste attend.
    const viande = (await comptes(dUnCoup)).find((s) => s.ressource_id === "viande");
    const parHeure = (await prairie()).viande;
    expect(viande.quantite).toBe((Math.floor((parHeure * 1000 * 1_000_000) / 60) / 1_000_000).toFixed(6));
  });

  it("arrête un Stock exactement à sa limite, perd ce qui la dépasse, et laisse les autres monter (US-0221)", async () => {
    const territoireId = await naitre();
    const parHeure = await prairie();
    // Le Bois à un rien de sa limite ; une heure de production le ferait déborder.
    await pool.query("update stock set quantite = limite - 1, produit_depuis_visite = 0 where territoire_id = $1 and ressource_id = 'bois'", [territoireId]);
    const limite = Number((await pool.query("select limite from stock where territoire_id = $1 and ressource_id = 'bois'", [territoireId])).rows[0].limite);
    await rattraper("territoire", territoireId, { pool, jusqua: await dans(territoireId, HEURE) });
    const apres = async () =>
      (await pool.query("select ressource_id, quantite::float as q, reste::float as reste, produit_depuis_visite::float as produit from stock where territoire_id = $1", [territoireId])).rows;
    const bois = (await apres()).find((s) => s.ressource_id === "bois");
    expect(bois).toMatchObject({ q: limite, reste: 0, produit: 1 });
    expect((await apres()).find((s) => s.ressource_id === "viande").q).toBe(parHeure.viande);
    // Une heure de plus : le Bois ne bouge plus, la Viande continue.
    await rattraper("territoire", territoireId, { pool, jusqua: await dans(territoireId, HEURE) });
    expect((await apres()).find((s) => s.ressource_id === "bois")).toMatchObject({ q: limite, reste: 0, produit: 1 });
    expect((await apres()).find((s) => s.ressource_id === "viande").q).toBe(parHeure.viande * 2);
  });

  it("donne le même total en dix heures d'un coup qu'en dix rattrapages d'une heure", async () => {
    const dUnCoup = await naitre();
    const parPas = await naitre();
    await rattraper("territoire", dUnCoup, { pool, jusqua: await dans(dUnCoup, 10 * HEURE) });
    for (let i = 0; i < 10; i++) await rattraper("territoire", parPas, { pool, jusqua: await dans(parPas, HEURE) });
    const parHeure = await prairie();
    expect(await stocks(dUnCoup)).toEqual({ viande: parHeure.viande * 10, vegetaux: parHeure.vegetaux * 10, bois: parHeure.bois * 10, pierre: parHeure.pierre * 10 });
    expect(await stocks(parPas)).toEqual(await stocks(dUnCoup));
  });

  it("additionne la production de toutes les Cases du Territoire, et laisse telle quelle une Ressource que rien ne produit", async () => {
    const territoireId = await naitre();
    const client = await pool.connect();
    try {
      await client.query("begin");
      // Une seconde Case, de forêt, rejoint le Territoire ; la prairie cesse de produire de la Pierre.
      await client.query(
        `update case_du_monde set chef_id = (select chef_id from territoire where id = $1)
         where id = (select id from case_du_monde where chef_id is null and biome_id = 'foret' order by id limit 1)`,
        [territoireId],
      );
      await client.query("update production_biome set par_heure = 0 where biome_id in ('prairie', 'foret') and ressource_id = 'pierre'");
      const depuis = new Date("2026-01-01T00:00:00Z");
      await produire(client, territoireId, depuis, new Date(depuis.getTime() + 2 * HEURE));
      const { rows } = await client.query<{ id: string; total: string }>(
        `select s.ressource_id as id, s.quantite as total from stock s where s.territoire_id = $1`,
        [territoireId],
      );
      const { rows: parHeure } = await client.query<{ id: string; somme: string }>(
        "select ressource_id as id, sum(par_heure) as somme from production_biome where biome_id in ('prairie', 'foret') group by ressource_id",
      );
      const attendu = Object.fromEntries(parHeure.map((p) => [p.id, Number(p.somme) * 2]));
      expect(Object.fromEntries(rows.map((r) => [r.id, Number(r.total)]))).toEqual(attendu);
      expect(attendu.pierre).toBe(0);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});
