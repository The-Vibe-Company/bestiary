import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { reunirLesCouples } from "./couple";
import { coutDUneBeteElevee, dureeDUneBeteEleveeMinutes } from "./cout-d-elevage";
import { ELEVAGE_SANS_COUPLE, ELEVAGE_SANS_ELEVEUR } from "./elevage";
import { faireRepartirUnHabitant } from "./famine";
import { ELEVAGE_DEJA_EN_COURS, lancerUnElevage, NOURRITURE_MANQUANTE } from "./lancer-un-elevage";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du lancement d'un Élevage (US-0815)";

describe.skipIf(!URL_TEST)("lancer un Élevage (US-0815, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `lancer-elevage-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];

  /** Un joueur qui vient de naître : son Territoire, l'instant de sa naissance et ses trois Habitants, du premier arrivé au dernier. */
  const naitre = async () => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Lanc", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    const habitants = (await pool.query<{ id: number }>("select id from habitant where territoire_id = $1 order by id", [territoireId])).rows.map((h) => h.id);
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId), habitants };
  };
  /** Réunit au Territoire le Couple de l'Espèce `especeId`, comme au retour d'une Expédition (US-0956). */
  const reunir = async (t: { territoireId: number; ne: Date }, especeId: string) => {
    const client = await pool.connect();
    try {
      await client.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 1), ($1, $2, 'femelle', 1)", [t.territoireId, especeId]);
      expect(await reunirLesCouples(client, t.territoireId, new Date(t.ne.getTime() + 3_600_000))).toEqual([especeId]);
    } finally {
      client.release();
    }
  };
  /** Les Habitants `ids` deviennent éleveurs. */
  const eleveurs = (ids: number[]) => pool.query("update habitant set metier = 'eleveur' where id = any($1)", [ids]);
  /** Fixe la Viande et les Végétaux du Territoire, et leur limite. */
  const nourriture = (territoireId: number, viande: string, vegetaux: string, limite = "100000") =>
    pool.query(
      `update stock set quantite = case ressource_id when 'viande' then $2::numeric else $3::numeric end, limite = $4::numeric, reste = 0, plein_depuis = null
       where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')`,
      [territoireId, viande, vegetaux, limite],
    );
  /** La Viande et les Végétaux du Territoire, en texte, comme la base les tient. */
  const stocks = async (territoireId: number) =>
    Object.fromEntries(
      (
        await pool.query<{ ressource_id: string; quantite: string }>(
          "select ressource_id, quantite::text from stock where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')",
          [territoireId],
        )
      ).rows.map((s) => [s.ressource_id, Number(s.quantite)]),
    );
  /** Les Élevages du Territoire, tels qu'ils sont enregistrés. */
  const elevages = async (territoireId: number) =>
    (
      await pool.query<{ especeId: string; eleveurId: number | null; quantite: number; dureeMinutes: number; cout: string; lanceLe: Date }>(
        `select espece_id as "especeId", eleveur_id as "eleveurId", quantite, duree_minutes as "dureeMinutes", cout::text, lance_le as "lanceLe"
         from elevage where territoire_id = $1 order by id`,
        [territoireId],
      )
    ).rows;
  /** L'Espèce qu'élève chacun des Habitants `ids`, dans leur ordre (null : libre). */
  const eleve = async (ids: number[]) =>
    (await pool.query<{ id: number; espece_elevee: string | null }>("select id, espece_elevee from habitant where id = any($1) order by id", [ids])).rows.map(
      (h) => h.espece_elevee,
    );
  /** Le coût d'une Bête de l'Espèce `id`, d'après son Entretien en base. */
  const cout = async (id: string) => coutDUneBeteElevee((await pool.query<{ e: number }>("select entretien_par_heure as e from espece where id = $1", [id])).rows[0].e);
  const taille = async (id: string) => (await pool.query<{ t: number }>("select taille as t from espece where id = $1", [id])).rows[0].t;

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

  it("lance l'Élevage à l'heure du clic : le coût total part aussitôt des Stocks, l'éleveur part à l'Élevage, et l'Élevage est retenu", async () => {
    const t = await naitre();
    await reunir(t, "souris");
    await eleveurs([t.habitants[1]]);
    await nourriture(t.territoireId, "300", "500");
    const clic = new Date(t.ne.getTime() + 2 * 3_600_000);
    const [unite, duree] = [await cout("souris"), dureeDUneBeteEleveeMinutes(await taille("souris"))];

    expect(await lancerUnElevage(pool, t.territoireId, "souris", 3, clic)).toEqual({ lance: { quantite: 3, eleveur: expect.any(String) } });
    // Un omnivore paie sur le Stock le plus fourni d'abord : les Végétaux, ici.
    expect(await stocks(t.territoireId)).toEqual({ viande: 300, vegetaux: 500 - 3 * unite });
    expect(await eleve(t.habitants)).toEqual([null, "souris", null]);
    expect(await elevages(t.territoireId)).toEqual([{ especeId: "souris", eleveurId: t.habitants[1], quantite: 3, dureeMinutes: duree, cout: String(3 * unite), lanceLe: clic }]);
  });

  it("paie un omnivore sur les deux Stocks quand le plus fourni n'y suffit pas, et un herbivore sur ses seuls Végétaux", async () => {
    const t = await naitre();
    await reunir(t, "souris");
    await reunir(t, "pigeon");
    await eleveurs([t.habitants[0], t.habitants[1]]);
    const unite = await cout("souris");
    // Trois souris : le plus fourni (60) donne tout, l'autre le reste.
    await nourriture(t.territoireId, "50", "60");
    expect(await lancerUnElevage(pool, t.territoireId, "souris", 3, t.ne)).toMatchObject({ lance: { quantite: 3 } });
    expect(await stocks(t.territoireId)).toEqual({ viande: 50 - (3 * unite - 60), vegetaux: 0 });
    // Le pigeon mange des Végétaux : la Viande ne le paie pas, même abondante.
    await nourriture(t.territoireId, "100000", "10");
    expect(await lancerUnElevage(pool, t.territoireId, "pigeon", 1, t.ne)).toEqual({ refus: NOURRITURE_MANQUANTE });
    await nourriture(t.territoireId, "0", "1000");
    expect(await lancerUnElevage(pool, t.territoireId, "pigeon", 1, t.ne)).toMatchObject({ lance: { quantite: 1 } });
    expect(await stocks(t.territoireId)).toEqual({ viande: 0, vegetaux: 1000 - (await cout("pigeon")) });
  });

  it("refuse sans rien retenir ni rien payer : sans Couple, sans éleveur libre, une Espèce déjà en Élevage, ou faute de Nourriture", async () => {
    const t = await naitre();
    await reunir(t, "souris");
    await nourriture(t.territoireId, "10", "10");
    expect(await lancerUnElevage(pool, t.territoireId, "poule", 1, t.ne)).toEqual({ refus: ELEVAGE_SANS_COUPLE });
    expect(await lancerUnElevage(pool, t.territoireId, "souris", 1, t.ne)).toEqual({ refus: ELEVAGE_SANS_ELEVEUR });
    await eleveurs([t.habitants[0], t.habitants[1]]);
    // 10 + 10 ne paient pas une souris (29) : rien n'est retenu, l'éleveur reste libre.
    expect(await lancerUnElevage(pool, t.territoireId, "souris", 1, t.ne)).toEqual({ refus: NOURRITURE_MANQUANTE });
    expect(await stocks(t.territoireId)).toEqual({ viande: 10, vegetaux: 10 });
    expect(await eleve(t.habitants)).toEqual([null, null, null]);
    expect(await elevages(t.territoireId)).toEqual([]);
    // Une Espèce n'a qu'un Élevage à la fois, même avec un autre éleveur libre (US-0844).
    await nourriture(t.territoireId, "1000", "1000");
    expect(await lancerUnElevage(pool, t.territoireId, "souris", 1, t.ne)).toMatchObject({ lance: { quantite: 1 } });
    expect(await lancerUnElevage(pool, t.territoireId, "souris", 1, t.ne)).toEqual({ refus: ELEVAGE_DEJA_EN_COURS });
    expect(await elevages(t.territoireId)).toHaveLength(1);
  });

  it("sous un double clic, ne lance qu'un Élevage et ne fait payer qu'une fois, même avec deux éleveurs libres", async () => {
    const t = await naitre();
    await reunir(t, "souris");
    await eleveurs([t.habitants[0], t.habitants[1]]);
    await nourriture(t.territoireId, "1000", "1000");
    const unite = await cout("souris");
    const resultats = await Promise.all([lancerUnElevage(pool, t.territoireId, "souris", 2, t.ne), lancerUnElevage(pool, t.territoireId, "souris", 2, t.ne)]);
    expect(resultats.filter((r) => "lance" in r)).toHaveLength(1);
    expect(resultats.filter((r) => "refus" in r)).toEqual([{ refus: ELEVAGE_DEJA_EN_COURS }]);
    expect(await elevages(t.territoireId)).toHaveLength(1);
    const apres = await stocks(t.territoireId);
    expect(apres.viande + apres.vegetaux).toBe(2000 - 2 * unite);
  });

  it("ne garde pas un Stock « plein » qu'un Élevage a fait passer sous sa limite", async () => {
    const t = await naitre();
    await reunir(t, "souris");
    await eleveurs([t.habitants[0]]);
    await nourriture(t.territoireId, "1000", "1000", "1000");
    await pool.query("update stock set plein_depuis = $2 where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')", [t.territoireId, t.ne]);
    expect(await lancerUnElevage(pool, t.territoireId, "souris", 1, t.ne)).toMatchObject({ lance: { quantite: 1 } });
    const pleins = (
      await pool.query<{ ressource_id: string; plein: boolean }>(
        "select ressource_id, plein_depuis is not null as plein from stock where territoire_id = $1 and ressource_id in ('viande', 'vegetaux') order by ressource_id",
        [t.territoireId],
      )
    ).rows;
    // Le Stock payé (l'un des deux, à égalité) n'est plus plein ; l'autre l'est toujours.
    expect(pleins.filter((s) => s.plein)).toHaveLength(1);
  });

  it("garde son éleveur à l'Élevage pendant une Famine : un autre s'en va à sa place (US-0834)", async () => {
    const t = await naitre();
    await reunir(t, "souris");
    // Tous ont un Métier ; l'éleveur est le dernier arrivé, celui qu'une Famine ferait partir le premier.
    await pool.query("update habitant set metier = 'chasseur' where territoire_id = $1", [t.territoireId]);
    await eleveurs([t.habitants[2]]);
    await nourriture(t.territoireId, "1000", "1000");
    expect(await lancerUnElevage(pool, t.territoireId, "souris", 1, t.ne)).toMatchObject({ lance: { quantite: 1 } });
    const client = await pool.connect();
    try {
      await client.query("begin");
      await faireRepartirUnHabitant(client, t.territoireId, new Date(t.ne.getTime() + 3_600_000).toISOString());
      await faireRepartirUnHabitant(client, t.territoireId, new Date(t.ne.getTime() + 7_200_000).toISOString());
      await client.query("commit");
    } finally {
      client.release();
    }
    const restants = (await pool.query<{ id: number }>("select id from habitant where territoire_id = $1 order by id", [t.territoireId])).rows.map((h) => h.id);
    expect(restants).toEqual([t.habitants[2]]);
  });

  it("paie au millionième près, sans toucher au reste d'un Stock, et le temps reprend de là", async () => {
    const t = await naitre();
    await reunir(t, "souris");
    await eleveurs([t.habitants[0]]);
    const unite = await cout("souris");
    // Des Stocks comme la production les laisse : des millionièmes, et un reste sous le millionième.
    await pool.query(
      `update stock set quantite = case ressource_id when 'viande' then 20.5 else 10.25 end, reste = case ressource_id when 'viande' then 1800 else 7 end,
         limite = 100000, plein_depuis = null
       where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')`,
      [t.territoireId],
    );
    expect(await lancerUnElevage(pool, t.territoireId, "souris", 1, t.ne)).toMatchObject({ lance: { quantite: 1 } });
    const apres = async () =>
      (
        await pool.query<{ ressource_id: string; quantite: string; reste: string }>(
          "select ressource_id, quantite::text, reste::text from stock where territoire_id = $1 and ressource_id in ('viande', 'vegetaux') order by ressource_id",
          [t.territoireId],
        )
      ).rows;
    // La Viande, la plus fournie, donne tout (20,5) ; les Végétaux le reste ; les restes n'ont pas bougé.
    expect(await apres()).toEqual([
      { ressource_id: "vegetaux", quantite: (10.25 - (unite - 20.5)).toFixed(6), reste: "7.000000" },
      { ressource_id: "viande", quantite: "0.000000", reste: "1800.000000" },
    ]);
    // Le temps reprend de là : une heure de production plus tard, les Stocks ont monté.
    await rattraper("territoire", t.territoireId, { pool, jusqua: new Date(t.ne.getTime() + 3_600_000) });
    const [vegetaux, viande] = await apres();
    expect(Number(vegetaux.quantite)).toBeGreaterThan(10.25 - (unite - 20.5));
    expect(Number(viande.quantite)).toBeGreaterThan(0);
  });

  it("par le temps qui avance, ne fait jamais partir en Famine un éleveur à l'Élevage : la Famine dure, ses éleveurs restent (US-0834)", async () => {
    const t = await naitre();
    await reunir(t, "souris");
    await reunir(t, "pigeon");
    await eleveurs([t.habitants[0], t.habitants[1]]);
    await pool.query("update habitant set metier = 'chasseur' where id = $1", [t.habitants[2]]);
    await nourriture(t.territoireId, "1000", "1000");
    expect(await lancerUnElevage(pool, t.territoireId, "souris", 1, t.ne)).toMatchObject({ lance: { quantite: 1 } });
    expect(await lancerUnElevage(pool, t.territoireId, "pigeon", 1, t.ne)).toMatchObject({ lance: { quantite: 1 } });
    // Plus de Nourriture, et plus de production : le Foyer passe à un voisin (comme pour les explorateurs, US-0921).
    await nourriture(t.territoireId, "0", "0");
    const voisin = await naitre();
    await pool.query("update case_du_monde set chef_id = (select chef_id from territoire where id = $2) where id = (select foyer_case_id from territoire where id = $1)", [
      t.territoireId,
      voisin.territoireId,
    ]);
    await rattraper("territoire", t.territoireId, { pool, jusqua: new Date(t.ne.getTime() + 10 * 3_600_000) });
    // Le chasseur, seul libre, est parti ; les deux éleveurs restent à l'Élevage, et la Famine dure.
    const restants = (await pool.query<{ id: number; espece_elevee: string | null }>("select id, espece_elevee from habitant where territoire_id = $1 order by id", [t.territoireId])).rows;
    expect(restants.map((h) => h.id).sort()).toEqual([t.habitants[0], t.habitants[1]].sort());
    expect(restants.every((h) => h.espece_elevee !== null)).toBe(true);
    expect((await pool.query("select famine_depuis is not null as famine from territoire where id = $1", [t.territoireId])).rows[0]).toEqual({ famine: true });
  });

  it("se lance pendant que le temps du Territoire avance, l'un après l'autre : le coût est payé une fois, jamais perdu par le rattrapage", async () => {
    // Deux Territoires nés de même (Foyer en prairie, trois Habitants), aux mêmes Stocks ; l'un lance un Élevage pendant
    // qu'il rattrape cinq heures, l'autre (le témoin) rattrape seulement : l'écart de leur Nourriture est le coût, à l'unité.
    const [t, temoin] = [await naitre(), await naitre()];
    await reunir(t, "souris");
    await eleveurs([t.habitants[0]]);
    await nourriture(t.territoireId, "100", "100");
    await nourriture(temoin.territoireId, "100", "100");
    const cinqHeures = (x: { ne: Date }) => new Date(x.ne.getTime() + 5 * 3_600_000);
    const [, lance] = await Promise.all([
      rattraper("territoire", t.territoireId, { pool, jusqua: cinqHeures(t) }),
      lancerUnElevage(pool, t.territoireId, "souris", 2, t.ne),
    ]);
    await rattraper("territoire", temoin.territoireId, { pool, jusqua: cinqHeures(temoin) });
    expect(lance).toMatchObject({ lance: { quantite: 2 } });
    /** La Nourriture du Territoire, à la plus petite unité de la production (US-0219). */
    const total = async (territoireId: number) =>
      Number(
        (
          await pool.query<{ total: string }>(
            "select sum(quantite * 3600000000 + reste)::text as total from stock where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')",
            [territoireId],
          )
        ).rows[0].total,
      ) / 3_600_000_000;
    expect((await total(temoin.territoireId)) - (await total(t.territoireId))).toBeCloseTo(2 * (await cout("souris")), 6);
  });
});

