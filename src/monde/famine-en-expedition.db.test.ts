import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { lancerLExpedition } from "@/expeditions/depart";
import { betesSauvagesDesCases } from "@/monde/betes-sauvages";
import { rattraperLesAbsents } from "@/temps/absents";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { EN_EXPEDITION } from "./etat-habitant";
import { DEPART_DE_FAMINE } from "./famine";
import { entretienDesHabitants, habitantsDuTerritoire } from "./habitants";
import type { Coordonnees } from "./hex";
import { nourriturePourEncoreDesStocks } from "./nourriture";
import { stocksDuTerritoire } from "./stocks";

const HEURE = 3_600_000;
const MINUTE = 60_000;
/** Une heure, en microsecondes : la plus petite durée du jeu est la microseconde. */
const HEURE_US = 3_600_000_000;
/** Des heures, en microsecondes, comme les donne la base. */
const us = (heures: number) => String(heures * HEURE_US);

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de la Famine en Expédition (US-0921)";

describe.skipIf(!URL_TEST)("ceux qui sont partis mangent toujours (US-0921, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `partis-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];

  /**
   * Un Territoire tout neuf en prairie (Viande +8, Végétaux +14 par heure), peuplé de `habitants`, du premier arrivé
   * au dernier, avec sa Viande et ses Végétaux réglés à la main ; et l'instant de sa naissance, d'où partent les essais.
   */
  const naitre = async (habitants: { prenom: string; metier: string | null }[], viande: string, vegetaux: string) => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Part", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query(
      `update stock set quantite = case ressource_id when 'viande' then $2::numeric else $3::numeric end, reste = 0, plein_depuis = null
       where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')`,
      [territoireId, viande, vegetaux],
    );
    await pool.query(
      `with partis as (delete from habitant where territoire_id = $1)
       insert into habitant (territoire_id, prenom, metier) select $1, h.prenom, h.metier from unnest($2::text[], $3::text[]) with ordinality as h(prenom, metier, rang) order by h.rang`,
      [territoireId, habitants.map((h) => h.prenom), habitants.map((h) => h.metier)],
    );
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /**
   * Vingt Habitants, du premier arrivé au dernier : H01 à H20 ; cinq sans Métier (H02, H05, H08, H11, H14), les cinq
   * derniers arrivés explorateurs (H16 à H20), les autres chasseurs ou bûcherons.
   */
  const VINGT = Array.from({ length: 20 }, (_, i) => ({
    prenom: `H${String(i + 1).padStart(2, "0")}`,
    metier: i >= 15 ? "explorateur" : i % 3 === 1 ? null : i % 2 === 0 ? "chasseur" : "bucheron",
  }));
  /**
   * Vingt Habitants (40 d'Entretien), comme la Famine les essaie (US-0325) : la Viande, à 8 − 20 = −12 par heure, se
   * vide en 6 h ; les Végétaux, à 288 − 6 × 6 = 252, paient alors 32 et en produisent 14 : 14 h de plus. Tous
   * comptés, la Nourriture tient 20 h tout juste. Sans les cinq explorateurs, elle tiendrait bien plus longtemps.
   */
  const vingtHeures = () => naitre(VINGT, "72", "288");
  const apres = (ne: Date, ms: number) => new Date(ne.getTime() + ms);

  /**
   * Une Case libre du Monde du Territoire, à deux Cases de son Foyer, où ne se montre aucune Bête sauvage plus rare que
   * commune pendant les 40 heures des essais : trop forte pour l'escorte, elle pourrait l'attaquer, et le combat lui
   * coûterait des Bêtes (US-0944) ; une commune suit l'Expédition (US-0935), et n'entrerait dans l'effectif qu'au retour.
   */
  const destination = async (t: { territoireId: number; ne: Date }): Promise<Coordonnees> => {
    const { rows } = await pool.query<Coordonnees & { id: number }>(
      `select c.id, c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = 2
       order by c.q, c.r`,
      [t.territoireId],
    );
    const betes = await betesSauvagesDesCases(pool, rows.map((c) => c.id), t.ne, apres(t.ne, 40 * HEURE));
    const calme = rows.find((c) => betes.get(c.id)!.every((b) => b.rareteId === "commune"));
    if (!calme) throw new Error("Aucune Case à deux Cases du Foyer sans Bête plus rare que commune pendant les essais.");
    return { q: calme.q, r: calme.r };
  };
  /**
   * US-0911 : tous les explorateurs du Territoire partent en Expédition à sa naissance, escortés de deux souris, pour
   * un séjour d'une semaine : tout l'essai se passe pendant l'Expédition.
   */
  const partir = async (t: { territoireId: number; ne: Date }) => {
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, 'souris', 'male', 2)", [t.territoireId]);
    const { rows } = await pool.query<{ n: number }>("select count(*)::int as n from habitant where territoire_id = $1 and metier = 'explorateur'", [
      t.territoireId,
    ]);
    const depart = await lancerLExpedition(
      pool,
      t.territoireId,
      { destination: await destination(t), explorateurs: rows[0].n, escorte: new Map([["souris", 2]]), sejourMinutes: 7 * 24 * 60 },
      t.ne,
    );
    expect(depart).toEqual({ expeditionId: expect.any(Number) });
  };

  /** L'instant où la famine est devenue imminente (US-0322), en microsecondes après `ne` ; null si elle ne l'est pas. */
  const imminente = async (territoireId: number, ne: Date) =>
    (
      await pool.query<{ depuis: string | null }>(
        "select (extract(epoch from famine_imminente_depuis - $2::timestamptz) * 1000000)::bigint::text as depuis from territoire where id = $1",
        [territoireId, ne],
      )
    ).rows[0].depuis;
  /** L'instant où la Famine a commencé (US-0325), en microsecondes après `ne` ; null hors Famine. */
  const famine = async (territoireId: number, ne: Date) =>
    (
      await pool.query<{ debut: string | null }>(
        "select (extract(epoch from famine_depuis - $2::timestamptz) * 1000000)::bigint::text as debut from territoire where id = $1",
        [territoireId, ne],
      )
    ).rows[0].debut;
  /** La Viande et les Végétaux du Territoire, en texte exact. */
  const nourriture = async (territoireId: number) =>
    (
      await pool.query<{ ressource_id: string; quantite: string }>(
        "select ressource_id, quantite::text from stock where territoire_id = $1 and ressource_id in ('viande', 'vegetaux') order by ressource_id",
        [territoireId],
      )
    ).rows;
  /** Les Habitants du Territoire, du premier arrivé au dernier : leur prénom, et s'ils sont en Expédition. */
  const restants = async (territoireId: number) =>
    (
      await pool.query<{ prenom: string; parti: boolean }>(
        "select prenom, expedition_id is not null as parti from habitant where territoire_id = $1 order by id",
        [territoireId],
      )
    ).rows;
  /** Les départs de Famine notés (US-0326), dans leur ordre : le prénom et l'instant, en microsecondes après `ne`. */
  const departs = async (territoireId: number, ne: Date) =>
    (
      await pool.query<{ prenom: string; instant: string }>(
        `select donnees->>'prenom' as prenom, (extract(epoch from survient_le - $2::timestamptz) * 1000000)::bigint::text as instant
         from evenement where element = 'territoire' and element_id = $1 and type = $3 order by survient_le, id`,
        [territoireId, ne, DEPART_DE_FAMINE],
      )
    ).rows;
  /** Les Bêtes du Territoire, Espèce et sexe, et celles de l'escorte de ses Expéditions. */
  const betes = async (territoireId: number) => ({
    effectif: (
      await pool.query("select espece_id, sexe, nombre from effectif where territoire_id = $1 order by espece_id, sexe", [territoireId])
    ).rows,
    escorte: (
      await pool.query(
        "select s.espece_id, s.nombre from expedition_escorte s join expedition x on x.id = s.expedition_id where x.territoire_id = $1 order by s.espece_id",
        [territoireId],
      )
    ).rows,
  });

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterEach(async () => {
    // Chaque essai rend ses Foyers à la Couronne du Monde d'essai, que les autres fichiers remplissent en même temps.
    await pool.query("delete from compte where email = any($1)", [nes.splice(0)]);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  describe("la Nourriture des explorateurs continue d'être prise sur les Stocks", () => {
    it("compte les explorateurs partis dans l'Entretien que la page Habitants détaille", async () => {
      const t = await vingtHeures();
      await partir(t);
      expect((await habitantsDuTerritoire(pool, t.territoireId)).filter((h) => h.etat === EN_EXPEDITION)).toHaveLength(5);
      expect(await entretienDesHabitants(pool, t.territoireId)).toMatchObject({ habitants: 20, parHeure: "40" });
    });

    it("prend leur Entretien sur les Stocks pendant toute l'Expédition, comme celui des Habitants restés au Foyer", async () => {
      const t = await vingtHeures();
      await partir(t);
      // Vingt bouches : la Viande à −12 par heure, les Végétaux à −6. Sans les explorateurs, la Viande ne perdrait que 7.
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 5 * HEURE) });
      expect(await nourriture(t.territoireId)).toEqual([
        { ressource_id: "vegetaux", quantite: "258.000000" },
        { ressource_id: "viande", quantite: "12.000000" },
      ]);
      // La Famine commence à 20 h pile, comme si personne n'était parti.
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 20 * HEURE - 1) });
      expect(await famine(t.territoireId, t.ne)).toBeNull();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 20.5 * HEURE) });
      expect(await famine(t.territoireId, t.ne)).toBe(us(20));
      expect((await restants(t.territoireId)).filter((h) => h.parti)).toHaveLength(5);
    });
  });

  describe("l'avertissement « famine imminente » tient compte des Expéditions en cours", () => {
    it("la barre du haut annonce le temps que tient la Nourriture, explorateurs partis compris", async () => {
      const t = await vingtHeures();
      await partir(t);
      const stocks = await stocksDuTerritoire(pool, t.territoireId);
      expect(nourriturePourEncoreDesStocks(stocks, (await entretienDesHabitants(pool, t.territoireId)).parHeure)).toBe(20);
    });

    it("devient imminente à son instant exact, 12 h avant la Famine, comme si personne n'était parti", async () => {
      const t = await vingtHeures();
      await partir(t);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 8 * HEURE - 1) });
      expect(await imminente(t.territoireId, t.ne)).toBeNull();
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 11 * HEURE) });
      expect(await imminente(t.territoireId, t.ne)).toBe(us(8));
    });
  });

  describe("en Famine pendant une Expédition, seuls les Habitants restés au Foyer s'en vont", () => {
    /** Les neuf départs de Famine attendus, de 21 h à 29 h : les sans Métier d'abord, puis les derniers arrivés restés au Foyer. */
    const NEUF_DEPARTS = ["H14", "H11", "H08", "H05", "H02", "H15", "H13", "H12", "H10"].map((prenom, i) => ({ prenom, instant: us(21 + i) }));

    it("un explorateur absent ne part pas : le suivant resté au Foyer part à sa place", async () => {
      const t = await vingtHeures();
      await partir(t);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 40 * HEURE) });
      // Onze bouches, explorateurs compris, mangent 22 par heure, ce que la prairie produit : la Famine a fini à 29 h.
      expect(await departs(t.territoireId, t.ne)).toEqual(NEUF_DEPARTS);
      expect(await restants(t.territoireId)).toEqual([
        ...["H01", "H03", "H04", "H06", "H07", "H09"].map((prenom) => ({ prenom, parti: false })),
        ...["H16", "H17", "H18", "H19", "H20"].map((prenom) => ({ prenom, parti: true })),
      ]);
      expect(await famine(t.territoireId, t.ne)).toBeNull();
    });

    it("les Bêtes de l'escorte ne retournent pas au sauvage", async () => {
      const t = await vingtHeures();
      await partir(t);
      const avant = await betes(t.territoireId);
      expect(avant.escorte).toEqual([{ espece_id: "souris", nombre: 2 }]);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 40 * HEURE) });
      expect(await departs(t.territoireId, t.ne)).toHaveLength(9);
      expect(await betes(t.territoireId)).toEqual(avant);
    });

    it("garde toujours au moins un Habitant au Territoire : le seul resté au Foyer part, les explorateurs absents restent, et la Famine dure", async () => {
      const t = await naitre(
        [
          { prenom: "Reste", metier: "chasseur" },
          { prenom: "Loin", metier: "explorateur" },
          { prenom: "Ailleurs", metier: "explorateur" },
        ],
        "0",
        "0",
      );
      await partir(t);
      // Sans aucune Case, le Territoire ne produit rien : même un seul Habitant reste en Famine.
      const voisin = await naitre([{ prenom: "Voisin", metier: null }], "100", "100");
      await pool.query(
        "update case_du_monde set chef_id = (select chef_id from territoire where id = $2) where id = (select foyer_case_id from territoire where id = $1)",
        [t.territoireId, voisin.territoireId],
      );
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 10 * HEURE) });
      expect(await departs(t.territoireId, t.ne)).toEqual([{ prenom: "Reste", instant: us(1) }]);
      expect(await restants(t.territoireId)).toEqual([
        { prenom: "Loin", parti: true },
        { prenom: "Ailleurs", parti: true },
      ]);
      expect(await famine(t.territoireId, t.ne)).toBe("0");
      expect(await entretienDesHabitants(pool, t.territoireId)).toMatchObject({ habitants: 2, parHeure: "4" });
    });

    describe("les mêmes départs page ouverte, page fermée ou tâche planifiée", () => {
      /** Tout ce que la Famine touche : les Habitants restants, les départs, les Stocks de Nourriture, l'état retenu et les Bêtes. */
      const etat = async (t: { territoireId: number; ne: Date }) => ({
        restants: await restants(t.territoireId),
        departs: await departs(t.territoireId, t.ne),
        stocks: (
          await pool.query("select ressource_id, quantite::text, reste::text from stock where territoire_id = $1 order by ressource_id", [t.territoireId])
        ).rows,
        famine: await famine(t.territoireId, t.ne),
        imminente: await imminente(t.territoireId, t.ne),
        betes: await betes(t.territoireId),
      });
      const preparer = async () => {
        const t = await vingtHeures();
        await partir(t);
        return t;
      };
      let fermee: Awaited<ReturnType<typeof etat>>;

      beforeAll(async () => {
        const t = await preparer();
        await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 40 * HEURE) });
        fermee = await etat(t);
        expect(fermee.departs).toEqual(NEUF_DEPARTS);
      });

      it("page ouverte : à chaque rattrapage, les départs prévus jusque-là, et la même fin qu'à la page fermée", async () => {
        const t = await preparer();
        for (let ms = 37 * MINUTE + 3_123; ms < 40 * HEURE; ms += 37 * MINUTE + 3_123) {
          await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, ms) });
          expect(await departs(t.territoireId, t.ne), `${(ms / HEURE).toFixed(2)} h`).toEqual(fermee.departs.filter((d) => Number(d.instant) <= ms * 1000));
        }
        await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 40 * HEURE) });
        expect(await etat(t)).toEqual(fermee);
      }, 120_000);

      it("tâche planifiée passée au milieu, dont une à l'instant même d'un départ : même fin qu'à la page fermée", async () => {
        const t = await preparer();
        for (const heures of [7.5, 20.25, 23, 26.75, 33]) {
          const passage = await rattraperLesAbsents({ pool, maintenant: apres(t.ne, heures * HEURE), parmi: { territoire: [t.territoireId] } });
          expect(passage, `passage à ${heures} h`).toMatchObject({ rattrapes: 1, echecs: 0 });
        }
        await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 40 * HEURE) });
        expect(await etat(t)).toEqual(fermee);
      }, 60_000);
    });
  });
});
