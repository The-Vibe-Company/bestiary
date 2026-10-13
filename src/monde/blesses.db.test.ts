import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { GUERISON_DES_BLESSES_HEURES } from "@/reglages";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { blessesAuFoyer } from "./blesses";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai des Blessés au Foyer (US-0952)";

const HEURE_MS = 3_600_000;

describe.skipIf(!URL_TEST)("les Blessés au Foyer, groupe par groupe (US-0952, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `blesses-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Un instant du jeu de référence, et un autre `heures` après lui. */
  const t0 = new Date(Date.UTC(2031, 0, 10, 12));
  const a = (heures: number) => new Date(t0.getTime() + heures * HEURE_MS);
  const guerison = (rentreeA: number) => a(rentreeA + GUERISON_DES_BLESSES_HEURES);

  /** Un joueur qui vient de naître : son Territoire. */
  const naitre = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Ble", suffixe, numero), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    return (await territoireDuCompte(pool, compte.id))!;
  };
  /**
   * Une Expédition du Territoire posée en base, rentrée `rentreeA` heures après t0 (null : encore dehors), avec son escorte :
   * Espèce par Espèce, son nombre de Bêtes, ses perdues et ses Blessées parmi elles.
   */
  const expedition = async (territoireId: number, rentreeA: number | null, escorte: [string, number, number, number][]) => {
    const { rows } = await pool.query<{ id: number }>(
      `insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes, rentree_le)
       select $1, c.id, $3, 30, 60, $4 from case_du_monde c where c.monde_id = $2 and c.chef_id is null order by c.id limit 1 returning id`,
      [territoireId, mondeId, a(-48), rentreeA === null ? null : a(rentreeA)],
    );
    for (const [especeId, nombre, perdues, blessees] of escorte) {
      await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre, perdues, blessees) values ($1, $2, $3, $4, $5)", [
        rows[0].id,
        especeId,
        nombre,
        perdues,
        blessees,
      ]);
    }
  };
  /** Les groupes de Blessés du Territoire à l'instant `instant`, Espèce par Espèce, en objet simple. */
  const lus = async (territoireId: number, instant: Date) => Object.fromEntries(await blessesAuFoyer(pool, territoireId, instant));

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("chaque Expédition rentrée ramène au Foyer un groupe de Blessés par Espèce, qui guérit GUERISON_DES_BLESSES_HEURES après son retour", async () => {
    expect(GUERISON_DES_BLESSES_HEURES).toBeGreaterThan(3);
    const territoireId = await naitre();
    await expedition(territoireId, 0, [
      ["souris", 10, 5, 3],
      ["pigeon", 2, 1, 1],
    ]);
    await expedition(territoireId, 2, [["souris", 4, 2, 1]]);
    expect(await lus(territoireId, a(3))).toEqual({
      pigeon: [{ nombre: 1, gueriLe: guerison(0) }],
      souris: [
        { nombre: 3, gueriLe: guerison(0) },
        { nombre: 1, gueriLe: guerison(2) },
      ],
    });
  });

  it("deux Expéditions rentrées au même instant ne font qu'un groupe ; guéri, un groupe n'est plus là", async () => {
    const territoireId = await naitre();
    await expedition(territoireId, 0, [["souris", 4, 2, 1]]);
    await expedition(territoireId, 0, [["souris", 4, 3, 2]]);
    await expedition(territoireId, 5, [["souris", 4, 1, 1]]);
    expect(await lus(territoireId, a(6))).toEqual({
      souris: [
        { nombre: 3, gueriLe: guerison(0) },
        { nombre: 1, gueriLe: guerison(5) },
      ],
    });
    // À l'instant de sa guérison, le premier groupe n'est plus fait de Blessés.
    expect(await lus(territoireId, guerison(0))).toEqual({ souris: [{ nombre: 1, gueriLe: guerison(5) }] });
    expect(await lus(territoireId, guerison(5))).toEqual({});
  });

  it("ni les Blessés encore dehors avec leur Expédition, ni des pertes sans Blessé, ni ceux d'un autre joueur", async () => {
    const territoireId = await naitre();
    const voisin = await naitre();
    await expedition(territoireId, null, [["souris", 6, 3, 2]]);
    await expedition(territoireId, 1, [["poule", 3, 2, 0]]);
    await expedition(voisin, 1, [["souris", 6, 3, 2]]);
    expect(await lus(territoireId, a(2))).toEqual({});
  });
});
