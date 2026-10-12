import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { FAMINE_IMMINENTE_MARGE_HEURES } from "@/reglages";
import { rattraperLesAbsents } from "@/temps/absents";
import { definirAncre } from "@/temps/horloge";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { entretienDesHabitants } from "./habitants";
import { nourriturePourEncoreDesStocks } from "./nourriture";
import { famineImminenteDepuis } from "./production";
import { fixerStock, stocksDuTerritoire } from "./stocks";

const HEURE = 3_600_000;
const MINUTE = 60_000;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de la famine imminente (US-0322)";

describe.skipIf(!URL_TEST)("l'avertissement « famine imminente », tenu par le mécanisme du temps (US-0322, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `famine-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;

  /**
   * Un Territoire tout neuf en prairie (Viande +8, Végétaux +14 par heure), ses `habitants` Habitants, sa Viande
   * et ses Végétaux réglés à la main, la limite des Végétaux aussi s'il le faut ; et l'instant de sa naissance,
   * d'où partent les essais.
   */
  const naitre = async (habitants: number, viande: string, vegetaux: string, limiteDesVegetaux: string | null = null) => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Fami", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query(
      `update stock set quantite = case ressource_id when 'viande' then $2::numeric else $3::numeric end, reste = 0, plein_depuis = null,
         limite = case ressource_id when 'vegetaux' then coalesce($4::numeric, limite) else limite end
       where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')`,
      [territoireId, viande, vegetaux, limiteDesVegetaux],
    );
    await pool.query(
      "with partis as (delete from habitant where territoire_id = $1) insert into habitant (territoire_id, prenom) select $1, 'Essai' from generate_series(1, $2)",
      [territoireId, habitants],
    );
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /**
   * Vingt Habitants (40 d'Entretien) : la Viande, à 8 − 20 = −12 par heure, se vide en 6 h ; les Végétaux, à
   * 288 − 6 × 6 = 252, paient alors 32 et en produisent 14 : 14 h de plus. La Nourriture tient 20 h : la famine
   * devient imminente 8 h après la naissance, à la microseconde.
   */
  const vingtHeures = () => naitre(20, "72", "288");
  /** L'instant où la famine est devenue imminente, en microsecondes après `ne` ; null si elle ne l'est pas. */
  const depuis = async (territoireId: number, ne: Date) =>
    (
      await pool.query<{ depuis: string | null }>(
        "select (extract(epoch from famine_imminente_depuis - $2::timestamptz) * 1000000)::bigint::text as depuis from territoire where id = $1",
        [territoireId, ne],
      )
    ).rows[0].depuis;
  const apres = (ne: Date, ms: number) => new Date(ne.getTime() + ms);
  /** 8 heures, en microsecondes. */
  const HUIT_HEURES = String(8 * 3_600_000_000);

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterEach(() => {
    vi.useRealTimers();
    definirAncre(null);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("n'est pas imminente tant que la Nourriture couvre plus de 12 heures", async () => {
    const t = await vingtHeures();
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 8 * HEURE - 1) });
    expect(await depuis(t.territoireId, t.ne)).toBeNull();
    expect(await famineImminenteDepuis(pool, t.territoireId)).toBeNull();
  });

  it("page fermée : au retour, le Territoire sait l'instant exact où le seuil a été franchi pendant l'absence", async () => {
    const t = await vingtHeures();
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 11 * HEURE) });
    expect(await depuis(t.territoireId, t.ne)).toBe(HUIT_HEURES);
    // Depuis 3 h, à l'instant jusqu'où le Territoire est calculé.
    expect(await famineImminenteDepuis(pool, t.territoireId)).toBe(3);
  });

  it("page ouverte : l'instant est le même, quel que soit le découpage du temps", async () => {
    const t = await vingtHeures();
    for (let ms = 17 * MINUTE + 3_123; ms < 11 * HEURE; ms += 17 * MINUTE + 3_123) {
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, ms) });
      expect(await depuis(t.territoireId, t.ne), `${ms / MINUTE} min`).toBe(ms < 8 * HEURE ? null : HUIT_HEURES);
    }
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 11 * HEURE) });
    expect(await famineImminenteDepuis(pool, t.territoireId)).toBe(3);
  }, 60_000);

  it("tâche planifiée passée au milieu : même instant qu'à la page fermée", async () => {
    const t = await vingtHeures();
    for (const heures of [3.5, 8.25, 10]) {
      const passage = await rattraperLesAbsents({ pool, maintenant: apres(t.ne, heures * HEURE), parmi: { territoire: [t.territoireId] } });
      expect(passage, `passage à ${heures} h`).toMatchObject({ rattrapes: 1, echecs: 0 });
    }
    expect(await depuis(t.territoireId, t.ne)).toBe(HUIT_HEURES);
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 11 * HEURE) });
    expect(await depuis(t.territoireId, t.ne)).toBe(HUIT_HEURES);
  });

  it("à ×100, le seuil est franchi à son instant de jeu exact, 288 secondes réelles après la naissance", async () => {
    const t = await vingtHeures();
    const reel = new Date("2026-03-01T12:00:00Z").getTime();
    vi.useFakeTimers({ toFake: ["Date"] });
    definirAncre({ facteur: 100, reel, jeu: t.ne.getTime() });
    vi.setSystemTime(reel + 288_000 - 1);
    await rattraper("territoire", t.territoireId, { pool });
    expect(await depuis(t.territoireId, t.ne)).toBeNull();
    vi.setSystemTime(reel + 288_000 + 1);
    await rattraper("territoire", t.territoireId, { pool });
    expect(await depuis(t.territoireId, t.ne)).toBe(HUIT_HEURES);
  });

  it("un Territoire déjà sous le seuil, sans état, le reçoit à son premier rattrapage : depuis le marque-page d'où il part", async () => {
    // La Viande déjà vide, les Végétaux paient 32 et en produisent 14 : 180 tiennent 10 h.
    const t = await naitre(20, "0", "180");
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, HEURE) });
    expect(await depuis(t.territoireId, t.ne)).toBe("0");
    expect(await famineImminenteDepuis(pool, t.territoireId)).toBe(1);
  });

  it.each([
    { cas: "les deux Stocks se vident au même instant", habitants: 22, viande: "280", vegetaux: "160", limite: null },
    { cas: "les deux Stocks baissent, la Viande se vide d'abord", habitants: 20, viande: "300", vegetaux: "300", limite: null },
    // Douze Habitants : la Viande à −4 par heure, les Végétaux à +2 tant qu'elle paie sa moitié, à −2 ensuite.
    { cas: "le Stock qui monte s'arrête à sa limite", habitants: 12, viande: "20", vegetaux: "25", limite: "30" },
    { cas: "un Stock part de plus haut que sa limite, et y est encore quand l'autre se vide", habitants: 12, viande: "2", vegetaux: "40", limite: "30" },
  ])("suit la règle même du jeu : 12 heures avant le temps que la page annonce ($cas)", async ({ habitants, viande, vegetaux, limite }) => {
    const t = await naitre(habitants, viande, vegetaux, limite);
    const stocks = await stocksDuTerritoire(pool, t.territoireId);
    const heures = nourriturePourEncoreDesStocks(stocks, (await entretienDesHabitants(pool, t.territoireId)).parHeure)!;
    expect(heures).toBeGreaterThan(13);
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, (heures - 12) * HEURE - 1) });
    expect(await depuis(t.territoireId, t.ne)).toBeNull();
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, (heures - 11) * HEURE) });
    // À quelques microsecondes près : la page compte en continu, le jeu au pas d'une microseconde.
    expect(Number(await depuis(t.territoireId, t.ne))).toBeCloseTo((heures - 12) * 3_600_000_000, -1);
  });

  it("garde l'instant du premier franchissement tant que la famine reste imminente", async () => {
    const t = await vingtHeures();
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 9 * HEURE) });
    // Jusque dans la Famine (US-0325, à 20 h), avant le premier départ d'un Habitant (US-0326, à 21 h).
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 20.75 * HEURE) });
    expect(await depuis(t.territoireId, t.ne)).toBe(HUIT_HEURES);
    expect(await famineImminenteDepuis(pool, t.territoireId)).toBe(12.75);
  });

  describe("retirer l'avertissement quand le danger est passé (US-0323)", () => {
    /** Vingt Habitants, la famine imminente depuis 8 h et, à 9 h, la Viande vide et 198 Végétaux : 11 h de Nourriture. */
    const imminenteANeufHeures = async () => {
      const t = await vingtHeures();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 9 * HEURE) });
      expect(await depuis(t.territoireId, t.ne)).toBe(HUIT_HEURES);
      return t;
    };
    /** Comme la page de contrôle : le Territoire mis à l'heure, puis ses Végétaux fixés (à −18 par heure, 18 par heure tenue). */
    const fixerLesVegetaux = async (t: { territoireId: number; ne: Date }, ms: number, quantite: string) => {
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, ms) });
      expect(await fixerStock(pool, t.territoireId, "vegetaux", quantite)).not.toBeNull();
    };

    it("le retire dès que la Nourriture est assurée", async () => {
      const t = await imminenteANeufHeures();
      // Trois Habitants : la production (8 + 14) couvre leur Entretien (6).
      await pool.query("delete from habitant where territoire_id = $1 and id not in (select id from habitant where territoire_id = $1 order by id limit 3)", [
        t.territoireId,
      ]);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 9 * HEURE + 1) });
      expect(await depuis(t.territoireId, t.ne)).toBeNull();
      expect(await famineImminenteDepuis(pool, t.territoireId)).toBeNull();
    });

    it("le garde quand la Nourriture remonte entre 12 et 13 heures, le retire au-delà de 13", async () => {
      expect(FAMINE_IMMINENTE_MARGE_HEURES).toBe(1);
      const t = await imminenteANeufHeures();
      await fixerLesVegetaux(t, 9 * HEURE, "234"); // 13 h tout juste
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 9 * HEURE + 1) });
      expect(await depuis(t.territoireId, t.ne)).toBe(HUIT_HEURES);
      await fixerLesVegetaux(t, 9 * HEURE + MINUTE, "234.018"); // 13 h et 3,6 secondes
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 9 * HEURE + MINUTE + 1) });
      expect(await depuis(t.territoireId, t.ne)).toBeNull();
    });

    it("le note de nouveau au seuil, à son nouvel instant exact, une fois retiré", async () => {
      const t = await imminenteANeufHeures();
      await fixerLesVegetaux(t, 9 * HEURE, "243"); // 13 h 30
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 10 * HEURE) });
      expect(await depuis(t.territoireId, t.ne)).toBeNull();
      // Sous le seuil 1 h 30 après les Végétaux fixés : à 10 h 30.
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 11 * HEURE) });
      expect(await depuis(t.territoireId, t.ne)).toBe(String(10.5 * 3_600_000_000));
      expect(await famineImminenteDepuis(pool, t.territoireId)).toBe(0.5);
    });

    it("ne le note pas entre 12 et 13 heures s'il n'était pas là : la marge ne sert qu'à le garder", async () => {
      const t = await vingtHeures();
      // 7 h 30 après la naissance, la Nourriture tient 12 h 30.
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 7.5 * HEURE) });
      expect(await depuis(t.territoireId, t.ne)).toBeNull();
    });
  });
});
