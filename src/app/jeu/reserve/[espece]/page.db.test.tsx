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
  /** US-0804 : les caractéristiques de la fiche de l'Espèce `espece` que voit le joueur du Territoire, nom et valeur. */
  const caracteristiques = async (territoireId: number, espece: string) => {
    garde.exigerCompte.mockResolvedValue({ id: 1, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId, recitLu: true });
    const html = renderToStaticMarkup(await FicheDeLEspece({ params: Promise.resolve({ espece }), searchParams: Promise.resolve({}) }));
    return [...(html.match(/<dl[^>]*>(.*?)<\/dl>/)?.[1] ?? "").matchAll(/<dt[^>]*>(.*?)<\/dt><dd[^>]*>(.*?)<\/dd>/g)].map(
      ([, nom, valeur]) => `${nom.replace(/<[^>]+>/g, "")} ${valeur.replace(/<[^>]+>/g, "").replace(/[\u00a0\u202f]/g, " ")}`,
    );
  };
  /**
   * La fiche de l'Espèce `espece` telle que la page la montre au joueur du Territoire : son titre, sa Rareté et son image ;
   * US-0810 : et l'effectif qu'elle rappelle.
   */
  const fiche = async (territoireId: number, espece: string) => {
    garde.exigerCompte.mockResolvedValue({ id: 1, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId, recitLu: true });
    const html = renderToStaticMarkup(await FicheDeLEspece({ params: Promise.resolve({ espece }), searchParams: Promise.resolve({}) }));
    return {
      titre: html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1],
      rarete: html.match(/data-rarete="([^"]*)"[^>]*>(.*?)</)?.slice(1).join(" "),
      image: decodeURIComponent(html.match(/<img[^>]*src="([^"]*)"/)?.[1] ?? "").match(/especes\/[a-z_]+\.webp/)?.[0],
      effectif: html.match(/<button[^>]*>Effectif<\/button> <strong[^>]*>(\d+)<\/strong>/)?.[1],
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

    // US-0810 : ses deux Bêtes sont le Couple, en Réserve : son effectif est vide.
    expect(await fiche(t.territoireId, "pigeon")).toEqual({ titre: "Pigeon biset", rarete: "commune Commune", image: "especes/pigeon.webp", effectif: "0" });
  });

  it("ouvre, parmi les Couples du joueur, la fiche de l'Espèce demandée, et seulement elle", async () => {
    const t = await naitre();
    await reunir(t, "souris");
    await reunir(t, "poule");

    expect((await fiche(t.territoireId, "souris")).titre).toBe("Souris grise");
    expect((await fiche(t.territoireId, "poule")).titre).toBe("Poule");
    await expect(fiche(t.territoireId, "pigeon")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it("n'ouvre ni la fiche d'une Espèce sans Couple ni Bête, ni celle du Couple d'un autre joueur", async () => {
    const [a, b] = [await naitre(), await naitre()];
    await reunir(b, "souris");

    await expect(fiche(a.territoireId, "souris")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    await expect(fiche(a.territoireId, "espece_inconnue")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    expect((await fiche(b.territoireId, "souris")).titre).toBe("Souris grise");
  });

  it("ouvre aussi la fiche d'une Espèce dont le joueur a des Bêtes sans en avoir réuni le Couple, et rappelle son effectif (US-0810)", async () => {
    const [t, voisin] = [await naitre(), await naitre()];
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, 'poule', 'femelle', 3)", [t.territoireId]);
    await reunir(t, "souris");
    // Deux souris de plus, après le Couple (US-0959).
    await pool.query("update effectif set nombre = 2 where territoire_id = $1 and espece_id = 'souris' and sexe = 'male'", [t.territoireId]);

    expect(await fiche(t.territoireId, "poule")).toEqual({ titre: "Poule", rarete: "commune Commune", image: "especes/poule.webp", effectif: "3" });
    // Avec son Couple en Réserve, l'Espèce rappelle les seules Bêtes de son effectif.
    expect((await fiche(t.territoireId, "souris")).effectif).toBe("2");
    // Les poules d'un joueur n'ouvrent pas la fiche chez un autre.
    await expect(fiche(voisin.territoireId, "poule")).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it("affiche l'attaque, la vie, la vitesse et la charge enregistrées pour l'Espèce, les mêmes pour tous les joueurs (US-0804)", async () => {
    const [a, b] = [await naitre(), await naitre()];
    await reunir(a, "pigeon");
    await reunir(b, "pigeon");
    const { rows } = await pool.query<{ attaque: number; vie: number; vitesse: number; charge: number }>(
      "select attaque, vie, vitesse, charge from espece where id = 'pigeon'",
    );
    const nombre = (n: number) => n.toLocaleString("fr-FR").replace(/[\u00a0\u202f]/g, " ");
    const attendues = [`Attaque ${nombre(rows[0].attaque)}`, `Vie ${nombre(rows[0].vie)}`, `Vitesse ${nombre(rows[0].vitesse)} km/h`, `Charge ${nombre(rows[0].charge)}`];

    expect((await caracteristiques(a.territoireId, "pigeon")).slice(0, 4)).toEqual(attendues);
    // Rien du Territoire n'y entre : un autre joueur lit les mêmes valeurs pour la même Espèce.
    expect((await caracteristiques(b.territoireId, "pigeon")).slice(0, 4)).toEqual(attendues);
  });

  it("affiche la taille, le régime et l'Entretien enregistrés pour l'Espèce (US-0805)", async () => {
    const t = await naitre();
    await reunir(t, "pigeon");
    const { rows } = await pool.query<{ taille: number; regime: string; entretien: number }>(
      "select taille, regime, entretien_par_heure as entretien from espece where id = 'pigeon'",
    );
    const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 3 }).replace(/[\u00a0\u202f]/g, " ");
    // Le pigeon est herbivore (donnees/especes.yaml) : il mange des Végétaux.
    expect(rows[0].regime).toBe("herbivore");
    expect((await caracteristiques(t.territoireId, "pigeon")).slice(4, 7)).toEqual([
      `Taille ${nombre(rows[0].taille)} Places`,
      "Régime Herbivore",
      `Entretien ${nombre(rows[0].entretien)} Végétaux / h`,
    ]);
  });

  it("ne propose le bloc « Élever » que sur la fiche d'une Espèce dont le joueur a réuni le Couple (US-0812)", async () => {
    const t = await naitre();
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, 'poule', 'femelle', 3)", [t.territoireId]);
    await reunir(t, "souris");
    /** Le bloc « Élever » de la fiche, s'il y est. */
    const elever = async (espece: string) => {
      garde.exigerCompte.mockResolvedValue({ id: 1, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId: t.territoireId, recitLu: true });
      const html = renderToStaticMarkup(await FicheDeLEspece({ params: Promise.resolve({ espece }), searchParams: Promise.resolve({}) }));
      return /<div id="elever"[^>]*><section[^>]*><h2[^>]*>Élever<\/h2>/.test(html);
    };

    expect(await elever("souris")).toBe(true);
    // Trois poules, sans Couple : leur fiche s'ouvre (US-0810), sans Élevage.
    expect(await elever("poule")).toBe(false);
  });

  it("affiche le Biome d'Habitat et le Rôle enregistrés pour l'Espèce, ou « Aucun Rôle » (US-0806)", async () => {
    const t = await naitre();
    await reunir(t, "pigeon");
    await reunir(t, "souris");
    const { rows } = await pool.query<{ id: string; biome: string; role: string | null }>(
      `select e.id, b.nom as biome, r.nom as role from espece e join biome b on b.id = e.biome_id left join role r on r.id = e.role_id
       where e.id in ('pigeon', 'souris') order by e.id`,
    );
    const [pigeon, souris] = rows;
    // Le pigeon est Éclaireur, la souris n'a aucun Rôle (donnees/especes.yaml).
    expect(pigeon.role).not.toBeNull();
    expect(souris.role).toBeNull();
    expect((await caracteristiques(t.territoireId, "pigeon")).slice(7)).toEqual([`Habitat ${pigeon.biome}`, `Rôle ${pigeon.role}`]);
    expect((await caracteristiques(t.territoireId, "souris")).slice(7)).toEqual([`Habitat ${souris.biome}`, "Rôle Aucun Rôle"]);
  });
});
