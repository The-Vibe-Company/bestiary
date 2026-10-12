import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { entretienDesHabitants } from "./habitants";
import { nourriturePourEncore, type StockDeNourriture } from "./nourriture";
import { PRODUIRE } from "./production";
import { stocksDuTerritoire } from "./stocks";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de la Nourriture (US-0320)";

describe.skipIf(!URL_TEST)("combien de temps tiendra la Nourriture, contre le calcul du jeu (US-0320, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `nourriture-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  const HEURE = 3_600_000;
  const DEBUT = new Date("2026-01-01T00:00:00Z");

  /**
   * Un Territoire tout neuf en prairie, ses `habitants` Habitants, et sa Viande et ses Végétaux réglés à la
   * main (quantité et limite).
   */
  const naitre = async (habitants: number, viande: { quantite: string; limite: string }, vegetaux: { quantite: string; limite: string }) => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Nour", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    for (const [ressource, reglage] of [
      ["viande", viande],
      ["vegetaux", vegetaux],
    ] as const) {
      await pool.query("update stock set quantite = $3, reste = 0, limite = $4, plein_depuis = null where territoire_id = $1 and ressource_id = $2", [
        territoireId,
        ressource,
        reglage.quantite,
        reglage.limite,
      ]);
    }
    await pool.query(
      "with partis as (delete from habitant where territoire_id = $1) insert into habitant (territoire_id, prenom) select $1, 'Essai' from generate_series(1, $2)",
      [territoireId, habitants],
    );
    return territoireId;
  };
  /** Le temps que la page annoncerait, de ses propres lectures : les Stocks et l'Entretien du Territoire. */
  const pourEncore = async (territoireId: number) => {
    const stocks = await stocksDuTerritoire(pool, territoireId);
    const nourriture = (id: string): StockDeNourriture => {
      const s = stocks.find((stock) => stock.id === id)!;
      return { quantite: Number(s.quantite), parHeure: Number(s.parHeure), limite: Number(s.limite) };
    };
    const entretien = await entretienDesHabitants(pool, territoireId);
    return nourriturePourEncore(nourriture("viande"), nourriture("vegetaux"), Number(entretien.parHeure));
  };
  /** Le calcul même du jeu, entre deux instants comptés en heures depuis le début de l'essai. */
  const produire = (territoireId: number, de: number, a: number) =>
    pool.query(PRODUIRE, [territoireId, new Date(DEBUT.getTime() + de * HEURE), new Date(DEBUT.getTime() + a * HEURE)]);
  const nourritureEnStock = async (territoireId: number) =>
    (
      await pool.query<{ id: string; quantite: string }>(
        "select ressource_id as id, quantite::text from stock where territoire_id = $1 and ressource_id in ('viande', 'vegetaux') order by ressource_id",
        [territoireId],
      )
    ).rows.map((s) => Number(s.quantite));

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  /** Le jeu, mis à l'heure une minute avant le temps annoncé, a encore de la Nourriture ; une minute après, plus du tout. */
  const tientJusteLeTempsAnnonce = async (territoireId: number) => {
    const heures = (await pourEncore(territoireId))!;
    await produire(territoireId, 0, heures - 1 / 60);
    const avant = await nourritureEnStock(territoireId);
    expect(avant[0] + avant[1]).toBeGreaterThan(0);
    await produire(territoireId, heures - 1 / 60, heures + 1 / 60);
    expect(await nourritureEnStock(territoireId)).toEqual([0, 0]);
    return heures;
  };

  it("annonce le temps que mettent les deux Stocks à se vider ensemble, quand les deux baissent", async () => {
    // 20 Habitants en prairie : 40 d'Entretien, la Viande à 8 − 20 = −12 par heure, les Végétaux à 14 − 20 = −6.
    const territoireId = await naitre(20, { quantite: "100", limite: "1000" }, { quantite: "100", limite: "1000" });
    // La Viande se vide en 8 h 20 ; les Végétaux, à 50, paient alors 32 et en produisent 14 : 2 h 47 de plus.
    expect(await tientJusteLeTempsAnnonce(territoireId)).toBeCloseTo(100 / 12 + 50 / 18, 9);
  });

  it("annonce le temps du jeu quand un seul Stock baisse : douze Habitants en prairie tiennent 100 h", async () => {
    const territoireId = await naitre(12, { quantite: "100", limite: "1000" }, { quantite: "100", limite: "1000" });
    expect(await tientJusteLeTempsAnnonce(territoireId)).toBeCloseTo(100, 9);
  });

  it("suit le jeu quand le Stock qui monte s'arrête à sa limite, ou part de plus haut qu'elle", async () => {
    const plafonne = await naitre(12, { quantite: "100", limite: "1000" }, { quantite: "990", limite: "1000" });
    expect(await tientJusteLeTempsAnnonce(plafonne)).toBeCloseTo(525, 9);
    const auDessus = await naitre(12, { quantite: "100", limite: "1000" }, { quantite: "2000", limite: "1000" });
    expect(await tientJusteLeTempsAnnonce(auDessus)).toBeCloseTo(568.75, 9);
  });

  it("ne dit rien de plus quand la Nourriture est assurée", async () => {
    const territoireId = await naitre(3, { quantite: "100", limite: "1000" }, { quantite: "100", limite: "1000" });
    expect(await pourEncore(territoireId)).toBeNull();
  });
});
