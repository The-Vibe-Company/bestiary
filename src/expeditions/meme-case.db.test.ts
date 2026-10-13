// US-0967 : deux Expéditions du même joueur sur une Case. Envoyer une seconde Expédition vers une Case où l'on en a déjà
// une est autorisé, sans message (décidé le 2026-10-12, comme US-0919 : aucun plafond hors des explorateurs libres). Sur
// la Case, chacune a sa propre chance au tirage selon la force de son escorte (US-0963), comme celles de deux joueurs, et
// une Bête ne suit jamais qu'une seule d'entre elles ; l'autre l'apprend dans son récit (US-0964). Les mêmes Expéditions,
// vécues page ouverte ou d'un bloc, laissent le même résultat.
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bestiaireDuTerritoire, type EspeceAuBestiaire } from "@/bestiaire/bestiaire";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { type BeteSauvage, betesSauvagesDesCases } from "@/monde/betes-sauvages";
import { type Coordonnees, distance } from "@/monde/hex";
import { type Recit, recitsDuTerritoire } from "@/monde/recits";
import { PRESENCE_D_UNE_BETE_HEURES } from "@/reglages";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDansLaTransaction, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { dureeDuTrajetMinutes } from "./allure";
import { lExpeditionSuivie } from "./apprivoisement";
import { lancerLExpedition } from "./depart";
import { expeditionsEnCours } from "./en-cours";
import { forceDUneBete } from "./force";
import { retourDUneExpedition } from "./phase";
import { AUTRES_EXPEDITIONS } from "./recit-de-retour";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;
/** Le temps, en minutes, où aucune autre Bête n'apparaît avant ou après celle de l'essai : sa présence et 6 heures de marge. */
const CALME = PRESENCE_D_UNE_BETE_HEURES * HEURE + 6 * HEURE;
/** Le séjour des Expéditions de l'essai, en minutes. */
const SEJOUR = 4 * HEURE;
/** Les Bêtes de l'escorte de la première Expédition et de la seconde : des forces de 1 contre 3. */
const ESCORTES = [1, 3] as const;

/** Le Monde d'essai de ce fichier, où naît son chef : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de deux Expéditions du même joueur sur une Case (US-0967)";
/** Le titre des Récits de retour, pour les trier parmi ceux du Territoire (un Voyageur reparti en écrit aussi). */
const RETOUR = "Retour d'Expédition";

/** Ce que les deux Expéditions laissent au joueur, une fois rentrées : leurs récits, dans l'ordre de leur départ, son Bestiaire et son effectif. */
type Bilan = {
  recits: Pick<Recit, "texte" | "survenuLe" | "rencontres">[];
  bestiaire: EspeceAuBestiaire[];
  effectif: { especeId: string; sexe: string; nombre: number }[];
};

describe.skipIf(!URL_TEST)("deux Expéditions du même joueur sur une Case (US-0967, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `meme-case-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let territoireId: number;
  let foyer: Coordonnees;
  let ne: Date;
  /** La souris, qui escorte les deux Expéditions : sa force et sa vitesse. */
  let souris: { force: number; vitesse: number };
  const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);

  /**
   * Un essai dans une transaction annulée ensuite, où chaque transaction du jeu (un départ, un rattrapage) devient un point
   * de reprise (poolDansLaTransaction) : le suivant repart du même Territoire, devant les mêmes Bêtes sauvages.
   */
  const enEssai = async <T,>(essai: (client: PoolClient, jeu: Pool) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      return await essai(client, poolDansLaTransaction(client));
    } finally {
      await client.query("rollback");
      client.release();
    }
  };
  /** Le départ d'un explorateur vers `destination` à `instant`, escorté de `nombre` Souris, comme « Partir » le fait. */
  const partir = async (jeu: Pool, destination: Coordonnees, instant: Date, nombre: number) => {
    const depart = await lancerLExpedition(jeu, territoireId, { destination, explorateurs: 1, escorte: new Map([["souris", nombre]]), sejourMinutes: SEJOUR }, instant);
    if (!("expeditionId" in depart)) throw new Error(depart.refus);
    return depart.expeditionId;
  };

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    const compte = (await creerCompte(pool, `${lancement}-1@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Meme", suffixe, 1), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    territoireId = (await territoireDuCompte(pool, compte.id))!;
    ne = await lireMarquePage(pool, "territoire", territoireId);
    // Deux explorateurs, et assez de Souris pour les deux escortes.
    await pool.query("insert into habitant (territoire_id, prenom, metier) values ($1, 'Joran', 'explorateur'), ($1, 'Ilda', 'explorateur')", [territoireId]);
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, 'souris', 'male', $2)", [territoireId, ESCORTES[0] + ESCORTES[1]]);
    const { rows } = await pool.query<{ foyer: Coordonnees; attaque: number; vie: number; vitesse: number }>(
      `select json_build_object('q', f.q, 'r', f.r) as foyer, e.attaque, e.vie, e.vitesse
       from territoire t join case_du_monde f on f.id = t.foyer_case_id, espece e where t.id = $1 and e.id = 'souris'`,
      [territoireId],
    );
    foyer = rows[0].foyer;
    souris = { force: forceDUneBete(rows[0]), vitesse: rows[0].vitesse };
  });

  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("une seconde Expédition part vers une Case où le joueur en a déjà une, sans refus ni message : les deux sont en cours, vers la même Case", async () => {
    const { rows } = await pool.query<Coordonnees>(
      `select c.q, c.r from case_du_monde c where c.monde_id = $1 and c.chef_id is null
         and greatest(abs(c.q - $2), abs(c.r - $3), abs(c.q - $2 + c.r - $3)) = 3 order by c.q, c.r limit 1`,
      [mondeId, foyer.q, foyer.r],
    );
    const destination = rows[0];
    const instant = apres(ne, HEURE);
    const enCours = await enEssai(async (_client, jeu) => {
      const premiere = await partir(jeu, destination, instant, 1);
      // La seconde part dix minutes après, pendant que la première est encore à l'aller : elle est acceptée comme elle.
      const seconde = await partir(jeu, destination, apres(instant, 10), 1);
      const ids = [premiere, seconde];
      return { ids, lues: (await expeditionsEnCours(jeu, territoireId, apres(instant, 15))).map((x) => ({ id: x.id, q: x.destination.q, r: x.destination.r })) };
    });
    expect(enCours.lues).toEqual(enCours.ids.map((id) => ({ id, ...destination })));
  });

  /** Les Cases déjà prises par un tirage de l'essai : chacun a la sienne. */
  const prises = new Set<number>();

  /**
   * Deux Expéditions du joueur, escortées d'une Souris puis de trois (ESCORTES), parties au même instant vers une Case
   * libre à 2 à 6 Cases du Foyer, sans Bête de naissance, où une Bête commune d'une autre Espèce que la souris apparaît
   * seule une heure après leur arrivée, et que le tirage donne à celle de rang `gagnante` (0 : la première partie, la plus
   * faible ; 1 : la seconde, trois fois plus forte). Vécues page ouverte, relue toutes les 10 minutes et autour de
   * l'apparition, puis d'un bloc : la Bête, le nom de son Espèce et ce que chaque manière laisse au joueur.
   */
  const unTirage = async (gagnante: 0 | 1) => {
    const { rows: cases } = await pool.query<Coordonnees & { id: number }>(
      `select c.id, c.q, c.r from case_du_monde c where c.monde_id = $1 and c.chef_id is null
         and greatest(abs(c.q - $2), abs(c.r - $3), abs(c.q - $2 + c.r - $3)) between 2 and 6
         and not exists (select 1 from bete_de_naissance n where n.case_id = c.id)
       order by c.id`,
      [mondeId, foyer.q, foyer.r],
    );
    const [de, a] = [apres(ne, 3 * JOUR), apres(ne, 40 * JOUR)];
    const parCase = await betesSauvagesDesCases(pool, cases.filter((c) => !prises.has(c.id)).map((c) => c.id), de, a);
    let trouve: { destination: Coordonnees; bete: BeteSauvage } | null = null;
    for (const c of cases.filter((x) => !prises.has(x.id))) {
      const betes = parCase.get(c.id)!;
      const bete = betes.find(
        (x, i) =>
          x.rareteId === "commune" &&
          x.especeId !== "souris" &&
          x.arrivee >= apres(de, CALME) &&
          x.arrivee <= apres(a, -CALME) &&
          (i === 0 || betes[i - 1].arrivee <= apres(x.arrivee, -CALME)) &&
          (i === betes.length - 1 || betes[i + 1].arrivee >= apres(x.arrivee, CALME)) &&
          // Le tirage range les Expéditions par identifiant : la première partie a le plus petit.
          lExpeditionSuivie(
            { ...x, force: 0, caseId: c.id, beteDeNaissanceId: null },
            ESCORTES.map((n, k) => ({ id: k + 1, arrivee: apres(x.arrivee, -HEURE), depart: apres(x.arrivee, SEJOUR - HEURE), escorte: n * souris.force })),
          )?.expeditionId === gagnante + 1,
      );
      if (bete) {
        prises.add(c.id);
        trouve = { destination: { q: c.q, r: c.r }, bete };
        break;
      }
    }
    if (!trouve) throw new Error(`Aucune Bête commune seule que le tirage donne à l'Expédition de rang ${gagnante}.`);
    const { destination, bete } = trouve;
    const { rows: especes } = await pool.query<{ nom: string }>("select nom from espece where id = $1", [bete.especeId]);
    // Les deux partent au même instant, à l'allure de la souris, et arrivent une heure avant la Bête.
    const aller = dureeDuTrajetMinutes(distance(foyer, destination), [{ vitesse: souris.vitesse, nombre: 1 }]);
    const depart = apres(bete.arrivee, -HEURE - aller);
    const retour = retourDUneExpedition({ partLe: depart, trajetMinutes: aller, sejourMinutes: SEJOUR })!;
    const fin = apres(retour, HEURE);
    const instants = new Set([fin.getTime()]);
    for (let t = depart.getTime(); t < fin.getTime(); t += 10 * MINUTE_MS) instants.add(t);
    for (const ms of [-1, 0, 1]) instants.add(bete.arrivee.getTime() + ms);
    const page = [...instants].filter((t) => t >= depart.getTime()).sort((x, y) => x - y).map((t) => new Date(t));
    const bilans = {} as Record<"page ouverte" | "d'un bloc", Bilan>;
    for (const maniere of ["page ouverte", "d'un bloc"] as const) {
      bilans[maniere] = await enEssai(async (client, jeu) => {
        await rattraper("territoire", territoireId, { pool: jeu, jusqua: depart });
        const ids = [await partir(jeu, destination, depart, ESCORTES[0]), await partir(jeu, destination, depart, ESCORTES[1])];
        for (const instant of maniere === "page ouverte" ? page : [fin]) await rattraper("territoire", territoireId, { pool: jeu, jusqua: instant });
        const recits = (await recitsDuTerritoire(jeu, territoireId)).filter((r) => r.titre === RETOUR);
        // Les deux rentrent au même instant : leurs récits, dans l'ordre de leur départ (le premier écrit, le plus ancien).
        const parDepart = [...recits].sort((x, y) => x.id - y.id);
        expect(parDepart).toHaveLength(ids.length);
        const { rows: effectif } = await client.query<Bilan["effectif"][number]>(
          'select espece_id as "especeId", sexe, nombre from effectif where territoire_id = $1 and espece_id = $2 order by sexe',
          [territoireId, bete.especeId],
        );
        return {
          recits: parDepart.map(({ texte, survenuLe, rencontres }) => ({ texte, survenuLe, rencontres })),
          bestiaire: (await bestiaireDuTerritoire(jeu, territoireId)).filter((e) => e.especeId === bete.especeId),
          effectif,
        };
      });
    }
    return { bete, nomDeLEspece: especes[0].nom, bilans };
  };

  for (const gagnante of [1, 0] as const) {
    const perdante = (1 - gagnante) as 0 | 1;
    const qui = gagnante === 1 ? "la seconde, trois fois plus forte" : "la première, la plus faible";
    describe(`une Bête vue au même instant par ses deux Expéditions, que le tirage donne à ${qui}`, () => {
      let tirage: Awaited<ReturnType<typeof unTirage>>;

      beforeAll(async () => {
        tirage = await unTirage(gagnante);
      }, 120_000);

      it("chacune a sa propre chance au tirage selon sa force : celle qu'il désigne l'emporte, quel que soit son rang au départ", () => {
        const { bete, bilans } = tirage;
        const recits = bilans["page ouverte"].recits;
        expect(recits[gagnante].rencontres).toEqual([expect.objectContaining({ especeId: bete.especeId, vueLe: bete.arrivee, issue: "apprivoisee" })]);
        expect(recits[perdante].rencontres).toEqual([expect.objectContaining({ especeId: bete.especeId, vueLe: bete.arrivee, issue: "emmenee", repartieLe: bete.arrivee, sexe: null })]);
      });

      it("une Bête ne suit jamais qu'une seule d'entre elles : une seule arrive au Foyer, et l'Espèce est apprivoisée", () => {
        const { bete, bilans } = tirage;
        const { effectif, bestiaire, recits } = bilans["page ouverte"];
        expect(effectif.reduce((n, l) => n + l.nombre, 0)).toBe(1);
        expect(effectif[0].sexe).toBe(recits[gagnante].rencontres![0].sexe);
        expect(bestiaire).toEqual([{ especeId: bete.especeId, etat: "apprivoisee", croiseeLe: bete.arrivee }]);
      });

      it("l'autre l'apprend dans son récit, qui ne dit pas qu'un autre joueur séjournait sur la Case : l'autre Expédition est la sienne", () => {
        const { nomDeLEspece, bilans } = tirage;
        const recits = bilans["page ouverte"].recits;
        expect(recits[perdante].texte.split("\n")).toContain(`${nomDeLEspece} a suivi une autre Expédition.`);
        for (const recit of recits) expect(recit.texte.split("\n")).not.toContain(AUTRES_EXPEDITIONS);
      });

      it("« Nouvelle Espèce au Bestiaire » va à la Rencontre de la première partie, qui l'a inscrite (US-0933), qu'elle ait gagné ou non", () => {
        const recits = tirage.bilans["page ouverte"].recits;
        expect(recits.map((r) => r.rencontres![0].nouvelleEspece)).toEqual([true, false]);
      });

      it("le même résultat page ouverte et d'un bloc", () => {
        expect(tirage.bilans["d'un bloc"]).toEqual(tirage.bilans["page ouverte"]);
      });
    });
  }
});
