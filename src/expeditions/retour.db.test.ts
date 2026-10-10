import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { betesSauvagesDesCases } from "@/monde/betes-sauvages";
import { betesDisponibles } from "@/monde/effectif";
import { explorateursDuTerritoire, prochainRetourDUnExplorateur } from "@/monde/explorateurs";
import { DEPART_DE_FAMINE } from "@/monde/famine";
import { enregistrerLeMetier, habitantsDuTerritoire } from "@/monde/habitants";
import type { Coordonnees } from "@/monde/hex";
import { PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE } from "@/reglages";
import { rattraperLesAbsents } from "@/temps/absents";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, poolDeTest, preparerMondeDeTest, territoireDuCompte, URL_TEST } from "@/test/base";
import { lancerLExpedition } from "./depart";
import { expeditionsEnCours } from "./en-cours";
import { retourDUneExpedition } from "./phase";
import { expeditionsPresentesSurLaCase } from "./presence";
import { RETOUR_EXPEDITION } from "./retour";

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
/** L'aller vers une Case à 2 Cases du Foyer, au pas des explorateurs (US-0909), en minutes de jeu. */
const ALLER = 2 * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE;
/** Des heures, en microsecondes après la naissance, comme les donne la base. */
const us = (heures: number) => String(heures * 3_600_000_000);

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du retour au Foyer (US-0916)";

describe.skipIf(!URL_TEST)("le retour au Foyer (US-0916, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `retour-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];

  /**
   * Un chef qui vient de naître dans le Monde d'essai, avec ses Habitants, du premier arrivé au dernier, à la place des
   * siens, et des Stocks pleins : son Territoire et l'instant de sa naissance, d'où partent les essais.
   */
  const naitre = async (habitants: { prenom: string; metier: string | null }[]) => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = `Ret${lancement.slice(-5).replace(/[^a-z]/g, "x")}${"abcdefghij"[Math.floor(n / 10) % 10]}${"abcdefghij"[n % 10]}`;
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query(
      `with partis as (delete from habitant where territoire_id = $1)
       insert into habitant (territoire_id, prenom, metier) select $1, h.prenom, h.metier from unnest($2::text[], $3::text[]) with ordinality as h(prenom, metier, rang) order by h.rang`,
      [territoireId, habitants.map((h) => h.prenom), habitants.map((h) => h.metier)],
    );
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /**
   * Trois explorateurs, Joran, Ilda et Ines, et trois souris dans l'effectif, toutes mâles : un mâle et une femelle au
   * Foyer réuniraient leur Couple au retour (US-0956), et quitteraient l'effectif.
   */
  const naitreAvecTroisExplorateurs = async () => {
    const t = await naitre(["Joran", "Ilda", "Ines"].map((prenom) => ({ prenom, metier: "explorateur" })));
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, 'souris', 'male', 3)", [
      t.territoireId,
    ]);
    return t;
  };
  /**
   * La `rang`-ième Case libre du Monde du Territoire, à `ecart` Cases de son Foyer, où aucune Bête ne se montre de `de` à
   * `a`, ni Bête sauvage ni Bête de naissance : US-0938, une Bête qui suivrait l'Expédition entrerait dans l'effectif à
   * son retour, et ces essais ne comptent que les Bêtes de l'escorte.
   */
  const destination = async (territoireId: number, ecart: number, rang: number, de: Date, a: Date): Promise<Coordonnees> => {
    const { rows } = await pool.query<Coordonnees & { id: number }>(
      `select c.id, c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = $2
         and not exists (select 1 from bete_de_naissance n where n.territoire_id = t.id and n.case_id = c.id)
       order by c.q, c.r`,
      [territoireId, ecart],
    );
    const sauvages = await betesSauvagesDesCases(pool, rows.map((c) => c.id), de, a);
    const calme = rows.filter((c) => sauvages.get(c.id)!.length === 0)[rang];
    if (!calme) throw new Error(`Aucune Case à ${ecart} Cases où rien ne se montre pendant le séjour (rang ${rang}).`);
    return { q: calme.q, r: calme.r };
  };
  /**
   * Une Expédition de `explorateurs` explorateurs, escortée de `souris` souris, qui part à `instant` vers une Case à `ecart`
   * Cases du Foyer (deux par défaut) pour un séjour de `sejour` minutes.
   */
  const partir = async (territoireId: number, instant: Date, { explorateurs = 2, souris = 2, sejour = 60, ecart = 2, rang = 0 } = {}) => {
    // Son séjour : après un aller au pas des explorateurs, plus lent que les souris (US-0912).
    const arrivee = apres(instant, ecart * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE * MINUTE);
    const laCase = await destination(territoireId, ecart, rang, arrivee, apres(arrivee, sejour * MINUTE));
    const depart = await lancerLExpedition(
      pool,
      territoireId,
      { destination: laCase, explorateurs, escorte: new Map(souris > 0 ? [["souris", souris]] : []), sejourMinutes: sejour },
      instant,
    );
    expect(depart).toEqual({ expeditionId: expect.any(Number) });
    return (depart as { expeditionId: number }).expeditionId;
  };
  const apres = (instant: Date, ms: number) => new Date(instant.getTime() + ms);
  /** Les horaires d'une Expédition, tels qu'ils sont en base. */
  const horaires = async (expeditionId: number) =>
    (
      await pool.query<{ partLe: Date; trajetMinutes: number; sejourMinutes: number }>(
        `select part_le as "partLe", trajet_minutes as "trajetMinutes", sejour_minutes as "sejourMinutes" from expedition where id = $1`,
        [expeditionId],
      )
    ).rows[0];
  /** L'instant du jeu où une Expédition est rentrée au Foyer ; null tant qu'elle n'y est pas. */
  const rentreeLe = async (expeditionId: number) =>
    (await pool.query<{ rentree_le: Date | null }>("select rentree_le from expedition where id = $1", [expeditionId])).rows[0].rentree_le;
  /** Ce que le joueur voit de ses explorateurs et de ses Bêtes : l'état de chaque Habitant, le compteur des explorateurs et les souris disponibles. */
  const auFoyer = async (territoireId: number) => ({
    habitants: (await habitantsDuTerritoire(pool, territoireId)).map((h) => `${h.prenom} : ${h.etat}`),
    explorateurs: await explorateursDuTerritoire(pool, territoireId),
    souris: (await betesDisponibles(pool, territoireId)).find((e) => e.id === "souris")?.disponibles ?? 0,
  });

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterEach(async () => {
    // Chaque essai rend ses Foyers à la Couronne du Monde d'essai.
    await pool.query("delete from compte where email = any($1)", [nes.splice(0)]);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  describe("au retour, les explorateurs redeviennent libres et les Bêtes de l'escorte rentrent dans l'effectif", () => {
    it("à l'heure prévue du retour, pas une milliseconde avant", async () => {
      const t = await naitreAvecTroisExplorateurs();
      const expedition = await partir(t.territoireId, t.ne);
      const retour = retourDUneExpedition(await horaires(expedition))!;
      // L'aller, une heure de séjour, puis le retour, qui dure autant que l'aller.
      expect(retour).toEqual(apres(t.ne, (2 * ALLER + 60) * MINUTE));

      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(retour, -1) });
      expect(await auFoyer(t.territoireId)).toEqual({
        habitants: ["Ilda : en Expédition", "Ines : libre", "Joran : en Expédition"],
        explorateurs: { libres: 1, total: 3 },
        souris: 1,
      });

      await rattraper("territoire", t.territoireId, { pool, jusqua: retour });
      expect(await auFoyer(t.territoireId)).toEqual({
        habitants: ["Ilda : libre", "Ines : libre", "Joran : libre"],
        explorateurs: { libres: 3, total: 3 },
        souris: 3,
      });
      expect(await rentreeLe(expedition)).toEqual(retour);
      expect(await prochainRetourDUnExplorateur(pool, t.territoireId)).toBeNull();
    });

    it("rentrés, ils repartent aussitôt, avec les mêmes Bêtes", async () => {
      const t = await naitreAvecTroisExplorateurs();
      const expedition = await partir(t.territoireId, t.ne, { explorateurs: 3, souris: 3 });
      const retour = retourDUneExpedition(await horaires(expedition))!;

      await rattraper("territoire", t.territoireId, { pool, jusqua: retour });
      expect(await partir(t.territoireId, retour, { explorateurs: 3, souris: 3 })).toEqual(expect.any(Number));
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(retour, MINUTE) });
      // Repartis avec la nouvelle : de nouveau en Expédition, jusqu'à son retour à elle.
      expect(await auFoyer(t.territoireId)).toMatchObject({ explorateurs: { libres: 0, total: 3 }, souris: 0 });
      expect(await prochainRetourDUnExplorateur(pool, t.territoireId)).toEqual(apres(retour, (2 * ALLER + 60) * MINUTE));
    });

    it("rentrée, le Métier d'un explorateur se change de nouveau", async () => {
      const t = await naitreAvecTroisExplorateurs();
      const expedition = await partir(t.territoireId, t.ne, { explorateurs: 3, souris: 0 });
      await rattraper("territoire", t.territoireId, { pool, jusqua: retourDUneExpedition(await horaires(expedition))! });
      const joran = (await habitantsDuTerritoire(pool, t.territoireId)).find((h) => h.prenom === "Joran")!;
      expect(await enregistrerLeMetier(pool, t.territoireId, joran.id, "chasseur")).toBe(true);
    });
  });

  describe("l'Expédition quitte la liste des Expéditions en cours", () => {
    it("celle qui est rentrée la quitte, celle encore en route y reste avec ses explorateurs et son escorte", async () => {
      const t = await naitreAvecTroisExplorateurs();
      const premiere = await partir(t.territoireId, t.ne, { explorateurs: 1, souris: 1 });
      // Partie 1 h 30 après la première : sur sa Case de 2 h 10 à 3 h 10.
      const seconde = await partir(t.territoireId, apres(t.ne, 90 * MINUTE), { explorateurs: 1, souris: 1, rang: 1 });
      const retour = retourDUneExpedition(await horaires(premiere))!;

      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(retour, -1) });
      expect((await expeditionsEnCours(pool, t.territoireId, apres(retour, -1))).map((x) => [x.id, x.phase])).toEqual([
        [premiere, "retour"],
        [seconde, "sejour"],
      ]);

      await rattraper("territoire", t.territoireId, { pool, jusqua: retour });
      expect(await expeditionsEnCours(pool, t.territoireId, retour)).toEqual([
        expect.objectContaining({ id: seconde, phase: "sejour", explorateurs: ["Ilda"], escorte: [expect.objectContaining({ id: "souris", nombre: 1 })] }),
      ]);
      expect(await auFoyer(t.territoireId)).toMatchObject({ explorateurs: { libres: 2, total: 3 }, souris: 2 });
    });

    it("rentrée, elle reste sur sa Case pour le temps de son séjour : ses Rencontres peuvent toujours être jugées (US-0915)", async () => {
      const t = await naitreAvecTroisExplorateurs();
      const expedition = await partir(t.territoireId, t.ne);
      const { rows } = await pool.query<{ caseId: number }>(`select case_id as "caseId" from expedition where id = $1`, [expedition]);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, 10 * HEURE) });
      expect(await rentreeLe(expedition)).not.toBeNull();
      expect((await expeditionsPresentesSurLaCase(pool, rows[0].caseId, apres(t.ne, (ALLER + 30) * MINUTE))).map((x) => x.id)).toEqual([expedition]);
    });
  });

  describe("le retour a lieu à l'heure prévue même si le joueur n'est pas connecté", () => {
    it("la tâche planifiée la fait rentrer à son heure exacte, pas à celle de son passage", async () => {
      const t = await naitreAvecTroisExplorateurs();
      const expedition = await partir(t.territoireId, t.ne);
      const retour = retourDUneExpedition(await horaires(expedition))!;
      const passage = await rattraperLesAbsents({ pool, maintenant: apres(retour, 3 * HEURE + 17 * MINUTE), parmi: { territoire: [t.territoireId] } });
      expect(passage).toMatchObject({ rattrapes: 1, echecs: 0 });
      expect(await rentreeLe(expedition)).toEqual(retour);
      expect(await auFoyer(t.territoireId)).toMatchObject({ explorateurs: { libres: 3, total: 3 }, souris: 3 });
      expect(await expeditionsEnCours(pool, t.territoireId, apres(retour, 3 * HEURE + 17 * MINUTE))).toEqual([]);
    });

    /**
     * Un chasseur et deux explorateurs, sans Nourriture ni Case pour en produire : la Famine dès la naissance. Les deux
     * explorateurs partent aussitôt, 3 h de séjour, à 2 Cases (40 min d'aller, autant de retour : ils rentrent à 4 h 20)
     * ou à 3 Cases (1 h d'aller : ils rentrent à 5 h pile, une heure pleine de la Famine). Reste, seul au Foyer, s'en va à
     * 1 h ; la Famine dure sans départ jusqu'au retour, puis le dernier arrivé des deux explorateurs rentrés s'en va à
     * l'heure pleine qui suit ; jamais le dernier Habitant.
     */
    describe.each([
      { ecart: 2, retour: 4 * 60 + 20, depart: 5, quand: "à 4 h 20, entre deux heures pleines" },
      { ecart: 3, retour: 5 * 60, depart: 6, quand: "à 5 h pile, une heure pleine de la Famine" },
    ])("en Famine, sans plus personne au Foyer, rentrés $quand : les départs reprennent à l'heure pleine qui suit, quel que soit le découpage", ({ ecart, retour, depart }) => {
      const preparer = async () => {
        const t = await naitre([
          { prenom: "Reste", metier: "chasseur" },
          { prenom: "Loin", metier: "explorateur" },
          { prenom: "Ailleurs", metier: "explorateur" },
        ]);
        await pool.query("update stock set quantite = 0, reste = 0, plein_depuis = null where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')", [
          t.territoireId,
        ]);
        const expedition = await partir(t.territoireId, t.ne, { explorateurs: 2, souris: 0, sejour: 180, ecart });
        // Sans aucune Case, le Territoire ne produit rien : son Foyer passe à un voisin.
        const voisin = await naitre([{ prenom: "Voisin", metier: null }]);
        await pool.query(
          "update case_du_monde set chef_id = (select chef_id from territoire where id = $2) where id = (select foyer_case_id from territoire where id = $1)",
          [t.territoireId, voisin.territoireId],
        );
        return { ...t, expedition };
      };
      /**
       * Tout ce que le retour et la Famine touchent : l'instant du retour (null avant) et les départs de Famine, en
       * microsecondes après la naissance, et les Habitants restants.
       */
      const etat = async ({ territoireId, ne, expedition }: Awaited<ReturnType<typeof preparer>>) => ({
        rentree: (
          await pool.query<{ instant: string | null }>(
            "select (extract(epoch from rentree_le - $2::timestamptz) * 1000000)::bigint::text as instant from expedition where id = $1",
            [expedition, ne],
          )
        ).rows[0].instant,
        restants: (
          await pool.query<{ prenom: string; parti: boolean }>(
            "select prenom, expedition_id is not null as parti from habitant where territoire_id = $1 order by id",
            [territoireId],
          )
        ).rows,
        departs: (
          await pool.query<{ prenom: string; instant: string }>(
            `select donnees->>'prenom' as prenom, (extract(epoch from survient_le - $2::timestamptz) * 1000000)::bigint::text as instant
             from evenement where element = 'territoire' and element_id = $1 and type = $3 order by survient_le, id`,
            [territoireId, ne, DEPART_DE_FAMINE],
          )
        ).rows,
      });
      const RETOUR = retour * MINUTE;
      const FIN = 8 * HEURE;
      let fermee: Awaited<ReturnType<typeof etat>>;

      beforeAll(async () => {
        const t = await preparer();
        await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, FIN) });
        fermee = await etat(t);
        expect(fermee).toEqual({
          rentree: String(RETOUR * 1000),
          restants: [{ prenom: "Loin", parti: false }],
          departs: [
            { prenom: "Reste", instant: us(1) },
            { prenom: "Ailleurs", instant: us(depart) },
          ],
        });
      });

      it("page ouverte : rentrés à leur heure, et la même fin qu'à la page fermée", async () => {
        const t = await preparer();
        for (let ms = 7 * MINUTE + 3_123; ms < FIN; ms += 7 * MINUTE + 3_123) {
          await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, ms) });
          expect((await etat(t)).rentree, `${(ms / HEURE).toFixed(2)} h`).toBe(ms >= RETOUR ? fermee.rentree : null);
        }
        await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, FIN) });
        expect(await etat(t)).toEqual(fermee);
      }, 60_000);

      it("tâche planifiée passée au milieu, dont une à l'instant même du retour : même fin qu'à la page fermée", async () => {
        const t = await preparer();
        for (const minutes of [50, retour, retour + 39, retour + 130]) {
          const passage = await rattraperLesAbsents({ pool, maintenant: apres(t.ne, minutes * MINUTE), parmi: { territoire: [t.territoireId] } });
          expect(passage, `passage à ${minutes} min`).toMatchObject({ rattrapes: 1, echecs: 0 });
        }
        await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, FIN) });
        expect(await etat(t)).toEqual(fermee);
      }, 60_000);
    });
  });

  it("programme le retour des Expéditions parties avant lui (migration 0052), une seule fois, à leur heure", async () => {
    const t = await naitreAvecTroisExplorateurs();
    const avant = await partir(t.territoireId, t.ne, { explorateurs: 1, souris: 1 });
    const programmee = await partir(t.territoireId, t.ne, { explorateurs: 1, souris: 1, rang: 1 });
    // Ses retours programmés seulement : sa colonne est déjà là (src/test/preparer-base.ts), et l'ajouter de nouveau tiendrait
    // la table de toutes les Expéditions de la base de test, que d'autres fichiers lisent en même temps.
    const migration = readFileSync(join(process.cwd(), "drizzle/0052_retour_au_foyer.sql"), "utf8")
      .split("--> statement-breakpoint")
      .filter((instruction) => !instruction.includes("ALTER TABLE"))
      .join("\n");
    expect(migration).toContain("INSERT INTO");
    const retours = `select (donnees->>'expedition')::int as expedition, survient_le as "survientLe" from evenement
      where element = 'territoire' and element_id = $1 and type = $2 order by (donnees->>'expedition')::int`;
    const client = await pool.connect();
    let programmes: { expedition: number; survientLe: Date }[];
    try {
      await client.query("begin");
      // Partie avant le retour au Foyer : rien ne programmait son retour.
      await client.query(`delete from evenement where element = 'territoire' and element_id = $1 and type = $2 and (donnees->>'expedition')::int = $3`, [
        t.territoireId,
        RETOUR_EXPEDITION,
        avant,
      ]);
      await client.query(migration);
      // Rejouée, elle ne change rien.
      await client.query(migration);
      programmes = (await client.query<{ expedition: number; survientLe: Date }>(retours, [t.territoireId, RETOUR_EXPEDITION])).rows;
    } finally {
      await client.query("rollback");
      client.release();
    }
    expect(programmes).toEqual([
      { expedition: avant, survientLe: retourDUneExpedition(await horaires(avant)) },
      { expedition: programmee, survientLe: retourDUneExpedition(await horaires(programmee)) },
    ]);
  });
});
