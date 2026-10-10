import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { EtatAuBestiaire } from "@/bestiaire/bestiaire";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { sexeDUneBeteDeNaissance } from "@/monde/betes-de-naissance";
import { type BeteSauvage, betesSauvagesDUneCase, type Sexe } from "@/monde/betes-sauvages";
import { betesDisponibles } from "@/monde/effectif";
import { type Coordonnees, distance } from "@/monde/hex";
import { recitsDuTerritoire } from "@/monde/recits";
import { PRESENCE_D_UNE_BETE_HEURES } from "@/reglages";
import { rattraperLesAbsents } from "@/temps/absents";
import type { Evenement } from "@/temps/avancer";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, poolDeTest, preparerMondeDeTest, territoireDuCompte, URL_TEST } from "@/test/base";
import { dureeDuTrajetMinutes } from "./allure";
import { BETE_PLUS_DISPONIBLE, lancerLExpedition } from "./depart";
import { expeditionsEnCours } from "./en-cours";
import { forceDUneBete } from "./force";
import { type HorairesDUneExpedition, retourDUneExpedition, sejourDUneExpedition } from "./phase";
import { rappelerLExpedition } from "./rappel";
import { rencontresDUneExpedition } from "./rencontres";
import { RETOUR_EXPEDITION, rentrerAuFoyer } from "./retour";
import { betesQuiSuivent } from "./sexe";

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;
/** Le séjour des Expéditions des essais, en minutes de jeu. */
const SEJOUR = 60;
/** Le temps où aucune autre Bête n'apparaît avant ou après celle d'un essai : sa présence et 6 heures de marge. */
const CALME = (PRESENCE_D_UNE_BETE_HEURES + 6) * HEURE;
/** Ce que dit le récit d'un sexe. */
const DIT = { male: "mâle", femelle: "femelle" } as const;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de l'arrivée au Foyer (US-0938)";

/** Une Bête de naissance du Territoire (US-0975), la Bête commune qu'il apprivoise dans ces essais, sur sa Case. */
type BeteDeNaissance = Coordonnees & { id: number; caseId: number; especeId: string; arrivee: Date; depart: Date };

describe.skipIf(!URL_TEST)("la Bête apprivoisée arrive au Foyer (US-0938, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  /** La graine du Monde d'essai, d'où se tirent les sexes de ses Bêtes. */
  let graine: number;
  /** La vitesse, la force et le nom de chaque Espèce du jeu. */
  const especes = new Map<string, { vitesse: number; force: number; nom: string; rareteId: string }>();
  const lancement = `arrivee-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];
  const apres = (instant: Date, ms: number) => new Date(instant.getTime() + ms);

  /** Un chef qui vient de naître dans le Monde d'essai, avec deux explorateurs : son Territoire et l'instant de sa naissance. */
  const naitre = async () => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = `Arr${lancement.slice(-5).replace(/[^a-z]/g, "x")}${"abcdefghij"[Math.floor(n / 10) % 10]}${"abcdefghij"[n % 10]}`;
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query("insert into habitant (territoire_id, prenom, metier) values ($1, 'Joran', 'explorateur'), ($1, 'Ilda', 'explorateur')", [territoireId]);
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /** Le Foyer du Territoire. */
  const foyer = async (territoireId: number) =>
    (await pool.query<Coordonnees>("select f.q, f.r from territoire t join case_du_monde f on f.id = t.foyer_case_id where t.id = $1", [territoireId])).rows[0];
  /**
   * Une Bête de naissance du Territoire, l'Espèce commune de l'escorte qui part la chercher (une autre que la sienne, une
   * Bête dans l'effectif) et l'heure d'un départ d'où l'Expédition arrive sur sa Case pendant sa présence, pour un séjour
   * où aucune Bête sauvage ordinaire ne se montre : seule elle peut suivre l'Expédition.
   */
  const uneBeteDeNaissanceACalme = async (t: { territoireId: number; ne: Date }) => {
    const { rows } = await pool.query<BeteDeNaissance>(
      `select b.id, b.case_id as "caseId", b.espece_id as "especeId", b.arrivee, b.depart, c.q, c.r
       from bete_de_naissance b join case_du_monde c on c.id = b.case_id where b.territoire_id = $1 and c.chef_id is null order by b.id`,
      [t.territoireId],
    );
    const ici = await foyer(t.territoireId);
    for (const bete of rows) {
      const escorte = bete.especeId === "souris" ? "poule" : "souris";
      const trajet = dureeDuTrajetMinutes(distance(ici, bete), [{ vitesse: especes.get(escorte)!.vitesse, nombre: 1 }]);
      for (let depart = t.ne; ; depart = apres(depart, 30 * MINUTE)) {
        const arrivee = apres(depart, trajet * MINUTE);
        if (apres(arrivee, SEJOUR * MINUTE) > bete.depart) break;
        if (arrivee < bete.arrivee) continue;
        if ((await betesSauvagesDUneCase(pool, bete.caseId, arrivee, apres(arrivee, SEJOUR * MINUTE))).length > 0) continue;
        await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 1)", [t.territoireId, escorte]);
        return { bete, escorte, depart, sexe: sexeDUneBeteDeNaissance(graine, bete.id) };
      }
    }
    throw new Error("Aucune Bête de naissance à aller chercher pendant un séjour calme.");
  };
  /** Un explorateur part à `depart` vers la Case `destination`, escorté d'une Bête de l'Espèce `escorte` : son Expédition. */
  const partir = async (territoireId: number, destination: Coordonnees, escorte: string, depart: Date) => {
    const resultat = await lancerLExpedition(pool, territoireId, { destination, explorateurs: 1, escorte: new Map([[escorte, 1]]), sejourMinutes: SEJOUR }, depart);
    if (!("expeditionId" in resultat)) throw new Error(resultat.refus);
    return resultat.expeditionId;
  };
  /** Les horaires d'une Expédition, tels qu'ils sont en base, rappel compris (US-0920). */
  const horaires = async (expeditionId: number) =>
    (
      await pool.query<HorairesDUneExpedition>(
        `select part_le as "partLe", trajet_minutes as "trajetMinutes", sejour_minutes as "sejourMinutes", rappelee_le as "rappeleeLe" from expedition where id = $1`,
        [expeditionId],
      )
    ).rows[0];
  /** Une Expédition partie vers une Bête de naissance du Territoire, et ses heures d'arrivée et de retour. */
  const allerChercherSaBete = async (t: { territoireId: number; ne: Date }) => {
    const voulue = await uneBeteDeNaissanceACalme(t);
    const expeditionId = await partir(t.territoireId, voulue.bete, voulue.escorte, voulue.depart);
    const prevus = await horaires(expeditionId);
    return { ...voulue, expeditionId, arrivee: sejourDUneExpedition(prevus)!.debut, retour: retourDUneExpedition(prevus)! };
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
  /** Les Bêtes que le joueur peut emmener en escorte, Espèce par Espèce, telles que l'écran d'Expédition les propose. */
  const disponibles = async (territoireId: number) =>
    (await betesDisponibles(pool, territoireId)).map(({ id, disponibles, males, femelles }) => ({ id, disponibles, males, femelles }));
  /** L'état de l'Espèce `especeId` au Bestiaire du Territoire ; null tant qu'elle n'y est pas. */
  const auBestiaire = async (territoireId: number, especeId: string) =>
    (await pool.query<{ etat: EtatAuBestiaire }>("select etat from bestiaire where territoire_id = $1 and espece_id = $2", [territoireId, especeId])).rows[0]?.etat ??
    null;
  /** La dernière ligne du Récit de retour le plus récent du Territoire. */
  const finDuRecitDeRetour = async (territoireId: number) =>
    (await recitsDuTerritoire(pool, territoireId)).find((r) => r.titre === "Retour d'Expédition")?.texte.split("\n").at(-1);

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    graine = Number((await pool.query<{ graine: string }>("select graine from monde where id = $1", [mondeId])).rows[0].graine);
    const { rows } = await pool.query<{ id: string; nom: string; rareteId: string; attaque: number; vie: number; vitesse: number }>(
      `select id, nom, rarete_id as "rareteId", attaque, vie, vitesse from espece`,
    );
    for (const { id, nom, rareteId, vitesse, ...e } of rows) especes.set(id, { nom, rareteId, vitesse, force: forceDUneBete(e) });
  });
  afterEach(async () => {
    // Chaque essai rend ses Foyers à la Couronne du Monde d'essai.
    await pool.query("delete from compte where email = any($1)", [nes.splice(0)]);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  describe("la Bête suit l'Expédition et arrive au Foyer avec elle, à son retour", () => {
    it("jusqu'au retour, elle suit l'Expédition hors de l'effectif ; au retour, elle entre dans l'effectif de son Espèce, avec son sexe, une seule fois", async () => {
      const t = await naitre();
      const { bete, escorte, sexe, expeditionId, arrivee, retour } = await allerChercherSaBete(t);

      await aLHeure(t.territoireId, apres(retour, -1));
      expect(await betesQuiSuivent(pool, expeditionId)).toEqual([{ especeId: bete.especeId, sexe, depuis: arrivee }]);
      expect(await effectifDe(t.territoireId, bete.especeId)).toEqual([]);
      // Sa seule Bête est partie en escorte : il n'en a aucune à emmener.
      expect(await disponibles(t.territoireId)).toEqual([]);
      expect(await auBestiaire(t.territoireId, bete.especeId)).toBe("croisee");

      await aLHeure(t.territoireId, retour);
      expect(await effectifDe(t.territoireId, bete.especeId)).toEqual([{ sexe, nombre: 1 }]);
      expect(await disponibles(t.territoireId)).toEqual(
        expect.arrayContaining([
          { id: escorte, disponibles: 1, males: 1, femelles: 0 },
          { id: bete.especeId, disponibles: 1, males: sexe === "male" ? 1 : 0, femelles: sexe === "femelle" ? 1 : 0 },
        ]),
      );
      expect(await disponibles(t.territoireId)).toHaveLength(2);

      // Rentrée une fois, elle n'arrive qu'une fois : même quand son retour s'appliquerait de nouveau.
      await aLHeure(t.territoireId, apres(retour, JOUR));
      const { rows } = await pool.query<Evenement>(
        `select id, type, survient_le as "survientLe", donnees from evenement where element = 'territoire' and element_id = $1 and type = $2`,
        [t.territoireId, RETOUR_EXPEDITION],
      );
      const client = await pool.connect();
      try {
        await rentrerAuFoyer(client, t.territoireId, rows[0]);
      } finally {
        client.release();
      }
      expect(await effectifDe(t.territoireId, bete.especeId)).toEqual([{ sexe, nombre: 1 }]);
      expect(await effectifDe(t.territoireId, escorte)).toEqual([{ sexe: "male", nombre: 1 }]);
      expect((await recitsDuTerritoire(pool, t.territoireId)).filter((r) => r.titre === "Retour d'Expédition")).toHaveLength(1);
    });

    it("le récit de retour la dit ramenée au Foyer, avec son sexe", async () => {
      const t = await naitre();
      const { bete, sexe, retour } = await allerChercherSaBete(t);

      await aLHeure(t.territoireId, retour);
      expect(await finDuRecitDeRetour(t.territoireId)).toBe(`Bête ramenée au Foyer : ${especes.get(bete.especeId)!.nom} (${DIT[sexe]}).`);
    });

    it("rappelée pendant son séjour, l'Expédition rentre plus tôt, avec la Bête déjà apprivoisée (US-0920)", async () => {
      const t = await naitre();
      const { bete, sexe, expeditionId, arrivee, retour } = await allerChercherSaBete(t);
      const rappel = apres(arrivee, 10 * MINUTE);

      await aLHeure(t.territoireId, rappel);
      expect(await rappelerLExpedition(pool, t.territoireId, expeditionId, rappel)).toEqual({ rappeleeLe: rappel });
      const rentree = retourDUneExpedition(await horaires(expeditionId))!;
      expect(rentree < retour).toBe(true);
      await aLHeure(t.territoireId, rentree);
      expect(await effectifDe(t.territoireId, bete.especeId)).toEqual([{ sexe, nombre: 1 }]);
      expect(await auBestiaire(t.territoireId, bete.especeId)).toBe("apprivoisee");
    });

    it("rappelée à l'aller, l'Expédition ne ramène rien : elle n'a jamais vu la Bête (US-0920)", async () => {
      const t = await naitre();
      const { bete, expeditionId, arrivee } = await allerChercherSaBete(t);
      const rappel = apres(arrivee, -10 * MINUTE);

      await aLHeure(t.territoireId, rappel);
      expect(await rappelerLExpedition(pool, t.territoireId, expeditionId, rappel)).toEqual({ rappeleeLe: rappel });
      await aLHeure(t.territoireId, apres(retourDUneExpedition(await horaires(expeditionId))!, HEURE));
      expect(await betesQuiSuivent(pool, expeditionId)).toEqual([]);
      expect(await effectifDe(t.territoireId, bete.especeId)).toEqual([]);
      expect(await finDuRecitDeRetour(t.territoireId)).toBe("Aucune Bête ne s'est montrée.");
    });

    it("elle s'ajoute aux Bêtes de son Espèce déjà au Foyer, à son sexe", async () => {
      const t = await naitre();
      const { bete, sexe, retour } = await allerChercherSaBete(t);
      await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 2), ($1, $2, 'femelle', 1)", [t.territoireId, bete.especeId]);
      // Son Couple déjà réuni (US-0956) : sinon, un mâle et une femelle au Foyer partiraient en Réserve à ce retour.
      await pool.query("insert into couple (territoire_id, espece_id, reuni_le) values ($1, $2, $3)", [t.territoireId, bete.especeId, t.ne]);

      await aLHeure(t.territoireId, retour);
      expect(await effectifDe(t.territoireId, bete.especeId)).toEqual([
        { sexe: "male", nombre: sexe === "male" ? 3 : 2 },
        { sexe: "femelle", nombre: sexe === "femelle" ? 2 : 1 },
      ]);
    });
  });

  describe("son Espèce passe à l'état « apprivoisée » au Bestiaire si elle n'avait pas mieux", () => {
    it("croisée à la Rencontre, apprivoisée au retour", async () => {
      const t = await naitre();
      const { bete, retour } = await allerChercherSaBete(t);

      await aLHeure(t.territoireId, apres(retour, -1));
      expect(await auBestiaire(t.territoireId, bete.especeId)).toBe("croisee");
      await aLHeure(t.territoireId, retour);
      expect(await auBestiaire(t.territoireId, bete.especeId)).toBe("apprivoisee");
    });

    it("une Espèce dont le Couple est déjà réuni le reste", async () => {
      const t = await naitre();
      const { bete, retour } = await allerChercherSaBete(t);
      await pool.query("insert into bestiaire (territoire_id, espece_id, etat, croisee_le) values ($1, $2, 'couple_reuni', $3)", [t.territoireId, bete.especeId, t.ne]);

      await aLHeure(t.territoireId, retour);
      expect(await auBestiaire(t.territoireId, bete.especeId)).toBe("couple_reuni");
    });
  });

  describe("jusqu'au retour, la Bête qui suit ne fait pas partie de l'escorte (décidé le 2026-10-09)", () => {
    it("l'escorte de l'Expédition en cours reste celle du départ", async () => {
      const t = await naitre();
      const { escorte, expeditionId, retour } = await allerChercherSaBete(t);

      await aLHeure(t.territoireId, apres(retour, -1));
      const [enCours] = await expeditionsEnCours(pool, t.territoireId, apres(retour, -1));
      expect(enCours).toMatchObject({ id: expeditionId, escorte: [expect.objectContaining({ id: escorte, nombre: 1 })] });
      expect(enCours.escorte).toHaveLength(1);
    });

    it("elle n'en change pas la force : une Bête plus rare, à portée de l'escorte et d'elle réunies, mais pas de l'escorte seule, reste sur sa Case", async () => {
      const t = await naitre();
      // L'escorte : une Bête de la commune la plus forte ; la Bête de naissance qui suivra l'Expédition, de la même Espèce.
      const [forte, { force }] = [...especes].filter(([, e]) => e.rareteId === "commune").sort((a, b) => b[1].force - a[1].force)[0];
      // Une Bête plus rare, seule sur sa Case, plus forte que l'escorte, mais pas plus que l'escorte et la Bête qui suit réunies.
      const { caseId, bete } = await uneBeteSeule(t.territoireId, apres(t.ne, 3 * JOUR), (b) => {
        const sienne = especes.get(b.especeId)!.force;
        return b.rareteId !== "commune" && sienne > force && sienne <= 2 * force;
      });
      // La Bête de naissance, là deux heures avant elle ; l'Expédition arrive une heure avant elle et reste quatre heures.
      await pool.query("insert into bete_de_naissance (territoire_id, case_id, espece_id, arrivee, depart) values ($1, $2, $3, $4, $5)", [
        t.territoireId,
        caseId,
        forte,
        apres(bete.arrivee, -2 * HEURE),
        apres(bete.arrivee, 4 * HEURE),
      ]);
      const { rows } = await pool.query<{ id: number }>(
        "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, 30, 240) returning id",
        [t.territoireId, caseId, apres(bete.arrivee, -HEURE - 30 * MINUTE)],
      );
      await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, 1)", [rows[0].id, forte]);

      await aLHeure(t.territoireId, apres(bete.depart, JOUR));
      expect((await rencontresDUneExpedition(pool, rows[0].id)).map((r) => [r.especeId, r.apprivoisee])).toEqual([
        [forte, true],
        [bete.especeId, false],
      ]);
    });

    it("elle ne peut partir en escorte qu'une fois rentrée : dès l'Expédition suivante", async () => {
      const t = await naitre();
      const { bete, retour } = await allerChercherSaBete(t);
      const avecElle = (instant: Date) =>
        lancerLExpedition(pool, t.territoireId, { destination: bete, explorateurs: 1, escorte: new Map([[bete.especeId, 1]]), sejourMinutes: SEJOUR }, instant);

      await aLHeure(t.territoireId, apres(retour, -1));
      expect(await avecElle(apres(retour, -1))).toEqual({ refus: BETE_PLUS_DISPONIBLE });

      await aLHeure(t.territoireId, retour);
      expect(await avecElle(retour)).toEqual({ expeditionId: expect.any(Number) });
      expect((await disponibles(t.territoireId)).map((e) => e.id)).not.toContain(bete.especeId);
    });
  });

  /**
   * Trois Territoires, chacun avec sa Bête de naissance : l'un mis à l'heure page ouverte, par tranches de sept minutes,
   * l'autre d'un bloc, le dernier par la tâche planifiée, dont un passage à l'instant même du retour.
   */
  it("le même effectif et le même Bestiaire en direct, au rattrapage et par la tâche planifiée", async () => {
    /** Ce que le retour touche : l'effectif des deux Espèces et l'état de celle de la Bête au Bestiaire. */
    const etat = async (t: { territoireId: number }, { bete, escorte }: Awaited<ReturnType<typeof allerChercherSaBete>>) => ({
      apprivoisee: await effectifDe(t.territoireId, bete.especeId),
      escorte: await effectifDe(t.territoireId, escorte),
      bestiaire: await auBestiaire(t.territoireId, bete.especeId),
    });
    const attendu = ({ sexe }: { sexe: Sexe }) => ({ apprivoisee: [{ sexe, nombre: 1 }], escorte: [{ sexe: "male", nombre: 1 }], bestiaire: "apprivoisee" });

    const [direct, bloc, tache] = [await naitre(), await naitre(), await naitre()];
    const [enDirect, dUnBloc, parLaTache] = [await allerChercherSaBete(direct), await allerChercherSaBete(bloc), await allerChercherSaBete(tache)];

    for (let instant = enDirect.depart; instant < apres(enDirect.retour, HEURE); instant = apres(instant, 7 * MINUTE + 3_123)) await aLHeure(direct.territoireId, instant);
    await aLHeure(direct.territoireId, apres(enDirect.retour, HEURE));
    await aLHeure(bloc.territoireId, apres(dUnBloc.retour, HEURE));
    for (const instant of [apres(parLaTache.arrivee, 10 * MINUTE), parLaTache.retour, apres(parLaTache.retour, 39 * MINUTE)]) {
      expect(await rattraperLesAbsents({ pool, maintenant: instant, parmi: { territoire: [tache.territoireId] } })).toMatchObject({ rattrapes: 1, echecs: 0 });
    }

    expect(await etat(direct, enDirect)).toEqual(attendu(enDirect));
    expect(await etat(bloc, dUnBloc)).toEqual(attendu(dUnBloc));
    expect(await etat(tache, parLaTache)).toEqual(attendu(parLaTache));
  }, 60_000);

  /**
   * Une Bête sauvage seule, telle que `accepte` la veut, sur une Case libre à 2 à 6 Cases du Foyer du Territoire, sans Bête
   * de naissance, apparue après `apresLe` : aucune autre n'apparaît sur sa Case de CALME avant elle à CALME après. Sa Case
   * et la Bête.
   */
  const uneBeteSeule = async (territoireId: number, apresLe: Date, accepte: (b: BeteSauvage) => boolean) => {
    const fin = apres(apresLe, 30 * JOUR);
    const { rows: cases } = await pool.query<{ id: number }>(
      `select c.id from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) between 2 and 6
         and not exists (select 1 from bete_de_naissance n where n.territoire_id = t.id and n.case_id = c.id)
       order by c.q, c.r`,
      [territoireId],
    );
    for (const ici of cases) {
      const betes = await betesSauvagesDUneCase(pool, ici.id, apresLe, fin);
      const bete = betes.find(
        (b, i) =>
          accepte(b) &&
          b.arrivee >= apres(apresLe, CALME) &&
          b.arrivee <= apres(fin, -CALME) &&
          (i === 0 || betes[i - 1].arrivee <= apres(b.arrivee, -CALME)) &&
          (i === betes.length - 1 || betes[i + 1].arrivee >= apres(b.arrivee, CALME)),
      );
      if (bete) return { caseId: ici.id, bete };
    }
    throw new Error("Aucune Bête seule telle que l'essai la veut.");
  };
});
