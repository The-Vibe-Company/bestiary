import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { rattraperLesAbsents } from "@/temps/absents";
import { definirAncre } from "@/temps/horloge";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { DEPART_DE_FAMINE, departsNonLus, famineDepuis, recitDesDeparts } from "./famine";
import { entretienDesHabitants, habitantsDuTerritoire, nombreDHabitants, renvoyerLHabitant } from "./habitants";
import { ecrireUnRecit, marquerUnRecitLu } from "./recits";
import { fixerStock } from "./stocks";

const HEURE = 3_600_000;
const MINUTE = 60_000;
/** Une heure, en microsecondes : la plus petite durée du jeu est la microseconde. */
const HEURE_US = 3_600_000_000;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de la Famine (US-0325)";

describe.skipIf(!URL_TEST)("la Famine, tenue par le mécanisme du temps (US-0325, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `famine-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];

  /**
   * Un Territoire tout neuf en prairie (Viande +8, Végétaux +14 par heure), ses `habitants` Habitants, sa Viande et
   * ses Végétaux réglés à la main ; et l'instant de sa naissance, d'où partent les essais.
   */
  const naitre = async (habitants: number, viande: string, vegetaux: string) => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Fain", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query(
      `update stock set quantite = case ressource_id when 'viande' then $2::numeric else $3::numeric end, reste = 0, plein_depuis = null
       where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')`,
      [territoireId, viande, vegetaux],
    );
    await pool.query(
      "with partis as (delete from habitant where territoire_id = $1) insert into habitant (territoire_id, prenom) select $1, 'Essai' from generate_series(1, $2)",
      [territoireId, habitants],
    );
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /**
   * Vingt Habitants (40 d'Entretien) : la Viande, à 8 − 20 = −12 par heure, se vide en 6 h ; les Végétaux, à
   * 288 − 6 × 6 = 252, paient alors 32 et en produisent 14 : 14 h de plus. La Nourriture paie l'Entretien pendant
   * 20 h tout juste : la Famine commence 20 h après la naissance, à la microseconde.
   */
  const vingtHeures = () => naitre(20, "72", "288");
  /** L'instant où la Famine a commencé, en microsecondes après `ne` ; null hors Famine. */
  const debut = async (territoireId: number, ne: Date) =>
    (
      await pool.query<{ debut: string | null }>(
        "select (extract(epoch from famine_depuis - $2::timestamptz) * 1000000)::bigint::text as debut from territoire where id = $1",
        [territoireId, ne],
      )
    ).rows[0].debut;
  const apres = (ne: Date, ms: number) => new Date(ne.getTime() + ms);
  /** 20 heures, en microsecondes. */
  const VINGT_HEURES = String(20 * HEURE_US);
  /** US-0326 : les Habitants du Territoire, du premier arrivé au dernier : leur prénom, et leur Métier. */
  const restants = async (territoireId: number) =>
    (
      await pool.query<{ prenom: string; metier: string | null }>("select prenom, metier from habitant where territoire_id = $1 order by id", [
        territoireId,
      ])
    ).rows;
  /** US-0326 : les départs de Famine notés, dans leur ordre : le prénom, le Métier et l'instant, en microsecondes après `ne`. */
  const departs = async (territoireId: number, ne: Date) =>
    (
      await pool.query<{ prenom: string; metier: string | null; instant: string }>(
        `select donnees->>'prenom' as prenom, donnees->>'metier' as metier,
           (extract(epoch from survient_le - $2::timestamptz) * 1000000)::bigint::text as instant
         from evenement where element = 'territoire' and element_id = $1 and type = $3 order by survient_le, id`,
        [territoireId, ne, DEPART_DE_FAMINE],
      )
    ).rows;
  /** Des heures, en microsecondes, comme les donne la base. */
  const us = (heures: number) => String(heures * HEURE_US);
  /**
   * Vingt Habitants, du premier arrivé au dernier : H01 à H20 ; cinq sans Métier (H02, H05, H08, H11, H14), les
   * autres chasseurs ou bûcherons.
   */
  const VINGT = Array.from({ length: 20 }, (_, i) => ({
    prenom: `H${String(i + 1).padStart(2, "0")}`,
    metier: i % 3 === 1 && i < 15 ? null : i % 2 === 0 ? "chasseur" : "bucheron",
  }));
  const peupler = async (territoireId: number, habitants: { prenom: string; metier: string | null }[]) =>
    pool.query(
      `with partis as (delete from habitant where territoire_id = $1)
       insert into habitant (territoire_id, prenom, metier) select $1, h.prenom, h.metier from unnest($2::text[], $3::text[]) with ordinality as h(prenom, metier, rang) order by h.rang`,
      [territoireId, habitants.map((h) => h.prenom), habitants.map((h) => h.metier)],
    );
  /**
   * US-0327 : les Récits de Famine du Territoire, du premier écrit au dernier (pas ceux des Voyageurs qui passent) :
   * titre, texte, instant en microsecondes après `ne`, lu ou non.
   */
  const recitsDeFamine = async (territoireId: number, ne: Date) =>
    (
      await pool.query<{ titre: string; texte: string; instant: string; lu: boolean }>(
        `select r.titre, r.texte, (extract(epoch from r.survenu_le - $2::timestamptz) * 1000000)::bigint::text as instant, r.lu_le is not null as lu
         from recit r
         where r.territoire_id = $1
           and exists (select 1 from evenement e where e.element = 'territoire' and e.element_id = $1 and e.type = $3 and (e.donnees->>'recit')::int = r.id)
         order by r.id`,
        [territoireId, ne, DEPART_DE_FAMINE],
      )
    ).rows;
  /** US-0328 : les Récits de fin de Famine du Territoire, du premier écrit au dernier : texte et instant, en microsecondes après `ne`. */
  const recitsDeFin = async (territoireId: number, ne: Date) =>
    (
      await pool.query<{ texte: string; instant: string }>(
        `select texte, (extract(epoch from survenu_le - $2::timestamptz) * 1000000)::bigint::text as instant
         from recit where territoire_id = $1 and titre = 'Fin de la Famine' order by id`,
        [territoireId, ne],
      )
    ).rows;
  /** US-0327 : le Récit attendu pour des départs notés (departs), d'un Territoire né à `ne`. */
  const recitAttendu = (ne: Date, partis: { prenom: string; metier: string | null; instant: string }[]) => {
    const recit = recitDesDeparts(partis.map((d) => ({ prenom: d.prenom, metier: d.metier, partiLe: new Date(ne.getTime() + Number(d.instant) / 1000) })));
    return { titre: recit.titre, texte: recit.texte, instant: partis.at(-1)!.instant, lu: false };
  };

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterEach(async () => {
    vi.useRealTimers();
    definirAncre(null);
    // Chaque essai rend ses Foyers à la Couronne du Monde d'essai, que les autres fichiers remplissent en même temps.
    await pool.query("delete from compte where email = any($1)", [nes.splice(0)]);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  describe("entrer en Famine (US-0325)", () => {
    it("commence à l'heure exacte où la Nourriture ne suffit plus à payer l'Entretien, pas avant", async () => {
      const t = await vingtHeures();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 20 * HEURE - 1) });
      expect(await debut(t.territoireId, t.ne)).toBeNull();
      expect(await famineDepuis(pool, t.territoireId)).toBeNull();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 20.5 * HEURE) });
      expect(await debut(t.territoireId, t.ne)).toBe(VINGT_HEURES);
      // Depuis 30 min, à l'instant jusqu'où le Territoire est calculé.
      expect(await famineDepuis(pool, t.territoireId)).toBe(0.5);
    });

    it("ne commence que quand la Viande et les Végétaux ensemble ne suffisent plus : la Viande vide, les Végétaux paient tout", async () => {
      const t = await vingtHeures();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 19 * HEURE) });
      const { rows } = await pool.query<{ ressource_id: string; quantite: string }>(
        "select ressource_id, quantite::text from stock where territoire_id = $1 and ressource_id in ('viande', 'vegetaux') order by ressource_id",
        [t.territoireId],
      );
      expect(rows).toEqual([
        { ressource_id: "vegetaux", quantite: "18.000000" },
        { ressource_id: "viande", quantite: "0.000000" },
      ]);
      expect(await debut(t.territoireId, t.ne)).toBeNull();
    });

    it("page ouverte : le même instant, quel que soit le découpage du temps, gardé tant qu'elle dure", async () => {
      const t = await vingtHeures();
      for (let ms = 17 * MINUTE + 3_123; ms < 20.9 * HEURE; ms += 17 * MINUTE + 3_123) {
        await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, ms) });
        expect(await debut(t.territoireId, t.ne), `${ms / MINUTE} min`).toBe(ms < 20 * HEURE ? null : VINGT_HEURES);
      }
    }, 60_000);

    it("tâche planifiée passée au milieu : le même instant qu'à la page fermée", async () => {
      const t = await vingtHeures();
      for (const heures of [3.5, 12.25, 19.99, 20.1]) {
        const passage = await rattraperLesAbsents({ pool, maintenant: apres(t.ne, heures * HEURE), parmi: { territoire: [t.territoireId] } });
        expect(passage, `passage à ${heures} h`).toMatchObject({ rattrapes: 1, echecs: 0 });
      }
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 20.75 * HEURE) });
      expect(await debut(t.territoireId, t.ne)).toBe(VINGT_HEURES);
    });

    it("à ×100, commence à son instant de jeu exact, 720 secondes réelles après la naissance", async () => {
      const t = await vingtHeures();
      const reel = new Date("2026-03-01T12:00:00Z").getTime();
      vi.useFakeTimers({ toFake: ["Date"] });
      definirAncre({ facteur: 100, reel, jeu: t.ne.getTime() });
      vi.setSystemTime(reel + 720_000 - 1);
      await rattraper("territoire", t.territoireId, { pool });
      expect(await debut(t.territoireId, t.ne)).toBeNull();
      vi.setSystemTime(reel + 720_000 + 1);
      await rattraper("territoire", t.territoireId, { pool });
      expect(await debut(t.territoireId, t.ne)).toBe(VINGT_HEURES);
    });

    it("un Territoire déjà en Famine, sans état, la reçoit à son premier rattrapage : depuis le marque-page d'où il part", async () => {
      const t = await naitre(20, "0", "0");
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 30 * MINUTE) });
      expect(await debut(t.territoireId, t.ne)).toBe("0");
      expect(await famineDepuis(pool, t.territoireId)).toBe(0.5);
    });

    it("commence dès le premier pas quand les deux Stocks sont vides, même si l'un produit sa moitié de l'Entretien", async () => {
      // Douze Habitants (24 d'Entretien) : les Végétaux produisent 14, plus que leur moitié, mais la Viande ne donne que
      // ses 8 : 22 en tout, il en manque 2 dès le premier pas.
      const t = await naitre(12, "0", "0");
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 30 * MINUTE) });
      expect(await debut(t.territoireId, t.ne)).toBe("0");
    });

    it("s'arrête dès que la Nourriture paie de nouveau l'Entretien", async () => {
      const t = await vingtHeures();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 20.5 * HEURE) });
      expect(await debut(t.territoireId, t.ne)).toBe(VINGT_HEURES);
      expect(await fixerStock(pool, t.territoireId, "vegetaux", "1000")).not.toBeNull();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 20.5 * HEURE + 1) });
      expect(await debut(t.territoireId, t.ne)).toBeNull();
      expect(await famineDepuis(pool, t.territoireId)).toBeNull();
    });
  });

  describe("voir des Habitants s'en aller (US-0326)", () => {
    it("fait partir un Habitant par heure de Famine, à l'instant exact : une heure pile après son début, puis d'heure en heure", async () => {
      const t = await vingtHeures();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 21 * HEURE - 1) });
      expect(await restants(t.territoireId)).toHaveLength(20);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 21 * HEURE) });
      expect(await restants(t.territoireId)).toHaveLength(19);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 25.5 * HEURE) });
      expect(await restants(t.territoireId)).toHaveLength(15);
      expect((await departs(t.territoireId, t.ne)).map((d) => d.instant)).toEqual([21, 22, 23, 24, 25].map(us));
    });

    it("cesse dès que l'Entretien des Habitants restants est payé : chaque départ le réduit", async () => {
      // Onze Habitants prennent 22 de Nourriture par heure, ce que la prairie produit : le neuvième départ, à 29 h, suffit.
      const t = await vingtHeures();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 40 * HEURE) });
      expect(await restants(t.territoireId)).toHaveLength(11);
      expect((await departs(t.territoireId, t.ne)).map((d) => d.instant)).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29].map(us));
      expect(await debut(t.territoireId, t.ne)).toBeNull();
    });

    it("fait partir les Habitants sans Métier d'abord, puis le dernier arrivé", async () => {
      const t = await vingtHeures();
      await peupler(t.territoireId, VINGT);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 40 * HEURE) });
      expect((await departs(t.territoireId, t.ne)).map((d) => [d.prenom, d.metier])).toEqual([
        ["H14", null],
        ["H11", null],
        ["H08", null],
        ["H05", null],
        ["H02", null],
        ["H20", "Bûcheron"],
        ["H19", "Chasseur"],
        ["H18", "Bûcheron"],
        ["H17", "Chasseur"],
      ]);
      expect((await restants(t.territoireId)).map((h) => h.prenom)).toEqual(["H01", "H03", "H04", "H06", "H07", "H09", "H10", "H12", "H13", "H15", "H16"]);
    });

    it("fait baisser aussitôt le nombre d'Habitants, l'Entretien et les effectifs par Métier", async () => {
      const t = await vingtHeures();
      await peupler(t.territoireId, VINGT);
      const bucherons = async () => (await habitantsDuTerritoire(pool, t.territoireId)).filter((h) => h.metier === "Bûcheron").length;
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 26 * HEURE - 1) });
      expect(await nombreDHabitants(pool, t.territoireId)).toBe(15);
      expect(await bucherons()).toBe(7);
      // À 26 h, H20, bûcheron, s'en va.
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 26 * HEURE) });
      expect(await nombreDHabitants(pool, t.territoireId)).toBe(14);
      expect(await entretienDesHabitants(pool, t.territoireId)).toMatchObject({ habitants: 14, parHeure: "28" });
      expect(await bucherons()).toBe(6);
    });

    it("garde toujours au moins un Habitant : le dernier ne part jamais, même quand la Famine dure", async () => {
      // Sans aucune Case, le Territoire ne produit rien : même un seul Habitant reste en Famine.
      const t = await naitre(3, "0", "0");
      const voisin = await naitre(1, "100", "100");
      await pool.query(
        "update case_du_monde set chef_id = (select chef_id from territoire where id = $2) where id = (select foyer_case_id from territoire where id = $1)",
        [t.territoireId, voisin.territoireId],
      );
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 10 * HEURE) });
      expect(await restants(t.territoireId)).toHaveLength(1);
      expect((await departs(t.territoireId, t.ne)).map((d) => d.instant)).toEqual([1, 2].map(us));
      expect(await debut(t.territoireId, t.ne)).toBe("0");
    });

    it("tombe à la microseconde quand la Famine commence entre deux millisecondes", async () => {
      // Un millionième de Végétaux de plus tient 200 microsecondes de plus, à 18 par heure : la Famine commence à 20 h et 200 µs.
      const t = await naitre(20, "72", "288.000001");
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 21 * HEURE) });
      expect(await debut(t.territoireId, t.ne)).toBe(String(20 * HEURE_US + 200));
      expect(await restants(t.territoireId)).toHaveLength(20);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 22 * HEURE + 1) });
      expect((await departs(t.territoireId, t.ne)).map((d) => d.instant)).toEqual([String(21 * HEURE_US + 200), String(22 * HEURE_US + 200)]);
    });

    describe("les mêmes départs page ouverte, page fermée ou tâche planifiée", () => {
      /** Tout ce que la Famine touche : les Habitants restants, les départs, les Stocks de Nourriture et l'état retenu. */
      const etat = async (t: { territoireId: number; ne: Date }) => ({
        restants: await restants(t.territoireId),
        departs: await departs(t.territoireId, t.ne),
        stocks: (
          await pool.query("select ressource_id, quantite::text, reste::text from stock where territoire_id = $1 order by ressource_id", [t.territoireId])
        ).rows,
        famine: await debut(t.territoireId, t.ne),
        // US-0328 : la fin de la Famine, au même instant, avec la même durée et le même total.
        fin: await recitsDeFin(t.territoireId, t.ne),
      });
      /**
       * US-0327 : un seul Récit pour tous les départs de l'absence, quel que soit le découpage du temps. Il dit les heures
       * de Paris : celui de chaque Territoire se compare à ses propres départs, chacun étant né à son instant.
       */
      const unSeulRecit = async (t: { territoireId: number; ne: Date }) => {
        const partis = await departs(t.territoireId, t.ne);
        expect(await recitsDeFamine(t.territoireId, t.ne)).toEqual(partis.length > 0 ? [recitAttendu(t.ne, partis)] : []);
      };
      let fermee: Awaited<ReturnType<typeof etat>>;
      const preparer = async () => {
        const t = await vingtHeures();
        await peupler(t.territoireId, VINGT);
        return t;
      };

      beforeAll(async () => {
        const t = await preparer();
        await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 40 * HEURE) });
        fermee = await etat(t);
        expect(fermee.departs).toHaveLength(9);
        expect(fermee.fin).toHaveLength(1);
        await unSeulRecit(t);
      });

      it("page ouverte : à chaque rattrapage, les départs prévus jusque-là, dans un seul Récit, et la même fin qu'à la page fermée", async () => {
        const t = await preparer();
        for (let ms = 17 * MINUTE + 3_123; ms < 40 * HEURE; ms += 17 * MINUTE + 3_123) {
          await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, ms) });
          const partis = fermee.departs.filter((d) => Number(d.instant) <= ms * 1000);
          expect(await departs(t.territoireId, t.ne), `${(ms / HEURE).toFixed(2)} h`).toEqual(partis);
          await unSeulRecit(t);
        }
        await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 40 * HEURE) });
        expect(await etat(t)).toEqual(fermee);
        await unSeulRecit(t);
      }, 120_000);

      it("tâche planifiée passée au milieu, dont une à l'instant même d'un départ : même fin qu'à la page fermée", async () => {
        const t = await preparer();
        for (const heures of [12.5, 20.25, 23, 26.75, 33]) {
          const passage = await rattraperLesAbsents({ pool, maintenant: apres(t.ne, heures * HEURE), parmi: { territoire: [t.territoireId] } });
          expect(passage, `passage à ${heures} h`).toMatchObject({ rattrapes: 1, echecs: 0 });
        }
        await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 40 * HEURE) });
        expect(await etat(t)).toEqual(fermee);
        await unSeulRecit(t);
      }, 60_000);
    });

    it("à ×100, une Famine provoquée fait partir exactement le nombre d'Habitants prévu, chacun à son instant", async () => {
      const t = await vingtHeures();
      const reel = new Date("2026-03-01T12:00:00Z").getTime();
      vi.useFakeTimers({ toFake: ["Date"] });
      definirAncre({ facteur: 100, reel, jeu: t.ne.getTime() });
      // Le premier départ, à 21 h de jeu : 756 secondes réelles.
      vi.setSystemTime(reel + 756_000 - 1);
      await rattraper("territoire", t.territoireId, { pool });
      expect(await restants(t.territoireId)).toHaveLength(20);
      vi.setSystemTime(reel + 756_000 + 1);
      await rattraper("territoire", t.territoireId, { pool });
      expect(await restants(t.territoireId)).toHaveLength(19);
      // 40 h de jeu : 1 440 secondes réelles. Neuf départs en tout, aux heures prévues.
      vi.setSystemTime(reel + 1_440_000);
      await rattraper("territoire", t.territoireId, { pool });
      expect(await restants(t.territoireId)).toHaveLength(11);
      expect((await departs(t.territoireId, t.ne)).map((d) => d.instant)).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29].map(us));
    });
  });

  describe("être informé des départs par un Récit (US-0327)", () => {
    it("écrit un Récit non lu : combien d'Habitants sont partis, avec quels Métiers, à quelle heure, et comment sortir de la Famine", async () => {
      const t = await vingtHeures();
      await peupler(t.territoireId, VINGT);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 21 * HEURE) });
      const [premier] = await departs(t.territoireId, t.ne);
      expect(await recitsDeFamine(t.territoireId, t.ne)).toEqual([recitAttendu(t.ne, [premier])]);
      expect((await recitsDeFamine(t.territoireId, t.ne))[0]).toMatchObject({
        titre: "H14 a quitté le Territoire",
        texte: expect.stringContaining("Pour sortir de la Famine : produire plus de Nourriture ou nourrir moins de bouches."),
      });
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 40 * HEURE) });
      const [recit] = await recitsDeFamine(t.territoireId, t.ne);
      expect(recit.titre).toBe("9 Habitants ont quitté le Territoire");
      expect(recit.texte.split("\n").slice(1, 10).map((ligne) => ligne.split(",").slice(0, 2).join(","))).toEqual([
        "H14, sans Métier",
        "H11, sans Métier",
        "H08, sans Métier",
        "H05, sans Métier",
        "H02, sans Métier",
        "H20, Bûcheron",
        "H19, Chasseur",
        "H18, Bûcheron",
        "H17, Chasseur",
      ]);
    });

    it("un Récit lu, puis de nouveaux départs : un nouveau Récit, et le premier reste tel qu'il a été lu", async () => {
      const t = await vingtHeures();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 23 * HEURE) });
      const [lu] = await recitsDeFamine(t.territoireId, t.ne);
      expect(lu.titre).toBe("3 Habitants ont quitté le Territoire");
      await pool.query("update recit set lu_le = $2 where territoire_id = $1", [t.territoireId, apres(t.ne, 23 * HEURE)]);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 25 * HEURE) });
      const partis = await departs(t.territoireId, t.ne);
      expect(await recitsDeFamine(t.territoireId, t.ne)).toEqual([{ ...lu, lu: true }, recitAttendu(t.ne, partis.slice(3))]);
    });

    it("ne reprend qu'un Récit de Famine : un autre Récit à lire reste tel quel", async () => {
      const t = await vingtHeures();
      await ecrireUnRecit(pool, t.territoireId, { titre: "Un autre Récit", texte: "Rien à voir.", survenuLe: apres(t.ne, 20 * HEURE) });
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 22 * HEURE) });
      expect(await recitsDeFamine(t.territoireId, t.ne)).toEqual([recitAttendu(t.ne, await departs(t.territoireId, t.ne))]);
      const { rows } = await pool.query("select titre, texte from recit where territoire_id = $1 and titre = 'Un autre Récit'", [t.territoireId]);
      expect(rows).toEqual([{ titre: "Un autre Récit", texte: "Rien à voir." }]);
    });

    it("signale au retour les départs que le joueur n'a pas encore lus, et plus rien une fois leur Récit lu", async () => {
      const t = await vingtHeures();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 20.5 * HEURE) });
      expect(await departsNonLus(pool, t.territoireId)).toBeNull();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 40 * HEURE) });
      const nonLus = await departsNonLus(pool, t.territoireId);
      expect(nonLus).toMatchObject({ habitants: 9 });
      expect(await marquerUnRecitLu(pool, t.territoireId, nonLus!.recitId, apres(t.ne, 40 * HEURE))).toBe(true);
      expect(await departsNonLus(pool, t.territoireId)).toBeNull();
    });
  });

  describe("sortir de la Famine (US-0328)", () => {
    it("finit au départ qui ramène l'Entretien sous la production : plus de départ ensuite, et un Récit dit sa durée et le total des départs", async () => {
      const t = await vingtHeures();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 40 * HEURE) });
      expect(await debut(t.territoireId, t.ne)).toBeNull();
      expect(await departs(t.territoireId, t.ne)).toHaveLength(9);
      expect(await recitsDeFin(t.territoireId, t.ne)).toEqual([
        { texte: "La Nourriture paie de nouveau l'Entretien. La Famine a duré 9 h ; 9 Habitants ont quitté le Territoire.", instant: us(29) },
      ]);
    });

    it("finit à l'instant même de ce départ, quand le temps s'arrête juste dessus", async () => {
      const t = await vingtHeures();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 29 * HEURE) });
      expect(await restants(t.territoireId)).toHaveLength(11);
      expect(await debut(t.territoireId, t.ne)).toBeNull();
      expect(await famineDepuis(pool, t.territoireId)).toBeNull();
      expect((await recitsDeFin(t.territoireId, t.ne)).map((r) => r.instant)).toEqual([us(29)]);
    });

    it("finit dès que de la Nourriture est ajoutée : les départs cessent aussitôt", async () => {
      const t = await vingtHeures();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 22.5 * HEURE) });
      expect(await fixerStock(pool, t.territoireId, "vegetaux", "1000")).not.toBeNull();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 40 * HEURE) });
      expect((await departs(t.territoireId, t.ne)).map((d) => d.instant)).toEqual([us(21), us(22)]);
      expect(await recitsDeFin(t.territoireId, t.ne)).toEqual([
        { texte: "La Nourriture paie de nouveau l'Entretien. La Famine a duré 2 h 30 ; 2 Habitants ont quitté le Territoire.", instant: us(22.5) },
      ]);
    });

    it("dit aussi la fin d'une Famine sans aucun départ", async () => {
      const t = await vingtHeures();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 20.5 * HEURE) });
      expect(await fixerStock(pool, t.territoireId, "vegetaux", "1000")).not.toBeNull();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 30 * HEURE) });
      expect(await recitsDeFin(t.territoireId, t.ne)).toEqual([
        { texte: "La Nourriture paie de nouveau l'Entretien. La Famine a duré 30 min ; aucun Habitant n'a quitté le Territoire.", instant: us(20.5) },
      ]);
    });

    it("ne fait pas revenir les Habitants partis", async () => {
      const t = await vingtHeures();
      await peupler(t.territoireId, VINGT);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 30 * HEURE) });
      const apresLaFamine = await restants(t.territoireId);
      expect(apresLaFamine).toHaveLength(11);
      // De quoi nourrir tout le monde longtemps : rien ne change pour autant.
      expect(await fixerStock(pool, t.territoireId, "viande", "1000")).not.toBeNull();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 60 * HEURE) });
      expect(await restants(t.territoireId)).toEqual(apresLaFamine);
      expect(apresLaFamine.map((h) => h.prenom)).not.toEqual(expect.arrayContaining(["H14", "H17"]));
    });

    it("compte les départs de chaque Famine à part : une nouvelle Famine repart de zéro", async () => {
      const t = await vingtHeures();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 22.5 * HEURE) });
      expect(await fixerStock(pool, t.territoireId, "vegetaux", "36")).not.toBeNull();
      // 18 Habitants (36 d'Entretien), la Viande vide : les Végétaux paient 28 et en produisent 14, 36 tiennent 2 h 34.
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 40 * HEURE) });
      expect((await recitsDeFin(t.territoireId, t.ne)).map((r) => r.texte)).toEqual([
        "La Nourriture paie de nouveau l'Entretien. La Famine a duré 2 h 30 ; 2 Habitants ont quitté le Territoire.",
        "La Nourriture paie de nouveau l'Entretien. La Famine a duré 7 h ; 7 Habitants ont quitté le Territoire.",
      ]);
    });
  });

  describe("renvoyer un Habitant pendant une Famine (US-0330)", () => {
    /** L'identifiant de l'Habitant du Territoire qui porte ce prénom. */
    const habitant = async (territoireId: number, prenom: string) =>
      (await pool.query<{ id: number }>("select id from habitant where territoire_id = $1 and prenom = $2", [territoireId, prenom])).rows[0].id;

    it("n'est pas un départ de Famine : son Récit reste à part, les départs de Famine écrivent le leur, et le retour ne compte qu'eux", async () => {
      const t = await vingtHeures();
      await peupler(t.territoireId, VINGT);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 20.5 * HEURE) });
      // H20, bûcheron, renvoyé par le chef au milieu de la Famine : dix-neuf Habitants ne sont toujours pas nourris.
      expect(await renvoyerLHabitant(pool, t.territoireId, await habitant(t.territoireId, "H20"), apres(t.ne, 20.5 * HEURE))).toBe(true);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 22 * HEURE) });
      const partis = await departs(t.territoireId, t.ne);
      expect(partis.map((d) => [d.prenom, d.instant])).toEqual([
        ["H14", us(21)],
        ["H11", us(22)],
      ]);
      expect(await recitsDeFamine(t.territoireId, t.ne)).toEqual([recitAttendu(t.ne, partis)]);
      const { rows } = await pool.query("select titre, texte from recit where territoire_id = $1 and titre = 'H20 a quitté le Territoire'", [t.territoireId]);
      expect(rows).toEqual([{ titre: "H20 a quitté le Territoire", texte: "H20, Bûcheron, a quitté le Territoire à la demande du chef." }]);
      expect(await departsNonLus(pool, t.territoireId)).toMatchObject({ habitants: 2 });
    });

    it("renvoyer assez d'Habitants finit la Famine aussitôt : plus aucun départ, et la fin ne compte que les départs de Famine", async () => {
      const t = await vingtHeures();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 21.5 * HEURE) });
      expect(await restants(t.territoireId)).toHaveLength(19);
      // Le chef renvoie huit Habitants : les onze qui restent mangent 22 par heure, ce que la prairie produit.
      const { rows } = await pool.query<{ id: number }>("select id from habitant where territoire_id = $1 order by id desc limit 8", [t.territoireId]);
      for (const { id } of rows) expect(await renvoyerLHabitant(pool, t.territoireId, id, apres(t.ne, 21.5 * HEURE))).toBe(true);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 30 * HEURE) });
      expect(await restants(t.territoireId)).toHaveLength(11);
      expect((await departs(t.territoireId, t.ne)).map((d) => d.instant)).toEqual([us(21)]);
      expect(await debut(t.territoireId, t.ne)).toBeNull();
      expect(await recitsDeFin(t.territoireId, t.ne)).toEqual([
        { texte: "La Nourriture paie de nouveau l'Entretien. La Famine a duré 1 h 30 ; 1 Habitant a quitté le Territoire.", instant: us(21.5) },
      ]);
    });
  });
});
