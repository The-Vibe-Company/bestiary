import type { Pool } from "pg";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { reunirLesCouples } from "@/monde/couple";
import { faireEntrerDansLEffectif } from "@/monde/effectif";
import { lireMarquePage } from "@/temps/marque-page";
import { PLACES_DE_L_HABITAT_DU_FOYER } from "@/reglages";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";

// La garde dit qui est connecté ; la page lit pour de bon la base de test.
const garde = vi.hoisted(() => ({ exigerCompte: vi.fn() }));
vi.mock("@/comptes/garde", () => garde);
const base = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/db", async (original) => ({ ...(await original<object>()), getPool: () => base.pool }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));

import Betes from "./page";

/** US-0822 : le total des Places de l'Habitat du Foyer, un réglage provisoire, écrit comme la page l'écrit (« 1 500 »). */
const TOTAL = new Intl.NumberFormat("fr-FR").format(PLACES_DE_L_HABITAT_DU_FOYER).replace(/\s/g, "\u00a0");

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de la page Bêtes (US-0810)";

describe.skipIf(!URL_TEST)("voir l'effectif par Espèce, sur base (US-0810)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `betes-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Btes", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /** Des Bêtes dans l'effectif du Territoire : une ligne par Espèce et par sexe, avec leur nombre. */
  const ajouter = (territoireId: number, lignes: [string, "male" | "femelle", number][]) =>
    pool.query(
      `insert into effectif (territoire_id, espece_id, sexe, nombre)
       select $1, e, s::sexe, n from unnest($2::text[], $3::text[], $4::int[]) as l(e, s, n)`,
      [territoireId, lignes.map((l) => l[0]), lignes.map((l) => l[1]), lignes.map((l) => l[2])],
    );
  /** Réunit les Couples du Territoire, comme au retour d'une Expédition (US-0956) : les Espèces réunies. */
  const reunir = async (t: { territoireId: number; ne: Date }) => {
    const client = await pool.connect();
    try {
      return await reunirLesCouples(client, t.territoireId, new Date(t.ne.getTime() + 3_600_000));
    } finally {
      client.release();
    }
  };
  /** La page Bêtes telle que le joueur du Territoire la voit : son texte, morceau par morceau, et ses liens. */
  const page = async (territoireId: number) => {
    garde.exigerCompte.mockResolvedValue({ id: 1, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId, recitLu: true });
    const html = renderToStaticMarkup(await Betes());
    return {
      texte: html
        .replace(/<[^>]+>/g, "|")
        .replace(/&#x27;/g, "'")
        .split("|")
        .map((m) => m.trim())
        .filter(Boolean)
        .join(" · "),
      liens: [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map(([, lien]) => lien.replace(/&amp;/g, "&")),
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

  it("liste les Espèces du joueur avec leur effectif, et leur total en haut ; jamais les Bêtes d'un autre joueur", async () => {
    const [t, voisin] = [await naitre(), await naitre()];
    await ajouter(t.territoireId, [
      ["souris", "male", 4],
      ["souris", "femelle", 3],
      ["pigeon", "male", 2],
    ]);
    await ajouter(voisin.territoireId, [["poule", "femelle", 5]]);

    expect(await page(t.territoireId)).toEqual({
      // US-0822 : 7 souris (1 Place chacune) et 2 pigeons (8,556 chacun) prennent 25 Places de l'Habitat du Foyer.
      texte: `Bêtes · 9 · Bêtes · Places : · 25 / ${TOTAL} · Pigeon biset · Commune · 2 · Souris grise · Commune · 7`,
      liens: ["/jeu/reserve/pigeon?depuis=betes", "/jeu/reserve/souris?depuis=betes"],
    });
  });

  it("ne compte pas les Bêtes d'un Couple, parties en Réserve, ni dans l'effectif de l'Espèce ni dans le total", async () => {
    const t = await naitre();
    await ajouter(t.territoireId, [
      ["souris", "male", 2],
      ["souris", "femelle", 1],
      ["poule", "male", 1],
      ["poule", "femelle", 1],
    ]);
    // US-0822 : 3 souris et 2 poules (31,623 Places chacune) : 67 Places.
    expect((await page(t.territoireId)).texte).toBe(`Bêtes · 5 · Bêtes · Places : · 67 / ${TOTAL} · Poule · Commune · 2 · Souris grise · Commune · 3`);

    expect(await reunir(t)).toEqual(["poule", "souris"]);
    // Les deux poules du Couple sont en Réserve : la poule quitte la liste, une souris reste.
    expect((await page(t.territoireId)).texte).toBe(`Bêtes · 1 · Bête · Places : · 1 / ${TOTAL} · Souris grise · Commune · 1`);
  });

  it("sans aucune Bête, ne dit que « Aucune Bête pour l'instant » et mène à l'Expédition ; la première Bête ramenée y met la liste (US-0811)", async () => {
    const t = await naitre();
    expect(await page(t.territoireId)).toEqual({ texte: "Bêtes · Aucune Bête pour l'instant · Envoyer une Expédition", liens: ["/jeu/expeditions/nouvelle"] });

    // La première Bête ramenée au Foyer entre dans l'effectif (US-0938).
    await faireEntrerDansLEffectif(pool, t.territoireId, [{ especeId: "souris", sexe: "femelle" }]);
    expect(await page(t.territoireId)).toEqual({ texte: `Bêtes · 1 · Bête · Places : · 1 / ${TOTAL} · Souris grise · Commune · 1`, liens: ["/jeu/reserve/souris?depuis=betes"] });
  });
});
