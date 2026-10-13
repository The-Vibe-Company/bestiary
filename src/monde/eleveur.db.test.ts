import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { eleveurLibre } from "./elevage";
import { enregistrerLeMetier, habitantsDuTerritoire, renvoyerLHabitant, retirerUnHabitantDuMetier } from "./habitants";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de l'éleveur (US-0843)";

/** Une heure du jeu, pour un renvoi. */
const INSTANT = new Date("2026-10-13T10:00:00Z");

describe.skipIf(!URL_TEST)("confier l'Élevage à un éleveur (US-0843, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `eleveur-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;

  /** Un joueur qui vient de naître, avec ses trois Habitants sans Métier : son Territoire et leurs identifiants, par prénom. */
  const nouveauTerritoire = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Elev", suffixe, numero), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    const habitants = (await pool.query<{ id: number; prenom: string }>("select id, prenom from habitant where territoire_id = $1 order by prenom, id", [territoireId])).rows;
    return { territoireId, habitants };
  };
  /** L'Habitant `habitantId` élève désormais l'Espèce `especeId` : ce que posera le lancement d'un Élevage (US-0815). */
  const confier = (habitantId: number, especeId: string | null) => pool.query("update habitant set espece_elevee = $2 where id = $1", [habitantId, especeId]);

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("trouve un éleveur libre : un Habitant au Métier d'éleveur qui ne s'occupe d'aucun Élevage, le premier par prénom", async () => {
    const { territoireId: t, habitants } = await nouveauTerritoire();
    // Sans Métier, personne n'est éleveur.
    expect(await eleveurLibre(pool, t)).toBeNull();
    const [premier, second] = habitants;
    expect(await enregistrerLeMetier(pool, t, second.id, "eleveur")).toBe(true);
    expect(await eleveurLibre(pool, t)).toEqual({ id: second.id, prenom: second.prenom });
    expect(await enregistrerLeMetier(pool, t, premier.id, "eleveur")).toBe(true);
    expect(await eleveurLibre(pool, t)).toEqual({ id: premier.id, prenom: premier.prenom });
    // L'un à l'Élevage, l'autre reste libre ; les deux à l'Élevage, plus aucun.
    await confier(premier.id, "poule");
    expect(await eleveurLibre(pool, t)).toEqual({ id: second.id, prenom: second.prenom });
    await confier(second.id, "souris");
    expect(await eleveurLibre(pool, t)).toBeNull();
    // Un Élevage fini (ou annulé) le rend libre.
    await confier(premier.id, null);
    expect(await eleveurLibre(pool, t)).toEqual({ id: premier.id, prenom: premier.prenom });
  });

  it("ne compte jamais l'éleveur d'un autre Territoire", async () => {
    const [a, b] = [await nouveauTerritoire(), await nouveauTerritoire()];
    expect(await enregistrerLeMetier(pool, b.territoireId, b.habitants[0].id, "eleveur")).toBe(true);
    expect(await eleveurLibre(pool, a.territoireId)).toBeNull();
    expect(await eleveurLibre(pool, b.territoireId)).toEqual({ id: b.habitants[0].id, prenom: b.habitants[0].prenom });
  });

  it("montre l'éleveur « à l'Élevage » avec l'Espèce qu'il élève, et verrouille son Métier jusqu'à la fin : ni changé, ni retiré, ni renvoyé", async () => {
    const { territoireId: t, habitants } = await nouveauTerritoire();
    const [eleveur, autre] = habitants;
    expect(await enregistrerLeMetier(pool, t, eleveur.id, "eleveur")).toBe(true);
    await confier(eleveur.id, "poule");

    expect(await habitantsDuTerritoire(pool, t)).toContainEqual(expect.objectContaining({ id: eleveur.id, metier: "Éleveur", etat: "à l'Élevage · Poule" }));
    expect(await habitantsDuTerritoire(pool, t)).toContainEqual(expect.objectContaining({ id: autre.id, etat: "libre" }));
    expect(await enregistrerLeMetier(pool, t, eleveur.id, "chasseur")).toBe(false);
    expect(await enregistrerLeMetier(pool, t, eleveur.id, null)).toBe(false);
    expect(await retirerUnHabitantDuMetier(pool, t, "eleveur")).toBeNull();
    expect(await renvoyerLHabitant(pool, t, eleveur.id, INSTANT)).toBe(false);
    expect(await habitantsDuTerritoire(pool, t)).toContainEqual(expect.objectContaining({ id: eleveur.id, metier: "Éleveur", etat: "à l'Élevage · Poule" }));

    // Un autre éleveur, resté libre, change de Métier comme avant ; « − » le prend, lui.
    expect(await enregistrerLeMetier(pool, t, autre.id, "eleveur")).toBe(true);
    expect(await retirerUnHabitantDuMetier(pool, t, "eleveur")).toBe(autre.id);

    // L'Élevage fini, son Métier se change de nouveau.
    await confier(eleveur.id, null);
    expect(await enregistrerLeMetier(pool, t, eleveur.id, "chasseur")).toBe(true);
  });
});
