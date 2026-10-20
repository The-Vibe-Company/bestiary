import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { dureeDUneBeteEleveeMinutes } from "./cout-d-elevage";
import { reunirLesCouples } from "./couple";
import { entretienDesBetes } from "./entretien-des-betes";
import { lancerUnElevage } from "./lancer-un-elevage";
import { nourriturePourEncoreDesStocks } from "./nourriture";
import { stocksDuTerritoire } from "./stocks";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de l'Entretien des Bêtes (US-0826)";

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
/** Ce que la base écrit d'un numeric(24, 6). */
const six = (n: number) => n.toFixed(6);

describe.skipIf(!URL_TEST)("payer l'Entretien des Bêtes chaque heure (US-0826, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `entretien-betes-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];
  /** Ce qu'une Case de prairie, Biome du Foyer, produit par heure : la Viande et les Végétaux. */
  let prairie: { viande: number; vegetaux: number };
  /** L'Entretien par heure du suricate (carnivore), de l'écureuil (herbivore) et de la poule (omnivore). */
  let mange: { suricate: number; ecureuil: number; poule: number };

  /**
   * Un joueur qui vient de naître, sans Habitant (`habitants` en garde autant), la Viande et les Végétaux à `nourriture`,
   * leur limite hors de portée : son Territoire et l'instant d'où il part, la seconde ronde qui suit sa naissance (le temps
   * ne recule jamais) : les essais comptent des heures entières depuis lui, et un Entretien à trois décimales sur un
   * nombre rond de pas tombe juste.
   */
  const naitre = async (nourriture = 500, habitants = 0) => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Mang", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    const ne = new Date(Math.ceil((await lireMarquePage(pool, "territoire", territoireId)).getTime() / 1000) * 1000 + 1000);
    await rattraper("territoire", territoireId, { pool, jusqua: ne });
    await pool.query("delete from habitant where territoire_id = $1 and id not in (select id from habitant where territoire_id = $1 order by id limit $2)", [
      territoireId,
      habitants,
    ]);
    await pool.query(
      `update stock set quantite = case when ressource_id in ('viande', 'vegetaux') then $2::numeric else quantite end, reste = 0, limite = 100000, plein_depuis = null
       where territoire_id = $1`,
      [territoireId, nourriture],
    );
    expect(await lireMarquePage(pool, "territoire", territoireId)).toEqual(ne);
    return { territoireId, ne };
  };
  /** Des Bêtes dans l'effectif du Territoire : une ligne par Espèce et par sexe, avec leur nombre. */
  const ajouter = (territoireId: number, lignes: [string, "male" | "femelle", number][]) =>
    pool.query(
      `insert into effectif (territoire_id, espece_id, sexe, nombre)
       select $1, e, s::sexe, n from unnest($2::text[], $3::text[], $4::int[]) as l(e, s, n)
       on conflict (territoire_id, espece_id, sexe) do update set nombre = effectif.nombre + excluded.nombre`,
      [territoireId, lignes.map((l) => l[0]), lignes.map((l) => l[1]), lignes.map((l) => l[2])],
    );
  /** La Viande et les Végétaux du Territoire, en texte exact, et leur reste. */
  const nourriture = async (territoireId: number) =>
    Object.fromEntries(
      (
        await pool.query<{ id: string; quantite: string; reste: string }>(
          "select ressource_id as id, quantite::text, reste::text from stock where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')",
          [territoireId],
        )
      ).rows.map(({ id, ...s }) => [id, s]),
    ) as Record<"viande" | "vegetaux", { quantite: string; reste: string }>;
  /** Le Territoire mis à l'heure du jeu `heures` après sa naissance, comme à l'ouverture d'une page. */
  const avancer = (t: { territoireId: number; ne: Date }, heures: number) =>
    rattraper("territoire", t.territoireId, { pool, jusqua: new Date(t.ne.getTime() + heures * HEURE) });
  /** L'instant où la Famine du Territoire a commencé ; null hors Famine. */
  const famine = async (territoireId: number) => (await pool.query<{ f: Date | null }>("select famine_depuis as f from territoire where id = $1", [territoireId])).rows[0].f;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    const { rows: p } = await pool.query<{ id: string; parHeure: number }>(
      "select ressource_id as id, par_heure::float8 as \"parHeure\" from production_biome where biome_id = 'prairie' and ressource_id in ('viande', 'vegetaux')",
    );
    prairie = Object.fromEntries(p.map((r) => [r.id, r.parHeure])) as typeof prairie;
    const { rows: e } = await pool.query<{ id: string; regime: string; entretien: number }>(
      "select id, regime, entretien_par_heure::float8 as entretien from espece where id in ('suricate', 'ecureuil', 'poule')",
    );
    expect(e.map((x) => [x.id, x.regime]).sort()).toEqual([
      ["ecureuil", "herbivore"],
      ["poule", "omnivore"],
      ["suricate", "carnivore"],
    ]);
    mange = Object.fromEntries(e.map((r) => [r.id, r.entretien])) as typeof mange;
  });
  afterEach(async () => {
    // Chaque essai rend ses Foyers à la Couronne du Monde d'essai.
    await pool.query("delete from compte where email = any($1)", [nes.splice(0)]);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("lit l'Entretien des Bêtes de l'effectif par heure : les carnivores sur la Viande, les herbivores sur les Végétaux, les omnivores à part ; rien sans Bête", async () => {
    const t = await naitre();
    expect(await entretienDesBetes(pool, t.territoireId)).toEqual({ viande: six(0), vegetaux: six(0), omnivores: six(0) });
    await ajouter(t.territoireId, [
      ["suricate", "male", 2],
      ["suricate", "femelle", 1],
      ["ecureuil", "femelle", 4],
      ["poule", "femelle", 3],
    ]);
    expect(await entretienDesBetes(pool, t.territoireId)).toEqual({ viande: six(3 * mange.suricate), vegetaux: six(4 * mange.ecureuil), omnivores: six(3 * mange.poule) });
  });

  it("chaque heure, chaque Bête mange l'Entretien de son Espèce : un carnivore de la Viande, un herbivore des Végétaux, un omnivore moitié de chaque (décidé le 2026-10-19)", async () => {
    const t = await naitre();
    await ajouter(t.territoireId, [
      ["suricate", "male", 2],
      ["ecureuil", "femelle", 3],
      ["poule", "femelle", 2],
    ]);
    await avancer(t, 1);
    // En une heure, la prairie produit, et les Bêtes mangent : 2 suricates sur la Viande, 3 écureuils sur les Végétaux, et
    // les 2 poules, 10 en tout, 5 sur chaque Stock.
    expect(await nourriture(t.territoireId)).toEqual({
      viande: { quantite: six(500 + prairie.viande - 2 * mange.suricate - mange.poule), reste: "0.000000" },
      vegetaux: { quantite: six(500 + prairie.vegetaux - 3 * mange.ecureuil - mange.poule), reste: "0.000000" },
    });
    await avancer(t, 4);
    expect((await nourriture(t.territoireId)).viande.quantite).toBe(six(500 + 4 * (prairie.viande - 2 * mange.suricate - mange.poule)));
  });

  it("les Bêtes sorties en escorte mangent toujours, sur les Stocks du Territoire ; les Bêtes du Couple, en Réserve, ne mangent pas (décidé le 2026-10-19)", async () => {
    const t = await naitre();
    await ajouter(t.territoireId, [["suricate", "male", 4]]);
    // Deux suricates partent en escorte : ils mangent comme ceux restés au Foyer.
    const { rows } = await pool.query<{ id: number }>(
      `insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes)
       select $1, c.id, $3, 30, 600 from case_du_monde c where c.monde_id = $2 and c.chef_id is null order by c.id limit 1 returning id`,
      [t.territoireId, mondeId, t.ne],
    );
    await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre, males) values ($1, 'suricate', 2, 2)", [rows[0].id]);
    // Un mâle et une femelle de poule : leur Couple se réunit et part en Réserve, hors de l'effectif.
    await ajouter(t.territoireId, [
      ["poule", "male", 1],
      ["poule", "femelle", 1],
    ]);
    const client = await pool.connect();
    try {
      expect(await reunirLesCouples(client, t.territoireId, t.ne)).toEqual(["poule"]);
    } finally {
      client.release();
    }
    expect(await entretienDesBetes(pool, t.territoireId)).toEqual({ viande: six(4 * mange.suricate), vegetaux: six(0), omnivores: six(0) });
    await avancer(t, 2);
    expect((await nourriture(t.territoireId)).viande.quantite).toBe(six(500 + 2 * (prairie.viande - 4 * mange.suricate)));
    expect((await nourriture(t.territoireId)).vegetaux.quantite).toBe(six(500 + 2 * prairie.vegetaux));
  });

  it("chaque Stock nourrit d'abord les Bêtes qui ne mangent que lui ; vide, il laisse l'autre nourrir les Habitants, qui ne sont pas en Famine (décidé le 2026-10-19)", async () => {
    // Trois Habitants (6 par heure, 3 sur chaque Stock) et huit suricates (20 par heure, sur la seule Viande) : la Viande,
    // à 10, se vide en 40 minutes ; dès lors elle donne sa production aux suricates, qui ont faim, et les Végétaux paient
    // tout l'Entretien des Habitants, qu'ils produisent largement : aucune Famine.
    const t = await naitre(10, 3);
    expect([prairie.viande, prairie.vegetaux, mange.suricate]).toEqual([8, 14, 2.5]);
    await pool.query("update stock set quantite = 1000 where territoire_id = $1 and ressource_id = 'vegetaux'", [t.territoireId]);
    await ajouter(t.territoireId, [["suricate", "male", 8]]);
    await avancer(t, 5);
    expect(await nourriture(t.territoireId)).toEqual({
      viande: { quantite: "0.000000", reste: "0.000000" },
      // 40 minutes à 14 − 3 = +11, puis 4 h 20 à 14 − 6 = +8.
      vegetaux: { quantite: six(1000 + 11 * (2 / 3) + 8 * (13 / 3)), reste: "0.000000" },
    });
    expect(await famine(t.territoireId)).toBeNull();
    // La barre du haut le lit de même : la Nourriture des Habitants est assurée.
    const stocks = await stocksDuTerritoire(pool, t.territoireId);
    expect(nourriturePourEncoreDesStocks(stocks, "6", await entretienDesBetes(pool, t.territoireId))).toBeNull();
  });

  it("les omnivores mangent après les Habitants sur la Nourriture partagée : la Famine des Habitants garde son sens", async () => {
    // Trois Habitants et six poules (30 par heure) sur des Stocks vides, qui produisent 22 : les Habitants reçoivent leurs
    // 6, les poules le reste. Aucune Famine ; la barre dit la Nourriture des Habitants assurée.
    const t = await naitre(0, 3);
    await ajouter(t.territoireId, [["poule", "femelle", 6]]);
    await avancer(t, 3);
    expect(await famine(t.territoireId)).toBeNull();
    expect(await nourriture(t.territoireId)).toEqual({ viande: { quantite: "0.000000", reste: "0.000000" }, vegetaux: { quantite: "0.000000", reste: "0.000000" } });
    expect(nourriturePourEncoreDesStocks(await stocksDuTerritoire(pool, t.territoireId), "6", await entretienDesBetes(pool, t.territoireId))).toBeNull();
    // Douze Habitants (24 par heure) : les Stocks vides n'en donnent que 22 : la Famine, à l'instant même, poules ou non ;
    // une heure plus tard, un Habitant part (US-0326), et les onze qui restent vivent des 22 : la Famine finit, les poules ont faim.
    const u = await naitre(0, 3);
    await pool.query("insert into habitant (territoire_id, prenom) select $1, 'Essai' from generate_series(1, 9)", [u.territoireId]);
    await ajouter(u.territoireId, [["poule", "femelle", 6]]);
    await avancer(u, 0.5);
    expect(await famine(u.territoireId)).toEqual(u.ne);
    await avancer(u, 1.5);
    expect((await pool.query("select count(*)::int as n from habitant where territoire_id = $1", [u.territoireId])).rows[0].n).toBe(11);
    expect(await famine(u.territoireId)).toBeNull();
  });

  it("une Bête née d'un Élevage mange dès sa naissance, à l'instant exact : le temps s'y arrête, et par tranches ou d'un bloc, les Stocks baissent exactement de l'Entretien dû", async () => {
    /** Un Territoire dont le Couple de poules est en Réserve, avec un éleveur, qui élève deux poules dès sa naissance. */
    const elever = async () => {
      // De quoi payer l'Élevage de deux poules (US-0815) ; les Stocks repartent de 500 au lancement.
      const t = await naitre(2000, 1);
      await ajouter(t.territoireId, [
        ["poule", "male", 1],
        ["poule", "femelle", 1],
      ]);
      const client = await pool.connect();
      try {
        expect(await reunirLesCouples(client, t.territoireId, t.ne)).toEqual(["poule"]);
      } finally {
        client.release();
      }
      await pool.query("update habitant set metier = 'eleveur' where territoire_id = $1", [t.territoireId]);
      const debut = new Date(t.ne.getTime() + MINUTE);
      expect(await lancerUnElevage(pool, t.territoireId, "poule", 2, debut)).toMatchObject({ lance: { quantite: 2 } });
      // Le lancement a payé l'Élevage : les Stocks repartent de 500 au lancement même.
      await rattraper("territoire", t.territoireId, { pool, jusqua: debut });
      await pool.query("update stock set quantite = 500, reste = 0, produit_depuis_visite = 0 where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')", [
        t.territoireId,
      ]);
      return { ...t, debut };
    };
    const duree = dureeDUneBeteEleveeMinutes((await pool.query<{ t: number }>("select taille::float8 as t from espece where id = 'poule'")).rows[0].t);
    const naissance = (t: { debut: Date }, k: number, minutes = 0) => new Date(t.debut.getTime() + (k * duree + minutes) * MINUTE);
    const [dUnBloc, parTranches] = [await elever(), await elever()];
    // D'un bloc, une heure après la seconde naissance : un Habitant (2 par heure, 1 sur chaque Stock) tout du long ; la
    // première poule mange depuis sa naissance, la seconde depuis la sienne : 2,5 par heure sur chaque Stock, chacune.
    const heures = (2 * duree + 60) / 60;
    await rattraper("territoire", dUnBloc.territoireId, { pool, jusqua: naissance(dUnBloc, 2, 60) });
    const attendu = {
      viande: { quantite: six(500 + heures * (prairie.viande - 1) - (duree / 60 + 1) * (mange.poule / 2) - 1 * (mange.poule / 2)), reste: "0.000000" },
      vegetaux: { quantite: six(500 + heures * (prairie.vegetaux - 1) - (duree / 60 + 1) * (mange.poule / 2) - 1 * (mange.poule / 2)), reste: "0.000000" },
    };
    expect(await nourriture(dUnBloc.territoireId)).toEqual(attendu);
    // Par tranches de 7 min 3,123 s, qui ne tombent ni sur une naissance ni sur une seconde ronde, puis jusqu'au même
    // instant : les mêmes Stocks, au millionième et au reste près.
    const tranche = 7 * MINUTE + 3_123;
    for (let ms = tranche; ms < (2 * duree + 60) * MINUTE; ms += tranche) {
      await rattraper("territoire", parTranches.territoireId, { pool, jusqua: new Date(parTranches.debut.getTime() + ms) });
    }
    await rattraper("territoire", parTranches.territoireId, { pool, jusqua: naissance(parTranches, 2, 60) });
    expect(await nourriture(parTranches.territoireId)).toEqual(attendu);
    // Une milliseconde avant la première naissance, rien n'a encore été mangé par les poules ; à la naissance, pas davantage.
    const u = await elever();
    await rattraper("territoire", u.territoireId, { pool, jusqua: new Date(naissance(u, 1).getTime() - 1) });
    const avant = Number((await nourriture(u.territoireId)).viande.quantite);
    expect(avant).toBeCloseTo(500 + (duree / 60) * (prairie.viande - 1), 3);
    await rattraper("territoire", u.territoireId, { pool, jusqua: naissance(u, 1, 60) });
    expect(Number((await nourriture(u.territoireId)).viande.quantite)).toBeCloseTo(avant + (prairie.viande - 1) - mange.poule / 2, 3);
  }, 60_000);
});
