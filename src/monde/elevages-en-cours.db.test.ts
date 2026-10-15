import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { reunirLesCouples } from "./couple";
import { dureeDUneBeteEleveeMinutes } from "./cout-d-elevage";
import { elevagesEnCours } from "./elevages-en-cours";
import { lancerUnElevage } from "./lancer-un-elevage";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du suivi des Élevages (US-0818)";

const MINUTE = 60_000;

describe.skipIf(!URL_TEST)("suivre les Élevages en cours (US-0818, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `suivi-elevage-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];
  /** Le nom, l'illustration et la durée d'Élevage d'une Bête de la souris et de la poule, d'après la base. */
  const especes: Record<string, { nom: string; illustration: string | null; duree: number }> = {};

  /**
   * Un joueur qui vient de naître, avec de quoi payer ses Élevages, le Couple de la souris et celui de la poule réunis, et
   * deux éleveurs, Hael et Brune : son Territoire, l'instant de sa naissance et ses Habitants, du premier arrivé au dernier.
   */
  const naitre = async () => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Suiv", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    const ne = await lireMarquePage(pool, "territoire", territoireId);
    const habitants = (await pool.query<{ id: number }>("select id from habitant where territoire_id = $1 order by id", [territoireId])).rows.map((h) => h.id);
    await pool.query("update habitant set metier = 'eleveur', prenom = 'Hael' where id = $1", [habitants[0]]);
    await pool.query("update habitant set metier = 'eleveur', prenom = 'Brune' where id = $1", [habitants[1]]);
    await pool.query(
      "update stock set quantite = 1000000, limite = 1000000, reste = 0, plein_depuis = null where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')",
      [territoireId],
    );
    const client = await pool.connect();
    try {
      await client.query(
        "insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, 'souris', 'male', 1), ($1, 'souris', 'femelle', 1), ($1, 'poule', 'male', 1), ($1, 'poule', 'femelle', 1)",
        [territoireId],
      );
      expect((await reunirLesCouples(client, territoireId, ne)).sort()).toEqual(["poule", "souris"]);
    } finally {
      client.release();
    }
    return { territoireId, ne, habitants };
  };
  /** Lance l'Élevage de `quantite` Bêtes de l'Espèce `especeId` à l'instant `instant`, qui doit partir. */
  const lancer = async (territoireId: number, especeId: string, quantite: number, instant: Date) =>
    expect(await lancerUnElevage(pool, territoireId, especeId, quantite, instant)).toMatchObject({ lance: { quantite } });
  /** L'instant `minutes` après `depuis`. */
  const apres = (depuis: Date, minutes: number) => new Date(depuis.getTime() + minutes * MINUTE);

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    const { rows } = await pool.query<{ id: string; nom: string; illustration: string | null; taille: number }>(
      "select id, nom, illustration, taille from espece where id in ('souris', 'poule')",
    );
    for (const { id, nom, illustration, taille } of rows) especes[id] = { nom, illustration, duree: dureeDUneBeteEleveeMinutes(taille) };
  });
  afterEach(async () => {
    // Chaque essai rend ses Foyers à la Couronne du Monde d'essai.
    await pool.query("delete from compte where email = any($1)", [nes.splice(0)]);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("donne chaque Élevage en cours, un par éleveur rangés par prénom : son Espèce, son éleveur, sa quantité, son lancement et la durée d'une Bête", async () => {
    const t = await naitre();
    const debut = apres(t.ne, 1);
    // Le premier lancement prend l'éleveur libre premier par prénom, Brune ; le suivant, Hael.
    await lancer(t.territoireId, "poule", 2, debut);
    await lancer(t.territoireId, "souris", 3, apres(debut, 1));
    expect(await elevagesEnCours(pool, t.territoireId, apres(debut, 2))).toEqual([
      { especeId: "poule", espece: especes.poule.nom, illustration: especes.poule.illustration, eleveur: "Brune", quantite: 2, lanceLe: debut, dureeMinutes: especes.poule.duree },
      {
        especeId: "souris",
        espece: especes.souris.nom,
        illustration: especes.souris.illustration,
        eleveur: "Hael",
        quantite: 3,
        lanceLe: apres(debut, 1),
        dureeMinutes: especes.souris.duree,
      },
    ]);
  });

  it("n'y met plus un Élevage dès la naissance de sa dernière Bête, que le temps ait été rattrapé ou non", async () => {
    const t = await naitre();
    const debut = apres(t.ne, 1);
    await lancer(t.territoireId, "souris", 2, debut);
    const fin = apres(debut, 2 * especes.souris.duree);
    expect((await elevagesEnCours(pool, t.territoireId, new Date(fin.getTime() - 1))).map((e) => e.especeId)).toEqual(["souris"]);
    expect(await elevagesEnCours(pool, t.territoireId, fin)).toEqual([]);
    // Le temps rattrapé, l'Élevage fini reste en base : il n'est plus en cours.
    await rattraper("territoire", t.territoireId, { pool, jusqua: fin });
    expect(await elevagesEnCours(pool, t.territoireId, fin)).toEqual([]);
    expect(await elevagesEnCours(pool, t.territoireId, debut)).toHaveLength(1);
  });

  it("ne donne que les Élevages du Territoire, et le garde sans éleveur quand celui-ci n'est plus là", async () => {
    const [t, voisin] = [await naitre(), await naitre()];
    const debut = apres(t.ne, 1);
    await lancer(voisin.territoireId, "poule", 1, apres(voisin.ne, 1));
    await lancer(t.territoireId, "souris", 1, debut);
    expect((await elevagesEnCours(pool, t.territoireId, debut)).map((e) => [e.especeId, e.eleveur])).toEqual([["souris", "Brune"]]);
    await pool.query("delete from habitant where id = $1", [t.habitants[1]]);
    expect((await elevagesEnCours(pool, t.territoireId, debut)).map((e) => [e.especeId, e.eleveur])).toEqual([["souris", null]]);
  });
});
