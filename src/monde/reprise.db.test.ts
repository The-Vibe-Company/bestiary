import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { rattraperLesAbsents } from "@/temps/absents";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { fixerStock } from "./stocks";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de la reprise (US-0229)";

describe.skipIf(!URL_TEST)("la production reprend dès qu'un Stock repasse sous sa limite (US-0229, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `reprise-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  const HEURE = 3_600_000;

  /** Un Territoire tout neuf, ses Stocks remis à zéro et sans Habitants (la production seule, sans Entretien), et l'instant de sa naissance. */
  const naitre = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Rep", suffixe, numero);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query("update stock set quantite = 0 where territoire_id = $1", [territoireId]);
    await pool.query("delete from habitant where territoire_id = $1", [territoireId]);
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  const apres = (ne: Date, heures: number) => new Date(ne.getTime() + heures * HEURE);
  /** Les Stocks tels qu'ils sont en base, en décimaux exacts ; l'instant où chacun s'est rempli, compté depuis la naissance. */
  const comptes = async ({ territoireId, ne }: { territoireId: number; ne: Date }) =>
    (
      await pool.query<{ ressource_id: string; quantite: string; limite: string; reste: string; produit: string; plein_depuis: Date | null }>(
        `select ressource_id, quantite::text, limite::text, reste::text, produit_depuis_visite::text as produit, plein_depuis
         from stock where territoire_id = $1 order by ressource_id`,
        [territoireId],
      )
    ).rows.map(({ plein_depuis, ...stock }) => ({ ...stock, pleinApres: plein_depuis && (plein_depuis.getTime() - ne.getTime()) / HEURE }));
  const bois = async (t: { territoireId: number; ne: Date }) => (await comptes(t)).find((s) => s.ressource_id === "bois")!;
  /** Ce qu'une Case de prairie, Biome du Foyer, produit par heure, tel que la base le tient de donnees/biomes.yaml. */
  const prairie = async (): Promise<Record<string, number>> =>
    Object.fromEntries(
      (await pool.query<{ id: string; par_heure: string }>("select ressource_id as id, par_heure from production_biome where biome_id = 'prairie'")).rows.map(
        (p) => [p.id, Number(p.par_heure)],
      ),
    );

  /** Ce que fait la page de contrôle (fixerUnStock) : le Territoire mis à l'heure, puis le Stock fixé à la main. */
  const fixerDepuisLeControle = async ({ territoireId, ne }: { territoireId: number; ne: Date }, heures: number, ressource: string, quantite: string) => {
    await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, heures) });
    expect(await fixerStock(pool, territoireId, ressource, quantite)).not.toBeNull();
  };

  /**
   * Un Territoire dont le Bois est plein depuis longtemps : à dix de sa limite à la naissance, il s'y
   * arrête au bout de 10 ÷ (Bois par heure) heures, puis reste plein jusqu'à la cinquième heure.
   */
  const boisPlein = async () => {
    const t = await naitre();
    await pool.query("update stock set quantite = limite - 10 where territoire_id = $1 and ressource_id = 'bois'", [t.territoireId]);
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 5) });
    const plein = await bois(t);
    expect(plein).toMatchObject({ quantite: plein.limite, reste: "0.000000", pleinApres: 10 / (await prairie()).bois });
    return { ...t, limite: Number(plein.limite) };
  };

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("un Stock plein, baissé depuis la page de contrôle, produit de nouveau au calcul suivant, sans rien d'autre", async () => {
    const t = await boisPlein();
    const parHeure = (await prairie()).bois;
    await fixerDepuisLeControle(t, 5, "bois", String(t.limite - 100));
    // Plus plein dès la baisse, avant même le calcul suivant.
    expect(await bois(t)).toMatchObject({ quantite: (t.limite - 100).toFixed(6), pleinApres: null });
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 6) });
    // Une heure de production, pas plus : les heures passées plein, avant la baisse, restent perdues.
    expect(await bois(t)).toMatchObject({ quantite: (t.limite - 100 + parHeure).toFixed(6), reste: "0.000000", pleinApres: null });
  });

  it("remonte exactement jusqu'à sa limite et s'y arrête, sans la dépasser, en ne comptant que ce qui est vraiment entré", async () => {
    const t = await boisPlein();
    const parHeure = (await prairie()).bois;
    await fixerDepuisLeControle(t, 5, "bois", String(t.limite - 6.5));
    // Une seconde après la baisse : les millionièmes entiers entrent, le reste exact de la division attend (US-0219).
    await rattraper("territoire", t.territoireId, { pool, jusqua: new Date(apres(t.ne, 5).getTime() + 1000) });
    const total = parHeure * 1_000_000;
    expect(await bois(t)).toMatchObject({
      quantite: (t.limite - 6.5 + Math.floor(total / 3600) / 1_000_000).toFixed(6),
      reste: (total % 3600).toFixed(6),
    });
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 6) });
    expect((await bois(t)).quantite).toBe((t.limite - 6.5 + parHeure).toFixed(6));
    // De quoi le remplir, et bien au-delà : il s'arrête pile à sa limite, au moment exact où il l'atteint.
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 9) });
    const plein = { quantite: t.limite.toFixed(6), reste: "0.000000", produit: (10 + 6.5).toFixed(6), pleinApres: 5 + 6.5 / parHeure };
    expect(await bois(t)).toMatchObject(plein);
    // Plein, il ne gagne plus rien, que la page soit ouverte ou que la tâche planifiée passe.
    await rattraperLesAbsents({ pool, maintenant: apres(t.ne, 12), parmi: { territoire: [t.territoireId] } });
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 15) });
    expect(await bois(t)).toMatchObject(plein);
  });

  it("donne le même résultat en un seul calcul après la baisse qu'en plusieurs, page ouverte ou tâche planifiée", async () => {
    const dUnCoup = await boisPlein();
    const parPas = await boisPlein();
    for (const t of [dUnCoup, parPas]) await fixerDepuisLeControle(t, 5, "bois", String(t.limite - 7.25));
    await rattraper("territoire", dUnCoup.territoireId, { pool, jusqua: apres(dUnCoup.ne, 10) });
    for (const heures of [5.1, 6, 6.5]) await rattraper("territoire", parPas.territoireId, { pool, jusqua: apres(parPas.ne, heures) });
    await rattraperLesAbsents({ pool, maintenant: apres(parPas.ne, 7.5), parmi: { territoire: [parPas.territoireId] } });
    await rattraper("territoire", parPas.territoireId, { pool, jusqua: apres(parPas.ne, 10) });
    expect(await comptes(parPas)).toEqual(await comptes(dUnCoup));
  });

  it("ne touche pas aux autres Stocks : ceux qui montaient continuent, un autre Stock plein le reste", async () => {
    const preparer = async () => {
      const t = await boisPlein();
      // La Pierre aussi est pleine, depuis la naissance.
      await pool.query("update stock set quantite = limite, plein_depuis = $2 where territoire_id = $1 and ressource_id = 'pierre'", [t.territoireId, t.ne]);
      return t;
    };
    const baisse = await preparer();
    const temoin = await preparer();
    await fixerDepuisLeControle(baisse, 5, "bois", String(baisse.limite - 100));
    for (const heures of [6, 9]) {
      for (const t of [baisse, temoin]) await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, heures) });
      const sansLeBois = async (t: typeof baisse) => (await comptes(t)).filter((s) => s.ressource_id !== "bois");
      expect(await sansLeBois(baisse)).toEqual(await sansLeBois(temoin));
    }
    // Au bout du compte : la Viande et les Végétaux ont monté neuf heures pleines, la Pierre est restée pleine depuis la naissance.
    const parHeure = await prairie();
    const apresNeufHeures = Object.fromEntries((await comptes(baisse)).map((s) => [s.ressource_id, s]));
    expect(apresNeufHeures.viande).toMatchObject({ quantite: (parHeure.viande * 9).toFixed(6), pleinApres: null });
    expect(apresNeufHeures.vegetaux).toMatchObject({ quantite: (parHeure.vegetaux * 9).toFixed(6), pleinApres: null });
    expect(apresNeufHeures.pierre).toMatchObject({ quantite: apresNeufHeures.pierre.limite, pleinApres: 0 });
    // Le Bois, lui, est reparti chez le Territoire baissé, et seulement chez lui.
    expect(apresNeufHeures.bois).toMatchObject({ quantite: (baisse.limite - 100 + 4 * parHeure.bois).toFixed(6), pleinApres: null });
    expect(await bois(temoin)).toMatchObject({ quantite: temoin.limite.toFixed(6), pleinApres: 10 / parHeure.bois });
  });
});
