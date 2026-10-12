// US-0963 : des chances proportionnelles à la force. Quand une Bête est à portée de plusieurs Expéditions dès le même
// instant, une seule l'emporte, tirée au sort à chances proportionnelles à la force de chaque escorte ; une Expédition
// pour qui la Bête est trop forte n'y participe pas (décidé le 2026-10-12) ; pour une Bête commune, une Expédition sans
// escorte n'a aucune chance face à une escortée. Le tirage a lieu une fois pour toutes : les mêmes Expéditions, vécues
// page ouverte, d'un bloc au retour des joueurs dans un ordre puis dans l'autre, ou par la seule tâche planifiée, donnent
// le même vainqueur, que rien ne change ensuite. Les Bêtes des essais sont choisies pour que le tirage désigne une autre
// Expédition que la plus petite, que suivait la règle d'avant (US-0934).
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bestiaireDuTerritoire, type EspeceAuBestiaire } from "@/bestiaire/bestiaire";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { type BeteSauvage, betesSauvagesDesCases } from "@/monde/betes-sauvages";
import { type RencontreDuRecit, recitsDuTerritoire } from "@/monde/recits";
import { PRESENCE_D_UNE_BETE_HEURES, RATTRAPER_APRES_MINUTES } from "@/reglages";
import { rattraperLesAbsents } from "@/temps/absents";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDansLaTransaction, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { lExpeditionSuivie } from "./apprivoisement";
import { forceDUneBete } from "./force";
import { type HorairesDUneExpedition, retourDUneExpedition, sejourDUneExpedition } from "./phase";
import { programmerLeRetour } from "./retour";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;
/** Le temps, en minutes, où aucune autre Bête n'apparaît avant ou après celle d'un essai : sa présence et 6 heures de marge. */
const CALME = PRESENCE_D_UNE_BETE_HEURES * HEURE + 6 * HEURE;
/** L'aller et le retour des Expéditions des essais, posées sur la Case sans souci de la distance à leur Foyer. */
const TRAJET = 30;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai des chances proportionnelles à la force (US-0963)";
/** Le titre des Récits de retour, pour les trier parmi ceux du Territoire (un Voyageur reparti en écrit aussi). */
const RETOUR = "Retour d'Expédition";

/** Les manières de vivre les mêmes Expéditions des joueurs A, B et C. */
const MANIERES = ["page ouverte", "d'un bloc, A, B puis C", "d'un bloc, C, B puis A", "par la tâche planifiée"] as const;
type Maniere = (typeof MANIERES)[number];
type Joueur = "A" | "B" | "C";
const JOUEURS = ["A", "B", "C"] as const;

/** Une Espèce telle que l'essai la choisit pour une escorte : sa Rareté et la force d'une de ses Bêtes (US-0905). */
type Espece = { id: string; rareteId: string; force: number };

/** Ce que l'Expédition d'un joueur lui laisse, une fois rentrée, tel qu'il le voit. */
type Bilan = { rencontres: RencontreDuRecit[]; texte: string; bestiaire: EspeceAuBestiaire[]; effectif: { especeId: string; sexe: string; nombre: number }[] };

describe.skipIf(!URL_TEST)("des chances proportionnelles à la force (US-0963, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `chances-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms des chefs de ce lancement, qui n'y forme aucun mot interdit (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  let especes: Espece[];
  /** La commune la plus faible du jeu. */
  let faible: Espece;
  const territoires = {} as Record<Joueur, number>;
  let ne: Date;
  /** Les Cases libres autour du Foyer de A, hors des Cases des Bêtes de naissance des trois joueurs. */
  let cases: number[];
  const prises = new Set<number>();
  const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);
  /** Les horaires d'une Expédition qui arrive sur sa Case à `arrivee` et y séjourne `sejourMinutes`. */
  const arriveeA = (arrivee: Date, sejourMinutes: number): HorairesDUneExpedition => ({ partLe: apres(arrivee, -TRAJET), trajetMinutes: TRAJET, sejourMinutes });

  /** Un chef qui vient de naître dans le Monde d'essai : son Territoire et l'instant de sa naissance. */
  const naitre = async () => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Chan", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /**
   * L'Expédition d'un joueur sur la Case `ici`, posée en base comme un départ l'aurait fait, avec ses horaires, son escorte
   * (Espèce et nombre de Bêtes) s'il en a une, et son retour au Foyer programmé (US-0916) : pour mettre sur une même Case
   * les Expéditions de Territoires éloignés.
   */
  const poser = async (client: PoolClient, territoireId: number, ici: number, h: HorairesDUneExpedition, escorte?: [Espece, number]) => {
    const { rows } = await client.query<{ id: number }>(
      "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, $4, $5) returning id",
      [territoireId, ici, h.partLe, h.trajetMinutes, h.sejourMinutes],
    );
    if (escorte) await client.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, $3)", [rows[0].id, escorte[0].id, escorte[1]]);
    await programmerLeRetour(client, territoireId, rows[0].id, h);
    return rows[0].id;
  };
  /**
   * Un essai dans une transaction annulée ensuite, où chaque transaction du jeu devient un point de reprise
   * (poolDansLaTransaction) : le suivant repart des mêmes Territoires, devant les mêmes Bêtes sauvages.
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
  /** Ce que l'Expédition du joueur lui laisse, lu avec `jeu` : son récit de retour, son Bestiaire et son effectif. */
  const bilan = async (jeu: Pool, territoireId: number): Promise<Bilan> => {
    const recits = (await recitsDuTerritoire(jeu, territoireId)).filter((r) => r.titre === RETOUR);
    expect(recits).toHaveLength(1);
    const { rows: effectif } = await jeu.query<Bilan["effectif"][number]>(
      'select espece_id as "especeId", sexe, nombre from effectif where territoire_id = $1 order by espece_id, sexe',
      [territoireId],
    );
    return { rencontres: recits[0].rencontres ?? [], texte: recits[0].texte, bestiaire: await bestiaireDuTerritoire(jeu, territoireId), effectif };
  };
  /**
   * Une Bête seule sur une Case libre de `cases`, apparue au moins trois jours après les naissances, telle que `accepte`
   * la veut : aucune autre n'apparaît sur sa Case de CALME heures avant elle à CALME heures après. Sa Case et la Bête.
   */
  const uneBeteSeule = async (accepte: (b: BeteSauvage, caseId: number) => boolean) => {
    const [de, a] = [apres(ne, 3 * JOUR), apres(ne, 40 * JOUR)];
    for (const [caseId, betes] of await betesSauvagesDesCases(pool, cases.filter((c) => !prises.has(c)), de, a)) {
      const bete = betes.find(
        (x, i) =>
          x.arrivee >= apres(de, CALME) &&
          x.arrivee <= apres(a, -CALME) &&
          (i === 0 || betes[i - 1].arrivee <= apres(x.arrivee, -CALME)) &&
          (i === betes.length - 1 || betes[i + 1].arrivee >= apres(x.arrivee, CALME)) &&
          accepte(x, caseId),
      );
      if (bete) {
        prises.add(caseId);
        return { caseId, bete };
      }
    }
    throw new Error("Aucune Bête seule telle que l'essai la veut.");
  };
  /**
   * L'Expédition que la Bête `bete` de la Case `caseId` suit selon la règle (lExpeditionSuivie), parmi des Expéditions
   * toutes arrivées sur la Case une heure avant elle, d'escortes de force `escortes` (null : sans escorte) : son rang, les
   * Expéditions étant posées dans cet ordre (le tirage les range par identifiant, et ne dépend que de cet ordre).
   */
  const rangSuivi = (bete: BeteSauvage, caseId: number, escortes: (number | null)[], force: number) => {
    const sur = { arrivee: apres(bete.arrivee, -HEURE), depart: apres(bete.arrivee, 3 * HEURE) };
    const suivie = lExpeditionSuivie(
      { ...bete, force, caseId, beteDeNaissanceId: null },
      escortes.map((escorte, i) => ({ id: i + 1, ...sur, escorte })),
    );
    return suivie ? suivie.expeditionId - 1 : null;
  };
  const forceDe = (id: string) => especes.find((e) => e.id === id)!.force;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    const { rows } = await pool.query<{ id: string; rareteId: string; attaque: number; vie: number }>('select id, rarete_id as "rareteId", attaque, vie from espece order by id');
    especes = rows.map(({ attaque, vie, ...e }) => ({ ...e, force: forceDUneBete({ attaque, vie }) })).sort((x, y) => x.force - y.force || x.id.localeCompare(y.id));
    faible = especes.find((e) => e.rareteId === "commune" && e.force > 0)!;
    for (const joueur of JOUEURS) {
      const chef = await naitre();
      territoires[joueur] = chef.territoireId;
      ne = chef.ne;
    }
    const { rows: libres } = await pool.query<{ id: number }>(
      `select c.id from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) between 2 and 6
         and not exists (select 1 from bete_de_naissance n where n.case_id = c.id and n.territoire_id = any($2::int[]))
       order by c.id`,
      [territoires.A, JOUEURS.map((j) => territoires[j])],
    );
    cases = libres.map((c) => c.id);
  });

  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  describe("une Bête commune à portée de trois Expéditions au même instant", () => {
    /** A part sans escorte ; B avec une Bête de la commune la plus faible, C avec deux : des forces de 1 contre 2. */
    const escortes = () => ({ A: undefined, B: [faible, 1], C: [faible, 2] }) as Record<Joueur, [Espece, number] | undefined>;
    let caseId: number;
    let bete: BeteSauvage;
    const bilans = {} as Record<Maniere, Record<Joueur, Bilan>>;
    /** Les mêmes bilans, relus après un rattrapage de plus, un jour plus tard. */
    const relus = {} as Record<Maniere, Record<Joueur, Bilan>>;

    beforeAll(async () => {
      // Une Bête commune pour qui le tirage désigne C, la plus grande des trois, que la règle d'avant n'aurait jamais suivie.
      ({ caseId, bete } = await uneBeteSeule((x, ici) => x.rareteId === "commune" && rangSuivi(x, ici, [null, faible.force, 2 * faible.force], forceDe(x.especeId)) === 2));
      // Les trois arrivent sur la Case une heure avant elle et y séjournent quatre heures : ils la voient à son apparition.
      const horaires = arriveeA(apres(bete.arrivee, -HEURE), 4 * HEURE);
      const retour = retourDUneExpedition(horaires)!;
      const passages = [apres(horaires.partLe, 7)];
      while (passages.at(-1)! <= apres(retour, RATTRAPER_APRES_MINUTES)) passages.push(apres(passages.at(-1)!, HEURE));
      const fin = passages.at(-1)!;
      const instants = new Set([fin.getTime()]);
      for (let t = horaires.partLe.getTime(); t <= fin.getTime(); t += 20 * MINUTE_MS) instants.add(t);
      const { debut, fin: repart } = sejourDUneExpedition(horaires)!;
      for (const instant of [debut, repart, retour, bete.arrivee]) [-1, 0, 1].forEach((ms) => instants.add(instant.getTime() + ms));
      const page = [...instants].filter((t) => t >= horaires.partLe.getTime() && t <= fin.getTime()).sort((x, y) => x - y).map((t) => new Date(t));

      for (const maniere of MANIERES) {
        [bilans[maniere], relus[maniere]] = await enEssai(async (client, jeu) => {
          for (const joueur of JOUEURS) await poser(client, territoires[joueur], caseId, horaires, escortes()[joueur]);
          const aLHeure = (joueur: Joueur, instant: Date) => rattraper("territoire", territoires[joueur], { pool: jeu, jusqua: instant });
          if (maniere === "page ouverte") {
            // Les trois pages ouvertes ensemble, mises à l'heure chaque fois dans un autre ordre.
            for (const [i, instant] of page.entries()) for (const k of [0, 1, 2]) await aLHeure(JOUEURS[(i + k) % 3], instant);
          } else if (maniere === "par la tâche planifiée") {
            for (const instant of passages) {
              expect(await rattraperLesAbsents({ pool: jeu, maintenant: instant, parmi: { territoire: JOUEURS.map((j) => territoires[j]) } })).toMatchObject({ rattrapes: 3, echecs: 0 });
            }
          } else {
            for (const joueur of maniere === "d'un bloc, A, B puis C" ? JOUEURS : [...JOUEURS].reverse()) await aLHeure(joueur, fin);
          }
          // L'un après l'autre : sur le client d'une transaction, deux requêtes ne partent pas à la fois.
          const lire = async () => {
            const lus = {} as Record<Joueur, Bilan>;
            for (const joueur of JOUEURS) lus[joueur] = await bilan(jeu, territoires[joueur]);
            return lus;
          };
          const lus = await lire();
          for (const joueur of JOUEURS) await aLHeure(joueur, apres(fin, JOUR));
          return [lus, await lire()];
        });
      }
      // Près de 100 rattrapages des trois Territoires, page ouverte : sous la charge de la suite complète, bien plus que les 30 s par défaut.
    }, 240_000);

    it("une seule l'emporte : celle que désigne le tirage proportionnel à la force, ici C, et non la plus petite ; toutes la voient", () => {
      const { A, B, C } = bilans["page ouverte"];
      const vue = { especeId: bete.especeId, vueLe: bete.arrivee, nouvelleEspece: true };
      expect(C.rencontres).toEqual([expect.objectContaining({ ...vue, issue: "apprivoisee" })]);
      for (const perdant of [A, B]) {
        expect(perdant.rencontres).toEqual([expect.objectContaining({ ...vue, sexe: null })]);
        expect(perdant.rencontres[0].issue).not.toBe("apprivoisee");
      }
      // Seul C la ramène au Foyer, et son Espèce y est « apprivoisée » ; A et B l'ont croisée.
      const { sexe } = C.rencontres[0];
      expect(C.effectif).toContainEqual({ especeId: bete.especeId, sexe, nombre: 1 });
      for (const perdant of [A, B]) expect(perdant.effectif.filter((e) => e.especeId === bete.especeId)).toEqual([]);
      expect(C.bestiaire).toEqual([{ especeId: bete.especeId, etat: "apprivoisee", croiseeLe: bete.arrivee }]);
      for (const perdant of [A, B]) expect(perdant.bestiaire).toEqual([{ especeId: bete.especeId, etat: "croisee", croiseeLe: bete.arrivee }]);
    });

    it("le tirage a lieu une fois pour toutes : le même vainqueur en direct, d'un bloc dans un ordre ou dans l'autre, ou par la tâche planifiée, et rien ne change ensuite", () => {
      for (const maniere of MANIERES) {
        expect(bilans[maniere], maniere).toEqual(bilans["page ouverte"]);
        expect(relus[maniere], `${maniere}, un jour après`).toEqual(bilans["page ouverte"]);
      }
    });

    it("pour une Bête commune, l'Expédition sans escorte n'a aucune chance face aux escortées", () => {
      expect(bilans["page ouverte"].A.rencontres[0].issue).not.toBe("apprivoisee");
      // Quelle que soit la Bête de cette Case, le tirage ne désigne jamais A, partie sans escorte.
      for (let n = 1; n <= 500; n++) {
        expect(rangSuivi({ ...bete, numero: bete.numero + n }, caseId, [null, faible.force, 2 * faible.force], forceDe(bete.especeId))).not.toBe(0);
      }
    });
  });

  describe("une Bête trop forte pour l'une des Expéditions qui la voient au même instant", () => {
    /** La Bête, sa Case, et l'Espèce de l'escorte trop faible de B, la plus forte en dessous d'elle. */
    let caseId: number;
    let bete: BeteSauvage;
    let tropFaible: Espece;
    let bilansDuBloc: Record<"A d'abord" | "B d'abord", Record<"A" | "B", Bilan>>;

    beforeAll(async () => {
      // Une Bête plus rare que commune, que B aurait emportée au tirage s'il avait pris part avec son escorte : A l'escorte
      // d'une Bête de son Espèce, juste à portée ; B d'une Bête de l'Espèce la plus forte en dessous d'elle.
      const enDessous = (force: number) => especes.filter((e) => e.force > 0 && e.force < force).at(-1);
      ({ caseId, bete } = await uneBeteSeule((x, ici) => {
        const force = forceDe(x.especeId);
        const dessous = enDessous(force);
        // Une Bête de la force de l'escorte de B serait à portée des deux : le tirage aurait désigné B.
        return x.rareteId !== "commune" && dessous !== undefined && rangSuivi(x, ici, [force, dessous.force], dessous.force) === 1;
      }));
      tropFaible = enDessous(forceDe(bete.especeId))!;
      const especeDeLaBete = especes.find((e) => e.id === bete.especeId)!;
      const horaires = arriveeA(apres(bete.arrivee, -HEURE), 4 * HEURE);
      const fin = apres(retourDUneExpedition(horaires)!, HEURE);
      const vivre = (ordre: ("A" | "B")[]) =>
        enEssai(async (client, jeu) => {
          await poser(client, territoires.A, caseId, horaires, [especeDeLaBete, 1]);
          await poser(client, territoires.B, caseId, horaires, [tropFaible, 1]);
          for (const joueur of ordre) await rattraper("territoire", territoires[joueur], { pool: jeu, jusqua: fin });
          return { A: await bilan(jeu, territoires.A), B: await bilan(jeu, territoires.B) };
        });
      bilansDuBloc = { "A d'abord": await vivre(["A", "B"]), "B d'abord": await vivre(["B", "A"]) };
    }, 120_000);

    it("elle ne participe pas au tirage : l'Expédition qui l'a à portée l'emporte, et l'autre la dit trop forte pour son escorte", () => {
      const { A, B } = bilansDuBloc["A d'abord"];
      expect(A.rencontres).toEqual([expect.objectContaining({ especeId: bete.especeId, vueLe: bete.arrivee, issue: "apprivoisee" })]);
      expect(B.rencontres).toEqual([expect.objectContaining({ especeId: bete.especeId, vueLe: bete.arrivee, sexe: null })]);
      expect(B.rencontres[0].issue).not.toBe("apprivoisee");
      const manque = B.texte.match(/trop forte pour votre escorte, il lui manquait ([\d\s]+) de force/);
      expect(Number(manque?.[1].replace(/\s/g, ""))).toBe(forceDe(bete.especeId) - tropFaible.force);
      expect(bilansDuBloc["B d'abord"]).toEqual(bilansDuBloc["A d'abord"]);
    });
  });

  describe("un tirage déjà retenu ne change plus, même si la force d'une escorte change entre deux rattrapages", () => {
    let bete: BeteSauvage;
    let lus: {
      rencontres: Record<"A" | "B", { apprivoisee: boolean; sexe: string | null }[]>;
      effectifs: Record<"A" | "B", number>;
      bestiaireDeB: EspeceAuBestiaire[];
      recitDeB: RencontreDuRecit[];
    };

    beforeAll(async () => {
      // Une Bête commune, d'une autre Espèce que les escortes, que le tirage donne à A face à B d'escortes égales, mais à B
      // si son escorte était cent fois plus forte.
      let caseId: number;
      ({ caseId, bete } = await uneBeteSeule(
        (x, ici) =>
          x.rareteId === "commune" &&
          x.especeId !== faible.id &&
          rangSuivi(x, ici, [faible.force, faible.force], forceDe(x.especeId)) === 0 &&
          rangSuivi(x, ici, [faible.force, 100 * faible.force], forceDe(x.especeId)) === 1,
      ));
      const horaires = arriveeA(apres(bete.arrivee, -HEURE), 4 * HEURE);
      const fin = apres(retourDUneExpedition(horaires)!, HEURE);
      lus = await enEssai(async (client, jeu) => {
        const ids = { A: await poser(client, territoires.A, caseId, horaires, [faible, 1]), B: await poser(client, territoires.B, caseId, horaires, [faible, 1]) };
        // A est mis à l'heure le premier : la Bête le suit, et son départ est retenu.
        await rattraper("territoire", territoires.A, { pool: jeu, jusqua: fin });
        // Puis la force de l'escorte de B change, comme à une mise en ligne qui rechargerait les caractéristiques des
        // Espèces (l'essai ne les change pas : les autres fichiers les lisent) : recalculé, le tirage désignerait B.
        await client.query("update expedition_escorte set nombre = 100 where expedition_id = $1", [ids.B]);
        await rattraper("territoire", territoires.B, { pool: jeu, jusqua: fin });
        const rencontres = async (id: number) =>
          (await client.query<{ apprivoisee: boolean; sexe: string | null }>("select apprivoisee, sexe from rencontre where expedition_id = $1 and numero = $2", [id, bete.numero]))
            .rows;
        const effectif = async (territoireId: number) =>
          (await client.query<{ n: number }>("select coalesce(sum(nombre), 0)::int as n from effectif where territoire_id = $1 and espece_id = $2", [territoireId, bete.especeId]))
            .rows[0].n;
        return {
          rencontres: { A: await rencontres(ids.A), B: await rencontres(ids.B) },
          effectifs: { A: await effectif(territoires.A), B: await effectif(territoires.B) },
          bestiaireDeB: await bestiaireDuTerritoire(jeu, territoires.B),
          recitDeB: (await bilan(jeu, territoires.B)).rencontres,
        };
      });
    }, 120_000);

    it("la Bête qu'une autre Expédition a déjà emmenée ne suit pas celle-ci : elle ne rejoint jamais deux Foyers", () => {
      expect(lus.rencontres).toEqual({ A: [{ apprivoisee: true, sexe: expect.any(String) }], B: [{ apprivoisee: false, sexe: null }] });
      expect(lus.effectifs).toEqual({ A: 1, B: 0 });
      // B l'a vue : son Espèce reste croisée à son Bestiaire, et son récit la dit partie à l'instant où A l'a emmenée.
      expect(lus.bestiaireDeB).toEqual([{ especeId: bete.especeId, etat: "croisee", croiseeLe: bete.arrivee }]);
      expect(lus.recitDeB).toEqual([expect.objectContaining({ especeId: bete.especeId, issue: "repartie", repartieLe: bete.arrivee, sexe: null })]);
    });
  });
});
