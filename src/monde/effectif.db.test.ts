import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { forceDUneBete } from "@/expeditions/force";
import { mondeDEssai, poolDeTest, preparerMondeDeTest, territoireDuCompte, URL_TEST } from "@/test/base";
import { betesDisponibles, faireEntrerDansLEffectif } from "./effectif";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de l'escorte (US-0904)";

describe.skipIf(!URL_TEST)("les Bêtes disponibles pour l'escorte (US-0904, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `effectif-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let numero = 0;

  /** Un joueur qui vient de naître, sans aucune Bête (ADR 0008) : son compte et son Territoire. */
  const nouveauTerritoire = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    const nom = `Eff${lancement.slice(-5).replace(/[^a-z]/g, "x")}${"abcdefghij"[Math.floor(numero / 10) % 10]}${"abcdefghij"[numero % 10]}`;
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    return { compteId: compte.id, territoireId: (await territoireDuCompte(pool, compte.id))! };
  };
  /** Des Bêtes dans l'effectif du Territoire : une ligne par Espèce et par sexe, avec leur nombre. */
  const ajouter = (territoireId: number, lignes: [string, "male" | "femelle", number][]) =>
    pool.query(
      `insert into effectif (territoire_id, espece_id, sexe, nombre)
       select $1, e, s::sexe, n from unnest($2::text[], $3::text[], $4::int[]) as l(e, s, n)`,
      [territoireId, lignes.map((l) => l[0]), lignes.map((l) => l[1]), lignes.map((l) => l[2])],
    );
  /** Les Bêtes de l'effectif du Territoire, toutes lignes comprises. */
  const lignesDeLEffectif = async (territoireId: number) =>
    (await pool.query<{ n: number }>("select count(*)::int as n from effectif where territoire_id = $1", [territoireId])).rows[0].n;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("ne propose aucune Bête à un joueur qui vient de naître : il n'en a pas", async () => {
    const { territoireId } = await nouveauTerritoire();
    expect(await betesDisponibles(pool, territoireId)).toEqual([]);
    expect(await lignesDeLEffectif(territoireId)).toBe(0);
  });

  it("propose chaque Espèce de l'effectif du Territoire, mâles et femelles ensemble, avec son nom et son illustration", async () => {
    const t = (await nouveauTerritoire()).territoireId;
    const voisin = (await nouveauTerritoire()).territoireId;
    await ajouter(t, [
      ["souris", "male", 2],
      ["souris", "femelle", 1],
      ["poule", "femelle", 1],
    ]);
    await ajouter(voisin, [
      ["pigeon", "male", 5],
      ["souris", "male", 7],
    ]);
    // Ni le pigeon ni les souris d'un autre Territoire ; de la plus commune à la plus rare, puis par nom.
    expect(await betesDisponibles(pool, t)).toEqual([
      { id: "poule", nom: "Poule", illustration: "especes/poule.webp", disponibles: 1, force: 9457, vitesse: 14, males: 0, femelles: 1, coupleReuni: false },
      { id: "souris", nom: "Souris grise", illustration: "especes/souris.webp", disponibles: 3, force: 473, vitesse: 13, males: 2, femelles: 1, coupleReuni: false },
    ]);
  });

  it("range une Espèce plus rare après les communes, même sans illustration", async () => {
    const t = (await nouveauTerritoire()).territoireId;
    // La plus rare des Espèces chargées, sans illustration : l'une des Espèces d'essai (US-0924), jamais nommée ici.
    const { rows } = await pool.query<{ id: string; nom: string; attaque: number; vie: number; vitesse: number }>(
      `select e.id, e.nom, e.attaque, e.vie, e.vitesse from espece e join rarete r on r.id = e.rarete_id where e.illustration is null order by r.rang desc, e.id limit 1`,
    );
    const [rare] = rows;
    await ajouter(t, [
      [rare.id, "femelle", 1],
      ["souris", "male", 4],
    ]);
    expect(await betesDisponibles(pool, t)).toEqual([
      { id: "souris", nom: "Souris grise", illustration: "especes/souris.webp", disponibles: 4, force: 473, vitesse: 13, males: 4, femelles: 0, coupleReuni: false },
      { id: rare.id, nom: rare.nom, illustration: null, disponibles: 1, force: forceDUneBete(rare), vitesse: rare.vitesse, males: 0, femelles: 1, coupleReuni: false },
    ]);
  });

  it("donne à chaque Bête la force de son Espèce (US-0905) : la même pour toutes, chez tous les joueurs, sans rien du Territoire", async () => {
    const [t, voisin] = [(await nouveauTerritoire()).territoireId, (await nouveauTerritoire()).territoireId];
    await ajouter(t, [
      ["souris", "male", 1],
      ["pigeon", "femelle", 2],
    ]);
    await ajouter(voisin, [
      ["souris", "femelle", 30],
      ["pigeon", "male", 1],
    ]);
    // Tirée de l'attaque et de la vie de l'Espèce, telles qu'elles sont en base : aucune Recherche n'y entre (ADR 0005).
    const { rows } = await pool.query<{ id: string; attaque: number; vie: number }>(
      "select id, attaque, vie from espece where id in ('pigeon', 'souris') order by id",
    );
    const attendues = rows.map((e) => [e.id, forceDUneBete(e)]);
    expect(attendues).toEqual([
      ["pigeon", 2216],
      ["souris", 473],
    ]);
    for (const territoireId of [t, voisin]) {
      expect((await betesDisponibles(pool, territoireId)).map((e) => [e.id, e.force])).toEqual(attendues);
    }
  });

  it("ne propose pas une Espèce dont il ne reste aucune Bête", async () => {
    const t = (await nouveauTerritoire()).territoireId;
    await ajouter(t, [
      ["souris", "male", 0],
      ["souris", "femelle", 0],
      ["poule", "male", 2],
    ]);
    expect((await betesDisponibles(pool, t)).map((e) => [e.id, e.disponibles])).toEqual([["poule", 2]]);
  });

  it("suit l'effectif : une Bête de plus compte aussitôt", async () => {
    const t = (await nouveauTerritoire()).territoireId;
    await ajouter(t, [["pigeon", "male", 1]]);
    expect((await betesDisponibles(pool, t)).map((e) => e.disponibles)).toEqual([1]);
    await pool.query("update effectif set nombre = nombre + 2 where territoire_id = $1", [t]);
    expect((await betesDisponibles(pool, t)).map((e) => e.disponibles)).toEqual([3]);
  });

  it("compte, Espèce par Espèce, les mâles et les femelles que le joueur possède, Bêtes sorties en escorte comprises (US-0937)", async () => {
    const t = (await nouveauTerritoire()).territoireId;
    await ajouter(t, [
      ["souris", "male", 2],
      ["souris", "femelle", 1],
      ["poule", "femelle", 1],
    ]);
    // Deux souris parties en escorte : l'escorte ne choisit pas le sexe, et le joueur les possède toujours.
    const { rows } = await pool.query<{ id: number }>(
      `insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes)
       select $1, c.id, now(), 30, 60 from case_du_monde c where c.monde_id = $2 and c.chef_id is null order by c.id limit 1 returning id`,
      [t, mondeId],
    );
    await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, 'souris', 2)", [rows[0].id]);
    expect((await betesDisponibles(pool, t)).map((e) => [e.id, e.disponibles, e.males, e.femelles])).toEqual([
      ["poule", 1, 0, 1],
      ["souris", 1, 2, 1],
    ]);
  });

  it("dit, Espèce par Espèce, si son Couple est réuni (US-0956) : seul le sien, sur ce Territoire", async () => {
    const [t, voisin] = [(await nouveauTerritoire()).territoireId, (await nouveauTerritoire()).territoireId];
    await ajouter(t, [
      ["souris", "male", 2],
      ["poule", "femelle", 1],
    ]);
    await ajouter(voisin, [["poule", "male", 1]]);
    await pool.query("insert into couple (territoire_id, espece_id, reuni_le) values ($1, 'souris', now()), ($2, 'poule', now())", [t, voisin]);
    expect((await betesDisponibles(pool, t)).map((e) => [e.id, e.coupleReuni])).toEqual([
      ["poule", false],
      ["souris", true],
    ]);
  });

  it("refuse un nombre de Bêtes négatif, un sexe inconnu, une Espèce inconnue, et deux lignes pour la même Espèce et le même sexe", async () => {
    const t = (await nouveauTerritoire()).territoireId;
    await expect(ajouter(t, [["souris", "male", -1]])).rejects.toThrow(/effectif_jamais_negatif/);
    await expect(pool.query("insert into effectif values ($1, 'souris', 'hermaphrodite', 1)", [t])).rejects.toThrow(/sexe/);
    await expect(ajouter(t, [["espece_inconnue", "male", 1]])).rejects.toThrow(/effectif_espece_id_espece_id_fk/);
    await ajouter(t, [["souris", "male", 1]]);
    await expect(ajouter(t, [["souris", "male", 1]])).rejects.toThrow(/effectif_territoire_id_espece_id_sexe_pk/);
  });

  it("part avec le Territoire", async () => {
    const { compteId, territoireId } = await nouveauTerritoire();
    await ajouter(territoireId, [
      ["souris", "male", 3],
      ["poule", "femelle", 1],
    ]);
    expect(await lignesDeLEffectif(territoireId)).toBe(2);
    await pool.query("delete from compte where id = $1", [compteId]);
    expect(await lignesDeLEffectif(territoireId)).toBe(0);
  });

  it("fait entrer des Bêtes apprivoisées dans l'effectif, chacune à la ligne de son Espèce et de son sexe, créée au besoin (US-0938)", async () => {
    const t = (await nouveauTerritoire()).territoireId;
    await ajouter(t, [["souris", "male", 2]]);
    await faireEntrerDansLEffectif(pool, t, [
      { especeId: "souris", sexe: "male" },
      { especeId: "poule", sexe: "femelle" },
      { especeId: "souris", sexe: "male" },
    ]);
    await faireEntrerDansLEffectif(pool, t, []);
    const { rows } = await pool.query("select espece_id, sexe, nombre from effectif where territoire_id = $1 order by espece_id, sexe", [t]);
    expect(rows).toEqual([
      { espece_id: "poule", sexe: "femelle", nombre: 1 },
      { espece_id: "souris", sexe: "male", nombre: 4 },
    ]);
  });
});
