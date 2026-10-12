import type { Pool } from "pg";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { reunirLesCouples } from "@/monde/couple";
import { lireMarquePage } from "@/temps/marque-page";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";

// La garde dit qui est connecté ; la page lit pour de bon la base de test.
const garde = vi.hoisted(() => ({ exigerCompte: vi.fn() }));
vi.mock("@/comptes/garde", () => garde);
const base = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/db", async (original) => ({ ...(await original<object>()), getPool: () => base.pool }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));

import FicheDeLEspece from "./page";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de la fiche d'une Espèce (US-0803)";

describe.skipIf(!URL_TEST)("ouvrir la fiche d'une Espèce, sur base (US-0803)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `fiche-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Fch", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
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
  /** La fiche de l'Espèce `espece` telle que la page la montre au joueur du Territoire : son titre, sa Rareté et son image. */
  const fiche = async (territoireId: number, espece: string) => {
    garde.exigerCompte.mockResolvedValue({ id: 1, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId, recitLu: true });
    const html = renderToStaticMarkup(await FicheDeLEspece({ params: Promise.resolve({ espece }) }));
    return {
      titre: html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1],
      rarete: html.match(/data-rarete="([^"]*)"[^>]*>(.*?)</)?.slice(1).join(" "),
      image: decodeURIComponent(html.match(/<img[^>]*src="([^"]*)"/)?.[1] ?? "").match(/especes\/[a-z_]+\.webp/)?.[0],
    };
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

  it("ouvre la fiche de l'Espèce d'un Couple réuni : son illustration, son nom et sa Rareté", async () => {
    const t = await naitre();
    await reunir(t, "pigeon");

    expect(await fiche(t.territoireId, "pigeon")).toEqual({ titre: "Pigeon biset", rarete: "commune Commune", image: "especes/pigeon.webp" });
  });

  it("ouvre, parmi les Couples du joueur, la fiche de l'Espèce demandée, et seulement elle", async () => {
    const t = await naitre();
    await reunir(t, "souris");
    await reunir(t, "poule");

    expect((await fiche(t.territoireId, "souris")).titre).toBe("Souris grise");
    expect((await fiche(t.territoireId, "poule")).titre).toBe("Poule");
    await expect(fiche(t.territoireId, "pigeon")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it("n'ouvre ni la fiche d'une Espèce sans Couple, ni celle du Couple d'un autre joueur", async () => {
    const [a, b] = [await naitre(), await naitre()];
    await reunir(b, "souris");

    await expect(fiche(a.territoireId, "souris")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    await expect(fiche(a.territoireId, "espece_inconnue")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    expect((await fiche(b.territoireId, "souris")).titre).toBe("Souris grise");
  });
});
