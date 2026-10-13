import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { BETE_PLUS_DISPONIBLE, lancerLExpedition } from "@/expeditions/depart";
import type { Coordonnees } from "@/monde/hex";
import { GUERISON_DES_BLESSES_HEURES } from "@/reglages";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { blessesAuFoyer } from "./blesses";
import { betesDisponibles } from "./effectif";

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

  describe("les Blessés restent au Foyer (US-0953)", () => {
    /** L'effectif d'une Espèce du Territoire : ses mâles et ses femelles. */
    const effectif = (territoireId: number, especeId: string, males: number, femelles: number) =>
      pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', $3), ($1, $2, 'femelle', $4)", [
        territoireId,
        especeId,
        males,
        femelles,
      ]);
    /** Ce que l'écran d'Expédition propose de chaque Espèce à l'instant `instant` : ses disponibles, ses Blessés au Foyer, ses mâles et femelles. */
    const proposees = async (territoireId: number, instant: Date) =>
      Object.fromEntries(
        (await betesDisponibles(pool, territoireId, instant)).map((e) => [e.id, { disponibles: e.disponibles, blesses: e.blesses, males: e.males, femelles: e.femelles }]),
      );

    it("ne propose jamais en escorte un Blessé qui guérit au Foyer ; il reste dans l'effectif, et repart une fois guéri", async () => {
      const territoireId = await naitre();
      // Douze Souris grises : dix parties, cinq perdues, trois Blessées, deux mortes déjà sorties de l'effectif.
      await effectif(territoireId, "souris", 8, 2);
      await expedition(territoireId, 0, [["souris", 10, 5, 3]]);
      expect(await proposees(territoireId, a(1))).toEqual({ souris: { disponibles: 7, blesses: 3, males: 8, femelles: 2 } });
      // Guéries, elles sont de nouveau disponibles.
      expect(await proposees(territoireId, guerison(0))).toEqual({ souris: { disponibles: 10, blesses: undefined, males: 8, femelles: 2 } });
    });

    it("une Espèce dont toutes les Bêtes au Foyer sont blessées reste montrée, sans aucune disponible", async () => {
      const territoireId = await naitre();
      await effectif(territoireId, "pigeon", 1, 1);
      await expedition(territoireId, 0, [["pigeon", 2, 2, 2]]);
      expect(await proposees(territoireId, a(1))).toEqual({ pigeon: { disponibles: 0, blesses: 2, males: 1, femelles: 1 } });
    });

    it("jamais plus de Blessés que de Bêtes au Foyer, ni moins de zéro disponible : un Couple réuni a pu en emmener en Réserve", async () => {
      const territoireId = await naitre();
      // Trois Blessées rentrées, mais deux souris seulement au Foyer depuis.
      await effectif(territoireId, "souris", 1, 1);
      await expedition(territoireId, 0, [["souris", 4, 3, 3]]);
      expect(await proposees(territoireId, a(1))).toEqual({ souris: { disponibles: 0, blesses: 2, males: 1, femelles: 1 } });
    });

    /**
     * Un joueur avec un explorateur et trois souris au Foyer, dont deux Blessées rentrées à t0 : le départ d'un explorateur
     * escorté de `nombre` souris à `instant`, vers une Case libre à 2 Cases du Foyer, comme « Partir » le fait.
     */
    const unDepart = async () => {
      const territoireId = await naitre();
      await pool.query("insert into habitant (territoire_id, prenom, metier) values ($1, 'Essai', 'explorateur')", [territoireId]);
      await effectif(territoireId, "souris", 3, 0);
      await expedition(territoireId, 0, [["souris", 3, 2, 2]]);
      const { rows } = await pool.query<Coordonnees>(
        `select c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
           join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
         where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = 2
         order by c.q, c.r limit 1`,
        [territoireId],
      );
      return (nombre: number, instant: Date) =>
        lancerLExpedition(pool, territoireId, { destination: rows[0], explorateurs: 1, escorte: new Map([["souris", nombre]]), sejourMinutes: 60 }, instant);
    };

    it("un départ qui emmènerait un Blessé est refusé, même envoyé d'un écran d'avant la blessure", async () => {
      const partir = await unDepart();
      expect(await partir(2, a(1))).toEqual({ refus: BETE_PLUS_DISPONIBLE });
      expect(await partir(1, a(1))).toEqual({ expeditionId: expect.any(Number) });
    });

    it("le départ relit les Blessés à son propre instant : une minute avant leur guérison, refusés ; guéris, ils repartent", async () => {
      const partir = await unDepart();
      expect(await partir(3, new Date(guerison(0).getTime() - 60_000))).toEqual({ refus: BETE_PLUS_DISPONIBLE });
      expect(await partir(3, guerison(0))).toEqual({ expeditionId: expect.any(Number) });
    });
  });
});
