import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { coutDUneBeteElevee, maxAElever } from "./cout-d-elevage";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du coût d'un Élevage (US-0813)";

describe.skipIf(!URL_TEST)("« Max » : les Bêtes que les Stocks permettent de payer (US-0813, sur base)", () => {
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
  /** Le coût d'une Bête élevée de l'Espèce `id`, d'après son Entretien en base. */
  const cout = async (id: string) =>
    coutDUneBeteElevee((await pool.query<{ e: number }>("select entretien_par_heure as e from espece where id = $1", [id])).rows[0].e);

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("paie un omnivore en Viande et en Végétaux, un herbivore en Végétaux seuls, avec les Stocks de ce Territoire seulement", async () => {
    const [t, voisin] = [await nouveauTerritoire(), await nouveauTerritoire()];
    await nourriture(t, 300, 500);
    await nourriture(voisin, 100_000, 100_000);
    const [souris, pigeon] = [await cout("souris"), await cout("pigeon")];
    // La souris (omnivore) mange de tout, le pigeon (herbivore) des Végétaux.
    expect(await maxAElever(pool, t, "souris")).toBe(Math.floor(800 / souris));
    expect(await maxAElever(pool, t, "pigeon")).toBe(Math.floor(500 / pigeon));
    // Des deux côtés, de quoi payer : la souris paie avec les deux Nourritures, le pigeon avec les seuls Végétaux.
    expect(await maxAElever(pool, t, "souris")).toBeGreaterThan(Math.floor(500 / souris));
    expect(await maxAElever(pool, t, "pigeon")).toBeGreaterThan(0);
    expect(await maxAElever(pool, t, "pigeon")).toBeLessThan(Math.floor(800 / pigeon));
  });

  it("ne propose rien quand les Stocks ne paient pas une Bête, ni pour une Espèce inconnue", async () => {
    const t = await nouveauTerritoire();
    await nourriture(t, 0, 0);
    expect(await maxAElever(pool, t, "souris")).toBe(0);
    await nourriture(t, 1000, 1000);
    expect(await maxAElever(pool, t, "espece_inconnue")).toBe(0);
  });
});
