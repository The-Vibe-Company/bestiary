import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { stocksDuTerritoire } from "./stocks";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du surplus (US-0230)";

describe.skipIf(!URL_TEST)("un Stock au-dessus de sa limite (US-0230, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `surplus-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  const HEURE = 3_600_000;

  /** Un Territoire tout neuf, aux Stocks remis à zéro et sans Habitants pour lire la production seule, sans Entretien (US-0316). */
  const naitre = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Surp", suffixe, numero);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query("update stock set quantite = 0, reste = 0, produit_depuis_visite = 0 where territoire_id = $1", [territoireId]);
    await pool.query("delete from habitant where territoire_id = $1", [territoireId]);
    return territoireId;
  };
  /** Ce que le Territoire produit par heure, tel que le calcul l'utilise. */
  const production = async (territoireId: number) =>
    Object.fromEntries((await stocksDuTerritoire(pool, territoireId)).map((s) => [s.id, Number(s.parHeure)]));
  /** Les Stocks en base, en texte exact pour la quantité et le reste. */
  const stocks = async (territoireId: number) =>
    Object.fromEntries(
      (
        await pool.query<{ id: string; quantite: string; limite: string; reste: string; produit: string; plein_depuis: Date | null }>(
          `select ressource_id as id, quantite::text, limite::text, reste::text, produit_depuis_visite::text as produit, plein_depuis
           from stock where territoire_id = $1`,
          [territoireId],
        )
      ).rows.map((s) => [s.id, s]),
    );
  const avancer = async (territoireId: number, heures: number) =>
    rattraper("territoire", territoireId, { pool, jusqua: new Date((await lireMarquePage(pool, "territoire", territoireId)).getTime() + heures * HEURE) });

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("ne produit plus rien et garde exactement tout son surplus, des heures durant ; les autres Stocks produisent", async () => {
    const territoireId = await naitre();
    const parHeure = await production(territoireId);
    expect(parHeure.bois).toBeGreaterThan(0);
    // Le Bois à 800,123456 ; puis sa limite baisse à 500, sous sa quantité.
    await pool.query("update stock set quantite = 800.123456 where territoire_id = $1 and ressource_id = 'bois'", [territoireId]);
    await pool.query("update stock set limite = 500 where territoire_id = $1 and ressource_id = 'bois'", [territoireId]);
    const debut = await lireMarquePage(pool, "territoire", territoireId);

    let heures = 0;
    for (const pas of [1, 4, 3]) {
      await avancer(territoireId, pas);
      heures += pas;
      const { bois, viande } = await stocks(territoireId);
      // Rien de produit, rien de retiré : le surplus reste, au millionième près.
      expect(bois).toMatchObject({ quantite: "800.123456", limite: "500.000000", reste: "0.000000", produit: "0.000000" });
      // Plein depuis le premier calcul, et toujours depuis le même instant.
      expect(bois.plein_depuis).toEqual(debut);
      expect(Number(viande.quantite)).toBe(parHeure.viande * heures);
    }
  });

  it("dès que sa limite remonte au-dessus de lui, reproduit jusqu'à elle et s'y arrête", async () => {
    const territoireId = await naitre();
    const parHeure = await production(territoireId);
    await pool.query("update stock set quantite = 800, limite = 500 where territoire_id = $1 and ressource_id = 'bois'", [territoireId]);
    await avancer(territoireId, 2);
    expect((await stocks(territoireId)).bois).toMatchObject({ quantite: "800.000000", produit: "0.000000" });

    // La limite remonte : deux heures et demie de production de place.
    const limite = 800 + 2.5 * parHeure.bois;
    await pool.query("update stock set limite = $2 where territoire_id = $1 and ressource_id = 'bois'", [territoireId, limite]);
    await avancer(territoireId, 1);
    let { bois } = await stocks(territoireId);
    expect(Number(bois.quantite)).toBe(800 + parHeure.bois);
    expect(bois.plein_depuis).toBeNull();
    await avancer(territoireId, 2);
    ({ bois } = await stocks(territoireId));
    expect(Number(bois.quantite)).toBe(limite);
    expect(Number(bois.produit)).toBe(2.5 * parHeure.bois);
    expect(bois.plein_depuis).not.toBeNull();
    // Une heure de plus : il reste à sa limite ; la Viande, elle, a produit les six heures.
    await avancer(territoireId, 1);
    ({ bois } = await stocks(territoireId));
    expect(Number(bois.quantite)).toBe(limite);
    expect(Number(bois.produit)).toBe(2.5 * parHeure.bois);
    expect(Number((await stocks(territoireId)).viande.quantite)).toBe(parHeure.viande * 6);
  });

  it("dès que sa quantité repasse sous sa limite, reproduit jusqu'à elle et s'y arrête", async () => {
    const territoireId = await naitre();
    const parHeure = await production(territoireId);
    await pool.query("update stock set quantite = 600, limite = 500 where territoire_id = $1 and ressource_id = 'bois'", [territoireId]);
    await avancer(territoireId, 1);
    expect((await stocks(territoireId)).bois.quantite).toBe("600.000000");

    // Le joueur en use : le Stock repasse à une heure et demie de production sous sa limite.
    await pool.query("update stock set quantite = $2 where territoire_id = $1 and ressource_id = 'bois'", [territoireId, 500 - 1.5 * parHeure.bois]);
    await avancer(territoireId, 1);
    expect(Number((await stocks(territoireId)).bois.quantite)).toBe(500 - 0.5 * parHeure.bois);
    await avancer(territoireId, 3);
    const { bois, viande } = await stocks(territoireId);
    expect(bois).toMatchObject({ quantite: "500.000000", reste: "0.000000" });
    expect(Number(bois.produit)).toBe(1.5 * parHeure.bois);
    expect(Number(viande.quantite)).toBe(parHeure.viande * 5);
  });
});
