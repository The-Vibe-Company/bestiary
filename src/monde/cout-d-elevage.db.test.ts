import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { nourritureDuRegime } from "./cout-d-elevage";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du coût d'un Élevage (US-0813)";

describe.skipIf(!URL_TEST)("les Stocks qui paient un Élevage, d'où « Max » et ce qui manque (US-0813, US-0816, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `cout-elevage-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;

  /** Un joueur qui vient de naître : son Territoire. */
  const nouveauTerritoire = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Cout", suffixe, numero), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    return (await territoireDuCompte(pool, compte.id))!;
  };
  /** Fixe la Viande et les Végétaux du Territoire. */
  const nourriture = (territoireId: number, viande: number, vegetaux: number) =>
    pool.query("update stock set quantite = case ressource_id when 'viande' then $2::numeric else $3::numeric end where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')", [
      territoireId,
      viande,
      vegetaux,
    ]);
  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("donne les Stocks qui paient l'Élevage selon le régime, ceux de ce Territoire seulement, tels que la barre du haut les lit (US-0816)", async () => {
    const [t, voisin] = [await nouveauTerritoire(), await nouveauTerritoire()];
    await nourriture(t, 300.5, 200.25);
    await nourriture(voisin, 100_000, 100_000);
    const quantites = async (regime: "carnivore" | "herbivore" | "omnivore") => (await nourritureDuRegime(pool, t, regime)).map((s) => Number(s.quantite));
    // Un omnivore : la Viande et les Végétaux ; un herbivore : les Végétaux ; un carnivore : la Viande.
    expect(await quantites("omnivore")).toEqual([300.5, 200.25]);
    expect(await quantites("herbivore")).toEqual([200.25]);
    expect(await quantites("carnivore")).toEqual([300.5]);
    // De quoi les faire monter comme la barre : la limite, la production et l'Entretien par heure.
    const [viande] = await nourritureDuRegime(pool, t, "carnivore");
    expect(Object.keys(viande).sort()).toEqual(["entretienParHeure", "limite", "parHeure", "quantite"]);
    expect(Number(viande.limite)).toBeGreaterThan(0);
    expect(Number(viande.parHeure)).toBeGreaterThan(0);
  });
});
