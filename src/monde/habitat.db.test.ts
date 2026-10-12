import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { PLACES_DE_L_HABITAT_DU_FOYER } from "@/reglages";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { reunirLesCouples } from "./couple";
import { placesDeLHabitat } from "./habitat";

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
});
