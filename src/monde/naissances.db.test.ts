import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { rattraperLesAbsents } from "@/temps/absents";
import { definirAncre } from "@/temps/horloge";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { reunirLesCouples } from "./couple";
import { dureeDUneBeteEleveeMinutes } from "./cout-d-elevage";
import { lancerUnElevage } from "./lancer-un-elevage";
import { FIN_D_ELEVAGE } from "./recit-d-elevage";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai des naissances d'un Élevage (US-0817)";

const MINUTE = 60_000;

describe.skipIf(!URL_TEST)("recevoir les Bêtes une à une (US-0817, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `naissances-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];
  /** La durée d'Élevage d'une souris, en minutes, d'après sa taille en base. */
  let souris: number;

  /** Un joueur qui vient de naître : son Territoire, l'instant de sa naissance et ses trois Habitants, du premier arrivé au dernier. */
  const naitre = async () => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Nais", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    const habitants = (await pool.query<{ id: number }>("select id from habitant where territoire_id = $1 order by id", [territoireId])).rows.map((h) => h.id);
    await pool.query("update stock set quantite = 1000, limite = 100000, reste = 0, plein_depuis = null where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')", [
      territoireId,
    ]);
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId), habitants };
  };
  /** Réunit au Territoire le Couple de l'Espèce `especeId`, comme au retour d'une Expédition (US-0956), à sa naissance. */
  const reunir = async (t: { territoireId: number; ne: Date }, especeId: string) => {
    const client = await pool.connect();
    try {
      await client.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 1), ($1, $2, 'femelle', 1)", [t.territoireId, especeId]);
      expect(await reunirLesCouples(client, t.territoireId, t.ne)).toEqual([especeId]);
    } finally {
      client.release();
    }
  };
  /** Un Territoire qui a réuni le Couple de la souris, avec un éleveur : il lance l'Élevage de `quantite` souris à sa naissance. */
  const elever = async (quantite: number) => {
    const t = await naitre();
    await reunir(t, "souris");
    await pool.query("update habitant set metier = 'eleveur' where id = $1", [t.habitants[0]]);
    expect(await lancerUnElevage(pool, t.territoireId, "souris", quantite, t.ne)).toMatchObject({ lance: { quantite } });
    return t;
  };
  const apres = (t: { ne: Date }, minutes: number) => new Date(t.ne.getTime() + minutes * MINUTE);
  /** Les souris de l'effectif, par sexe. */
  const effectif = async (territoireId: number) =>
    Object.fromEntries(
      (
        await pool.query<{ sexe: string; nombre: number }>("select sexe, nombre from effectif where territoire_id = $1 and espece_id = 'souris' order by sexe", [
          territoireId,
        ])
      ).rows.map((e) => [e.sexe, e.nombre]),
    );
  /** Les Récits de fin d'Élevage du Territoire : leur texte et leur instant. */
  const recits = async (territoireId: number) =>
    (
      await pool.query<{ texte: string; survenuLe: Date }>("select texte, survenu_le as \"survenuLe\" from recit where territoire_id = $1 and titre = $2 order by survenu_le, id", [
        territoireId,
        FIN_D_ELEVAGE,
      ])
    ).rows;
  /** L'Espèce qu'élève l'éleveur du Territoire (null : libre). */
  const eleve = async (territoireId: number) =>
    (await pool.query<{ espece_elevee: string | null }>("select espece_elevee from habitant where territoire_id = $1 and metier = 'eleveur'", [territoireId])).rows[0]
      .espece_elevee;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    souris = dureeDUneBeteEleveeMinutes((await pool.query<{ t: number }>("select taille as t from espece where id = 'souris'")).rows[0].t);
  });
  afterEach(async () => {
    definirAncre(null);
    vi.useRealTimers();
    // Chaque essai rend ses Foyers à la Couronne du Monde d'essai.
    await pool.query("delete from compte where email = any($1)", [nes.splice(0)]);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("fait naître les Bêtes l'une après l'autre, chacune après la durée d'Élevage, dans l'effectif aussitôt ; à la fin, un Récit, et l'éleveur libre", async () => {
    const t = await elever(3);
    // Avant la première naissance : rien.
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t, souris - 1) });
    expect(await effectif(t.territoireId)).toEqual({ femelle: 0, male: 0 });
    // La première : une femelle, aussitôt dans l'effectif ; l'Élevage continue.
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t, souris) });
    expect(await effectif(t.territoireId)).toEqual({ femelle: 1, male: 0 });
    expect(await eleve(t.territoireId)).toBe("souris");
    expect(await recits(t.territoireId)).toEqual([]);
    // La deuxième, un mâle, puis la troisième, une femelle : l'Élevage est fini.
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t, 3 * souris + 30) });
    expect(await effectif(t.territoireId)).toEqual({ femelle: 2, male: 1 });
    expect(await recits(t.territoireId)).toEqual([{ texte: "3 Bêtes de Souris grise ont rejoint votre effectif.", survenuLe: apres(t, 3 * souris) }]);
    expect(await eleve(t.territoireId)).toBeNull();
    // Rien ne naît plus ensuite, et l'Espèce peut être élevée de nouveau.
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t, 10 * souris) });
    expect(await effectif(t.territoireId)).toEqual({ femelle: 2, male: 1 });
    expect(await recits(t.territoireId)).toHaveLength(1);
    expect(await lancerUnElevage(pool, t.territoireId, "souris", 1, apres(t, 10 * souris))).toMatchObject({ lance: { quantite: 1 } });
  });

  it("donne la même chose par tranches ou d'un bloc : chaque naissance une seule fois, le Récit une seule fois", async () => {
    const [parTranches, dUnBloc] = [await elever(5), await elever(5)];
    for (let minutes = 7; minutes <= 6 * souris; minutes += 7) await rattraper("territoire", parTranches.territoireId, { pool, jusqua: apres(parTranches, minutes) });
    await rattraper("territoire", parTranches.territoireId, { pool, jusqua: apres(parTranches, 6 * souris) });
    await rattraper("territoire", dUnBloc.territoireId, { pool, jusqua: apres(dUnBloc, 6 * souris) });
    expect(await effectif(parTranches.territoireId)).toEqual({ femelle: 3, male: 2 });
    expect(await effectif(dUnBloc.territoireId)).toEqual({ femelle: 3, male: 2 });
    const [a, b] = [await recits(parTranches.territoireId), await recits(dUnBloc.territoireId)];
    expect(a.map((r) => r.texte)).toEqual(["5 Bêtes de Souris grise ont rejoint votre effectif."]);
    expect(b.map((r) => r.texte)).toEqual(a.map((r) => r.texte));
    expect(a[0].survenuLe.getTime() - parTranches.ne.getTime()).toBe(b[0].survenuLe.getTime() - dUnBloc.ne.getTime());
  });

  it("fait naître les Bêtes même le joueur absent, par la tâche planifiée, et dit une Bête seule au singulier", async () => {
    const t = await elever(1);
    await rattraperLesAbsents({ pool, maintenant: apres(t, 2 * souris), parmi: { territoire: [t.territoireId] } });
    expect(await effectif(t.territoireId)).toEqual({ femelle: 1, male: 0 });
    expect(await recits(t.territoireId)).toEqual([{ texte: "1 Bête de Souris grise a rejoint votre effectif.", survenuLe: apres(t, souris) }]);
    expect(await eleve(t.territoireId)).toBeNull();
  });

  it("en vitesse accélérée, fait naître au bout d'un temps réel donné autant de Bêtes que le rythme prévu", async () => {
    const t = await elever(4);
    const reel = new Date("2026-03-01T12:00:00Z").getTime();
    vi.useFakeTimers({ toFake: ["Date"] });
    // À ×100 : une souris toutes les `souris` minutes de jeu, soit toutes les `souris × 0,6` secondes réelles.
    definirAncre({ facteur: 100, reel, jeu: t.ne.getTime() });
    const parBete = (souris * MINUTE) / 100;
    vi.setSystemTime(reel + 2 * parBete - 1);
    await rattraper("territoire", t.territoireId, { pool });
    expect(await effectif(t.territoireId)).toEqual({ femelle: 1, male: 0 });
    vi.setSystemTime(reel + 2 * parBete + 1);
    await rattraper("territoire", t.territoireId, { pool });
    expect(await effectif(t.territoireId)).toEqual({ femelle: 1, male: 1 });
    vi.setSystemTime(reel + 4 * parBete + 1);
    await rattraper("territoire", t.territoireId, { pool });
    expect(await effectif(t.territoireId)).toEqual({ femelle: 2, male: 2 });
    expect(await recits(t.territoireId)).toHaveLength(1);
  });

  it("ne mêle jamais les Élevages ni les Territoires : chacun ses naissances, son Récit et son éleveur", async () => {
    const t = await elever(2);
    // Un pigeon, élevé par un autre éleveur du même Territoire, et un voisin qui n'élève rien.
    await reunir(t, "pigeon");
    await pool.query("update habitant set metier = 'eleveur' where id = $1", [t.habitants[1]]);
    expect(await lancerUnElevage(pool, t.territoireId, "pigeon", 1, t.ne)).toMatchObject({ lance: { quantite: 1 } });
    const voisin = await naitre();
    const pigeon = dureeDUneBeteEleveeMinutes((await pool.query<{ t: number }>("select taille as t from espece where id = 'pigeon'")).rows[0].t);
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t, Math.max(2 * souris, pigeon)) });
    await rattraper("territoire", voisin.territoireId, { pool, jusqua: apres(voisin, Math.max(2 * souris, pigeon)) });
    expect(await effectif(t.territoireId)).toEqual({ femelle: 1, male: 1 });
    const pigeons = (await pool.query<{ nombre: number }>("select sum(nombre)::int as nombre from effectif where territoire_id = $1 and espece_id = 'pigeon'", [t.territoireId]))
      .rows[0].nombre;
    expect(pigeons).toBe(1);
    expect((await recits(t.territoireId)).map((r) => r.texte).sort()).toEqual([
      "1 Bête de Pigeon biset a rejoint votre effectif.",
      "2 Bêtes de Souris grise ont rejoint votre effectif.",
    ]);
    expect((await pool.query("select count(*)::int as n from habitant where territoire_id = $1 and espece_elevee is not null", [t.territoireId])).rows[0].n).toBe(0);
    expect(await effectif(voisin.territoireId)).toEqual({});
    expect(await recits(voisin.territoireId)).toEqual([]);
  });
});
