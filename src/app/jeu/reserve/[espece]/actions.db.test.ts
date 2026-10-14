import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { reunirLesCouples } from "@/monde/couple";
import { ELEVAGE_SANS_COUPLE, ELEVAGE_SANS_ELEVEUR } from "@/monde/elevage";
import { lireMarquePage } from "@/temps/marque-page";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";

// La garde dit qui est connecté ; l'action lit pour de bon la base de test.
const garde = vi.hoisted(() => ({ exigerCompte: vi.fn() }));
vi.mock("@/comptes/garde", () => garde);
const base = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/db", async (original) => ({ ...(await original<object>()), getPool: () => base.pool }));
// US-0815 : la page relue après un lancement, hors de toute requête ici.
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { elever } from "./actions";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de l'Élevage demandé (US-0812)";

describe.skipIf(!URL_TEST)("refuser l'Élevage d'une Espèce sans Couple, sur base (US-0812)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `elever-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];

  /** Un chef qui vient de naître dans le Monde d'essai : son Territoire et l'instant de sa naissance. */
  const naitre = async () => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Elev", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /** Réunit au Territoire le Couple de l'Espèce `especeId`, comme au retour d'une Expédition (US-0956). */
  const reunir = async (t: { territoireId: number; ne: Date }, especeId: string) => {
    const client = await pool.connect();
    try {
      await client.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 1), ($1, $2, 'femelle', 1)", [t.territoireId, especeId]);
      expect(await reunirLesCouples(client, t.territoireId, new Date(t.ne.getTime() + 3_600_000))).toEqual([especeId]);
    } finally {
      client.release();
    }
  };
  /** US-0843 : donne le Métier d'éleveur au premier Habitant du Territoire. */
  const nommerUnEleveur = (territoireId: number) =>
    pool.query("update habitant set metier = 'eleveur' where id = (select id from habitant where territoire_id = $1 order by id limit 1)", [territoireId]);
  /** L'Élevage d'une Bête de l'Espèce `espece` demandé pour le joueur du Territoire, comme le bouton l'envoie, ou par tout autre chemin. */
  const demander = (territoireId: number, espece: string) => {
    garde.exigerCompte.mockResolvedValue({ id: 1, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId, recitLu: true });
    const formulaire = new FormData();
    formulaire.set("espece", espece);
    formulaire.set("quantite", "1");
    return elever({ refus: null }, formulaire);
  };

  beforeAll(async () => {
    pool = poolDeTest();
    base.pool = pool;
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterEach(async () => {
    // Chaque essai rend ses Foyers à la Couronne du Monde d'essai.
    await pool.query("delete from compte where email = any($1)", [nes.splice(0)]);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("refuse l'Élevage d'une Espèce sans Couple, même avec des Bêtes ou le Couple d'un autre joueur ; pas celui d'une Espèce au Couple réuni", async () => {
    const [t, voisin] = [await naitre(), await naitre()];
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, 'poule', 'femelle', 3)", [t.territoireId]);
    await reunir(t, "souris");
    await reunir(voisin, "pigeon");

    expect(await demander(t.territoireId, "poule")).toEqual({ refus: ELEVAGE_SANS_COUPLE });
    expect(await demander(t.territoireId, "pigeon")).toEqual({ refus: ELEVAGE_SANS_COUPLE });
    expect(await demander(t.territoireId, "espece_inconnue")).toEqual({ refus: ELEVAGE_SANS_COUPLE });
    // US-0843 : le Couple réuni, l'Élevage reste acquis, mais son lancement demande un éleveur libre.
    expect(await demander(t.territoireId, "souris")).toEqual({ refus: ELEVAGE_SANS_ELEVEUR });
    await nommerUnEleveur(t.territoireId);
    await nommerUnEleveur(voisin.territoireId);
    // US-0815 : de quoi payer une souris et un pigeon ; l'Élevage se lance.
    await pool.query("update stock set quantite = 1000, limite = 1000 where territoire_id = any($1) and ressource_id in ('viande', 'vegetaux')", [[t.territoireId, voisin.territoireId]]);
    const lance = { refus: null, lance: { quantite: 1, eleveur: expect.any(String) } };
    expect(await demander(t.territoireId, "souris")).toEqual(lance);
    expect(await demander(voisin.territoireId, "pigeon")).toEqual(lance);
  });

  it("refuse le lancement quand le seul éleveur s'occupe déjà d'un Élevage (US-0843) : celui qu'un premier lancement lui a confié (US-0815)", async () => {
    const t = await naitre();
    await reunir(t, "souris");
    await nommerUnEleveur(t.territoireId);
    await pool.query("update stock set quantite = 1000, limite = 1000 where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')", [t.territoireId]);
    expect(await demander(t.territoireId, "souris")).toMatchObject({ refus: null, lance: { quantite: 1 } });
    expect((await pool.query("select espece_elevee from habitant where territoire_id = $1 and metier = 'eleveur'", [t.territoireId])).rows).toEqual([{ espece_elevee: "souris" }]);
    expect(await demander(t.territoireId, "souris")).toEqual({ refus: ELEVAGE_SANS_ELEVEUR });
  });
});
