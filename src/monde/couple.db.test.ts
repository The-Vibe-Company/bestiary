import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { EtatAuBestiaire } from "@/bestiaire/bestiaire";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { dureeDuTrajetMinutes } from "@/expeditions/allure";
import { BETE_PLUS_DISPONIBLE, lancerLExpedition } from "@/expeditions/depart";
import { type HorairesDUneExpedition, retourDUneExpedition, sejourDUneExpedition } from "@/expeditions/phase";
import { rattraperLesAbsents } from "@/temps/absents";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { sexeDUneBeteDeNaissance } from "./betes-de-naissance";
import { betesSauvagesDUneCase, type Sexe } from "./betes-sauvages";
import { type CoupleReuni, couplesDuTerritoire, nombreDeCouples, reunirLesCouples } from "./couple";
import { betesDisponibles, faireEntrerDansLEffectif } from "./effectif";
import { type Coordonnees, distance } from "./hex";
import { recitsDuTerritoire } from "./recits";

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
/** Le séjour des Expéditions des essais, en minutes de jeu. */
const SEJOUR = 60;
/** L'autre sexe : celui qui manque au Couple d'une Bête. */
const AUTRE: Record<Sexe, Sexe> = { male: "femelle", femelle: "male" };
/** L'effectif d'une Espèce dont le Couple est réuni et qui n'a pas d'autre Bête : ses deux lignes, vides. */
const VIDE = [
  { sexe: "male", nombre: 0 },
  { sexe: "femelle", nombre: 0 },
];

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du Couple réuni (US-0956)";

/** Une Bête de naissance du Territoire (US-0975), la Bête commune qu'il apprivoise dans ces essais, sur sa Case. */
type BeteDeNaissance = Coordonnees & { id: number; caseId: number; especeId: string; arrivee: Date; depart: Date };

describe.skipIf(!URL_TEST)("réunir le Couple (US-0956, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  /** La graine du Monde d'essai, d'où se tirent les sexes de ses Bêtes. */
  let graine: number;
  /** La vitesse de chaque Espèce du jeu, en km/h. */
  const vitesses = new Map<string, number>();
  const lancement = `couple-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];
  const apres = (instant: Date, ms: number) => new Date(instant.getTime() + ms);

  /** Un chef qui vient de naître dans le Monde d'essai, avec deux explorateurs : son Territoire et l'instant de sa naissance. */
  const naitre = async () => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Cpl", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query("insert into habitant (territoire_id, prenom, metier) values ($1, 'Joran', 'explorateur'), ($1, 'Ilda', 'explorateur')", [territoireId]);
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /** Un chef qui vient de naître : son Territoire et l'instant de sa naissance. */
  type Ne = Awaited<ReturnType<typeof naitre>>;
  /**
   * `n` chefs nés l'un après l'autre, avant que leurs Bêtes de naissance ne soient choisies : un Foyer né ensuite sur la
   * Case de l'une d'elles la ferait disparaître (aucune Bête sur une Case qui appartient à un Territoire, US-0975).
   */
  const nesDAbord = async (n: number) => {
    const chefs: Ne[] = [];
    for (let i = 0; i < n; i++) chefs.push(await naitre());
    return chefs;
  };
  /** Le Foyer du Territoire. */
  const foyer = async (territoireId: number) =>
    (await pool.query<Coordonnees>("select f.q, f.r from territoire t join case_du_monde f on f.id = t.foyer_case_id where t.id = $1", [territoireId])).rows[0];
  /** L'aller, en minutes de jeu, du Foyer du Territoire à la Case `c`, au pas d'une Bête de l'Espèce `escorte`. */
  const aller = async (territoireId: number, c: Coordonnees, escorte: string) =>
    dureeDuTrajetMinutes(distance(await foyer(territoireId), c), [{ vitesse: vitesses.get(escorte)!, nombre: 1 }]);
  /** Les Bêtes de naissance du Territoire sur une Case libre, de la première posée à la dernière. */
  const betesDeNaissance = async (territoireId: number) =>
    (
      await pool.query<BeteDeNaissance>(
        `select b.id, b.case_id as "caseId", b.espece_id as "especeId", b.arrivee, b.depart, c.q, c.r
         from bete_de_naissance b join case_du_monde c on c.id = b.case_id where b.territoire_id = $1 and c.chef_id is null order by b.id`,
        [territoireId],
      )
    ).rows;
  /** L'Espèce commune de l'escorte qui part chercher une Bête de l'Espèce `especeId` : une autre que la sienne. */
  const escorteDe = (especeId: string) => (especeId === "souris" ? "poule" : "souris");
  /**
   * L'heure d'un départ, à `desLe` au plus tôt, d'où une Expédition escortée d'une Bête de l'Espèce `escorte` arrive sur la
   * Case de la Bête de naissance `bete` pendant sa présence, pour un séjour où aucune Bête sauvage ordinaire ne se montre :
   * seule elle peut suivre l'Expédition. Null s'il n'y en a plus avant qu'elle ne s'en aille.
   */
  const unDepartACalme = async (territoireId: number, bete: BeteDeNaissance, escorte: string, desLe: Date) => {
    const trajet = await aller(territoireId, bete, escorte);
    for (let depart = desLe; ; depart = apres(depart, 30 * MINUTE)) {
      const arrivee = apres(depart, trajet * MINUTE);
      if (apres(arrivee, SEJOUR * MINUTE) > bete.depart) return null;
      if (arrivee < bete.arrivee) continue;
      if ((await betesSauvagesDUneCase(pool, bete.caseId, arrivee, apres(arrivee, SEJOUR * MINUTE))).length > 0) continue;
      return depart;
    }
  };
  /**
   * Une Bête de naissance du Territoire, l'Espèce commune de l'escorte qui part la chercher (une Bête dans l'effectif) et
   * l'heure d'un départ à calme (unDepartACalme), dès la naissance. Null si le Foyer n'en a aucune.
   */
  const uneBeteDeNaissanceACalme = async (t: { territoireId: number; ne: Date }) => {
    for (const bete of await betesDeNaissance(t.territoireId)) {
      const escorte = escorteDe(bete.especeId);
      const depart = await unDepartACalme(t.territoireId, bete, escorte, t.ne);
      if (!depart) continue;
      await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 1)", [t.territoireId, escorte]);
      return { bete, escorte, depart, sexe: sexeDUneBeteDeNaissance(graine, bete.id) };
    }
    return null;
  };
  /** Un explorateur part à `depart` vers la Case `destination`, escorté d'une Bête de l'Espèce `escorte` : son Expédition. */
  const partir = async (territoireId: number, destination: Coordonnees, escorte: string, depart: Date) => {
    const resultat = await lancerLExpedition(pool, territoireId, { destination, explorateurs: 1, escorte: new Map([[escorte, 1]]), sejourMinutes: SEJOUR }, depart);
    if (!("expeditionId" in resultat)) throw new Error(resultat.refus);
    return resultat.expeditionId;
  };
  /** Les horaires d'une Expédition, tels qu'ils sont en base. */
  const horaires = async (expeditionId: number) =>
    (
      await pool.query<HorairesDUneExpedition>(
        `select part_le as "partLe", trajet_minutes as "trajetMinutes", sejour_minutes as "sejourMinutes", rappelee_le as "rappeleeLe" from expedition where id = $1`,
        [expeditionId],
      )
    ).rows[0];
  /**
   * Un chef qui vient de naître et a déjà au Foyer, de l'Espèce de l'une de ses Bêtes de naissance, les Bêtes que `deja`
   * donne d'après le sexe de celle-ci (sexe et nombre) ; une Expédition part chercher cette Bête, qui la suivra jusqu'au
   * Foyer : son Territoire, la Bête, son sexe, l'Expédition et ses heures d'arrivée et de retour. Un Foyer né sans Bête à
   * aller chercher, le chef renaît ailleurs, jusqu'à trois fois. Avec `ne`, un chef déjà né (nesDAbord) l'essaie d'abord.
   */
  const unRetourAvecLaBete = async (deja: (sexe: Sexe) => [Sexe, number][], ne?: Ne) => {
    for (let essai = 0; essai < 3; essai++) {
      const t = essai === 0 && ne ? ne : await naitre();
      const voulue = await uneBeteDeNaissanceACalme(t);
      if (!voulue) continue;
      for (const [sexe, nombre] of deja(voulue.sexe)) {
        await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, $3, $4)", [t.territoireId, voulue.bete.especeId, sexe, nombre]);
      }
      const expeditionId = await partir(t.territoireId, voulue.bete, voulue.escorte, voulue.depart);
      const prevus = await horaires(expeditionId);
      return { t, ...voulue, especeId: voulue.bete.especeId, expeditionId, arrivee: sejourDUneExpedition(prevus)!.debut, retour: retourDUneExpedition(prevus)! };
    }
    throw new Error("Trois Foyers sans Bête de naissance à aller chercher pendant un séjour calme.");
  };
  /**
   * US-0959 : comme unRetourAvecLaBete, mais le Couple de l'Espèce de la Bête est déjà réuni quand elle arrive au Foyer.
   * Un mâle et une femelle de l'Espèce l'attendent, avec les Bêtes que `deja` donne d'après son sexe ; l'une d'elles part
   * aussitôt en escorte d'une première Expédition, vers une Case calme, et son retour réunit leur Couple (US-0956).
   * L'Expédition qui va chercher la Bête part ensuite : son Territoire, la Bête, son sexe, l'instant du Couple réuni,
   * l'Expédition et ses heures d'arrivée et de retour. Avec `voulu`, une Bête de ce sexe : le chef renaît ailleurs tant
   * que son Foyer n'en a pas, jusqu'à huit fois, comme quand rien n'est calme. Avec `ne`, comme unRetourAvecLaBete.
   */
  const unRetourApresLeCouple = async ({ voulu, deja = () => [], ne }: { voulu?: Sexe; deja?: (sexe: Sexe) => [Sexe, number][]; ne?: Ne } = {}) => {
    for (let essai = 0; essai < 8; essai++) {
      const t = essai === 0 && ne ? ne : await naitre();
      const bete = (await betesDeNaissance(t.territoireId)).find((b) => !voulu || sexeDUneBeteDeNaissance(graine, b.id) === voulu);
      if (!bete) continue;
      const { especeId } = bete;
      const sexe = sexeDUneBeteDeNaissance(graine, bete.id);
      for (const [s, nombre] of [["male", 1], ["femelle", 1], ...deja(sexe)] as [Sexe, number][]) {
        await pool.query(
          `insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, $3, $4)
           on conflict (territoire_id, espece_id, sexe) do update set nombre = effectif.nombre + excluded.nombre`,
          [t.territoireId, especeId, s, nombre],
        );
      }
      const calme = await uneCaseCalme(t.territoireId, especeId, t.ne).catch(() => null);
      if (!calme) continue;
      const premiere = await partir(t.territoireId, calme, especeId, t.ne);
      const reuniLe = retourDUneExpedition(await horaires(premiere))!;
      const escorte = escorteDe(especeId);
      const depart = await unDepartACalme(t.territoireId, bete, escorte, reuniLe);
      if (!depart) continue;
      await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 1)", [t.territoireId, escorte]);
      const expeditionId = await partir(t.territoireId, bete, escorte, depart);
      const prevus = await horaires(expeditionId);
      return { t, bete, escorte, depart, sexe, especeId, reuniLe, expeditionId, arrivee: sejourDUneExpedition(prevus)!.debut, retour: retourDUneExpedition(prevus)! };
    }
    throw new Error("Huit Foyers sans Bête de naissance à aller chercher, Couple réuni, pendant un séjour calme.");
  };
  /**
   * Une Case libre à 2 à 4 Cases du Foyer du Territoire, sans Bête de naissance, où une Expédition escortée d'une Bête de
   * l'Espèce `escorte`, partie à `depart`, ne voit aucune Bête pendant son séjour.
   */
  const uneCaseCalme = async (territoireId: number, escorte: string, depart: Date) => {
    const { rows } = await pool.query<Coordonnees & { id: number }>(
      `select c.id, c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) between 2 and 4
         and not exists (select 1 from bete_de_naissance n where n.case_id = c.id)
       order by c.q, c.r`,
      [territoireId],
    );
    for (const ici of rows) {
      const arrivee = apres(depart, (await aller(territoireId, ici, escorte)) * MINUTE);
      if ((await betesSauvagesDUneCase(pool, ici.id, arrivee, apres(arrivee, SEJOUR * MINUTE))).length === 0) return ici;
    }
    throw new Error("Aucune Case calme à portée.");
  };
  /** Le Territoire mis à l'heure du jeu `instant`, comme à l'ouverture d'une page : le mécanisme unique du temps. */
  const aLHeure = (territoireId: number, instant: Date) => rattraper("territoire", territoireId, { pool, jusqua: instant });
  /** L'effectif de l'Espèce `especeId` au Territoire, sexe par sexe. */
  const effectifDe = async (territoireId: number, especeId: string) =>
    (
      await pool.query<{ sexe: Sexe; nombre: number }>("select sexe, nombre from effectif where territoire_id = $1 and espece_id = $2 order by sexe", [
        territoireId,
        especeId,
      ])
    ).rows;
  /** Ce que l'écran d'Expédition propose de l'Espèce `especeId` pour l'escorte ; null quand il ne la propose pas. */
  const proposee = async (territoireId: number, especeId: string) => {
    const espece = (await betesDisponibles(pool, territoireId)).find((e) => e.id === especeId);
    return espece ? { disponibles: espece.disponibles, males: espece.males, femelles: espece.femelles, coupleReuni: espece.coupleReuni } : null;
  };
  /** L'état de l'Espèce `especeId` au Bestiaire du Territoire ; null tant qu'elle n'y est pas. */
  const auBestiaire = async (territoireId: number, especeId: string) =>
    (await pool.query<{ etat: EtatAuBestiaire }>("select etat from bestiaire where territoire_id = $1 and espece_id = $2", [territoireId, especeId])).rows[0]?.etat ??
    null;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    graine = Number((await pool.query<{ graine: string }>("select graine from monde where id = $1", [mondeId])).rows[0].graine);
    const { rows } = await pool.query<{ id: string; vitesse: number }>("select id, vitesse from espece");
    for (const { id, vitesse } of rows) vitesses.set(id, vitesse);
  });
  afterEach(async () => {
    // Chaque essai rend ses Foyers à la Couronne du Monde d'essai.
    await pool.query("delete from compte where email = any($1)", [nes.splice(0)]);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  describe("dès que l'effectif d'une Espèce sans Couple compte un mâle et une femelle au Foyer, ils forment son Couple", () => {
    it("le retour qui ramène le sexe manquant réunit le Couple, à l'heure même du retour, sans action du joueur", async () => {
      const { t, especeId, retour } = await unRetourAvecLaBete((sexe) => [[AUTRE[sexe], 1]]);

      await aLHeure(t.territoireId, apres(retour, -1));
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([]);
      await aLHeure(t.territoireId, retour);
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId, reuniLe: retour }]);
    });

    it("une Bête sortie en escorte n'est pas au Foyer : le Couple attend son retour, et se forme à cet instant", async () => {
      const { t, especeId, retour } = await unRetourAvecLaBete((sexe) => [[AUTRE[sexe], 1]]);
      // Juste avant ce retour, la seule Bête de l'autre sexe part en escorte ; elle rentre après lui.
      const sortie = apres(retour, -MINUTE);
      await aLHeure(t.territoireId, sortie);
      const expeditionId = await partir(t.territoireId, await uneCaseCalme(t.territoireId, especeId, sortie), especeId, sortie);
      const rentree = retourDUneExpedition(await horaires(expeditionId))!;
      expect(rentree > retour).toBe(true);

      await aLHeure(t.territoireId, retour);
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([]);
      expect(await effectifDe(t.territoireId, especeId)).toEqual([
        { sexe: "male", nombre: 1 },
        { sexe: "femelle", nombre: 1 },
      ]);
      expect(await proposee(t.territoireId, especeId)).toEqual({ disponibles: 1, males: 1, femelles: 1, coupleReuni: false });
      expect(await auBestiaire(t.territoireId, especeId)).toBe("apprivoisee");

      await aLHeure(t.territoireId, rentree);
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId, reuniLe: rentree }]);
      expect(await effectifDe(t.territoireId, especeId)).toEqual(VIDE);
    });

    it("avec des Bêtes sorties, seulement si un mâle et une femelle sont sûrement au Foyer ; plusieurs Espèces à la fois", async () => {
      const t = await naitre();
      await pool.query(
        `insert into effectif (territoire_id, espece_id, sexe, nombre)
         values ($1, 'souris', 'male', 2), ($1, 'souris', 'femelle', 1), ($1, 'poule', 'male', 2), ($1, 'poule', 'femelle', 2),
           ($1, 'pigeon', 'male', 1), ($1, 'pigeon', 'femelle', 1)`,
        [t.territoireId],
      );
      // Une souris et une poule sorties en escorte d'une Expédition encore en cours, au sexe que l'escorte ne dit pas.
      const { rows } = await pool.query<{ id: number }>(
        `insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes)
         select $1, c.id, $2, 30, 60 from case_du_monde c where c.monde_id = $3 and c.chef_id is null order by c.id limit 1 returning id`,
        [t.territoireId, t.ne, mondeId],
      );
      await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, 'souris', 1), ($1, 'poule', 1)", [rows[0].id]);
      const le = apres(t.ne, HEURE);

      const client = await pool.connect();
      try {
        // La souris sortie peut être la seule femelle ; les poules gardent au Foyer au moins un mâle et une femelle.
        expect(await reunirLesCouples(client, t.territoireId, le)).toEqual(["pigeon", "poule"]);
        // Rien de plus la fois suivante.
        expect(await reunirLesCouples(client, t.territoireId, apres(le, HEURE))).toEqual([]);
      } finally {
        client.release();
      }
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([
        { especeId: "pigeon", reuniLe: le },
        { especeId: "poule", reuniLe: le },
      ]);
      expect(await effectifDe(t.territoireId, "poule")).toEqual(VIDE.map((l) => ({ ...l, nombre: 1 })));
      expect(await effectifDe(t.territoireId, "souris")).toEqual([
        { sexe: "male", nombre: 2 },
        { sexe: "femelle", nombre: 1 },
      ]);
      expect((await betesDisponibles(pool, t.territoireId)).map((e) => [e.id, e.disponibles, e.coupleReuni])).toEqual([
        ["poule", 1, true],
        ["souris", 2, false],
      ]);
    });

    it("une Espèce dont le Couple est déjà réuni n'en réunit pas d'autre : sa nouvelle Bête reste dans l'effectif", async () => {
      const { t, especeId, retour } = await unRetourAvecLaBete((sexe) => [[AUTRE[sexe], 1]]);
      await pool.query("insert into couple (territoire_id, espece_id, reuni_le) values ($1, $2, $3)", [t.territoireId, especeId, t.ne]);

      await aLHeure(t.territoireId, retour);
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId, reuniLe: t.ne }]);
      expect(await effectifDe(t.territoireId, especeId)).toEqual(VIDE.map((l) => ({ ...l, nombre: 1 })));
      expect(await proposee(t.territoireId, especeId)).toMatchObject({ disponibles: 2, coupleReuni: true });
    });
  });

  describe("les deux Bêtes quittent l'effectif et partent à l'abri, en Réserve : elles ne combattent plus et ne peuvent plus sortir", () => {
    it("ni l'une ni l'autre n'est plus dans l'effectif, ni proposée pour l'escorte, ni ne peut partir", async () => {
      const { t, bete, escorte, especeId, retour } = await unRetourAvecLaBete((sexe) => [[AUTRE[sexe], 1]]);

      await aLHeure(t.territoireId, apres(retour, -1));
      expect(await proposee(t.territoireId, especeId)).toMatchObject({ disponibles: 1, coupleReuni: false });
      await aLHeure(t.territoireId, retour);
      expect(await effectifDe(t.territoireId, especeId)).toEqual(VIDE);
      expect((await betesDisponibles(pool, t.territoireId)).map((e) => e.id)).toEqual([escorte]);
      const avecElle = await lancerLExpedition(
        pool,
        t.territoireId,
        { destination: bete, explorateurs: 1, escorte: new Map([[especeId, 1]]), sejourMinutes: SEJOUR },
        retour,
      );
      expect(avecElle).toEqual({ refus: BETE_PLUS_DISPONIBLE });
    });
  });

  describe("les autres Bêtes de l'Espèce, s'il y en a, restent dans l'effectif", () => {
    it("seuls un mâle et une femelle partent en Réserve ; les autres restent disponibles pour l'escorte", async () => {
      const { t, bete, especeId, sexe, retour } = await unRetourAvecLaBete((sexe) => [[AUTRE[sexe], 3]]);

      await aLHeure(t.territoireId, retour);
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId, reuniLe: retour }]);
      expect(await effectifDe(t.territoireId, especeId)).toEqual(VIDE.map((l) => ({ ...l, nombre: l.sexe === sexe ? 0 : 2 })));
      expect(await proposee(t.territoireId, especeId)).toEqual({
        disponibles: 2,
        males: sexe === "male" ? 0 : 2,
        femelles: sexe === "femelle" ? 0 : 2,
        coupleReuni: true,
      });
      const avecEllesDeux = await lancerLExpedition(
        pool,
        t.territoireId,
        { destination: bete, explorateurs: 1, escorte: new Map([[especeId, 2]]), sejourMinutes: SEJOUR },
        retour,
      );
      expect(avecEllesDeux).toEqual({ expeditionId: expect.any(Number) });
    });
  });

  describe("l'Espèce passe à l'état « Couple réuni » au Bestiaire", () => {
    it("apprivoisée avant le retour, son Couple réuni au retour", async () => {
      const { t, especeId, retour } = await unRetourAvecLaBete((sexe) => [[AUTRE[sexe], 1]]);
      await pool.query("insert into bestiaire (territoire_id, espece_id, etat, croisee_le) values ($1, $2, 'apprivoisee', $3)", [t.territoireId, especeId, t.ne]);

      await aLHeure(t.territoireId, apres(retour, -1));
      expect(await auBestiaire(t.territoireId, especeId)).toBe("apprivoisee");
      await aLHeure(t.territoireId, retour);
      expect(await auBestiaire(t.territoireId, especeId)).toBe("couple_reuni");
    });

    it("sans l'autre sexe, elle n'est qu'apprivoisée", async () => {
      const { t, especeId, retour } = await unRetourAvecLaBete((sexe) => [[sexe, 2]]);

      await aLHeure(t.territoireId, retour);
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([]);
      expect(await auBestiaire(t.territoireId, especeId)).toBe("apprivoisee");
    });
  });

  describe("le récit du retour qui réunit le Couple l'annonce en tête, avec l'illustration de l'Espèce (US-0958)", () => {
    /** Les Récits de retour du Territoire, du plus récent au plus ancien : leur instant et les Couples qu'ils annoncent. */
    const retours = async (territoireId: number) =>
      (await recitsDuTerritoire(pool, territoireId)).filter((r) => r.titre === "Retour d'Expédition").map((r) => ({ le: r.survenuLe, couples: r.couples }));
    /** Le nom et l'illustration de l'Espèce `id`, lus comme sur sa fiche. */
    const espece = async (id: string) =>
      (await pool.query<{ especeId: string; nom: string; illustration: string | null }>(`select id as "especeId", nom, illustration from espece where id = $1`, [id])).rows[0];

    it("le Récit du retour qui ramène le sexe manquant annonce le Couple de l'Espèce, en direct comme au rattrapage", async () => {
      const { t, especeId, retour } = await unRetourAvecLaBete((sexe) => [[AUTRE[sexe], 1]]);

      await aLHeure(t.territoireId, apres(retour, HEURE));
      expect(await retours(t.territoireId)).toEqual([{ le: retour, couples: [await espece(especeId)] }]);
    });

    it("un retour qui ne réunit aucun Couple n'annonce rien", async () => {
      const { t, retour } = await unRetourAvecLaBete((sexe) => [[sexe, 2]]);

      await aLHeure(t.territoireId, apres(retour, HEURE));
      expect(await retours(t.territoireId)).toEqual([{ le: retour, couples: undefined }]);
    });

    it("seul le retour qui l'a réuni l'annonce : pas celui qui ramène ensuite une autre Bête de l'Espèce", async () => {
      const { t, especeId, retour } = await unRetourAvecLaBete((sexe) => [[AUTRE[sexe], 3]]);
      await aLHeure(t.territoireId, retour);
      // Une Bête de l'Espèce, restée dans l'effectif, part en escorte et rentre plus tard, sans rien réunir.
      const expeditionId = await partir(t.territoireId, await uneCaseCalme(t.territoireId, especeId, retour), especeId, retour);
      const rentree = retourDUneExpedition(await horaires(expeditionId))!;

      await aLHeure(t.territoireId, apres(rentree, MINUTE));
      expect(await retours(t.territoireId)).toEqual([
        { le: rentree, couples: undefined },
        { le: retour, couples: [await espece(especeId)] },
      ]);
    });

    it("le retour qui ramène ensuite une Bête de l'Espèce au Couple réuni, entrée dans l'effectif (US-0959), ne l'annonce pas de nouveau", async () => {
      const { t, especeId, reuniLe, retour } = await unRetourApresLeCouple();

      await aLHeure(t.territoireId, apres(retour, MINUTE));
      expect(await retours(t.territoireId)).toEqual([
        { le: retour, couples: undefined },
        { le: reuniLe, couples: [await espece(especeId)] },
      ]);
    });
  });

  describe("le nombre de Couples réunis du joueur s'affiche et augmente d'un (US-0958)", () => {
    it("aucun pour un chef qui vient de naître, puis un de plus à chaque Couple réuni", async () => {
      const { t, escorte, especeId, retour } = await unRetourAvecLaBete((sexe) => [[AUTRE[sexe], 1]]);
      // Le mâle et la femelle d'une troisième Espèce, ni celle de la Bête ni celle de l'escorte, au Foyer, sans Couple.
      const autre = ["souris", "poule", "pigeon"].find((id) => id !== especeId && id !== escorte)!;

      expect(await nombreDeCouples(pool, t.territoireId)).toBe(0);
      const client = await pool.connect();
      try {
        await client.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 1), ($1, $2, 'femelle', 1)", [t.territoireId, autre]);
        await reunirLesCouples(client, t.territoireId, t.ne);
      } finally {
        client.release();
      }
      expect(await nombreDeCouples(pool, t.territoireId)).toBe(1);
      await aLHeure(t.territoireId, retour);
      expect(await nombreDeCouples(pool, t.territoireId)).toBe(2);
      // Rien ne le fait baisser ni compter deux fois la même Espèce.
      await aLHeure(t.territoireId, apres(retour, HEURE));
      expect(await nombreDeCouples(pool, t.territoireId)).toBe(2);
    });
  });

  /**
   * Trois Territoires, chacun avec sa Bête de naissance et une Bête de l'autre sexe au Foyer : l'un mis à l'heure page
   * ouverte, par tranches de sept minutes, l'autre d'un bloc, le dernier par la tâche planifiée, dont un passage à
   * l'instant même du retour.
   */
  it("le même Couple, au même instant, en direct, au rattrapage et par la tâche planifiée", async () => {
    /** Ce que le Couple touche : les Couples du Territoire, l'effectif de l'Espèce et son état au Bestiaire. */
    const etat = async ({ t, especeId }: Awaited<ReturnType<typeof unRetourAvecLaBete>>) => ({
      couples: await couplesDuTerritoire(pool, t.territoireId),
      effectif: await effectifDe(t.territoireId, especeId),
      bestiaire: await auBestiaire(t.territoireId, especeId),
    });
    const attendu = ({ especeId, retour }: { especeId: string; retour: Date }) => ({ couples: [{ especeId, reuniLe: retour }], effectif: VIDE, bestiaire: "couple_reuni" });
    const avecLAutre = (sexe: Sexe): [Sexe, number][] => [[AUTRE[sexe], 1]];
    const [a, b, c] = await nesDAbord(3);
    const [enDirect, dUnBloc, parLaTache] = [await unRetourAvecLaBete(avecLAutre, a), await unRetourAvecLaBete(avecLAutre, b), await unRetourAvecLaBete(avecLAutre, c)];

    for (let instant = enDirect.depart; instant < apres(enDirect.retour, HEURE); instant = apres(instant, 7 * MINUTE + 3_123)) {
      await aLHeure(enDirect.t.territoireId, instant);
    }
    await aLHeure(enDirect.t.territoireId, apres(enDirect.retour, HEURE));
    await aLHeure(dUnBloc.t.territoireId, apres(dUnBloc.retour, HEURE));
    for (const instant of [apres(parLaTache.arrivee, 10 * MINUTE), parLaTache.retour, apres(parLaTache.retour, 39 * MINUTE)]) {
      expect(await rattraperLesAbsents({ pool, maintenant: instant, parmi: { territoire: [parLaTache.t.territoireId] } })).toMatchObject({ rattrapes: 1, echecs: 0 });
    }

    expect(await etat(enDirect)).toEqual(attendu(enDirect));
    expect(await etat(dUnBloc)).toEqual(attendu(dUnBloc));
    expect(await etat(parLaTache)).toEqual(attendu(parLaTache));
  }, 60_000);

  describe("après le Couple, les Bêtes rejoignent l'effectif (US-0959)", () => {
    describe("une fois le Couple réuni, toute nouvelle Bête apprivoisée de l'Espèce rejoint l'effectif, quel que soit son sexe", () => {
      it.each<Sexe>(["male", "femelle"])("la Bête (%s) qui arrive au Foyer après le Couple entre dans l'effectif, et l'écran d'Expédition la propose", async (voulu) => {
        const { t, especeId, sexe, reuniLe, retour } = await unRetourApresLeCouple({ voulu });
        expect(sexe).toBe(voulu);

        await aLHeure(t.territoireId, apres(retour, -1));
        expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId, reuniLe }]);
        expect(await effectifDe(t.territoireId, especeId)).toEqual(VIDE);
        expect(await proposee(t.territoireId, especeId)).toBeNull();
        await aLHeure(t.territoireId, retour);
        expect(await effectifDe(t.territoireId, especeId)).toEqual(VIDE.map((l) => ({ ...l, nombre: l.sexe === sexe ? 1 : 0 })));
        expect(await proposee(t.territoireId, especeId)).toEqual({
          disponibles: 1,
          males: sexe === "male" ? 1 : 0,
          femelles: sexe === "femelle" ? 1 : 0,
          coupleReuni: true,
        });
        expect(await auBestiaire(t.territoireId, especeId)).toBe("couple_reuni");
      });

      it("mâle ou femelle, elle y entre aussi quand une Bête de l'autre sexe l'attend au Foyer", async () => {
        const { t, especeId, sexe, reuniLe, retour } = await unRetourApresLeCouple({ deja: (sexe) => [[AUTRE[sexe], 1]] });

        await aLHeure(t.territoireId, apres(retour, -1));
        expect(await effectifDe(t.territoireId, especeId)).toEqual(VIDE.map((l) => ({ ...l, nombre: l.sexe === sexe ? 0 : 1 })));
        await aLHeure(t.territoireId, retour);
        expect(await effectifDe(t.territoireId, especeId)).toEqual(VIDE.map((l) => ({ ...l, nombre: 1 })));
        expect(await proposee(t.territoireId, especeId)).toEqual({ disponibles: 2, males: 1, femelles: 1, coupleReuni: true });
        expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId, reuniLe }]);
      });
    });

    describe("aucun second Couple de la même Espèce ne se forme", () => {
      it("des mâles et des femelles entrés ensemble dans l'effectif après le Couple y restent tous, retour après retour", async () => {
        const t = await naitre();
        await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, 'poule', 'male', 1), ($1, 'poule', 'femelle', 1)", [
          t.territoireId,
        ]);
        const le = apres(t.ne, HEURE);
        const client = await pool.connect();
        try {
          expect(await reunirLesCouples(client, t.territoireId, le)).toEqual(["poule"]);
          // Deux mâles et deux femelles apprivoisés ensuite, comme à l'arrivée au Foyer (US-0938) ; puis d'autres retours.
          await faireEntrerDansLEffectif(client, t.territoireId, ["male", "femelle", "male", "femelle"].map((sexe) => ({ especeId: "poule", sexe: sexe as Sexe })));
          for (const ensuite of [apres(le, HEURE), apres(le, 2 * HEURE)]) expect(await reunirLesCouples(client, t.territoireId, ensuite)).toEqual([]);
        } finally {
          client.release();
        }
        expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId: "poule", reuniLe: le }]);
        expect(await effectifDe(t.territoireId, "poule")).toEqual(VIDE.map((l) => ({ ...l, nombre: 2 })));
        expect(await proposee(t.territoireId, "poule")).toEqual({ disponibles: 4, males: 2, femelles: 2, coupleReuni: true });
      });

      /**
       * Trois Territoires dont le Couple est réuni et qui ramènent ensuite une Bête de l'Espèce, une Bête de l'autre sexe
       * au Foyer : l'un mis à l'heure page ouverte, par tranches de sept minutes, l'autre d'un bloc, le dernier par la
       * tâche planifiée, dont un passage à l'instant même du retour.
       */
      it("le même effectif, sans second Couple, en direct, au rattrapage et par la tâche planifiée", async () => {
        const etat = async ({ t, especeId }: Awaited<ReturnType<typeof unRetourApresLeCouple>>) => ({
          couples: await couplesDuTerritoire(pool, t.territoireId),
          effectif: await effectifDe(t.territoireId, especeId),
          bestiaire: await auBestiaire(t.territoireId, especeId),
        });
        const attendu = ({ especeId, reuniLe }: { especeId: string; reuniLe: Date }) => ({
          couples: [{ especeId, reuniLe }],
          effectif: VIDE.map((l) => ({ ...l, nombre: 1 })),
          bestiaire: "couple_reuni",
        });
        const avecLAutre = (sexe: Sexe): [Sexe, number][] => [[AUTRE[sexe], 1]];
        const [a, b, c] = await nesDAbord(3);
        const [enDirect, dUnBloc, parLaTache] = [
          await unRetourApresLeCouple({ deja: avecLAutre, ne: a }),
          await unRetourApresLeCouple({ deja: avecLAutre, ne: b }),
          await unRetourApresLeCouple({ deja: avecLAutre, ne: c }),
        ];

        for (let instant = enDirect.t.ne; instant < apres(enDirect.retour, HEURE); instant = apres(instant, 7 * MINUTE + 3_123)) {
          await aLHeure(enDirect.t.territoireId, instant);
        }
        await aLHeure(enDirect.t.territoireId, apres(enDirect.retour, HEURE));
        await aLHeure(dUnBloc.t.territoireId, apres(dUnBloc.retour, HEURE));
        for (const instant of [apres(parLaTache.reuniLe, 10 * MINUTE), apres(parLaTache.arrivee, 10 * MINUTE), parLaTache.retour, apres(parLaTache.retour, 39 * MINUTE)]) {
          expect(await rattraperLesAbsents({ pool, maintenant: instant, parmi: { territoire: [parLaTache.t.territoireId] } })).toMatchObject({ rattrapes: 1, echecs: 0 });
        }

        expect(await etat(enDirect)).toEqual(attendu(enDirect));
        expect(await etat(dUnBloc)).toEqual(attendu(dUnBloc));
        expect(await etat(parLaTache)).toEqual(attendu(parLaTache));
      }, 90_000);
    });
  });

  it("réunit le Couple des effectifs qui comptaient déjà un mâle et une femelle au Foyer (migration 0061), une seule fois", async () => {
    const { t, bete, escorte, especeId, retour } = await unRetourAvecLaBete((sexe) => [[AUTRE[sexe], 1]]);
    await aLHeure(t.territoireId, apres(retour, HEURE));
    // Son rattrapage seulement : la table est déjà là (src/test/preparer-base.ts).
    const migration = readFileSync(join(process.cwd(), "drizzle/0061_couple.sql"), "utf8")
      .split("--> statement-breakpoint")
      .filter((instruction) => instruction.includes('INSERT INTO "couple"'))
      .join("\n");
    expect(migration).toContain('INSERT INTO "couple"');

    const client = await pool.connect();
    let apresLaMigration: { couples: CoupleReuni[]; effectif: { sexe: Sexe; nombre: number }[]; escorte: { sexe: Sexe; nombre: number }[]; bestiaire: EtatAuBestiaire | null };
    let marquePage: Date;
    let sansArrivee: string;
    try {
      await client.query("begin");
      // Arrivés avant cette story : le mâle et la femelle sont au Foyer, sans Couple.
      await client.query("delete from couple where territoire_id = $1", [t.territoireId]);
      await client.query("update effectif set nombre = 1 where territoire_id = $1 and espece_id = $2", [t.territoireId, especeId]);
      await client.query("update bestiaire set etat = 'apprivoisee' where territoire_id = $1 and espece_id = $2", [t.territoireId, especeId]);
      // Et une femelle de l'Espèce de l'escorte rejoint son mâle, sorti en escorte d'une Expédition encore en cours.
      await client.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'femelle', 1)", [t.territoireId, escorte]);
      const { rows } = await client.query<{ id: number }>(
        "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, 30, 60) returning id",
        [t.territoireId, bete.caseId, apres(retour, HEURE)],
      );
      await client.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, 1)", [rows[0].id, escorte]);
      // Et un mâle et une femelle d'une troisième Espèce, sans arrivée connue : réunis au marque-page du Territoire. Une
      // Espèce validée : celles d'essai ne se nomment pas dans le code (US-0924).
      sansArrivee = ["souris", "poule", "pigeon"].find((id) => id !== escorte && id !== especeId)!;
      await client.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 1), ($1, $2, 'femelle', 1)", [
        t.territoireId,
        sansArrivee,
      ]);
      marquePage = (await client.query<{ le: Date }>("select calcule_jusqu_a as le from territoire where id = $1", [t.territoireId])).rows[0].le;

      await client.query(migration);
      // Rejouée, elle ne change rien.
      await client.query(migration);
      apresLaMigration = {
        couples: await couplesDuTerritoire(client, t.territoireId),
        effectif: (await client.query("select sexe, nombre from effectif where territoire_id = $1 and espece_id = $2 order by sexe", [t.territoireId, especeId])).rows,
        escorte: (await client.query("select sexe, nombre from effectif where territoire_id = $1 and espece_id = $2 order by sexe", [t.territoireId, escorte])).rows,
        bestiaire: (await client.query("select etat from bestiaire where territoire_id = $1 and espece_id = $2", [t.territoireId, especeId])).rows[0]?.etat ?? null,
      };
    } finally {
      await client.query("rollback");
      client.release();
    }
    // Réuni à l'arrivée de la Bête de naissance, la seule connue des deux ; l'autre Espèce, au marque-page.
    expect(marquePage!).toEqual(apres(retour, HEURE));
    expect(apresLaMigration).toEqual({
      couples: [
        { especeId, reuniLe: retour },
        { especeId: sansArrivee!, reuniLe: marquePage! },
      ],
      effectif: VIDE,
      escorte: [
        { sexe: "male", nombre: 1 },
        { sexe: "femelle", nombre: 1 },
      ],
      bestiaire: "couple_reuni",
    });
  });
});
