import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { ecrireUnRecit, marquerUnRecitLu, nombreDeRecitsNonLus, recitsDuTerritoire } from "./recits";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai des Récits (US-0324)";

describe.skipIf(!URL_TEST)("les Récits d'un Territoire (US-0324, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `recits-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Un nom de chef propre à ce lancement, pour ne pas croiser les autres essais. */
  const nomUnique = () => nomDEssai("Recit", suffixe, numero);
  const naitre = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomUnique(), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    return { compteId: compte.id, territoireId: (await territoireDuCompte(pool, compte.id))! };
  };
  const a = (heure: string) => new Date(`2026-10-07T${heure}:00Z`);

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("n'en donne aucun à un Territoire qui vient de naître", async () => {
    const { territoireId } = await naitre();
    expect(await recitsDuTerritoire(pool, territoireId)).toEqual([]);
    expect(await nombreDeRecitsNonLus(pool, territoireId)).toBe(0);
  });

  it("écrit un Récit daté de l'heure du jeu où l'événement est survenu, non lu", async () => {
    const { territoireId } = await naitre();
    const id = await ecrireUnRecit(pool, territoireId, { titre: "Famine", texte: "Deux Habitants sont partis.\nIls ne reviendront pas.", survenuLe: a("14:05") });
    expect(id).toEqual(expect.any(Number));
    expect(await recitsDuTerritoire(pool, territoireId)).toEqual([
      { id, titre: "Famine", texte: "Deux Habitants sont partis.\nIls ne reviendront pas.", survenuLe: a("14:05"), luLe: null },
    ]);
  });

  it("écrit dans la transaction de l'événement qui le produit : annulée, elle n'en laisse rien", async () => {
    const { territoireId } = await naitre();
    const client = await pool.connect();
    try {
      await client.query("begin");
      await ecrireUnRecit(client, territoireId, { titre: "Retour de Récolte", texte: "Du Bois.", survenuLe: a("09:00") });
      expect(await recitsDuTerritoire(client, territoireId)).toHaveLength(1);
      await client.query("rollback");
    } finally {
      client.release();
    }
    expect(await recitsDuTerritoire(pool, territoireId)).toEqual([]);
  });

  it("les range du plus récent au plus ancien, selon l'heure où ils sont survenus et non l'ordre d'écriture", async () => {
    const { territoireId } = await naitre();
    const ecrire = (titre: string, heure: string) => ecrireUnRecit(pool, territoireId, { titre, texte: titre, survenuLe: a(heure) });
    await ecrire("Midi", "12:00");
    await ecrire("Matin", "08:00");
    await ecrire("Soir", "19:30");
    await ecrire("Midi, plus tard écrit", "12:00");
    expect((await recitsDuTerritoire(pool, territoireId)).map((r) => r.titre)).toEqual(["Soir", "Midi, plus tard écrit", "Midi", "Matin"]);
  });

  it("compte les non lus, et en retire chacun une fois ouvert, une seule fois", async () => {
    const { territoireId } = await naitre();
    const [premier, second] = [
      await ecrireUnRecit(pool, territoireId, { titre: "Un", texte: "Un.", survenuLe: a("10:00") }),
      await ecrireUnRecit(pool, territoireId, { titre: "Deux", texte: "Deux.", survenuLe: a("11:00") }),
    ];
    expect(await nombreDeRecitsNonLus(pool, territoireId)).toBe(2);
    expect(await marquerUnRecitLu(pool, territoireId, premier, a("15:00"))).toBe(true);
    expect(await nombreDeRecitsNonLus(pool, territoireId)).toBe(1);
    // Rouvert plus tard, il garde l'heure de sa première lecture.
    expect(await marquerUnRecitLu(pool, territoireId, premier, a("16:00"))).toBe(false);
    expect((await recitsDuTerritoire(pool, territoireId)).map((r) => [r.id, r.luLe])).toEqual([
      [second, null],
      [premier, a("15:00")],
    ]);
  });

  it("garde les Récits de chacun pour lui seul : ni lus, ni comptés, ni marqués par un autre", async () => {
    const [joueur, voisin] = [await naitre(), await naitre()];
    const sien = await ecrireUnRecit(pool, joueur.territoireId, { titre: "Le mien", texte: "À moi.", survenuLe: a("10:00") });
    const autre = await ecrireUnRecit(pool, voisin.territoireId, { titre: "Le sien", texte: "Au voisin.", survenuLe: a("11:00") });
    expect((await recitsDuTerritoire(pool, joueur.territoireId)).map((r) => r.id)).toEqual([sien]);
    expect((await recitsDuTerritoire(pool, voisin.territoireId)).map((r) => r.id)).toEqual([autre]);
    expect(await nombreDeRecitsNonLus(pool, joueur.territoireId)).toBe(1);
    expect(await marquerUnRecitLu(pool, joueur.territoireId, autre, a("12:00"))).toBe(false);
    expect(await nombreDeRecitsNonLus(pool, voisin.territoireId)).toBe(1);
    expect(await marquerUnRecitLu(pool, joueur.territoireId, -1, a("12:00"))).toBe(false);
  });

  it("joint au Récit d'un retour ses Rencontres, dans leur ordre, chacune avec le nom, l'illustration et la Rareté de son Espèce (US-0940)", async () => {
    const { territoireId } = await naitre();
    /** La première Espèce de la Rareté `rareteId`, avec le nom de celle-ci. */
    const uneEspece = async (rareteId: string) =>
      (
        await pool.query<{ id: string; nom: string; illustration: string | null; rareteId: string; rarete: string }>(
          `select e.id, e.nom, e.illustration, e.rarete_id as "rareteId", ra.nom as rarete from espece e join rarete ra on ra.id = e.rarete_id
           where e.rarete_id = $1 order by e.id limit 1`,
          [rareteId],
        )
      ).rows[0];
    const [rare, commune] = [await uneEspece("rare"), await uneEspece("commune")];
    expect([rare.rareteId, commune.rareteId]).toEqual(["rare", "commune"]);
    const rencontres = [
      { especeId: rare.id, vueLe: a("10:00"), issue: "restee" as const, sexe: null, nouvelleEspece: true },
      { especeId: commune.id, vueLe: a("10:40"), issue: "apprivoisee" as const, sexe: "femelle" as const, nouvelleEspece: false },
    ];
    const retour = await ecrireUnRecit(pool, territoireId, { titre: "Retour d'Expédition", texte: "Deux Bêtes se sont montrées.", survenuLe: a("12:00") }, rencontres);
    // Les autres Récits, et un retour sans Bête, restent du texte.
    const famine = await ecrireUnRecit(pool, territoireId, { titre: "Famine", texte: "Un Habitant est parti.", survenuLe: a("11:00") });
    const calme = await ecrireUnRecit(pool, territoireId, { titre: "Retour d'Expédition", texte: "Aucune Bête ne s'est montrée.", survenuLe: a("10:00") }, []);

    expect(await recitsDuTerritoire(pool, territoireId)).toEqual([
      {
        id: retour,
        titre: "Retour d'Expédition",
        texte: "Deux Bêtes se sont montrées.",
        survenuLe: a("12:00"),
        luLe: null,
        rencontres: [
          { ...rencontres[0], nom: rare.nom, illustration: rare.illustration, rarete: { id: "rare", nom: rare.rarete } },
          { ...rencontres[1], nom: commune.nom, illustration: commune.illustration, rarete: { id: "commune", nom: commune.rarete } },
        ],
      },
      { id: famine, titre: "Famine", texte: "Un Habitant est parti.", survenuLe: a("11:00"), luLe: null },
      { id: calme, titre: "Retour d'Expédition", texte: "Aucune Bête ne s'est montrée.", survenuLe: a("10:00"), luLe: null },
    ]);
    expect((await recitsDuTerritoire(pool, territoireId)).map((r) => "rencontres" in r)).toEqual([true, false, false]);
  });

  it("annonce en tête du retour qui l'a réuni chaque Couple réuni à son instant, avec le nom et l'illustration de son Espèce (US-0958)", async () => {
    const [joueur, voisin] = [await naitre(), await naitre()];
    /** Le nom et l'illustration de l'Espèce `id`, lus comme sur sa fiche. */
    const espece = async (id: string) =>
      (await pool.query<{ especeId: string; nom: string; illustration: string | null }>(`select id as "especeId", nom, illustration from espece where id = $1`, [id])).rows[0];
    const reunir = (territoireId: number, especeId: string, heure: string) =>
      pool.query("insert into couple (territoire_id, espece_id, reuni_le) values ($1, $2, $3)", [territoireId, especeId, a(heure)]);
    // Deux Couples réunis par le même retour, un autre réuni sans retour à cet instant.
    await reunir(joueur.territoireId, "souris", "12:00");
    await reunir(joueur.territoireId, "poule", "12:00");
    await reunir(joueur.territoireId, "pigeon", "09:00");
    const retour = await ecrireUnRecit(pool, joueur.territoireId, { titre: "Retour d'Expédition", texte: "Aucune Bête ne s'est montrée.", survenuLe: a("12:00") });
    // Un autre Récit au même instant, un retour plus tôt, et le retour d'un voisin au même instant ne l'annoncent pas.
    const famine = await ecrireUnRecit(pool, joueur.territoireId, { titre: "Famine", texte: "Un Habitant est parti.", survenuLe: a("12:00") });
    const plusTot = await ecrireUnRecit(pool, joueur.territoireId, { titre: "Retour d'Expédition", texte: "Aucune Bête ne s'est montrée.", survenuLe: a("10:00") });
    await ecrireUnRecit(pool, voisin.territoireId, { titre: "Retour d'Expédition", texte: "Aucune Bête ne s'est montrée.", survenuLe: a("12:00") });

    const recits = await recitsDuTerritoire(pool, joueur.territoireId);
    expect(recits.map((r) => [r.id, r.couples])).toEqual([
      [famine, undefined],
      [retour, [await espece("poule"), await espece("souris")]],
      [plusTot, undefined],
    ]);
    expect(recits.map((r) => "couples" in r)).toEqual([false, true, false]);
    expect((await recitsDuTerritoire(pool, voisin.territoireId)).map((r) => "couples" in r)).toEqual([false]);
  });

  it("les retire avec leur Territoire", async () => {
    const { compteId, territoireId } = await naitre();
    await ecrireUnRecit(pool, territoireId, { titre: "Éphémère", texte: "Bientôt parti.", survenuLe: a("10:00") });
    await pool.query("delete from compte where id = $1", [compteId]);
    expect(await recitsDuTerritoire(pool, territoireId)).toEqual([]);
  });
});
