import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { betesSauvagesDUneCase } from "@/monde/betes-sauvages";
import { betesDisponibles } from "@/monde/effectif";
import { explorateursDuTerritoire, prochainRetourDUnExplorateur } from "@/monde/explorateurs";
import { enregistrerLeMetier, habitantsDuTerritoire, renvoyerLHabitant, retirerUnHabitantDuMetier } from "@/monde/habitants";
import type { Coordonnees } from "@/monde/hex";
import { PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE, PORTEE_D_EXPLORATION_CASES } from "@/reglages";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { CASE_D_UN_TERRITOIRE, CASE_HORS_DE_PORTEE } from "./choix-de-destination";
import { BETE_PLUS_DISPONIBLE, type ChoixDuDepart, ECLAIREUR_SANS_LE_ROLE, EXPLORATEUR_PLUS_LIBRE, lancerLExpedition } from "./depart";
import { expeditionsEnCours } from "./en-cours";
import { forcesDesEscortes } from "./forces-en-base";

const MINUTE_MS = 60_000;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du départ (US-0911)";

describe.skipIf(!URL_TEST)("lancer l'Expédition (US-0911, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `depart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** L'heure du jeu du départ. */
  const INSTANT = new Date("2026-10-09T07:42:00.000Z");

  /** Un joueur qui vient de naître, et son Territoire, avec ses trois Habitants sans Métier et sans Bête. */
  const nouveauTerritoire = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Dep", suffixe, numero);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    return (await territoireDuCompte(pool, compte.id))!;
  };
  /** `n` explorateurs de plus au Territoire ; rend leurs identifiants. */
  const explorateurs = async (territoireId: number, n: number) =>
    (
      await pool.query<{ id: number }>(
        `insert into habitant (territoire_id, prenom, metier) select $1, 'Essai', 'explorateur' from generate_series(1, $2) returning id`,
        [territoireId, n],
      )
    ).rows.map((h) => h.id);
  /** Des Bêtes dans l'effectif du Territoire : une ligne par Espèce et par sexe, avec leur nombre. */
  const betes = (territoireId: number, lignes: [string, "male" | "femelle", number][]) =>
    pool.query(
      `insert into effectif (territoire_id, espece_id, sexe, nombre)
       select $1, e, s::sexe, n from unnest($2::text[], $3::text[], $4::int[]) as l(e, s, n)`,
      [territoireId, lignes.map((l) => l[0]), lignes.map((l) => l[1]), lignes.map((l) => l[2])],
    );
  /** Une Case libre du Monde du Territoire, à `ecart` Cases de son Foyer. */
  const aLEcart = async (territoireId: number, ecart: number): Promise<Coordonnees> => {
    const { rows } = await pool.query<Coordonnees>(
      `select c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = $2
       order by c.q, c.r limit 1`,
      [territoireId, ecart],
    );
    return rows[0];
  };
  /** Le Foyer du Territoire. */
  const foyer = async (territoireId: number): Promise<Coordonnees> =>
    (await pool.query<Coordonnees>("select c.q, c.r from territoire t join case_du_monde c on c.id = t.foyer_case_id where t.id = $1", [territoireId])).rows[0];
  /**
   * Un départ vers `destination` : `n` explorateurs, l'escorte donnée Espèce par Espèce, et 4 h de séjour ; US-0976 : et
   * ses Éclaireurs, Espèce par Espèce, s'il en a.
   */
  const choix = (destination: Coordonnees, n: number, escorte: [string, number][] = [], eclaireurs?: [string, number][]): ChoixDuDepart => ({
    destination,
    explorateurs: n,
    escorte: new Map(escorte),
    ...(eclaireurs ? { eclaireurs: new Map(eclaireurs) } : {}),
    sejourMinutes: 240,
  });
  /**
   * US-0976 : une Case libre à `ecart` Cases du Foyer du Territoire où ne se montre aucune Bête, sauvage ni de naissance,
   * pendant toute l'Expédition qui y part à `part` au pas des explorateurs pour `sejour` minutes : elle y séjourne sans
   * Rencontre, sans Bête qui la suive ni l'attaque, et rentre à son heure. Elle s'éloigne d'une Case, jusqu'à trois fois,
   * s'il n'y en a aucune ; rend la Case et sa distance.
   */
  const uneCaseSansBete = async (territoireId: number, ecart: number, part: Date, sejour = 240): Promise<Coordonnees & { distance: number }> => {
    for (let d = ecart; d <= ecart + 3; d++) {
      const { rows } = await pool.query<Coordonnees & { id: number }>(
        `select c.id, c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
           join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
         where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = $2
           and not exists (select 1 from bete_de_naissance n where n.case_id = c.id)
         order by c.q, c.r`,
        [territoireId, d],
      );
      const fin = new Date(part.getTime() + (2 * d * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE + sejour) * MINUTE_MS);
      for (const c of rows) if ((await betesSauvagesDUneCase(pool, c.id, part, fin)).length === 0) return { q: c.q, r: c.r, distance: d };
    }
    throw new Error(`Aucune Case sans Bête de ${ecart} à ${ecart + 3} Cases du Foyer.`);
  };
  /** US-0976 : les Éclaireurs que le Territoire a fait partir, Espèce par Espèce. */
  const eclaireursPartis = async (territoireId: number) =>
    Object.fromEntries(
      (
        await pool.query<{ espece_id: string; n: number }>(
          `select c.espece_id, sum(c.nombre)::int as n from expedition_eclaireur c join expedition x on x.id = c.expedition_id
           where x.territoire_id = $1 group by c.espece_id`,
          [territoireId],
        )
      ).rows.map((r) => [r.espece_id, r.n]),
    );
  /** Ce que le Territoire a retenu : ses Expéditions, leurs escortes, et ses explorateurs partis. */
  const retenu = async (territoireId: number) =>
    (
      await pool.query<{ expeditions: number; escortes: number; partis: number }>(
        `select (select count(*)::int from expedition where territoire_id = $1) as expeditions,
           (select coalesce(sum(s.nombre), 0)::int from expedition_escorte s join expedition x on x.id = s.expedition_id where x.territoire_id = $1) as escortes,
           (select count(*)::int from habitant where territoire_id = $1 and expedition_id is not null) as partis`,
        [territoireId],
      )
    ).rows[0];

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("fait partir les explorateurs choisis : ils ne sont plus libres, et l'Expédition est en cours, en phase « aller »", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, 3);
    const destination = await aLEcart(t, 3);
    const depart = await lancerLExpedition(pool, t, choix(destination, 2), INSTANT);
    expect(depart).toEqual({ expeditionId: expect.any(Number) });
    expect(await explorateursDuTerritoire(pool, t)).toEqual({ libres: 1, total: 3 });
    expect(await expeditionsEnCours(pool, t, INSTANT)).toEqual([
      // US-0918 : avec son détail (src/expeditions/en-cours.db.test.ts).
      expect.objectContaining({ id: (depart as { expeditionId: number }).expeditionId, destination: expect.objectContaining({ ...destination, distance: 3 }), phase: "aller" }),
    ]);
    expect(await retenu(t)).toEqual({ expeditions: 1, escortes: 0, partis: 2 });
  });

  it("donne l'heure du prochain retour quand tous les explorateurs sont partis : l'aller, le séjour, puis le retour (US-0903)", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, 1);
    await lancerLExpedition(pool, t, choix(await aLEcart(t, 3), 1), INSTANT);
    expect(await explorateursDuTerritoire(pool, t)).toEqual({ libres: 0, total: 1 });
    // Sans escorte, au pas des explorateurs : 3 Cases à l'aller, 4 h de séjour, 3 Cases au retour.
    const trajet = 3 * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE * MINUTE_MS;
    expect(await prochainRetourDUnExplorateur(pool, t)).toEqual(new Date(INSTANT.getTime() + trajet + 240 * MINUTE_MS + trajet));
  });

  it("emmène l'escorte : ses Bêtes ne sont plus proposées, et les autres le restent", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, 2);
    await betes(t, [
      ["souris", "male", 2],
      ["souris", "femelle", 1],
      ["poule", "femelle", 1],
    ]);
    expect(await lancerLExpedition(pool, t, choix(await aLEcart(t, 2), 1, [["souris", 2], ["poule", 1]]), INSTANT)).toEqual({ expeditionId: expect.any(Number) });
    expect(await betesDisponibles(pool, t)).toEqual([expect.objectContaining({ id: "souris", disponibles: 1 })]);
    expect(await retenu(t)).toEqual({ expeditions: 1, escortes: 3, partis: 1 });
    // L'effectif garde toutes ses Bêtes : celles qui sont sorties en reviendront (US-0916).
    expect((await pool.query("select sum(nombre)::int as n from effectif where territoire_id = $1", [t])).rows[0].n).toBe(4);
  });

  it("chiffre le trajet d'une escorte (US-0912) : au pas des explorateurs, plus lents que ses Bêtes ; elle arrive, séjourne, puis rentre", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, 1);
    await betes(t, [["souris", "male", 1]]);
    await lancerLExpedition(pool, t, choix(await aLEcart(t, 2), 1, [["souris", 1]]), INSTANT);
    // La souris court à 13 km/h, les explorateurs marchent à 5 : 2 Cases à leur pas, puis 4 h de séjour.
    const aller = 2 * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE;
    const apres = (minutes: number) => new Date(INSTANT.getTime() + minutes * MINUTE_MS);
    expect((await expeditionsEnCours(pool, t, apres(aller - 1))).map((x) => x.phase)).toEqual(["aller"]);
    expect((await expeditionsEnCours(pool, t, apres(aller))).map((x) => x.phase)).toEqual(["sejour"]);
    expect((await expeditionsEnCours(pool, t, apres(aller + 240))).map((x) => x.phase)).toEqual(["retour"]);
    // Le retour dure autant que l'aller.
    expect(await prochainRetourDUnExplorateur(pool, t)).toEqual(apres(aller + 240 + aller));
  });

  it("rattrape le trajet des Expéditions parties avant qu'il soit chiffré (migration 0050), au pas de leur Bête la plus lente, sans toucher aux autres", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, 3);
    await betes(t, [
      ["souris", "male", 1],
      ["pigeon", "femelle", 1],
    ]);
    const parties = [
      await lancerLExpedition(pool, t, choix(await aLEcart(t, 3), 1, [["souris", 1], ["pigeon", 1]]), INSTANT),
      await lancerLExpedition(pool, t, choix(await aLEcart(t, 2), 1), INSTANT),
      await lancerLExpedition(pool, t, choix(await aLEcart(t, 4), 1), INSTANT),
    ].map((depart) => (depart as { expeditionId: number }).expeditionId);
    const migration = readFileSync(join(process.cwd(), "drizzle/0050_trajet_des_escortes.sql"), "utf8");
    const client = await pool.connect();
    let trajets: number[];
    try {
      // Le temps de l'essai, rien n'en reste : aucune Espèce du jeu ne va encore moins vite que les explorateurs.
      await client.query("begin");
      await client.query("set local lock_timeout = '10s'");
      await client.query("update espece set vitesse = 2.5 where id = 'souris'");
      await client.query("update expedition set trajet_minutes = null where id = any($1)", [parties.slice(0, 2)]);
      await client.query(migration);
      // Rejouée, elle ne change rien.
      await client.query(migration);
      const { rows } = await client.query<{ trajet: number }>(`select trajet_minutes as trajet from expedition where id = any($1) order by array_position($1, id)`, [parties]);
      trajets = rows.map((x) => x.trajet);
    } finally {
      await client.query("rollback");
      client.release();
    }
    // À 2,5 km/h, deux fois moins vite que les explorateurs : 40 minutes par Case. Sans escorte, leur pas ; la dernière, déjà chiffrée, ne change pas.
    expect(trajets).toEqual([3 * 40, 2 * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE, 4 * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE]);
  });

  it("verrouille le Métier d'un explorateur parti jusqu'à son retour : ni changé, ni retiré, ni renvoyé, et il est « en Expédition »", async () => {
    const t = await nouveauTerritoire();
    const [parti] = await explorateurs(t, 1);
    await lancerLExpedition(pool, t, choix(await aLEcart(t, 3), 1), INSTANT);
    expect(await enregistrerLeMetier(pool, t, parti, "chasseur")).toBe(false);
    expect(await enregistrerLeMetier(pool, t, parti, null)).toBe(false);
    expect(await retirerUnHabitantDuMetier(pool, t, "explorateur")).toBeNull();
    expect(await renvoyerLHabitant(pool, t, parti, INSTANT)).toBe(false);
    expect(await habitantsDuTerritoire(pool, t)).toContainEqual(expect.objectContaining({ id: parti, metier: "Explorateur", etat: "en Expédition" }));
    // Les autres Habitants, restés au Foyer, sont toujours libres et changent de Métier comme avant.
    const restes = (await habitantsDuTerritoire(pool, t)).filter((h) => h.id !== parti);
    expect(restes.map((h) => h.etat)).toEqual(["libre", "libre", "libre"]);
    expect(await enregistrerLeMetier(pool, t, restes[0].id, "explorateur")).toBe(true);
    expect(await retirerUnHabitantDuMetier(pool, t, "explorateur")).toBe(restes[0].id);
  });

  it("refuse avec un message, sans rien retenir, quand un explorateur n'est plus libre", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, 2);
    await betes(t, [["souris", "male", 3]]);
    expect(await lancerLExpedition(pool, t, choix(await aLEcart(t, 3), 3, [["souris", 2]]), INSTANT)).toEqual({ refus: EXPLORATEUR_PLUS_LIBRE });
    expect(await retenu(t)).toEqual({ expeditions: 0, escortes: 0, partis: 0 });
    expect(await explorateursDuTerritoire(pool, t)).toEqual({ libres: 2, total: 2 });
    expect(await betesDisponibles(pool, t)).toEqual([expect.objectContaining({ id: "souris", disponibles: 3 })]);
  });

  it("refuse avec un message, sans rien retenir, quand une Bête n'est plus disponible", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, 2);
    await betes(t, [["souris", "male", 3]]);
    const refus = { refus: BETE_PLUS_DISPONIBLE };
    expect(await lancerLExpedition(pool, t, choix(await aLEcart(t, 3), 2, [["souris", 4]]), INSTANT)).toEqual(refus);
    // Une Espèce que le Territoire n'a pas, ou plus.
    expect(await lancerLExpedition(pool, t, choix(await aLEcart(t, 3), 2, [["poule", 1]]), INSTANT)).toEqual(refus);
    expect(await retenu(t)).toEqual({ expeditions: 0, escortes: 0, partis: 0 });
    expect(await explorateursDuTerritoire(pool, t)).toEqual({ libres: 2, total: 2 });
  });

  it("n'emmène jamais deux fois le même explorateur, même pour deux départs envoyés au même instant", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, 2);
    const destination = await aLEcart(t, 3);
    const departs = await Promise.all([lancerLExpedition(pool, t, choix(destination, 2), INSTANT), lancerLExpedition(pool, t, choix(destination, 2), INSTANT)]);
    expect(departs).toEqual(expect.arrayContaining([{ expeditionId: expect.any(Number) }, { refus: EXPLORATEUR_PLUS_LIBRE }]));
    expect(await retenu(t)).toEqual({ expeditions: 1, escortes: 0, partis: 2 });
  });

  it("partage les explorateurs libres entre des départs simultanés qui en laissent assez pour chacun", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, 3);
    const destination = await aLEcart(t, 3);
    const departs = await Promise.all([1, 2, 3].map(() => lancerLExpedition(pool, t, choix(destination, 1), INSTANT)));
    expect(departs).toEqual([1, 2, 3].map(() => ({ expeditionId: expect.any(Number) })));
    const { rows } = await pool.query<{ expedition_id: number }>("select expedition_id from habitant where territoire_id = $1 and expedition_id is not null", [t]);
    expect(new Set(rows.map((h) => h.expedition_id)).size).toBe(3);
  });

  it("n'emmène jamais deux fois la même Bête, même pour deux départs envoyés au même instant", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, 2);
    await betes(t, [
      ["souris", "male", 2],
      ["souris", "femelle", 1],
    ]);
    const destination = await aLEcart(t, 3);
    const departs = await Promise.all([1, 2].map(() => lancerLExpedition(pool, t, choix(destination, 1, [["souris", 2]]), INSTANT)));
    expect(departs).toEqual(expect.arrayContaining([{ expeditionId: expect.any(Number) }, { refus: BETE_PLUS_DISPONIBLE }]));
    expect(await retenu(t)).toEqual({ expeditions: 1, escortes: 2, partis: 1 });
  });

  it("refuse une destination que l'écran refuserait, d'où que vienne la demande, sans rien retenir (US-0907, US-0908)", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, 1);
    expect(await lancerLExpedition(pool, t, choix(await foyer(t), 1), INSTANT)).toEqual({ refus: CASE_D_UN_TERRITOIRE });
    expect(await lancerLExpedition(pool, t, choix(await aLEcart(t, PORTEE_D_EXPLORATION_CASES + 1), 1), INSTANT)).toEqual({ refus: CASE_HORS_DE_PORTEE });
    expect(await retenu(t)).toEqual({ expeditions: 0, escortes: 0, partis: 0 });
  });

  describe("emmener des Éclaireurs (US-0976)", () => {
    it("emmène des Éclaireurs à côté de l'escorte : ni les uns ni les autres ne sont plus proposés ; au retour, tous le sont de nouveau", async () => {
      const t = await nouveauTerritoire();
      await explorateurs(t, 1);
      // Des mâles seulement : aucun Couple ne se réunit au retour (US-0956), l'effectif ne bouge pas.
      await betes(t, [
        ["pigeon", "male", 4],
        ["souris", "male", 2],
      ]);
      // Parti à l'heure de sa naissance, pour que le temps du Territoire le ramène.
      const part = await lireMarquePage(pool, "territoire", t);
      const calme = await uneCaseSansBete(t, 2, part);
      const depart = await lancerLExpedition(pool, t, choix({ q: calme.q, r: calme.r }, 1, [["pigeon", 1], ["souris", 1]], [["pigeon", 2]]), part);
      expect(depart).toEqual({ expeditionId: expect.any(Number) });
      expect(await eclaireursPartis(t)).toEqual({ pigeon: 2 });
      // La force de l'Expédition, celle que lisent les Rencontres disputées de tous les joueurs (US-0963) : son escorte seule.
      const { expeditionId } = depart as { expeditionId: number };
      expect(await forcesDesEscortes(pool, [expeditionId])).toEqual(new Map([[expeditionId, 2216 + 473]]));
      expect(await retenu(t)).toEqual({ expeditions: 1, escortes: 2, partis: 1 });
      // Le pigeon de l'escorte et les deux Éclaireurs sont sortis : il en reste un au Foyer.
      expect(await betesDisponibles(pool, t, part)).toEqual([
        expect.objectContaining({ id: "pigeon", disponibles: 1 }),
        expect.objectContaining({ id: "souris", disponibles: 1 }),
      ]);
      // Au retour, tous rentrent dans l'effectif, libres pour la sortie suivante.
      const retour = (await expeditionsEnCours(pool, t, part))[0];
      const rentree = new Date(retour.partLe.getTime() + (2 * retour.trajetMinutes! + retour.sejourMinutes) * MINUTE_MS);
      await rattraper("territoire", t, { pool, jusqua: rentree });
      expect(await betesDisponibles(pool, t, rentree)).toEqual([
        expect.objectContaining({ id: "pigeon", disponibles: 4 }),
        expect.objectContaining({ id: "souris", disponibles: 2 }),
      ]);
    });

    it("une même Bête est l'un ou l'autre : jamais plus d'Éclaireurs et de Bêtes d'escorte que de disponibles, sans rien retenir", async () => {
      const t = await nouveauTerritoire();
      await explorateurs(t, 1);
      await betes(t, [["pigeon", "male", 2]]);
      expect(await lancerLExpedition(pool, t, choix(await aLEcart(t, 2), 1, [["pigeon", 1]], [["pigeon", 2]]), INSTANT)).toEqual({ refus: BETE_PLUS_DISPONIBLE });
      expect(await lancerLExpedition(pool, t, choix(await aLEcart(t, 2), 1, [], [["pigeon", 3]]), INSTANT)).toEqual({ refus: BETE_PLUS_DISPONIBLE });
      expect(await retenu(t)).toEqual({ expeditions: 0, escortes: 0, partis: 0 });
      expect(await eclaireursPartis(t)).toEqual({});
      expect(await betesDisponibles(pool, t, INSTANT)).toEqual([expect.objectContaining({ id: "pigeon", disponibles: 2 })]);
    });

    it("seule une Espèce Éclaireuse part en Éclaireurs, d'où que vienne la demande, sans rien retenir", async () => {
      const t = await nouveauTerritoire();
      await explorateurs(t, 1);
      await betes(t, [["souris", "male", 2]]);
      expect(await lancerLExpedition(pool, t, choix(await aLEcart(t, 2), 1, [], [["souris", 1]]), INSTANT)).toEqual({ refus: ECLAIREUR_SANS_LE_ROLE });
      expect(await retenu(t)).toEqual({ expeditions: 0, escortes: 0, partis: 0 });
      expect(await eclaireursPartis(t)).toEqual({});
    });

    it("n'emmène jamais deux fois le même pigeon, en escorte comme en Éclaireur, même pour deux départs envoyés au même instant", async () => {
      const t = await nouveauTerritoire();
      await explorateurs(t, 2);
      await betes(t, [["pigeon", "male", 3]]);
      const destination = await aLEcart(t, 3);
      const departs = await Promise.all([
        lancerLExpedition(pool, t, choix(destination, 1, [], [["pigeon", 2]]), INSTANT),
        lancerLExpedition(pool, t, choix(destination, 1, [["pigeon", 1]], [["pigeon", 1]]), INSTANT),
      ]);
      expect(departs).toEqual(expect.arrayContaining([{ expeditionId: expect.any(Number) }, { refus: BETE_PLUS_DISPONIBLE }]));
      expect(await retenu(t)).toEqual(expect.objectContaining({ expeditions: 1, partis: 1 }));
      expect(await betesDisponibles(pool, t, INSTANT)).toEqual([expect.objectContaining({ id: "pigeon", disponibles: 1 })]);
    });

    it("retient le sexe des Éclaireurs comme celui de l'escorte, pris après elle aux Bêtes valides du Foyer (US-0960)", async () => {
      const t = await nouveauTerritoire();
      await explorateurs(t, 1);
      // Le Couple déjà réuni : mâles et femelles au Foyer ensemble, sans Couple à former.
      await pool.query("insert into couple (territoire_id, espece_id, reuni_le) values ($1, 'pigeon', $2)", [t, INSTANT]);
      await betes(t, [
        ["pigeon", "male", 3],
        ["pigeon", "femelle", 2],
      ]);
      const depart = await lancerLExpedition(pool, t, choix(await aLEcart(t, 2), 1, [["pigeon", 2]], [["pigeon", 2]]), INSTANT);
      const { expeditionId } = depart as { expeditionId: number };
      // L'escorte d'abord, au sexe le plus nombreux, un mâle à égalité : deux mâles ; puis les Éclaireurs parmi les deux
      // femelles et le mâle qui restent : une femelle, puis le mâle à égalité.
      const males = async (table: string) => (await pool.query(`select males from ${table} where expedition_id = $1`, [expeditionId])).rows[0].males;
      expect([await males("expedition_escorte"), await males("expedition_eclaireur")]).toEqual([2, 1]);
    });

    /**
     * US-0960 : un Territoire avec les pigeons `pigeons` au Foyer ; un pigeon part en Éclaireur pour une longue Expédition (au
     * sexe retenu, ou inconnu avec `sansSexe`), puis `avant` s'ajoute à l'effectif, et une courte Expédition rentre la
     * première. Les Couples réunis au retour de la courte, puis à celui de la longue.
     */
    const couplesAuxRetours = async (pigeons: [string, "male" | "femelle", number][], avant: [string, "male" | "femelle", number][], sansSexe = false) => {
      const t = await nouveauTerritoire();
      await explorateurs(t, 2);
      await betes(t, [...pigeons, ["souris", "male", 1]]);
      const part = await lireMarquePage(pool, "territoire", t);
      const loin = await uneCaseSansBete(t, 3, part);
      const { expeditionId } = (await lancerLExpedition(pool, t, choix({ q: loin.q, r: loin.r }, 1, [], [["pigeon", 1]]), part)) as { expeditionId: number };
      if (sansSexe) await pool.query("update expedition_eclaireur set males = null where expedition_id = $1", [expeditionId]);
      if (avant.length > 0) await betes(t, avant);
      // Une autre Expédition, plus courte, rentre la première : le temps du Territoire repasse par la réunion des Couples.
      const pres = await uneCaseSansBete(t, 1, part, 30);
      expect(pres.distance).toBeLessThanOrEqual(loin.distance);
      await lancerLExpedition(pool, t, { ...choix({ q: pres.q, r: pres.r }, 1, [["souris", 1]]), sejourMinutes: 30 }, part);
      const [longue, courte] = await expeditionsEnCours(pool, t, part);
      const rentree = (x: typeof longue) => new Date(x.partLe.getTime() + (2 * x.trajetMinutes! + x.sejourMinutes) * MINUTE_MS);
      expect(rentree(courte) < rentree(longue)).toBe(true);
      const couples = async () => (await pool.query<{ espece_id: string }>("select espece_id from couple where territoire_id = $1", [t])).rows.map((c) => c.espece_id);
      await rattraper("territoire", t, { pool, jusqua: rentree(courte) });
      const auPremierRetour = await couples();
      await rattraper("territoire", t, { pool, jusqua: rentree(longue) });
      return [auPremierRetour, await couples()];
    };

    it("la seule Bête d'un sexe partie en Éclaireur ne réunit le Couple de son Espèce qu'à son retour (US-0956, US-0960)", async () => {
      // Le seul mâle part en Éclaireur ; une femelle arrive au Foyer pendant son absence.
      expect(await couplesAuxRetours([["pigeon", "male", 1]], [["pigeon", "femelle", 1]])).toEqual([[], ["pigeon"]]);
    });

    it("le sexe retenu de l'Éclaireur compte pour le Couple ; inconnu, il compte pour l'un et pour l'autre (US-0960)", async () => {
      // Deux mâles et une femelle : un mâle part en Éclaireur ; le mâle et la femelle restés au Foyer réunissent le Couple dès
      // le premier retour.
      expect(await couplesAuxRetours([["pigeon", "male", 2], ["pigeon", "femelle", 1]], [])).toEqual([["pigeon"], ["pigeon"]]);
      // Le sexe de l'Éclaireur inconnu, il pourrait être la femelle : le Couple attend son retour.
      expect(await couplesAuxRetours([["pigeon", "male", 2], ["pigeon", "femelle", 1]], [], true)).toEqual([[], ["pigeon"]]);
    });

    it("les Éclaireurs ne règlent pas l'allure : sans escorte, l'Expédition va au pas de ses explorateurs", async () => {
      const t = await nouveauTerritoire();
      await explorateurs(t, 1);
      await betes(t, [["pigeon", "male", 2]]);
      await lancerLExpedition(pool, t, choix(await aLEcart(t, 3), 1, [], [["pigeon", 2]]), INSTANT);
      expect((await expeditionsEnCours(pool, t, INSTANT)).map((x) => [x.trajetMinutes, x.escorte])).toEqual([[3 * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE, []]]);
    });
  });

  it("ne mêle jamais les Territoires : les explorateurs et les Bêtes d'un autre ne partent pas", async () => {
    const t = await nouveauTerritoire();
    const voisin = await nouveauTerritoire();
    await explorateurs(voisin, 2);
    await betes(voisin, [["souris", "male", 2]]);
    expect(await lancerLExpedition(pool, t, choix(await aLEcart(t, 3), 1), INSTANT)).toEqual({ refus: EXPLORATEUR_PLUS_LIBRE });
    await explorateurs(t, 1);
    expect(await lancerLExpedition(pool, t, choix(await aLEcart(t, 3), 1, [["souris", 1]]), INSTANT)).toEqual({ refus: BETE_PLUS_DISPONIBLE });
    expect(await retenu(voisin)).toEqual({ expeditions: 0, escortes: 0, partis: 0 });
    expect(await expeditionsEnCours(pool, voisin, INSTANT)).toEqual([]);
  });
});
