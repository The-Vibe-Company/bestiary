import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { ecrireUnRecit, recitsDuTerritoire } from "@/monde/recits";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";

// La garde dit qui est connecté ; l'action écrit pour de bon dans la base de test.
const garde = vi.hoisted(() => ({ exigerCompte: vi.fn() }));
vi.mock("@/comptes/garde", () => garde);
const base = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/db", async (original) => ({ ...(await original<object>()), getPool: () => base.pool }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { lireUnRecit } from "./actions";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai des actions des Récits (US-0324)";

describe.skipIf(!URL_TEST)("ouvrir un Récit, sur base (US-0324)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `lire-recit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  const nomUnique = () => nomDEssai("Lect", suffixe, numero);
  const naitre = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    return (await territoireDuCompte(pool, compte.id))!;
  };
  const lus = async (territoireId: number) => (await recitsDuTerritoire(pool, territoireId)).map((r) => [r.titre, r.luLe !== null]);

  beforeAll(async () => {
    pool = poolDeTest();
    base.pool = pool;
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("ne marque que les Récits du joueur connecté, jamais ceux d'un autre, même en envoyant leur identifiant", async () => {
    const [joueur, voisin] = [await naitre(), await naitre()];
    const survenuLe = new Date("2026-10-07T10:00:00Z");
    const sien = await ecrireUnRecit(pool, joueur, { titre: "Le mien", texte: "À moi.", survenuLe });
    const autre = await ecrireUnRecit(pool, voisin, { titre: "Le sien", texte: "Au voisin.", survenuLe });
    garde.exigerCompte.mockResolvedValue({ id: 1, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId: joueur, recitLu: true });

    await lireUnRecit(autre);
    expect(await lus(voisin)).toEqual([["Le sien", false]]);
    expect(await lus(joueur)).toEqual([["Le mien", false]]);

    await lireUnRecit(sien);
    expect(await lus(joueur)).toEqual([["Le mien", true]]);
    expect(await lus(voisin)).toEqual([["Le sien", false]]);
  });
});
