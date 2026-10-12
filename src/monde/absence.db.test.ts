import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { rattraperLesAbsents } from "@/temps/absents";
import { noterLaPresence, recapitulatifDAbsence } from "./absence";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de l'absence (US-0211)";

describe.skipIf(!URL_TEST)("retrouver ses stocks montés après une absence (US-0211, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `absence-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse : « Abs » suivi d'un « exe » ne naissait pas. */
  const suffixe = suffixeDEssai();
  let numero = 0;
  const HEURE = 3_600_000;

  /** Un Territoire tout neuf, ses Stocks remis à zéro et sans Habitants (la production seule, sans Entretien), et l'instant de sa naissance. */
  const naitre = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Abs", suffixe, numero);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query("update stock set quantite = 0 where territoire_id = $1", [territoireId]);
    await pool.query("delete from habitant where territoire_id = $1", [territoireId]);
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  const stocks = async (territoireId: number) =>
    (await pool.query<{ id: string; quantite: string }>("select ressource_id as id, quantite from stock where territoire_id = $1 order by ressource_id", [territoireId])).rows;
  /** N fois la production horaire d'une Case de prairie, telle que la base la tient. */
  const nFois = async (n: number) =>
    (await pool.query<{ id: string; quantite: string }>("select ressource_id as id, (par_heure * $1)::numeric(24, 6)::text as quantite from production_biome where biome_id = 'prairie' order by ressource_id", [n])).rows;
  const apres = (ne: Date, heures: number) => new Date(ne.getTime() + heures * HEURE);

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("après six heures d'absence, chaque stock a monté exactement de six fois sa production horaire", async () => {
    const { territoireId, ne } = await naitre();
    await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 6) });
    expect(await stocks(territoireId)).toEqual(await nFois(6));
  });

  it("donne le même résultat si la tâche planifiée est passée entre-temps, ou si la page a été ouverte plusieurs fois", async () => {
    const ferme = await naitre();
    const tache = await naitre();
    const ouverte = await naitre();
    await rattraper("territoire", ferme.territoireId, { pool, jusqua: apres(ferme.ne, 6) });
    for (const heures of [1.5, 4]) {
      await rattraperLesAbsents({ pool, maintenant: apres(tache.ne, heures), parmi: { territoire: [tache.territoireId] } });
    }
    await rattraper("territoire", tache.territoireId, { pool, jusqua: apres(tache.ne, 6) });
    for (const heures of [0.5, 1, 2.5, 3, 5.5, 6]) await rattraper("territoire", ouverte.territoireId, { pool, jusqua: apres(ouverte.ne, heures) });
    expect(await stocks(tache.territoireId)).toEqual(await stocks(ferme.territoireId));
    expect(await stocks(ouverte.territoireId)).toEqual(await stocks(ferme.territoireId));
  });

  it("deux onglets qui le mettent à l'heure au même moment ne comptent pas deux fois la production", async () => {
    const { territoireId, ne } = await naitre();
    await Promise.all([1, 2, 3].map(() => rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 2) })));
    expect(await stocks(territoireId)).toEqual(await nFois(2));
  });

  describe("le récapitulatif de ce que le Foyer a produit pendant l'absence (US-0216)", () => {
    it("compte ce qui est produit depuis la dernière visite, et le donne après deux heures d'absence au moins", async () => {
      const { territoireId, ne } = await naitre();
      await noterLaPresence(pool, territoireId, ne);
      await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 1) });
      expect(await recapitulatifDAbsence(pool, territoireId, apres(ne, 1))).toEqual({ gains: [], pleins: [] });
      await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 3) });
      const { gains } = await recapitulatifDAbsence(pool, territoireId, apres(ne, 3));
      const attendus = (await nFois(3)).filter((p) => Number(p.quantite) >= 1);
      expect(gains.map((g) => [g.id, g.gain])).toEqual(
        ["viande", "vegetaux", "bois", "pierre"].flatMap((id) => attendus.filter((a) => a.id === id).map((a) => [a.id, a.quantite])),
      );
    });

    it("repart de zéro quand le joueur revient, et ne dit rien avant sa première visite notée", async () => {
      const { territoireId, ne } = await naitre();
      await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 5) });
      expect(await recapitulatifDAbsence(pool, territoireId, apres(ne, 5))).toEqual({ gains: [], pleins: [] });
      await noterLaPresence(pool, territoireId, apres(ne, 5));
      await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 8) });
      expect((await recapitulatifDAbsence(pool, territoireId, apres(ne, 8))).gains.length).toBeGreaterThan(0);
      await noterLaPresence(pool, territoireId, apres(ne, 8));
      expect(await recapitulatifDAbsence(pool, territoireId, apres(ne, 11))).toEqual({ gains: [], pleins: [] });
    });
  });

  describe("la limite pendant le rattrapage (US-0222)", () => {
    /** Le Bois à dix de sa limite : quatre heures et demie de prairie l'y amènent, au milieu de l'absence. */
    const presDeLaLimite = async () => {
      const t = await naitre();
      await pool.query("update stock set quantite = limite - 10 where territoire_id = $1 and ressource_id = 'bois'", [t.territoireId]);
      return t;
    };
    const comptes = async (territoireId: number) =>
      (await pool.query("select ressource_id, quantite::text, reste::text, produit_depuis_visite::text, (quantite = limite) as plein from stock where territoire_id = $1 order by ressource_id", [territoireId])).rows;

    it("après une longue absence, arrête un Stock à sa limite, et il ne gagne plus rien pour le reste de l'absence", async () => {
      const { territoireId, ne } = await presDeLaLimite();
      await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 10) });
      const bois = (await comptes(territoireId)).find((s) => s.ressource_id === "bois");
      expect(bois).toMatchObject({ plein: true, reste: "0.000000", produit_depuis_visite: "10.000000" });
      const viande = (await comptes(territoireId)).find((s) => s.ressource_id === "viande");
      expect(viande.quantite).toBe((await nFois(10)).find((p) => p.id === "viande")!.quantite);
    });

    it("donne le même résultat page fermée, page ouverte ou après la tâche planifiée", async () => {
      const ferme = await presDeLaLimite();
      const tache = await presDeLaLimite();
      const ouverte = await presDeLaLimite();
      await rattraper("territoire", ferme.territoireId, { pool, jusqua: apres(ferme.ne, 10) });
      for (const heures of [1.5, 4, 7]) await rattraperLesAbsents({ pool, maintenant: apres(tache.ne, heures), parmi: { territoire: [tache.territoireId] } });
      await rattraper("territoire", tache.territoireId, { pool, jusqua: apres(tache.ne, 10) });
      for (const heures of [0.25, 2, 2.5, 4.4, 4.6, 9, 10]) await rattraper("territoire", ouverte.territoireId, { pool, jusqua: apres(ouverte.ne, heures) });
      expect(await comptes(tache.territoireId)).toEqual(await comptes(ferme.territoireId));
      expect(await comptes(ouverte.territoireId)).toEqual(await comptes(ferme.territoireId));
    });
  });

  describe("les Stocks pleins dans le récapitulatif d'absence (US-0228)", () => {
    it("dit qu'un Stock s'est rempli pendant l'absence et depuis quand, et ne compte que ce qui est vraiment entré", async () => {
      const { territoireId, ne } = await naitre();
      await noterLaPresence(pool, territoireId, ne);
      // Dix Bois de place : à 4 par heure de prairie, le Stock est plein après 2 h 30, sur 6 h 30 d'absence.
      const parHeure = Number((await pool.query("select par_heure from production_biome where biome_id = 'prairie' and ressource_id = 'bois'")).rows[0].par_heure);
      await pool.query("update stock set quantite = limite - 10 where territoire_id = $1 and ressource_id = 'bois'", [territoireId]);
      await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 6.5) });
      const recap = await recapitulatifDAbsence(pool, territoireId, apres(ne, 6.5));
      expect(recap.gains.find((g) => g.id === "bois")?.gain).toBe("10.000000");
      const plein = recap.pleins.find((p) => p.id === "bois");
      expect(plein?.nom).toBe("Bois");
      // Plein depuis 6,5 - 10 / parHeure heures.
      const heures = 6.5 - 10 / parHeure;
      const minutes = Math.ceil(heures * 60);
      expect(plein?.depuis).toBe(minutes % 60 === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`);
    });

    it("signale aussi un Stock déjà plein au départ et resté plein", async () => {
      const { territoireId, ne } = await naitre();
      await pool.query("update stock set quantite = limite where territoire_id = $1 and ressource_id = 'pierre'", [territoireId]);
      await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 1) });
      await noterLaPresence(pool, territoireId, apres(ne, 1));
      await rattraper("territoire", territoireId, { pool, jusqua: apres(ne, 4) });
      const recap = await recapitulatifDAbsence(pool, territoireId, apres(ne, 4));
      expect(recap.gains.find((g) => g.id === "pierre")).toBeUndefined();
      expect(recap.pleins.map((p) => [p.id, p.depuis])).toEqual([["pierre", "4 h"]]);
    });
  });
});

