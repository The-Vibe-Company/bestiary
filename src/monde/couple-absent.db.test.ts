// US-0960 : le Couple se forme correctement quand le mâle ou la femelle n'est pas au Foyer. Le départ retient le sexe de
// son escorte, le combat prend ses mortes à l'escorte partie, et le Couple se forme dès qu'un mâle et une femelle sont au
// Foyer, Blessés compris. Les Expéditions des essais séjournent là où rien ne se montre : aucune Rencontre, donc aucun
// combat que ceux que l'essai livre lui-même (subirLesCombats), contre la plus forte des Espèces du jeu.
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { EtatAuBestiaire } from "@/bestiaire/bestiaire";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { dureeDuTrajetMinutes } from "@/expeditions/allure";
import { sexesDesPertes } from "@/expeditions/combat";
import { lancerLExpedition } from "@/expeditions/depart";
import { subirLesCombats } from "@/expeditions/pertes";
import { type HorairesDUneExpedition, retourDUneExpedition } from "@/expeditions/phase";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { betesSauvagesDesCases } from "./betes-sauvages";
import { couplesDuTerritoire, reunirLesCouples } from "./couple";
import { betesDisponibles, blessesParEspece, malesPris } from "./effectif";
import type { Coordonnees } from "./hex";
import { rolesAuFoyer } from "./roles";

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du Couple dont une Bête n'est pas au Foyer (US-0960)";

describe.skipIf(!URL_TEST)("le mâle ou la femelle n'est pas au Foyer (US-0960, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  /** La plus forte des Espèces du jeu : contre elle, toute escorte perd toutes ses Bêtes. */
  let fort: string;
  /** La vitesse de chaque Espèce du jeu, en km/h : celle des escortes des essais. */
  const vitesses = new Map<string, number>();
  const lancement = `couple-absent-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  const nes: string[] = [];
  const apres = (instant: Date, ms: number) => new Date(instant.getTime() + ms);

  /** Un chef qui vient de naître dans le Monde d'essai, avec deux explorateurs : son Territoire et l'instant de sa naissance. */
  const naitre = async () => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Abs", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query(
      `with partis as (delete from habitant where territoire_id = $1)
       insert into habitant (territoire_id, prenom, metier) values ($1, 'Joran', 'explorateur'), ($1, 'Ilda', 'explorateur')`,
      [territoireId],
    );
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /** Les souris du Territoire au Foyer comme au dehors, mâles puis femelles, comme l'effectif les compte. */
  const souris = async (territoireId: number) => {
    const { rows } = await pool.query<{ sexe: string; nombre: number }>(
      "select sexe, nombre from effectif where territoire_id = $1 and espece_id = 'souris' order by sexe",
      [territoireId],
    );
    return Object.fromEntries(rows.map((r) => [r.sexe, r.nombre]));
  };
  /** Des Bêtes de l'Espèce `espece` (des souris d'abord) de plus dans l'effectif du Territoire, `males` mâles et `femelles` femelles. */
  const ajouter = (territoireId: number, males: number, femelles: number, espece = "souris") =>
    pool.query(
      `insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $4, 'male', $2), ($1, $4, 'femelle', $3)
       on conflict (territoire_id, espece_id, sexe) do update set nombre = effectif.nombre + excluded.nombre`,
      [territoireId, males, femelles, espece],
    );
  /**
   * Des Bêtes de l'Espèce `espece` (des souris d'abord) arrivent au Foyer à `le`, comme une Bête apprivoisée au retour d'une
   * Expédition : le Couple se forme s'il le peut.
   */
  const arrivent = async (territoireId: number, le: Date, males: number, femelles: number, espece = "souris") => {
    await rattraper("territoire", territoireId, { pool, jusqua: le });
    await ajouter(territoireId, males, femelles, espece);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await reunirLesCouples(client, territoireId, le);
      await client.query("commit");
    } finally {
      client.release();
    }
  };
  /**
   * Un explorateur part à `instant`, escorté de `nombre` Bêtes de l'Espèce `espece` (des souris d'abord), vers une Case libre à deux Cases du Foyer où aucune Bête ne
   * se montre de son départ à son retour : son Expédition, le sexe retenu de son escorte et l'instant de son retour.
   */
  const partir = async (territoireId: number, instant: Date, nombre: number, espece = "souris") => {
    await rattraper("territoire", territoireId, { pool, jusqua: instant });
    const { rows } = await pool.query<Coordonnees & { id: number }>(
      `select c.id, c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = 2
         and not exists (select 1 from bete_de_naissance n where n.case_id = c.id)
       order by c.q, c.r`,
      [territoireId],
    );
    const aller = dureeDuTrajetMinutes(2, [{ vitesse: vitesses.get(espece)!, nombre }]);
    const sauvages = await betesSauvagesDesCases(pool, rows.map((c) => c.id), instant, apres(instant, (2 * aller + 60 + 1) * MINUTE));
    const calme = rows.find((c) => sauvages.get(c.id)!.length === 0);
    if (!calme) throw new Error("Aucune Case à deux Cases du Foyer où rien ne se montre pendant l'Expédition.");
    const depart = await lancerLExpedition(
      pool,
      territoireId,
      { destination: { q: calme.q, r: calme.r }, explorateurs: 1, escorte: new Map([[espece, nombre]]), sejourMinutes: 60 },
      instant,
    );
    if (!("expeditionId" in depart)) throw new Error(depart.refus);
    const { rows: x } = await pool.query<HorairesDUneExpedition & { males: number | null }>(
      `select x.part_le as "partLe", x.trajet_minutes as "trajetMinutes", x.sejour_minutes as "sejourMinutes", s.males
       from expedition x join expedition_escorte s on s.expedition_id = x.id where x.id = $1`,
      [depart.expeditionId],
    );
    return { expeditionId: depart.expeditionId, males: x[0].males, retour: retourDUneExpedition(x[0])! };
  };
  /** L'Expédition `expeditionId` est attaquée à `le` par la plus forte des Espèces du jeu : son escorte perd toutes ses Bêtes. */
  const combat = async (territoireId: number, x: { expeditionId: number; retour: Date }, le: Date) => {
    expect(le < x.retour).toBe(true);
    await rattraper("territoire", territoireId, { pool, jusqua: le });
    await subirLesCombats(pool, [{ expeditionId: x.expeditionId, especeId: fort, le, numero: null, beteDeNaissanceId: null }]);
  };
  const auBestiaire = async (territoireId: number) =>
    (await pool.query<{ etat: EtatAuBestiaire }>("select etat from bestiaire where territoire_id = $1 and espece_id = 'souris'", [territoireId])).rows[0]?.etat;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    fort = (await pool.query<{ id: string }>("select id from espece order by attaque::numeric * vie desc, id limit 1")).rows[0].id;
    for (const { id, vitesse } of (await pool.query<{ id: string; vitesse: number }>("select id, vitesse from espece")).rows) vitesses.set(id, vitesse);
  });
  afterEach(async () => {
    await pool.query("delete from compte where email = any($1)", [nes.splice(0)]);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("la règle des sexes s'écrit aussi en SQL : les mêmes mâles pris que sexesDesPertes, pour toute escorte", async () => {
    const { rows } = await pool.query<{ m: number; f: number; k: number; males: number }>(
      `select m, f, k, ${malesPris("m", "f", "k")} as males
       from generate_series(0, 6) m, generate_series(0, 6) f, generate_series(0, 12) k where k <= m + f`,
    );
    expect(rows.length).toBeGreaterThan(100);
    for (const { m, f, k, males } of rows) expect(males, `${m} mâles, ${f} femelles, ${k} prises`).toBe(sexesDesPertes({ males: m, femelles: f }, k).males);
  });

  it("le départ retient le sexe de son escorte, prise aux Bêtes valides du Foyer, au sexe le plus nombreux, un mâle à égalité", async () => {
    const t = await naitre();
    await ajouter(t.territoireId, 3, 0);
    expect((await partir(t.territoireId, apres(t.ne, HEURE), 2)).males).toBe(2);
    const u = await naitre();
    await ajouter(u.territoireId, 0, 2);
    expect((await partir(u.territoireId, apres(u.ne, HEURE), 1)).males).toBe(0);
    // Mâles et femelles au Foyer ensemble, comme après un Couple réuni : trois mâles et deux femelles ; trois partent, un
    // mâle, puis à égalité un mâle, puis une femelle.
    const v = await naitre();
    await ajouter(v.territoireId, 3, 2);
    expect((await partir(v.territoireId, apres(v.ne, HEURE), 3)).males).toBe(2);
  });

  describe("si l'une des deux Bêtes est en Expédition, le Couple se forme à son retour, si elle revient vivante", () => {
    it("un mâle sorti, un autre au Foyer : la femelle qui arrive forme le Couple aussitôt, sans attendre le retour de l'escorte", async () => {
      const t = await naitre();
      await ajouter(t.territoireId, 2, 0);
      const x = await partir(t.territoireId, apres(t.ne, HEURE), 1);
      const le = apres(t.ne, 2 * HEURE);
      expect(le < x.retour).toBe(true);
      await arrivent(t.territoireId, le, 0, 1);
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId: "souris", reuniLe: le }]);
      // Le mâle sorti reste dans l'effectif, et rentre ensuite comme les autres Bêtes de l'escorte.
      expect(await souris(t.territoireId)).toEqual({ male: 1, femelle: 0 });
    });

    it("le seul mâle sorti : le Couple attend son retour, même quand un autre mâle est encore dehors, et se forme à cet instant", async () => {
      const t = await naitre();
      await ajouter(t.territoireId, 2, 0);
      const premier = await partir(t.territoireId, apres(t.ne, HEURE), 1);
      // Le second part plus tard, et rentre après le premier.
      const second = await partir(t.territoireId, apres(t.ne, 2 * HEURE), 1);
      expect(second.retour > premier.retour).toBe(true);
      await arrivent(t.territoireId, apres(t.ne, 3 * HEURE), 0, 1);
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([]);

      await rattraper("territoire", t.territoireId, { pool, jusqua: premier.retour });
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId: "souris", reuniLe: premier.retour }]);
      expect(await auBestiaire(t.territoireId)).toBe("couple_reuni");
    });

    it("le combat prend ses mortes à l'escorte : jamais une Bête restée au Foyer, même d'un sexe plus nombreux", async () => {
      const t = await naitre();
      await ajouter(t.territoireId, 4, 0);
      const x = await partir(t.territoireId, apres(t.ne, HEURE), 4);
      // Pendant que ses quatre mâles sont dehors, cinq femelles arrivent : plus nombreuses, aucune n'est au combat.
      await arrivent(t.territoireId, apres(t.ne, 2 * HEURE), 0, 5);
      await combat(t.territoireId, x, apres(t.ne, 3 * HEURE));
      const { rows } = await pool.query("select perdues, blessees from expedition_escorte where expedition_id = $1", [x.expeditionId]);
      expect(rows[0]).toEqual({ perdues: 4, blessees: 2 });
      // Deux mâles morts ; les deux autres, Blessés, rentrent avec l'Expédition.
      expect(await souris(t.territoireId)).toEqual({ male: 2, femelle: 5 });
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([]);
    });

    it("combat après combat, sur une escorte où les femelles sont les plus nombreuses : les mortes de chacun prises à l'escorte partie", async () => {
      const t = await naitre();
      // Un mâle et trois femelles au Foyer, comme après un Couple réuni : les quatre partent.
      await ajouter(t.territoireId, 1, 3);
      const x = await partir(t.territoireId, apres(t.ne, HEURE), 4);
      expect(x.males).toBe(1);
      // Un premier combat a déjà pris deux Bêtes, dont une Blessée : la morte, une femelle (la plus nombreuse), a quitté
      // l'effectif.
      await pool.query("update expedition_escorte set perdues = 2, blessees = 1 where expedition_id = $1", [x.expeditionId]);
      await pool.query("update effectif set nombre = nombre - 1 where territoire_id = $1 and espece_id = 'souris' and sexe = 'femelle'", [t.territoireId]);
      // Le second prend les deux qui restent : l'une Blessée, l'autre morte, encore une femelle.
      await combat(t.territoireId, x, apres(t.ne, 2 * HEURE));
      const { rows } = await pool.query("select perdues, blessees from expedition_escorte where expedition_id = $1", [x.expeditionId]);
      expect(rows[0]).toEqual({ perdues: 4, blessees: 2 });
      expect(await souris(t.territoireId)).toEqual({ male: 1, femelle: 1 });
      // Le mâle et la femelle qui restent, Blessés, rentrent ensemble : le Couple se forme à leur retour.
      await rattraper("territoire", t.territoireId, { pool, jusqua: x.retour });
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId: "souris", reuniLe: x.retour }]);
    });

    it("une escorte partie avant que le départ ne retienne le sexe compte pour l'un et pour l'autre : le départ suivant ne sait pas non plus", async () => {
      const t = await naitre();
      await ajouter(t.territoireId, 2, 0);
      const { rows } = await pool.query<{ id: number }>(
        `insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes)
         select $1, c.id, $2, 30, 60 from case_du_monde c where c.monde_id = $3 and c.chef_id is null order by c.id limit 1 returning id`,
        [t.territoireId, t.ne, mondeId],
      );
      await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, 'souris', 1)", [rows[0].id]);
      expect((await betesDisponibles(pool, t.territoireId, t.ne)).map((e) => [e.id, e.disponibles])).toEqual([["souris", 1]]);
      expect((await partir(t.territoireId, apres(t.ne, 10 * MINUTE), 1)).males).toBeNull();
    });
  });

  describe("si l'une est Blessée, le Couple se forme aussitôt et elle guérit en Réserve", () => {
    it("le seul mâle rentré Blessé forme le Couple à son retour ; parti en Réserve, il n'est plus un Blessé au Foyer", async () => {
      const t = await naitre();
      await ajouter(t.territoireId, 2, 0);
      const x = await partir(t.territoireId, apres(t.ne, HEURE), 2);
      await arrivent(t.territoireId, apres(t.ne, 2 * HEURE), 0, 3);
      await combat(t.territoireId, x, apres(t.ne, 3 * HEURE));
      // Un mâle mort, l'autre Blessé : le seul mâle de l'Espèce.
      expect(await souris(t.territoireId)).toEqual({ male: 1, femelle: 3 });

      await rattraper("territoire", t.territoireId, { pool, jusqua: x.retour });
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId: "souris", reuniLe: x.retour }]);
      expect(await souris(t.territoireId)).toEqual({ male: 0, femelle: 2 });
      // Les deux femelles restées au Foyer sont valides : ni Blessées, ni retenues.
      expect(await blessesParEspece(pool, t.territoireId, x.retour)).toEqual(new Map());
      expect((await betesDisponibles(pool, t.territoireId, x.retour)).map((e) => [e.id, e.disponibles, e.blesses])).toEqual([["souris", 2, undefined]]);
    });

    it("les Bêtes valides que le joueur peut affecter à leur Rôle (US-0837) sont les disponibles de l'escorte : le Blessé parti en Réserve n'en retient aucune", async () => {
      const t = await naitre();
      await ajouter(t.territoireId, 2, 0, "poule");
      const x = await partir(t.territoireId, apres(t.ne, HEURE), 2, "poule");
      await arrivent(t.territoireId, apres(t.ne, 2 * HEURE), 0, 3, "poule");
      await combat(t.territoireId, x, apres(t.ne, 3 * HEURE));
      await rattraper("territoire", t.territoireId, { pool, jusqua: x.retour });
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId: "poule", reuniLe: x.retour }]);
      expect((await betesDisponibles(pool, t.territoireId, x.retour)).map((e) => [e.id, e.disponibles])).toEqual([["poule", 2]]);
      expect((await rolesAuFoyer(pool, t.territoireId, x.retour)).get("poule")).toMatchObject({ valides: 2 });
    });

    it("une escorte plus nombreuse que l'effectif, comme un état réparé à la main : aucune Bête valide au Foyer, jamais un nombre négatif", async () => {
      const t = await naitre();
      await ajouter(t.territoireId, 2, 0, "poule");
      const { rows } = await pool.query<{ id: number }>(
        `insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes)
         select $1, c.id, $2, 30, 60 from case_du_monde c where c.monde_id = $3 and c.chef_id is null order by c.id limit 1 returning id`,
        [t.territoireId, t.ne, mondeId],
      );
      await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, 'poule', 10)", [rows[0].id]);
      expect((await rolesAuFoyer(pool, t.territoireId, t.ne)).get("poule")).toMatchObject({ valides: 0 });
    });

    it("parmi plusieurs Bêtes d'un sexe, le Couple en prend une valide : les Blessés restent au Foyer, à guérir", async () => {
      const t = await naitre();
      await ajouter(t.territoireId, 3, 0);
      const x = await partir(t.territoireId, apres(t.ne, HEURE), 2);
      await combat(t.territoireId, x, apres(t.ne, 2 * HEURE));
      await rattraper("territoire", t.territoireId, { pool, jusqua: x.retour });
      // Au Foyer : le mâle resté et le mâle Blessé. Une femelle arrive.
      expect(await blessesParEspece(pool, t.territoireId, x.retour)).toEqual(new Map([["souris", 1]]));
      const le = apres(x.retour, HEURE);
      await arrivent(t.territoireId, le, 0, 1);
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId: "souris", reuniLe: le }]);
      expect(await souris(t.territoireId)).toEqual({ male: 1, femelle: 0 });
      expect(await blessesParEspece(pool, t.territoireId, le)).toEqual(new Map([["souris", 1]]));
      expect((await betesDisponibles(pool, t.territoireId, le)).map((e) => [e.id, e.disponibles, e.blesses])).toEqual([["souris", 0, 1]]);
    });
  });

  it("si la seule Bête d'un sexe meurt avant l'arrivée de l'autre, aucun Couple ne se forme ; l'Espèce reste « apprivoisée »", async () => {
    const t = await naitre();
    await ajouter(t.territoireId, 0, 1);
    await pool.query("insert into bestiaire (territoire_id, espece_id, etat, croisee_le) values ($1, 'souris', 'apprivoisee', $2)", [t.territoireId, t.ne]);
    const x = await partir(t.territoireId, apres(t.ne, HEURE), 1);
    expect(x.males).toBe(0);
    // Morte au combat, posée telle quelle : le combat ne tue jamais la seule Bête qu'il prend à une escorte, qui n'est que
    // Blessée (US-0951), ni la dernière d'un sexe tant que l'autre en compte plus (sexesDesPertes).
    await pool.query("update expedition_escorte set perdues = 1 where expedition_id = $1", [x.expeditionId]);
    await pool.query("update effectif set nombre = 0 where territoire_id = $1 and espece_id = 'souris' and sexe = 'femelle'", [t.territoireId]);
    await arrivent(t.territoireId, apres(t.ne, 2 * HEURE), 1, 0);
    await rattraper("territoire", t.territoireId, { pool, jusqua: x.retour });
    expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([]);
    expect(await souris(t.territoireId)).toEqual({ male: 1, femelle: 0 });
    expect(await auBestiaire(t.territoireId)).toBe("apprivoisee");
  });
});
