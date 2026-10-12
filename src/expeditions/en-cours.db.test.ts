import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chefDuCompte, enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import type { Coordonnees } from "@/monde/hex";
import { PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE } from "@/reglages";
import { nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, URL_TEST } from "@/test/base";
import { lancerLExpedition } from "./depart";
import { expeditionsEnCours } from "./en-cours";

const MINUTE_MS = 60_000;

describe.skipIf(!URL_TEST)("le détail des Expéditions en cours (US-0918, sur base)", () => {
  let pool: Pool;
  const lancement = `en-cours-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** L'heure du jeu du premier départ. */
  const INSTANT = new Date("2026-10-09T07:42:00.000Z");

  /** Un joueur qui vient de naître, et son Territoire, avec ses trois Habitants sans Métier et sans Bête. */
  const nouveauTerritoire = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Enc", suffixe, numero);
    expect(await enregistrerNomDeChef(pool, compte.id, nom)).toMatchObject({ statut: "enregistre" });
    return (await chefDuCompte(pool, compte.id))!.territoireId!;
  };
  /** Des explorateurs de plus au Territoire, avec leurs prénoms, arrivés dans cet ordre. */
  const explorateurs = (territoireId: number, prenoms: string[]) =>
    pool.query(`insert into habitant (territoire_id, prenom, metier) select $1, p, 'explorateur' from unnest($2::text[]) with ordinality as l(p, n) order by n`, [
      territoireId,
      prenoms,
    ]);
  /** Des Bêtes dans l'effectif du Territoire, toutes mâles : une ligne par Espèce, avec leur nombre. */
  const betes = (territoireId: number, lignes: [string, number][]) =>
    pool.query(`insert into effectif (territoire_id, espece_id, sexe, nombre) select $1, e, 'male', n from unnest($2::text[], $3::int[]) as l(e, n)`, [
      territoireId,
      lignes.map((l) => l[0]),
      lignes.map((l) => l[1]),
    ]);
  /** Une Case libre du Monde du Territoire, à `ecart` Cases de son Foyer : la `rang`-ième, pour en viser plusieurs. */
  const aLEcart = async (territoireId: number, ecart: number, rang = 0): Promise<Coordonnees> => {
    const { rows } = await pool.query<Coordonnees>(
      `select c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = $2
       order by c.q, c.r limit 1 offset $3`,
      [territoireId, ecart, rang],
    );
    return rows[0];
  };
  /** Un départ vers `destination` de `n` explorateurs, avec l'escorte donnée Espèce par Espèce et `sejourMinutes` de séjour. */
  const partir = async (territoireId: number, destination: Coordonnees, n: number, escorte: [string, number][] = [], sejourMinutes = 240, instant = INSTANT) => {
    const depart = await lancerLExpedition(pool, territoireId, { destination, explorateurs: n, escorte: new Map(escorte), sejourMinutes }, instant);
    if (!("expeditionId" in depart)) throw new Error(depart.refus);
    return depart.expeditionId;
  };

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
  });

  afterAll(async () => {
    // Les Foyers de l'essai rendent leur place à la Couronne d'Aube, que toute la suite se partage : sans cela, chaque
    // passage y en laissait cinq, jusqu'à la remplir.
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("donne de chaque Expédition ses horaires et les prénoms de ses explorateurs, sans escorte", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, ["Joran", "Ines", "Mael"]);
    const destination = await aLEcart(t, 3);
    const id = await partir(t, destination, 2);
    expect(await expeditionsEnCours(pool, t, INSTANT)).toEqual([
      {
        id,
        destination: expect.objectContaining({ ...destination, distance: 3 }),
        phase: "aller",
        partLe: INSTANT,
        trajetMinutes: 3 * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE,
        sejourMinutes: 240,
        // US-0920 : pas rappelée.
        rappeleeLe: null,
        explorateurs: ["Joran", "Ines"],
        escorte: [],
      },
    ]);
  });

  it("donne son escorte, Espèce par Espèce, de la plus commune à la plus rare puis par nom, avec ses Bêtes", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, ["Joran"]);
    await betes(t, [
      ["souris", 3],
      ["poule", 1],
    ]);
    await partir(t, await aLEcart(t, 2), 1, [
      ["souris", 2],
      ["poule", 1],
    ]);
    expect(await expeditionsEnCours(pool, t, INSTANT)).toEqual([
      expect.objectContaining({
        explorateurs: ["Joran"],
        escorte: [
          { id: "poule", nom: "Poule", nombre: 1 },
          { id: "souris", nom: "Souris grise", nombre: 2 },
        ],
      }),
    ]);
  });

  it("garde à chaque Expédition ses propres explorateurs et sa phase, de la première partie à la dernière", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, ["Joran", "Ines", "Mael"]);
    const premiere = await partir(t, await aLEcart(t, 1), 1, [], 60);
    const plusTard = new Date(INSTANT.getTime() + 30 * MINUTE_MS);
    const seconde = await partir(t, await aLEcart(t, 2, 1), 2, [], 240, plusTard);
    // 30 min après le premier départ : la première, à 1 Case, est arrivée ; la seconde vient de partir.
    expect((await expeditionsEnCours(pool, t, plusTard)).map(({ id, explorateurs, phase, partLe }) => ({ id, explorateurs, phase, partLe }))).toEqual([
      { id: premiere, explorateurs: ["Joran"], phase: "sejour", partLe: INSTANT },
      { id: seconde, explorateurs: ["Ines", "Mael"], phase: "aller", partLe: plusTard },
    ]);
  });

  it("ne montre rien des Expéditions d'un autre Territoire", async () => {
    const t = await nouveauTerritoire();
    const voisin = await nouveauTerritoire();
    await explorateurs(voisin, ["Joran"]);
    await partir(voisin, await aLEcart(voisin, 2), 1);
    expect(await expeditionsEnCours(pool, t, INSTANT)).toEqual([]);
  });
});
