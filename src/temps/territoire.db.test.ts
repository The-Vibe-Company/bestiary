import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { mondeDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { rattraperLesAbsents } from "./absents";
import { lireMarquePage } from "./marque-page";
import { rattraper } from "./rattraper";

/** Le Monde d'essai de ce fichier, où naît son chef : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du temps d'un Territoire (US-0156)";

describe.skipIf(!URL_TEST)("le temps d'un Territoire (US-0156, sur base)", () => {
  let pool: Pool;
  let territoireId: number;
  const lancement = `temps-territoire-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    const compte = (await creerCompte(pool, `${lancement}@essai.test`, "une phrase de passe"))!;
    const mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    // Un nom qu'aucun mot interdit ne refuse : « Temps » suivi d'un « exe » tiré au hasard ne naissait pas.
    expect(await enregistrerNomDeChef(pool, compte.id, `Temps${suffixeDEssai()}`, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    territoireId = (await territoireDuCompte(pool, compte.id))!;
  });
  afterAll(async () => {
    await pool.query("delete from compte where email = $1", [`${lancement}@essai.test`]);
    await pool.end();
  });

  it("avance quand on le rattrape, comme le Monde : trois heures plus tard, il est à l'heure", async () => {
    const jusqua = new Date((await lireMarquePage(pool, "territoire", territoireId)).getTime() + 3 * 3_600_000);
    expect(await rattraper("territoire", territoireId, { pool, jusqua })).toEqual(jusqua);
  });

  it("refuse en base de faire reculer son marque-page", async () => {
    await expect(pool.query("update territoire set calcule_jusqu_a = calcule_jusqu_a - interval '1 hour' where id = $1", [territoireId])).rejects.toThrow(
      /Le temps ne recule jamais/,
    );
  });

  it("est rattrapé par la tâche planifiée quand personne ne l'a regardé", async () => {
    const instant = new Date((await lireMarquePage(pool, "territoire", territoireId)).getTime() + 60 * 60_000);
    const passage = await rattraperLesAbsents({ pool, maintenant: instant, parmi: { territoire: [territoireId] } });
    expect(passage).toMatchObject({ rattrapes: 1, echecs: 0, restants: 0 });
    expect(await lireMarquePage(pool, "territoire", territoireId)).toEqual(instant);
  });
});
