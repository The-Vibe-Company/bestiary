// US-0964 : le récit du perdant. Quand une Bête disputée suit une autre Expédition (US-0963), le joueur qui l'a vue sans
// l'emporter l'apprend au retour : son récit dit qu'elle a suivi une autre Expédition, sans nommer le chef qui l'a emportée
// (décidé le 2026-10-12 : un joueur n'apprend pas le nom des autres chefs d'une Case partagée, US-0962). Il ne perd rien,
// garde l'Espèce « croisée » au Bestiaire, et son Expédition a poursuivi son séjour normalement. Le même récit quel que
// soit le joueur mis à l'heure le premier.
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bestiaireDuTerritoire, type EspeceAuBestiaire } from "@/bestiaire/bestiaire";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { type BeteSauvage, betesSauvagesDesCases } from "@/monde/betes-sauvages";
import { type Recit, recitsDuTerritoire } from "@/monde/recits";
import { PRESENCE_D_UNE_BETE_HEURES } from "@/reglages";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDansLaTransaction, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { lExpeditionSuivie } from "./apprivoisement";
import { forceDUneBete } from "./force";
import { type HorairesDUneExpedition, retourDUneExpedition } from "./phase";
import { programmerLeRetour } from "./retour";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;
/** Le temps, en minutes, où aucune autre Bête n'apparaît avant ou après celle de l'essai : sa présence et 6 heures de marge. */
const CALME = PRESENCE_D_UNE_BETE_HEURES * HEURE + 6 * HEURE;
/** L'aller et le retour des Expéditions de l'essai, posées sur la Case sans souci de la distance à leur Foyer. */
const TRAJET = 30;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du récit du perdant (US-0964)";
/** Le titre des Récits de retour, pour les trier parmi ceux du Territoire (un Voyageur reparti en écrit aussi). */
const RETOUR = "Retour d'Expédition";

/** Ce que l'Expédition du perdant lui laisse, une fois rentrée. */
type Bilan = {
  recit: Pick<Recit, "texte" | "survenuLe" | "rencontres">;
  bestiaire: EspeceAuBestiaire[];
  escorte: { especeId: string; nombre: number; perdues: number }[];
  rentreeLe: Date | null;
};

describe.skipIf(!URL_TEST)("le récit du perdant (US-0964, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `recit-du-perdant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** La commune la plus faible du jeu, qui escorte les deux Expéditions. */
  let faible: { id: string; force: number };
  /** Les deux joueurs : A, qui emporte la Bête, et B, le perdant ; leur Territoire et le nom de leur chef. */
  const joueurs = {} as Record<"A" | "B", { territoireId: number; nom: string }>;
  let bete: BeteSauvage;
  let nomDeLEspece: string;
  let horaires: HorairesDUneExpedition;
  /** Le bilan du perdant, son Territoire mis à l'heure avant celui du gagnant, puis après. */
  const bilans = {} as Record<"B d'abord" | "A d'abord", Bilan>;
  const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);

  /** Un chef qui vient de naître dans le Monde d'essai : son Territoire, le nom de son chef, l'instant de sa naissance. */
  const naitre = async () => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Perd", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    return { territoireId, nom, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /**
   * L'Expédition du joueur sur la Case `ici`, escortée d'une Bête de la commune la plus faible, posée en base comme un départ
   * l'aurait fait, son retour programmé (US-0916) : pour mettre sur une même Case les Expéditions de Territoires éloignés.
   */
  const poser = async (client: PoolClient, territoireId: number, ici: number) => {
    const { rows } = await client.query<{ id: number }>(
      "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, $4, $5) returning id",
      [territoireId, ici, horaires.partLe, horaires.trajetMinutes, horaires.sejourMinutes],
    );
    await client.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, 1)", [rows[0].id, faible.id]);
    await programmerLeRetour(client, territoireId, rows[0].id, horaires);
    return rows[0].id;
  };

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    const { rows: especes } = await pool.query<{ id: string; nom: string; rareteId: string; attaque: number; vie: number }>(
      'select id, nom, rarete_id as "rareteId", attaque, vie from espece order by id',
    );
    const parForce = especes.map((e) => ({ ...e, force: forceDUneBete(e) })).sort((x, y) => x.force - y.force || x.id.localeCompare(y.id));
    faible = parForce.find((e) => e.rareteId === "commune" && e.force > 0)!;
    // Les deux chefs naissent d'abord, puis l'essai choisit sa Case : un Foyer né après coup pourrait s'y poser.
    const [a, b] = [await naitre(), await naitre()];
    [joueurs.A, joueurs.B] = [a, b];
    const { rows: cases } = await pool.query<{ id: number }>(
      `select c.id from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) between 2 and 6
         and not exists (select 1 from bete_de_naissance n where n.case_id = c.id and n.territoire_id = any($2::int[]))
       order by c.id`,
      [a.territoireId, [a.territoireId, b.territoireId]],
    );
    // Une Bête commune seule, d'une autre Espèce que l'escorte, que le tirage donne à A face à B, d'escortes égales, toutes
    // deux arrivées une heure avant elle : le tirage range les Expéditions par identifiant, A est posée la première.
    const [de, a40] = [apres(b.ne, 3 * JOUR), apres(b.ne, 40 * JOUR)];
    let caseId: number | null = null;
    for (const [ici, betes] of await betesSauvagesDesCases(pool, cases.map((c) => c.id), de, a40)) {
      const trouvee = betes.find(
        (x, i) =>
          x.rareteId === "commune" &&
          x.especeId !== faible.id &&
          x.arrivee >= apres(de, CALME) &&
          x.arrivee <= apres(a40, -CALME) &&
          (i === 0 || betes[i - 1].arrivee <= apres(x.arrivee, -CALME)) &&
          (i === betes.length - 1 || betes[i + 1].arrivee >= apres(x.arrivee, CALME)) &&
          lExpeditionSuivie({ ...x, force: 0, caseId: ici, beteDeNaissanceId: null }, [
            { id: 1, arrivee: apres(x.arrivee, -HEURE), depart: apres(x.arrivee, 3 * HEURE), escorte: faible.force },
            { id: 2, arrivee: apres(x.arrivee, -HEURE), depart: apres(x.arrivee, 3 * HEURE), escorte: faible.force },
          ])?.expeditionId === 1,
      );
      if (trouvee) {
        [caseId, bete] = [ici, trouvee];
        break;
      }
    }
    if (caseId === null) throw new Error("Aucune Bête commune seule que le tirage donne à A.");
    nomDeLEspece = especes.find((e) => e.id === bete.especeId)!.nom;
    // Les deux Expéditions arrivent une heure avant la Bête et séjournent quatre heures.
    horaires = { partLe: apres(bete.arrivee, -HEURE - TRAJET), trajetMinutes: TRAJET, sejourMinutes: 4 * HEURE };
    const fin = apres(retourDUneExpedition(horaires)!, HEURE);

    for (const [maniere, ordre] of [
      ["B d'abord", ["B", "A"]],
      ["A d'abord", ["A", "B"]],
    ] as const) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const jeu = poolDansLaTransaction(client);
        const ids = { A: await poser(client, joueurs.A.territoireId, caseId), B: await poser(client, joueurs.B.territoireId, caseId) };
        for (const joueur of ordre) await rattraper("territoire", joueurs[joueur].territoireId, { pool: jeu, jusqua: fin });
        const recits = (await recitsDuTerritoire(jeu, joueurs.B.territoireId)).filter((r) => r.titre === RETOUR);
        expect(recits).toHaveLength(1);
        const { rows: escorte } = await client.query<Bilan["escorte"][number]>(
          'select espece_id as "especeId", nombre, perdues from expedition_escorte where expedition_id = $1',
          [ids.B],
        );
        const { rows } = await client.query<{ rentreeLe: Date | null }>('select rentree_le as "rentreeLe" from expedition where id = $1', [ids.B]);
        const { texte, survenuLe, rencontres } = recits[0];
        bilans[maniere] = { recit: { texte, survenuLe, rencontres }, bestiaire: await bestiaireDuTerritoire(jeu, joueurs.B.territoireId), escorte, rentreeLe: rows[0].rentreeLe };
      } finally {
        await client.query("rollback");
        client.release();
      }
    }
  }, 120_000);

  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("au retour, le récit du perdant dit que la Bête a suivi une autre Expédition, à l'instant où elle l'a fait", () => {
    const { recit } = bilans["B d'abord"];
    expect(recit.rencontres).toEqual([expect.objectContaining({ especeId: bete.especeId, vueLe: bete.arrivee, issue: "emmenee", repartieLe: bete.arrivee, sexe: null })]);
    expect(recit.texte.split("\n")).toContain(`${nomDeLEspece} a suivi une autre Expédition.`);
    expect(bilans["A d'abord"]).toEqual(bilans["B d'abord"]);
  });

  it("il ne nomme pas le chef qui l'a emportée", () => {
    expect(JSON.stringify(bilans["B d'abord"].recit)).not.toContain(joueurs.A.nom);
  });

  it("le perdant ne subit aucune perte, garde l'Espèce croisée au Bestiaire, et son Expédition a poursuivi son séjour normalement", () => {
    const { recit, bestiaire, escorte, rentreeLe } = bilans["B d'abord"];
    expect(escorte).toEqual([{ especeId: faible.id, nombre: 1, perdues: 0 }]);
    expect(bestiaire).toEqual([{ especeId: bete.especeId, etat: "croisee", croiseeLe: bete.arrivee }]);
    expect(rentreeLe).toEqual(retourDUneExpedition(horaires));
    expect(recit.survenuLe).toEqual(retourDUneExpedition(horaires));
    expect(recit.texte.split("\n")).toContain("Aller 30 min, séjour 4 h, retour 30 min.");
  });
});
