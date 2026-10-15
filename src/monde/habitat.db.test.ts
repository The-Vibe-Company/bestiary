import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { PLACES_DE_L_HABITAT_DU_FOYER } from "@/reglages";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { subirLesCombats } from "@/expeditions/pertes";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { reunirLesCouples } from "./couple";
import { dureeDUneBeteEleveeMinutes } from "./cout-d-elevage";
import { placesDeLHabitat } from "./habitat";
import { lancerUnElevage } from "./lancer-un-elevage";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai des Places du Foyer (US-0822)";

describe.skipIf(!URL_TEST)("les Places de l'Habitat du Foyer (US-0822, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `places-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;

  /** Un joueur qui vient de naître, sans aucune Bête (ADR 0008) : son Territoire. */
  const nouveauTerritoire = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Plc", suffixe, numero), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    return (await territoireDuCompte(pool, compte.id))!;
  };
  /** Des Bêtes dans l'effectif du Territoire : une ligne par Espèce et par sexe, avec leur nombre. */
  const ajouter = (territoireId: number, lignes: [string, "male" | "femelle", number][]) =>
    pool.query(
      `insert into effectif (territoire_id, espece_id, sexe, nombre)
       select $1, e, s::sexe, n from unnest($2::text[], $3::text[], $4::int[]) as l(e, s, n)`,
      [territoireId, lignes.map((l) => l[0]), lignes.map((l) => l[1]), lignes.map((l) => l[2])],
    );
  /** La taille d'une Bête de l'Espèce `id`, en Places, telle qu'elle est en base (docs/adr/0007). */
  const taille = async (id: string) => (await pool.query<{ taille: number }>("select taille from espece where id = $1", [id])).rows[0].taille;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("offre au Foyer le nombre de Places des réglages du jeu, aucune prise tant que le joueur n'a pas de Bête", async () => {
    const t = await nouveauTerritoire();
    expect(PLACES_DE_L_HABITAT_DU_FOYER).toBeGreaterThan(0);
    expect(await placesDeLHabitat(pool, t)).toEqual({ occupees: 0, total: PLACES_DE_L_HABITAT_DU_FOYER });
  });

  it("compte prises les Places de chaque Bête de l'effectif selon la taille de son Espèce : leur somme exacte", async () => {
    const [t, voisin] = [await nouveauTerritoire(), await nouveauTerritoire()];
    await ajouter(t, [
      ["souris", "male", 2],
      ["souris", "femelle", 1],
      ["pigeon", "femelle", 2],
    ]);
    await ajouter(voisin, [["poule", "male", 5]]);
    // Une souris occupe 1 Place, un pigeon 8,556 (docs/adr/0007) ; jamais les Bêtes d'un autre joueur.
    expect([await taille("souris"), await taille("pigeon")]).toEqual([1, 8.556]);
    expect(await placesDeLHabitat(pool, t)).toEqual({ occupees: 20.112, total: PLACES_DE_L_HABITAT_DU_FOYER });
  });

  it("ne laisse pas une poussière de calcul déborder d'une Place : 1 pigeon et 28 poules prennent 894 Places tout rond", async () => {
    const t = await nouveauTerritoire();
    await ajouter(t, [
      ["pigeon", "femelle", 1],
      ["poule", "femelle", 28],
    ]);
    // 8,556 + 28 × 31,623 = 894 ; la somme en virgule flottante vaut 894,000…1 avant d'être arrondie au millionième.
    expect((await placesDeLHabitat(pool, t)).occupees).toBe(894);
  });

  it("compte les Bêtes sorties en escorte, qui gardent leur Place pour rentrer, pas celles du Couple, en Réserve", async () => {
    const t = await nouveauTerritoire();
    await ajouter(t, [
      ["souris", "male", 3],
      ["souris", "femelle", 2],
    ]);
    const { rows } = await pool.query<{ id: number }>(
      `insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes)
       select $1, c.id, now(), 30, 60 from case_du_monde c where c.monde_id = $2 and c.chef_id is null order by c.id limit 1 returning id`,
      [t, mondeId],
    );
    await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, 'souris', 1)", [rows[0].id]);
    expect((await placesDeLHabitat(pool, t)).occupees).toBe(5);
    // Le Couple de souris (un mâle et une femelle) part en Réserve : deux Places se libèrent.
    const client = await pool.connect();
    try {
      expect(await reunirLesCouples(client, t, new Date())).toEqual(["souris"]);
    } finally {
      client.release();
    }
    expect((await placesDeLHabitat(pool, t)).occupees).toBe(3);
  });

  describe("occuper des Places selon la taille (US-0824)", () => {
    /** Réunit au Territoire le Couple de l'Espèce `especeId` à l'instant `le`, comme au retour d'une Expédition (US-0956). */
    const reunir = async (territoireId: number, especeId: string, le: Date) => {
      await ajouter(territoireId, [
        [especeId, "male", 1],
        [especeId, "femelle", 1],
      ]);
      const client = await pool.connect();
      try {
        expect(await reunirLesCouples(client, territoireId, le)).toEqual([especeId]);
      } finally {
        client.release();
      }
    };
    /** Les Places prises, arrondies comme le compteur de la page les lit (au millionième, US-0822). */
    const prises = async (territoireId: number) => (await placesDeLHabitat(pool, territoireId)).occupees;

    it("chaque Bête née occupe autant de Places que la taille de son Espèce, dès sa naissance (US-0817)", async () => {
      const t = await nouveauTerritoire();
      const ne = await lireMarquePage(pool, "territoire", t);
      // Le Couple de poules part en Réserve, sans Place (US-0822) ; un éleveur ; de quoi payer l'Élevage.
      await reunir(t, "poule", ne);
      expect(await prises(t)).toBe(0);
      await pool.query("update habitant set metier = 'eleveur' where id = (select min(id) from habitant where territoire_id = $1)", [t]);
      await pool.query("update stock set quantite = 100000, limite = 1000000, reste = 0, plein_depuis = null where territoire_id = $1", [t]);
      const [poule, debut] = [await taille("poule"), new Date(ne.getTime() + 60_000)];
      expect(poule).toBeGreaterThan(1);
      expect(await lancerUnElevage(pool, t, "poule", 2, debut)).toMatchObject({ lance: { quantite: 2 } });
      const naissance = (k: number) => new Date(debut.getTime() + k * dureeDUneBeteEleveeMinutes(poule) * 60_000);
      // Rien avant la première naissance ; chacune prend aussitôt la taille d'une poule, en Places.
      await rattraper("territoire", t, { pool, jusqua: new Date(naissance(1).getTime() - 1) });
      expect(await prises(t)).toBe(0);
      await rattraper("territoire", t, { pool, jusqua: naissance(1) });
      expect(await prises(t)).toBe(poule);
      await rattraper("territoire", t, { pool, jusqua: naissance(2) });
      expect(await prises(t)).toBe(2 * poule);
    }, 60_000);

    it("une Bête tuée au combat quitte l'effectif et libère aussitôt ses Places ; une Blessée, restée dans l'effectif, garde les siennes", async () => {
      const t = await nouveauTerritoire();
      await ajouter(t, [["pigeon", "male", 10]]);
      const pigeon = await taille("pigeon");
      // Les dix pigeons partent en escorte : ils gardent leurs Places, pour rentrer.
      const { rows } = await pool.query<{ id: number }>(
        `insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes)
         select $1, c.id, now(), 30, 60 from case_du_monde c where c.monde_id = $2 and c.chef_id is null order by c.id limit 1 returning id`,
        [t, mondeId],
      );
      await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, 'pigeon', 10)", [rows[0].id]);
      expect(await prises(t)).toBeCloseTo(10 * pigeon, 6);
      // L'Espèce la plus forte du jeu les attaque (US-0944) : ses mortes quittent l'effectif, ses Blessés y restent (US-0951).
      const { rows: forte } = await pool.query<{ id: string }>("select id from espece order by attaque * vie desc, id limit 1");
      await subirLesCombats(pool, [{ expeditionId: rows[0].id, especeId: forte[0].id, le: new Date(), numero: 1, beteDeNaissanceId: null }]);
      const { rows: escorte } = await pool.query<{ perdues: number; blessees: number }>("select perdues, blessees from expedition_escorte where expedition_id = $1", [
        rows[0].id,
      ]);
      const mortes = escorte[0].perdues - escorte[0].blessees;
      expect(mortes).toBeGreaterThan(0);
      expect(escorte[0].blessees).toBeGreaterThan(0);
      expect(await prises(t)).toBeCloseTo((10 - mortes) * pigeon, 6);
    });
  });
});
