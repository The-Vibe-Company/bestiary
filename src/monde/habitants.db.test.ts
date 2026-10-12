import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef, naitreSurLaCouronne } from "@/chefs/chef";
import { cleDuNom } from "@/chefs/nom";
import { creerCompte } from "@/comptes/compte";
import { MIGRATIONS_FOLDER } from "@/db/migrations";
import { lireJeu } from "@/donnees/charger";
import { PRENOMS } from "@/donnees/jeux";
import { ENTRETIEN_HABITANT_PAR_HEURE, PLACES_DU_FOYER } from "@/reglages";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { famineDepuis } from "./famine";
import {
  ajouterUnHabitantAuMetier,
  enregistrerLeMetier,
  entretienDesHabitants,
  habitantsDuTerritoire,
  nombreDHabitants,
  nombreSansMetier,
  placesDuTerritoire,
  plusDePlace,
  recitDeRenvoi,
  renvoyerLHabitant,
  retirerUnHabitantDuMetier,
} from "./habitants";
import { recitsDuTerritoire } from "./recits";
import { stocksDuTerritoire } from "./stocks";
import { nombreDeVoyageurs } from "./voyageurs";

/** L'instruction de la migration US-0303 qui nomme les Habitants déjà là. */
function nommerLesHabitantsDejaLa(): string {
  const instructions = readdirSync(MIGRATIONS_FOLDER)
    .filter((f) => f.endsWith(".sql"))
    .flatMap((f) => readFileSync(join(MIGRATIONS_FOLDER, f), "utf8").split("--> statement-breakpoint"));
  return instructions.find((i) => /^\s*WITH "rangs"/m.test(i) && i.includes('UPDATE "habitant" SET "prenom"'))!;
}

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai des Habitants (US-0301)";

describe.skipIf(!URL_TEST)("les premiers Habitants (US-0301, US-0303, US-0305, US-0308, US-0310, US-0311, US-0312, US-0318, US-0329, US-0330, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `habitants-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  const nouveauCompte = async () => (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
  const nomUnique = () => nomDEssai("Hab", suffixe, numero);
  const habitants = async (territoireId: number) =>
    (await pool.query<{ id: number; metier: string | null }>("select id, metier from habitant where territoire_id = $1 order by id", [territoireId])).rows;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("donne trois Habitants sans Métier à un joueur qui vient de naître", async () => {
    const compte = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    const siens = await habitants(territoireId);
    expect(siens).toHaveLength(3);
    expect(siens.map((h) => h.metier)).toEqual([null, null, null]);
  });

  it("les donne aussi au chef né avant la Couronne, quand il reçoit son Foyer", async () => {
    const compte = await nouveauCompte();
    const nom = nomUnique();
    await pool.query("insert into chef (compte_id, monde_id, nom, cle_nom) values ($1, (select id from monde order by id limit 1), $2, $3)", [compte.id, nom, cleDuNom(nom)]);
    const territoireId = await naitreSurLaCouronne(pool, compte.id);
    expect(await habitants(territoireId!)).toHaveLength(3);
  });

  it("garde les Habitants de chacun pour lui seul, et les retire avec son Territoire", async () => {
    const a = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, a.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const b = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, b.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const [ta, tb] = [(await territoireDuCompte(pool, a.id))!, (await territoireDuCompte(pool, b.id))!];
    const [ha, hb] = [await habitants(ta), await habitants(tb)];
    expect(ha).toHaveLength(3);
    expect(hb).toHaveLength(3);
    expect(ha.some((h) => hb.some((x) => x.id === h.id))).toBe(false);
    await pool.query("delete from compte where id = $1", [a.id]);
    expect(await habitants(ta)).toEqual([]);
  });

  it("rend à la page Habitants ceux du Territoire, et aucun autre (US-0302)", async () => {
    const a = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, a.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const b = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, b.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const [ta, tb] = [(await territoireDuCompte(pool, a.id))!, (await territoireDuCompte(pool, b.id))!];
    const siens = await habitantsDuTerritoire(pool, ta);
    expect(siens.map((h) => h.id).sort()).toEqual((await habitants(ta)).map((h) => h.id).sort());
    expect(siens.map((h) => h.metier)).toEqual([null, null, null]);
    expect(siens.every((h) => h.arriveLe instanceof Date)).toBe(true);
    const autres = new Set((await habitantsDuTerritoire(pool, tb)).map((h) => h.id));
    expect(siens.some((h) => autres.has(h.id))).toBe(false);
    expect(await habitantsDuTerritoire(pool, -1)).toEqual([]);
  });

  it("donne à chacun des trois un prénom tiré de la liste, trois prénoms différents (US-0303)", async () => {
    const liste = lireJeu(PRENOMS).map((p) => p.nom);
    const tirages = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const compte = await nouveauCompte();
      expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
      const prenoms = (await habitantsDuTerritoire(pool, (await territoireDuCompte(pool, compte.id))!)).map((h) => h.prenom);
      expect(prenoms).toHaveLength(3);
      expect(new Set(prenoms).size).toBe(3);
      for (const p of prenoms) {
        expect(liste).toContain(p);
        tirages.add(p);
      }
    }
    // Tirés au hasard : quatre naissances ne redonnent pas toutes les trois mêmes prénoms.
    expect(tirages.size).toBeGreaterThan(3);
  });

  it("n'a aucun Habitant sans prénom, et la base refuse d'en créer un", async () => {
    expect((await pool.query("select count(*)::int as n from habitant where prenom is null")).rows[0].n).toBe(0);
    const compte = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const t = (await territoireDuCompte(pool, compte.id))!;
    await expect(pool.query("insert into habitant (territoire_id) values ($1)", [t])).rejects.toMatchObject({ code: "23502" });
  });

  it("nomme, à la migration, les Habitants déjà là : chacun un prénom de la liste, sans doublon dans un Territoire", async () => {
    const liste = lireJeu(PRENOMS).map((p) => p.nom);
    const client = await pool.connect();
    try {
      await client.query("begin");
      // Des Habitants encore sans prénom, comme avant la migration, dans une table temporaire qui masque la vraie.
      await client.query("create temp table habitant (id integer, territoire_id integer, prenom text) on commit drop");
      await client.query(`insert into habitant (id, territoire_id) select n, 1 + (n - 1) / 3 from generate_series(1, 30) n`);
      await client.query(nommerLesHabitantsDejaLa());
      const { rows } = await client.query<{ territoire_id: number; prenoms: string[] }>(
        "select territoire_id, array_agg(prenom order by id) as prenoms from habitant group by territoire_id order by territoire_id",
      );
      expect(rows).toHaveLength(10);
      for (const { prenoms } of rows) {
        expect(prenoms).toHaveLength(3);
        expect(new Set(prenoms).size).toBe(3);
        for (const p of prenoms) expect(liste).toContain(p);
      }
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  it("range la lecture par Métier dans l'ordre des Métiers, ceux sans Métier en premier, puis par prénom (US-0303, US-0308)", async () => {
    const compte = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const t = (await territoireDuCompte(pool, compte.id))!;
    const [h1, h2, h3] = (await habitants(t)).map((h) => h.id);
    const nommer = (id: number, prenom: string, metier: string | null) =>
      pool.query("update habitant set prenom = $2, metier = $3 where id = $1", [id, prenom, metier]);
    await nommer(h1, "Talo", "chasseur");
    await nommer(h2, "Miro", null);
    await nommer(h3, "Brune", "chasseur");
    await pool.query(
      `insert into habitant (territoire_id, prenom, metier) values ($1, 'Dara', 'bucheron'), ($1, 'Arno', null), ($1, 'Miro', null), ($1, 'Cael', 'explorateur')`,
      [t],
    );
    const lus = await habitantsDuTerritoire(pool, t);
    // US-0308 : le nom du Métier, pas son identifiant, et l'ordre de donnees/metiers.yaml, pas celui de l'alphabet.
    expect(lus.map((h) => [h.prenom, h.metier])).toEqual([
      ["Arno", null],
      ["Miro", null],
      ["Miro", null],
      ["Cael", "Explorateur"],
      ["Brune", "Chasseur"],
      ["Talo", "Chasseur"],
      ["Dara", "Bûcheron"],
    ]);
    // Deux prénoms pareils : le premier arrivé d'abord.
    expect(lus[1].id).toBe(h2);
    expect(lus.every((h) => h.etat === "libre")).toBe(true);
  });

  it("donne un Métier à un Habitant sans Métier du Territoire, pour de bon, sans rien coûter (US-0308)", async () => {
    const compte = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const t = (await territoireDuCompte(pool, compte.id))!;
    const [h1, h2] = (await habitants(t)).map((h) => h.id);
    const stocks = async () => (await pool.query("select ressource_id, quantite, reste from stock where territoire_id = $1 order by ressource_id", [t])).rows;
    const avant = await stocks();
    expect(await enregistrerLeMetier(pool, t, h1, "bucheron")).toBe(true);
    // Enregistré : une nouvelle lecture, comme après un rechargement ou sur un autre appareil, le retrouve.
    expect(await habitants(t)).toEqual([
      { id: h1, metier: "bucheron" },
      { id: h2, metier: null },
      expect.objectContaining({ metier: null }),
    ]);
    expect((await habitantsDuTerritoire(pool, t)).find((h) => h.id === h1)?.metier).toBe("Bûcheron");
    // Gratuit : aucune Ressource n'a bougé.
    expect(await stocks()).toEqual(avant);
  });

  it("change le Métier d'un Habitant qui en a un, pour de bon, aussitôt et sans rien coûter, comme le premier (US-0310)", async () => {
    const compte = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const t = (await territoireDuCompte(pool, compte.id))!;
    const [h1, h2] = (await habitants(t)).map((h) => h.id);
    const stocks = async () => (await pool.query("select ressource_id, quantite, reste from stock where territoire_id = $1 order by ressource_id", [t])).rows;
    expect(await enregistrerLeMetier(pool, t, h1, "chasseur")).toBe(true);
    expect(await enregistrerLeMetier(pool, t, h2, "chasseur")).toBe(true);
    const avant = await stocks();
    expect(await enregistrerLeMetier(pool, t, h1, "mineur")).toBe(true);
    // Enregistré comme le premier : une nouvelle lecture le retrouve, sous son nom, rangé avec son nouveau Métier.
    expect((await habitants(t)).map((h) => h.metier)).toEqual(["mineur", "chasseur", null]);
    expect((await habitantsDuTerritoire(pool, t)).map((h) => [h.id, h.metier])).toEqual([
      [expect.any(Number), null],
      [h2, "Chasseur"],
      [h1, "Mineur"],
    ]);
    // Gratuit : aucune Ressource n'a bougé.
    expect(await stocks()).toEqual(avant);
    // Un Métier inconnu, refusé par la base, laisse l'ancien en place.
    expect(await enregistrerLeMetier(pool, t, h1, "poste")).toBe(false);
    expect((await habitants(t)).map((h) => h.metier)).toEqual(["mineur", "chasseur", null]);
  });

  it("remet sans Métier un Habitant qui en a un, pour de bon, aussitôt et sans rien coûter : il revient en tête de la lecture (US-0311)", async () => {
    const a = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, a.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const b = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, b.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const [ta, tb] = [(await territoireDuCompte(pool, a.id))!, (await territoireDuCompte(pool, b.id))!];
    const [h1, h2, h3] = (await habitants(ta)).map((h) => h.id);
    const [voisin] = (await habitants(tb)).map((h) => h.id);
    await pool.query("update habitant set prenom = case id when $1 then 'Arno' when $2 then 'Brune' else 'Cael' end where territoire_id = $3", [h1, h2, ta]);
    expect(await enregistrerLeMetier(pool, ta, h1, "chasseur")).toBe(true);
    expect(await enregistrerLeMetier(pool, ta, h2, "mineur")).toBe(true);
    expect(await enregistrerLeMetier(pool, tb, voisin, "mineur")).toBe(true);
    const stocks = async () => (await pool.query("select ressource_id, quantite, reste from stock where territoire_id = $1 order by ressource_id", [ta])).rows;
    const avant = await stocks();

    expect(await enregistrerLeMetier(pool, ta, h1, null)).toBe(true);
    expect((await habitants(ta)).map((h) => h.metier)).toEqual([null, "mineur", null]);
    // Sans Métier, il passe devant ceux qui en ont un, à sa place parmi les sans Métier.
    expect((await habitantsDuTerritoire(pool, ta)).map((h) => [h.id, h.metier])).toEqual([
      [h1, null],
      [h3, null],
      [h2, "Mineur"],
    ]);
    // Gratuit : aucune Ressource n'a bougé.
    expect(await stocks()).toEqual(avant);
    // L'Habitant du voisin, même désigné par son identifiant, garde le sien.
    expect(await enregistrerLeMetier(pool, ta, voisin, null)).toBe(false);
    expect((await habitants(tb)).map((h) => h.metier)).toEqual(["mineur", null, null]);
  });

  /** Un Territoire neuf, ses trois Habitants renommés Brune, Cael et Arno, du premier arrivé au dernier. */
  const territoireABC = async () => {
    const compte = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const t = (await territoireDuCompte(pool, compte.id))!;
    const [brune, cael, arno] = (await habitants(t)).map((h) => h.id);
    await pool.query("update habitant set prenom = case id when $1 then 'Brune' when $2 then 'Cael' else 'Arno' end where territoire_id = $3", [brune, cael, t]);
    return { t, brune, cael, arno };
  };

  it("« + » donne le Métier au premier Habitant sans Métier dans l'ordre de la liste, gratuitement, et à personne quand il n'en reste aucun (US-0312)", async () => {
    const { t, brune, cael, arno } = await territoireABC();
    const voisin = await territoireABC();
    const stocks = async () => (await pool.query("select ressource_id, quantite, reste from stock where territoire_id = $1 order by ressource_id", [t])).rows;
    const avant = await stocks();
    // La liste range les sans Métier par prénom : Arno, Brune, puis Cael.
    expect(await ajouterUnHabitantAuMetier(pool, t, "bucheron")).toBe(arno);
    expect(await ajouterUnHabitantAuMetier(pool, t, "mineur")).toBe(brune);
    expect(await ajouterUnHabitantAuMetier(pool, t, "bucheron")).toBe(cael);
    expect(await ajouterUnHabitantAuMetier(pool, t, "bucheron")).toBeNull();
    expect((await habitants(t)).map((h) => h.metier)).toEqual(["mineur", "bucheron", "bucheron"]);
    expect(await stocks()).toEqual(avant);
    // Le voisin garde les siens sans Métier.
    expect((await habitants(voisin.t)).map((h) => h.metier)).toEqual([null, null, null]);
  });

  it("« + » ne donne à personne un Métier qui n'existe pas (US-0312)", async () => {
    const { t } = await territoireABC();
    expect(await ajouterUnHabitantAuMetier(pool, t, "poste")).toBeNull();
    expect(await ajouterUnHabitantAuMetier(pool, t, "Bûcheron")).toBeNull();
    expect(await ajouterUnHabitantAuMetier(pool, -1, "bucheron")).toBeNull();
    expect((await habitants(t)).map((h) => h.metier)).toEqual([null, null, null]);
  });

  it("« − » remet sans Métier le dernier arrivé de ceux qui exercent le Métier, gratuitement, et personne quand il n'y en a plus (US-0312)", async () => {
    const { t, brune, cael, arno } = await territoireABC();
    const voisin = await territoireABC();
    for (const id of [brune, cael, arno]) expect(await enregistrerLeMetier(pool, t, id, "chasseur")).toBe(true);
    expect(await enregistrerLeMetier(pool, t, cael, "mineur")).toBe(true);
    expect(await enregistrerLeMetier(pool, voisin.t, voisin.arno, "chasseur")).toBe(true);
    const stocks = async () => (await pool.query("select ressource_id, quantite, reste from stock where territoire_id = $1 order by ressource_id", [t])).rows;
    const avant = await stocks();
    // Arno est arrivé après Brune : il part le premier, quel que soit son prénom.
    expect(await retirerUnHabitantDuMetier(pool, t, "chasseur")).toBe(arno);
    expect(await retirerUnHabitantDuMetier(pool, t, "chasseur")).toBe(brune);
    expect(await retirerUnHabitantDuMetier(pool, t, "chasseur")).toBeNull();
    expect(await retirerUnHabitantDuMetier(pool, t, "poste")).toBeNull();
    expect((await habitants(t)).map((h) => h.metier)).toEqual([null, "mineur", null]);
    expect(await stocks()).toEqual(avant);
    // Le Chasseur du voisin le reste.
    expect((await habitants(voisin.t)).map((h) => h.metier)).toEqual([null, null, "chasseur"]);
  });

  it("ne touche ni un Habitant d'un autre Territoire, ni ne donne un Métier qui n'existe pas (US-0308, US-0310)", async () => {
    const a = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, a.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const b = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, b.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const [ta, tb] = [(await territoireDuCompte(pool, a.id))!, (await territoireDuCompte(pool, b.id))!];
    const [h1, h2] = (await habitants(ta)).map((h) => h.id);
    const [voisin] = (await habitants(tb)).map((h) => h.id);
    expect(await enregistrerLeMetier(pool, ta, h1, "chasseur")).toBe(true);
    // L'Habitant du voisin, même désigné par son identifiant, n'est pas à ce Territoire.
    expect(await enregistrerLeMetier(pool, ta, voisin, "mineur")).toBe(false);
    // Un Métier inconnu, refusé par la base, ne change rien et ne casse rien.
    expect(await enregistrerLeMetier(pool, ta, h2, "poste")).toBe(false);
    expect(await enregistrerLeMetier(pool, ta, h2, "Bûcheron")).toBe(false);
    expect(await enregistrerLeMetier(pool, ta, -1, "mineur")).toBe(false);
    expect((await habitants(ta)).map((h) => h.metier)).toEqual(["chasseur", null, null]);
    expect((await habitants(tb)).map((h) => h.metier)).toEqual([null, null, null]);
  });

  it("compte les Habitants du Territoire pour la barre du haut, et suit chaque arrivée et chaque départ (US-0304)", async () => {
    const a = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, a.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const b = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, b.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const [ta, tb] = [(await territoireDuCompte(pool, a.id))!, (await territoireDuCompte(pool, b.id))!];
    expect(await nombreDHabitants(pool, ta)).toBe(3);
    await pool.query("insert into habitant (territoire_id, prenom) values ($1, 'Arno'), ($1, 'Dara')", [ta]);
    expect(await nombreDHabitants(pool, ta)).toBe(5);
    await pool.query("delete from habitant where id in (select id from habitant where territoire_id = $1 order by id limit 4)", [ta]);
    expect(await nombreDHabitants(pool, ta)).toBe(1);
    expect(await nombreDHabitants(pool, tb)).toBe(3);
    expect(await nombreDHabitants(pool, -1)).toBe(0);
  });

  it("compte les Habitants sans Métier du Territoire pour la navigation, et suit chaque Métier donné, chaque arrivée et chaque départ (US-0313)", async () => {
    const a = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, a.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const b = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, b.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const [ta, tb] = [(await territoireDuCompte(pool, a.id))!, (await territoireDuCompte(pool, b.id))!];
    expect(await nombreSansMetier(pool, ta)).toBe(3);
    const [h1, h2] = (await habitants(ta)).map((h) => h.id);
    expect(await enregistrerLeMetier(pool, ta, h1, "chasseur")).toBe(true);
    expect(await nombreSansMetier(pool, ta)).toBe(2);
    await pool.query("insert into habitant (territoire_id, prenom, metier) values ($1, 'Arno', null), ($1, 'Dara', 'mineur')", [ta]);
    expect(await nombreSansMetier(pool, ta)).toBe(3);
    await pool.query("delete from habitant where territoire_id = $1 and metier is null and id <> $2", [ta, h2]);
    expect(await nombreSansMetier(pool, ta)).toBe(1);
    expect(await enregistrerLeMetier(pool, ta, h2, "bucheron")).toBe(true);
    expect(await nombreSansMetier(pool, ta)).toBe(0);
    // Le voisin garde les siens, et un Territoire qui n'existe pas n'en a aucun.
    expect(await nombreSansMetier(pool, tb)).toBe(3);
    expect(await nombreSansMetier(pool, -1)).toBe(0);
  });

  it("rend la place du Territoire : au départ, les 5 places du Foyer, quel que soit le nombre d'Habitants (US-0305)", async () => {
    expect(PLACES_DU_FOYER).toBe(5);
    const a = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, a.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const b = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, b.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const [ta, tb] = [(await territoireDuCompte(pool, a.id))!, (await territoireDuCompte(pool, b.id))!];
    expect(await placesDuTerritoire(pool, ta)).toBe(PLACES_DU_FOYER);
    // Toute la place prise, puis plus d'Habitants que de places : la place ne bouge pas.
    await pool.query("insert into habitant (territoire_id, prenom) values ($1, 'Arno'), ($1, 'Dara')", [ta]);
    expect(await nombreDHabitants(pool, ta)).toBe(PLACES_DU_FOYER);
    expect(await placesDuTerritoire(pool, ta)).toBe(PLACES_DU_FOYER);
    await pool.query("insert into habitant (territoire_id, prenom) values ($1, 'Elio')", [ta]);
    expect(await placesDuTerritoire(pool, ta)).toBe(PLACES_DU_FOYER);
    expect(await placesDuTerritoire(pool, tb)).toBe(PLACES_DU_FOYER);
    // Sans Territoire, aucune place.
    expect(await placesDuTerritoire(pool, -1)).toBe(0);
  });

  it("dit quand toute la place est prise : autant d'Habitants que de places, ou plus (US-0338)", async () => {
    const a = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, a.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const ta = (await territoireDuCompte(pool, a.id))!;
    expect(await plusDePlace(pool, ta)).toBe(false);
    await pool.query("insert into habitant (territoire_id, prenom) values ($1, 'Arno')", [ta]);
    expect(await plusDePlace(pool, ta)).toBe(false);
    await pool.query("insert into habitant (territoire_id, prenom) values ($1, 'Dara')", [ta]);
    expect(await nombreDHabitants(pool, ta)).toBe(PLACES_DU_FOYER);
    expect(await plusDePlace(pool, ta)).toBe(true);
    await pool.query("insert into habitant (territoire_id, prenom) values ($1, 'Elio')", [ta]);
    expect(await plusDePlace(pool, ta)).toBe(true);
    await pool.query("delete from habitant where id in (select id from habitant where territoire_id = $1 order by id limit 2)", [ta]);
    expect(await plusDePlace(pool, ta)).toBe(false);
  });

  /** L'Entretien lu pour la page, son total en nombre. */
  const entretien = async (territoireId: number) => {
    const lu = await entretienDesHabitants(pool, territoireId);
    return { ...lu, parHeure: Number(lu.parHeure) };
  };

  it("rend l'Entretien des Habitants, et le suit à chaque arrivée et à chaque départ, avec ou sans Métier (US-0318)", async () => {
    const a = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, a.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const b = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, b.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const [ta, tb] = [(await territoireDuCompte(pool, a.id))!, (await territoireDuCompte(pool, b.id))!];
    const e = ENTRETIEN_HABITANT_PAR_HEURE;
    expect(await entretien(ta)).toEqual({ habitants: 3, parHabitant: e, parHeure: 3 * e });
    await pool.query("insert into habitant (territoire_id, prenom, metier) values ($1, 'Arno', null), ($1, 'Dara', 'chasseur')", [ta]);
    expect(await entretien(ta)).toEqual({ habitants: 5, parHabitant: e, parHeure: 5 * e });
    await pool.query("delete from habitant where id in (select id from habitant where territoire_id = $1 order by id limit 4)", [ta]);
    expect(await entretien(ta)).toEqual({ habitants: 1, parHabitant: e, parHeure: e });
    expect(await entretien(tb)).toEqual({ habitants: 3, parHabitant: e, parHeure: 3 * e });
    expect(await entretien(-1)).toEqual({ habitants: 0, parHabitant: e, parHeure: 0 });
  });

  it("rend l'Entretien même que le calcul du jeu prélève chaque heure sur la Nourriture (US-0318)", async () => {
    const compte = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const t = (await territoireDuCompte(pool, compte.id))!;
    await pool.query("insert into habitant (territoire_id, prenom) values ($1, 'Arno')", [t]);
    const lu = await entretien(t);
    expect(lu).toMatchObject({ habitants: 4, parHeure: 4 * ENTRETIEN_HABITANT_PAR_HEURE });
    // Une heure de jeu, la Nourriture loin de zéro comme de sa limite : elle baisse de l'Entretien affiché, sa production ajoutée.
    await pool.query("update stock set quantite = 100, reste = 0, plein_depuis = null where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')", [t]);
    const nourriture = async () => (await stocksDuTerritoire(pool, t)).filter((s) => s.famille === "nourriture");
    const avant = await nourriture();
    expect(avant).toHaveLength(2);
    const production = avant.reduce((somme, s) => somme + Number(s.parHeure), 0);
    const debut = await lireMarquePage(pool, "territoire", t);
    await rattraper("territoire", t, { pool, jusqua: new Date(debut.getTime() + 3_600_000) });
    const apres = (await nourriture()).reduce((somme, s) => somme + Number(s.quantite), 0);
    expect(apres).toBeCloseTo(200 + production - lu.parHeure, 6);
  });

  it("fait produire le Foyer d'un Territoire sans Habitant, sans Entretien ni Famine, et des Voyageurs s'y présentent toujours (US-0329)", async () => {
    const compte = await nouveauCompte();
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const t = (await territoireDuCompte(pool, compte.id))!;
    await pool.query("delete from habitant where territoire_id = $1", [t]);
    await pool.query("update stock set quantite = 100, reste = 0, plein_depuis = null where territoire_id = $1", [t]);
    const avant = await stocksDuTerritoire(pool, t);
    // Le Foyer produit de chaque Ressource, et personne n'en mange.
    expect(avant.map((s) => [s.id, Number(s.parHeure) > 0, Number(s.entretienParHeure)])).toEqual(avant.map((s) => [s.id, true, 0]));
    const debut = await lireMarquePage(pool, "territoire", t);
    // Douze heures de jeu : la première arrivée d'un Voyageur tombe d'ici là, de 4 à 12 h après la naissance.
    await rattraper("territoire", t, { pool, jusqua: new Date(debut.getTime() + 12 * 3_600_000) });
    expect((await stocksDuTerritoire(pool, t)).map((s) => [s.id, Number(s.quantite)])).toEqual(avant.map((s) => [s.id, 100 + 12 * Number(s.parHeure)]));
    expect(await famineDepuis(pool, t)).toBeNull();
    expect(await nombreDHabitants(pool, t)).toBe(0);
    expect(await nombreDeVoyageurs(pool, t)).toBeGreaterThan(0);
  });

  describe("renvoyer un Habitant (US-0330)", () => {
    /** Un Territoire tout neuf, ses trois Habitants nommés Arno, Brune (Chasseur) et Cael, du premier arrivé au dernier. */
    const naitre = async () => {
      const compte = await nouveauCompte();
      expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
      const t = (await territoireDuCompte(pool, compte.id))!;
      const [arno, brune, cael] = (await habitants(t)).map((h) => h.id);
      await pool.query("update habitant set prenom = $2, metier = $3 where id = $1", [arno, "Arno", null]);
      await pool.query("update habitant set prenom = $2, metier = $3 where id = $1", [brune, "Brune", "chasseur"]);
      await pool.query("update habitant set prenom = $2, metier = $3 where id = $1", [cael, "Cael", null]);
      return { t, arno, brune, cael };
    };
    /** Les Récits du Territoire, du plus récent au plus ancien : titre, texte, heure du jeu, et s'il a été lu. */
    const recits = async (territoireId: number) =>
      (await recitsDuTerritoire(pool, territoireId)).map(({ titre, texte, survenuLe, luLe }) => ({ titre, texte, survenuLe, lu: luLe !== null }));
    const INSTANT = new Date("2026-10-08T12:05:00Z");

    it("le fait partir pour de bon : le nombre d'Habitants, les effectifs par Métier et l'Entretien baissent aussitôt", async () => {
      const { t, brune } = await naitre();
      const stocks = async () => (await pool.query("select ressource_id, quantite, reste from stock where territoire_id = $1 order by ressource_id", [t])).rows;
      const avant = await stocks();
      expect(await renvoyerLHabitant(pool, t, brune, INSTANT)).toBe(true);
      expect((await habitantsDuTerritoire(pool, t)).map((h) => [h.prenom, h.metier])).toEqual([
        ["Arno", null],
        ["Cael", null],
      ]);
      expect(await nombreDHabitants(pool, t)).toBe(2);
      expect(await nombreSansMetier(pool, t)).toBe(2);
      expect(await entretien(t)).toEqual({ habitants: 2, parHabitant: ENTRETIEN_HABITANT_PAR_HEURE, parHeure: 2 * ENTRETIEN_HABITANT_PAR_HEURE });
      // Rien ne se paie, ni ne se rend.
      expect(await stocks()).toEqual(avant);
    });

    it("écrit un Récit non lu, daté du renvoi, qui dit son Métier et que le chef l'a renvoyé, sans lui donner de genre", async () => {
      const { t, arno, brune } = await naitre();
      await renvoyerLHabitant(pool, t, brune, INSTANT);
      expect(await recits(t)).toEqual([
        { titre: "Brune a quitté le Territoire", texte: "Brune, Chasseur, a quitté le Territoire à la demande du chef.", survenuLe: INSTANT, lu: false },
      ]);
      const plusTard = new Date(INSTANT.getTime() + 60_000);
      await renvoyerLHabitant(pool, t, arno, plusTard);
      expect((await recits(t))[0]).toEqual({
        titre: "Arno a quitté le Territoire",
        texte: "Arno, sans Métier, a quitté le Territoire à la demande du chef.",
        survenuLe: plusTard,
        lu: false,
      });
      expect(recitDeRenvoi("Ines", "Bûcheron", INSTANT)).toEqual({
        titre: "Ines a quitté le Territoire",
        texte: "Ines, Bûcheron, a quitté le Territoire à la demande du chef.",
        survenuLe: INSTANT,
      });
    });

    it("renvoie aussi le dernier Habitant : le Territoire reste sans Habitant (US-0329)", async () => {
      const { t, arno, brune, cael } = await naitre();
      for (const id of [arno, brune, cael]) expect(await renvoyerLHabitant(pool, t, id, INSTANT)).toBe(true);
      expect(await nombreDHabitants(pool, t)).toBe(0);
      expect(await entretien(t)).toEqual({ habitants: 0, parHabitant: ENTRETIEN_HABITANT_PAR_HEURE, parHeure: 0 });
      expect(await recits(t)).toHaveLength(3);
    });

    it("ne touche jamais à l'Habitant d'un autre Territoire, quel que soit l'identifiant envoyé, ni à un Habitant déjà parti", async () => {
      const [joueur, voisin] = [await naitre(), await naitre()];
      expect(await renvoyerLHabitant(pool, joueur.t, voisin.arno, INSTANT)).toBe(false);
      expect(await renvoyerLHabitant(pool, joueur.t, -1, INSTANT)).toBe(false);
      expect(await nombreDHabitants(pool, voisin.t)).toBe(3);
      expect(await nombreDHabitants(pool, joueur.t)).toBe(3);
      expect([await recits(joueur.t), await recits(voisin.t)]).toEqual([[], []]);
      expect(await renvoyerLHabitant(pool, joueur.t, joueur.arno, INSTANT)).toBe(true);
      expect(await renvoyerLHabitant(pool, joueur.t, joueur.arno, INSTANT)).toBe(false);
      expect(await nombreDHabitants(pool, joueur.t)).toBe(2);
      expect(await recits(joueur.t)).toHaveLength(1);
    });

    it("renvoyé plusieurs fois en même temps (un double clic, deux appareils), il ne part qu'une fois, d'un seul Récit", async () => {
      const { t, cael } = await naitre();
      const renvois = await Promise.all(Array.from({ length: 4 }, () => renvoyerLHabitant(pool, t, cael, INSTANT)));
      expect(renvois.filter(Boolean)).toHaveLength(1);
      expect(await nombreDHabitants(pool, t)).toBe(2);
      expect(await recits(t)).toHaveLength(1);
    });
  });
});
