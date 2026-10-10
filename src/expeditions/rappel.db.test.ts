import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { betesDisponibles } from "@/monde/effectif";
import { explorateursDuTerritoire, prochainRetourDUnExplorateur } from "@/monde/explorateurs";
import { ficheDUneCase } from "@/monde/fiche";
import type { Coordonnees } from "@/monde/hex";
import { recitsDuTerritoire } from "@/monde/recits";
import { ABORDS_DU_FOYER_CASES, PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE } from "@/reglages";
import { formaterJourEtHeure, formaterMinutes } from "@/temps/affichage";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, poolDeTest, preparerMondeDeTest, territoireDuCompte, URL_TEST } from "@/test/base";
import { casesRevelees } from "./brouillard";
import { lancerLExpedition } from "./depart";
import { expeditionsEnCours } from "./en-cours";
import { expeditionsPresentesSurLaCase } from "./presence";
import { RAPPEL_DEJA_AU_RETOUR, RAPPEL_DEJA_RENTREE, RAPPEL_SANS_EXPEDITION, rappelerLExpedition } from "./rappel";
import { rencontresDUneExpedition } from "./rencontres";
import { RETOUR_EXPEDITION } from "./retour";

const MINUTE = 60_000;
/** L'écart au Foyer des destinations des essais, en Cases : au-delà des abords du Foyer, sous le brouillard au départ (US-0436). */
const ECART = ABORDS_DU_FOYER_CASES + 2;
/** L'aller vers ces destinations, au pas des explorateurs (US-0909), en minutes de jeu. */
const ALLER = ECART * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE;
/** Le séjour des Expéditions des essais, en minutes de jeu. */
const SEJOUR = 240;
/** Le titre des Récits de retour. */
const RETOUR = "Retour d'Expédition";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du rappel des Expéditions (US-0920)";

describe.skipIf(!URL_TEST)("rappeler une Expédition (US-0920, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `rappel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];
  const apres = (instant: Date, ms: number) => new Date(instant.getTime() + ms);

  /**
   * Un chef qui vient de naître dans le Monde d'essai, avec deux explorateurs et trois souris, toutes mâles (aucun Couple
   * à réunir au retour, US-0956) : son Territoire et sa naissance.
   */
  const naitre = async () => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = `Rap${lancement.slice(-5).replace(/[^a-z]/g, "x")}${"abcdefghij"[Math.floor(n / 10) % 10]}${"abcdefghij"[n % 10]}`;
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query("insert into habitant (territoire_id, prenom, metier) values ($1, 'Joran', 'explorateur'), ($1, 'Ilda', 'explorateur')", [territoireId]);
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, 'souris', 'male', 3)", [territoireId]);
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /** Les Cases libres à ECART Cases du Foyer du Territoire, hors de celles de ses Bêtes de naissance (US-0975). */
  const casesAPortee = async (territoireId: number) =>
    (
      await pool.query<Coordonnees & { id: number }>(
        `select c.id, c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
           join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
         where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = $2
           and not exists (select 1 from bete_de_naissance n where n.territoire_id = t.id and n.case_id = c.id)
         order by c.q, c.r`,
        [territoireId, ECART],
      )
    ).rows;
  /** La première Case libre à ECART Cases du Foyer. */
  const uneCase = async (territoireId: number) => (await casesAPortee(territoireId))[0];
  /**
   * Une souris de naissance du Territoire (US-0975) posée sur la Case `caseId` du départ `depart` jusqu'à la fin du séjour
   * qu'y ferait une Expédition partie alors : sans rappel, elle l'y verrait, et la suivrait (une commune, toujours à
   * portée de l'escorte, US-0934). Les Bêtes sauvages d'une Case dépendent de son Biome, que le hasard du Foyer choisit.
   */
  const uneBeteSurLaCase = (territoireId: number, caseId: number, depart: Date) =>
    pool.query("insert into bete_de_naissance (territoire_id, case_id, espece_id, arrivee, depart) values ($1, $2, 'souris', $3, $4)", [
      territoireId,
      caseId,
      depart,
      apres(depart, (ALLER + SEJOUR) * MINUTE),
    ]);
  /** Deux explorateurs et deux souris partent à `depart` vers `destination` pour SEJOUR minutes : l'Expédition. */
  const partir = async (territoireId: number, destination: Coordonnees, depart: Date) => {
    const resultat = await lancerLExpedition(
      pool,
      territoireId,
      { destination, explorateurs: 2, escorte: new Map([["souris", 2]]), sejourMinutes: SEJOUR },
      depart,
    );
    if (!("expeditionId" in resultat)) throw new Error(resultat.refus);
    return resultat.expeditionId;
  };
  /** Le Territoire mis à l'heure du jeu `instant`, comme à l'ouverture d'une page : le mécanisme unique du temps. */
  const aLHeure = (territoireId: number, instant: Date) => rattraper("territoire", territoireId, { pool, jusqua: instant });
  /** Les retours de l'Expédition encore à venir : l'instant de chaque événement en attente. */
  const retoursEnAttente = async (territoireId: number, expeditionId: number) =>
    (
      await pool.query<{ survient_le: Date }>(
        `select survient_le from evenement where element = 'territoire' and element_id = $1 and type = $2 and traite_le is null
           and donnees->>'expedition' = $3::text`,
        [territoireId, RETOUR_EXPEDITION, expeditionId],
      )
    ).rows.map((e) => e.survient_le);
  /** L'Expédition telle qu'elle est en base : son rappel et son retour. */
  const enBase = async (expeditionId: number) =>
    (
      await pool.query<{ rappeleeLe: Date | null; rentreeLe: Date | null }>(
        `select rappelee_le as "rappeleeLe", rentree_le as "rentreeLe" from expedition where id = $1`,
        [expeditionId],
      )
    ).rows[0];
  /** Les Cases que le Territoire a découvertes. */
  const decouvertes = async (territoireId: number) =>
    (await pool.query<{ nombre: number }>("select count(*)::int as nombre from case_decouverte where territoire_id = $1", [territoireId])).rows[0].nombre;
  /** Les Récits de retour du Territoire, du plus récent au plus ancien. */
  const recitsDeRetour = async (territoireId: number) => (await recitsDuTerritoire(pool, territoireId)).filter((r) => r.titre === RETOUR);

  beforeAll(async () => {
    pool = poolDeTest();
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

  it("à l'aller, fait demi-tour aussitôt : le retour dure le temps déjà parcouru, et les explorateurs rentrent à cette heure", async () => {
    const { territoireId, ne } = await naitre();
    const depart = apres(ne, MINUTE);
    const expeditionId = await partir(territoireId, await uneCase(territoireId), depart);
    const rappel = apres(depart, 50 * MINUTE);
    await aLHeure(territoireId, rappel);

    expect(await rappelerLExpedition(pool, territoireId, expeditionId, rappel)).toEqual({ rappeleeLe: rappel });
    const retour = apres(rappel, 50 * MINUTE);
    expect(await enBase(expeditionId)).toEqual({ rappeleeLe: rappel, rentreeLe: null });
    expect(await expeditionsEnCours(pool, territoireId, rappel)).toEqual([expect.objectContaining({ id: expeditionId, phase: "retour", rappeleeLe: rappel })]);
    // Son retour au Foyer, programmé au départ, est déplacé à la nouvelle heure : un seul, jamais deux.
    expect(await retoursEnAttente(territoireId, expeditionId)).toEqual([retour]);
    expect(await prochainRetourDUnExplorateur(pool, territoireId)).toEqual(retour);

    await aLHeure(territoireId, apres(retour, -1));
    expect((await enBase(expeditionId)).rentreeLe).toBeNull();
    await aLHeure(territoireId, retour);
    expect((await enBase(expeditionId)).rentreeLe).toEqual(retour);
    expect(await explorateursDuTerritoire(pool, territoireId)).toEqual({ libres: 2, total: 2 });
    expect((await betesDisponibles(pool, territoireId)).find((e) => e.id === "souris")?.disponibles).toBe(3);
  });

  it("rappelée à l'aller, ne séjourne pas, ne voit aucune Bête et ne rapporte rien ; les Cases déjà révélées le restent, aucune de plus", async () => {
    const { territoireId, ne } = await naitre();
    const depart = apres(ne, MINUTE);
    const destination = await uneCase(territoireId);
    await uneBeteSurLaCase(territoireId, destination.id, depart);
    await aLHeure(territoireId, depart);
    const avant = await decouvertes(territoireId);
    const expeditionId = await partir(territoireId, destination, depart);
    // Après sa quatrième Case, la première au-delà des abords du Foyer, avant la cinquième, d'où elle verrait sa destination.
    const rappel = apres(depart, 90 * MINUTE);
    await aLHeure(territoireId, rappel);
    const auRappel = await decouvertes(territoireId);
    expect(auRappel).toBeGreaterThan(avant);

    await rappelerLExpedition(pool, territoireId, expeditionId, rappel);
    // Bien après l'arrivée et le séjour qu'elle aurait faits.
    await aLHeure(territoireId, apres(depart, (2 * ALLER + SEJOUR + 60) * MINUTE));
    expect(await expeditionsPresentesSurLaCase(pool, destination.id, depart, apres(depart, (ALLER + SEJOUR) * MINUTE))).toEqual([]);
    expect(await rencontresDUneExpedition(pool, expeditionId)).toEqual([]);
    expect(await decouvertes(territoireId)).toBe(auRappel);
    expect(await ficheDUneCase(pool, territoireId, destination)).toMatchObject({ inconnue: true });
    // Rien de rapporté : pas une Bête de plus que celles parties avec elle.
    expect((await betesDisponibles(pool, territoireId)).find((e) => e.id === "souris")?.disponibles).toBe(3);
    expect(await pool.query("select 1 from rencontre where expedition_id = $1 and apprivoisee", [expeditionId])).toMatchObject({ rowCount: 0 });

    // Le récit dit qu'elle a été rappelée, à l'aller, et quand ; sans séjour, ni le Biome d'une destination jamais atteinte.
    const [recit] = await recitsDeRetour(territoireId);
    expect(recit.texte.split("\n")).toEqual([
      `Destination : Case inconnue, à ${ECART} Cases de votre Foyer.`,
      `Rappelée à l'aller le ${formaterJourEtHeure(rappel, "Europe/Paris")}.`,
      "Aller 1 h 30, sans séjour, retour 1 h 30.",
      auRappel - avant === 1 ? "Une Case est sortie du brouillard." : `${auRappel - avant} Cases sont sorties du brouillard.`,
      "Aucune Bête ne s'est montrée.",
    ]);
  });

  it("en séjour, y met fin et lance le retour aussitôt, aussi long que l'aller (décidé le 2026-10-08)", async () => {
    const { territoireId, ne } = await naitre();
    const depart = apres(ne, MINUTE);
    const destination = await uneCase(territoireId);
    // La même souris que l'Expédition rappelée à l'aller ne verra pas : arrivée, celle-ci la voit, et la ramène.
    await uneBeteSurLaCase(territoireId, destination.id, depart);
    const expeditionId = await partir(territoireId, destination, depart);
    const arrivee = apres(depart, ALLER * MINUTE);
    const rappel = apres(arrivee, 30 * MINUTE);
    await aLHeure(territoireId, rappel);

    expect(await rappelerLExpedition(pool, territoireId, expeditionId, rappel)).toEqual({ rappeleeLe: rappel });
    const retour = apres(rappel, ALLER * MINUTE);
    expect(await retoursEnAttente(territoireId, expeditionId)).toEqual([retour]);
    // Elle a quitté sa Case au rappel.
    expect(await expeditionsPresentesSurLaCase(pool, destination.id, apres(rappel, -1))).toEqual([expect.objectContaining({ id: expeditionId, depart: rappel })]);
    expect(await expeditionsPresentesSurLaCase(pool, destination.id, rappel)).toEqual([]);

    await aLHeure(territoireId, retour);
    expect((await enBase(expeditionId)).rentreeLe).toEqual(retour);
    // Les Bêtes sauvages de la Case, au hasard de son Biome, peuvent s'y être montrées aussi.
    expect(await rencontresDUneExpedition(pool, expeditionId)).toEqual(
      expect.arrayContaining([expect.objectContaining({ beteDeNaissanceId: expect.any(Number), vueLe: arrivee })]),
    );
    const [recit] = await recitsDeRetour(territoireId);
    const fiche = await ficheDUneCase(pool, territoireId, destination);
    expect(recit.texte.split("\n")).toEqual([
      `Destination : ${(fiche as { biome: string }).biome}, à ${ECART} Cases de votre Foyer.`,
      `Rappelée pendant le séjour le ${formaterJourEtHeure(rappel, "Europe/Paris")}.`,
      `Aller ${formaterMinutes(ALLER)}, séjour 30 min, retour ${formaterMinutes(ALLER)}.`,
      expect.stringMatching(/sorties? du brouillard\.$/),
      expect.stringMatching(/^(Une Bête s'est montrée|\d+ Bêtes se sont montrées)\.$/),
      // US-0938 : la souris qui la suit arrive au Foyer avec elle, et peut-être d'autres Bêtes de la Case.
      expect.stringMatching(/^Bêtes? ramenées? au Foyer : .*Souris grise \(/),
    ]);
  });

  it("au retour, ne se rappelle plus : un second rappel, ou un double clic, ne la rappelle qu'une fois", async () => {
    const { territoireId, ne } = await naitre();
    const depart = apres(ne, MINUTE);
    const expeditionId = await partir(territoireId, await uneCase(territoireId), depart);
    const rappel = apres(depart, 50 * MINUTE);
    await aLHeure(territoireId, rappel);

    const [premier, second] = await Promise.all([
      rappelerLExpedition(pool, territoireId, expeditionId, rappel),
      rappelerLExpedition(pool, territoireId, expeditionId, rappel),
    ]);
    expect([premier, second]).toEqual(expect.arrayContaining([{ rappeleeLe: rappel }, { refus: RAPPEL_DEJA_AU_RETOUR }]));
    expect(await rappelerLExpedition(pool, territoireId, expeditionId, apres(rappel, 10 * MINUTE))).toEqual({ refus: RAPPEL_DEJA_AU_RETOUR });
    expect(await enBase(expeditionId)).toEqual({ rappeleeLe: rappel, rentreeLe: null });
    expect(await retoursEnAttente(territoireId, expeditionId)).toEqual([apres(rappel, 50 * MINUTE)]);
  });

  it("refuse une Expédition déjà sur le chemin du retour, déjà rentrée, ou qui n'est pas du Territoire", async () => {
    const { territoireId, ne } = await naitre();
    const autre = await naitre();
    const depart = apres(ne, MINUTE);
    const expeditionId = await partir(territoireId, await uneCase(territoireId), depart);
    const finDuSejour = apres(depart, (ALLER + SEJOUR) * MINUTE);

    expect(await rappelerLExpedition(pool, autre.territoireId, expeditionId, apres(depart, MINUTE))).toEqual({ refus: RAPPEL_SANS_EXPEDITION });
    expect(await rappelerLExpedition(pool, territoireId, expeditionId + 1_000_000, apres(depart, MINUTE))).toEqual({ refus: RAPPEL_SANS_EXPEDITION });
    expect(await rappelerLExpedition(pool, territoireId, expeditionId, finDuSejour)).toEqual({ refus: RAPPEL_DEJA_AU_RETOUR });
    const retour = apres(finDuSejour, ALLER * MINUTE);
    await aLHeure(territoireId, retour);
    expect(await rappelerLExpedition(pool, territoireId, expeditionId, apres(retour, MINUTE))).toEqual({ refus: RAPPEL_DEJA_RENTREE });
    expect(await enBase(expeditionId)).toEqual({ rappeleeLe: null, rentreeLe: retour });
  });

  it("n'est jamais rappelée avant l'heure où son Territoire est déjà calculé : rien de ce qui est retenu n'est défait", async () => {
    const { territoireId, ne } = await naitre();
    const depart = apres(ne, MINUTE);
    const expeditionId = await partir(territoireId, await uneCase(territoireId), depart);
    const calcule = apres(depart, 50 * MINUTE);
    await aLHeure(territoireId, calcule);

    expect(await rappelerLExpedition(pool, territoireId, expeditionId, apres(calcule, -5 * MINUTE))).toEqual({ rappeleeLe: calcule });
    expect(await retoursEnAttente(territoireId, expeditionId)).toEqual([apres(calcule, 50 * MINUTE)]);
  });

  it("lève le même brouillard et fait le même récit, quel que soit le découpage du temps autour du rappel", async () => {
    /** Les Cases du Territoire découvertes, en clés « q,r », et la place de son Foyer. */
    const connues = async (territoireId: number) =>
      new Set(
        (
          await pool.query<Coordonnees>(
            "select c.q, c.r from case_decouverte d join case_du_monde c on c.id = d.case_id where d.territoire_id = $1",
            [territoireId],
          )
        ).rows.map(({ q, r }) => `${q},${r}`),
      );
    const leFoyer = async (territoireId: number) =>
      (
        await pool.query<Coordonnees & { mondeId: number }>(
          "select f.q, f.r, f.monde_id as \"mondeId\" from territoire t join case_du_monde f on f.id = t.foyer_case_id where t.id = $1",
          [territoireId],
        )
      ).rows[0];
    /**
     * Un départ, un rappel 1 h 30 et quelques secondes plus tard (au-delà de la quatrième Case, la première hors des abords
     * du Foyer), le Territoire calculé jusqu'à `calcule` minutes après le départ avant le rappel, puis `avancer` jusqu'après
     * le retour : ce que le joueur en retrouve.
     */
    const lePasse = async (calcule: number, avancer: (territoireId: number, rappel: Date, retour: Date) => Promise<void>) => {
      const { territoireId, ne } = await naitre();
      const depart = apres(ne, MINUTE);
      const destination = await uneCase(territoireId);
      await aLHeure(territoireId, depart);
      const avant = await connues(territoireId);
      const expeditionId = await partir(territoireId, destination, depart);
      const rappel = apres(depart, 90 * MINUTE + 13_457);
      await aLHeure(territoireId, apres(depart, calcule * MINUTE));
      expect(await rappelerLExpedition(pool, territoireId, expeditionId, rappel)).toEqual({ rappeleeLe: rappel });
      const retour = apres(rappel, rappel.getTime() - depart.getTime());
      await avancer(territoireId, rappel, retour);
      // Les Cases que ses horaires disent révélées jusqu'au rappel, que le Monde a et que le Territoire ne connaissait pas.
      const foyer = await leFoyer(territoireId);
      const existantes = new Set(
        (
          await pool.query<Coordonnees>("select q, r from case_du_monde where monde_id = $1 and abs(q - $2) <= 12 and abs(r - $3) <= 12", [
            foyer.mondeId,
            foyer.q,
            foyer.r,
          ])
        ).rows.map(({ q, r }) => `${q},${r}`),
      );
      const horaires = { partLe: depart, trajetMinutes: ALLER, sejourMinutes: SEJOUR, rappeleeLe: rappel };
      const attendues = casesRevelees(foyer, destination, horaires, apres(retour, 60 * MINUTE))
        .map(({ q, r }) => `${q},${r}`)
        .filter((c) => existantes.has(c) && !avant.has(c));
      const nouvelles = [...(await connues(territoireId))].filter((c) => !avant.has(c));
      expect(new Set(nouvelles)).toEqual(new Set(attendues));
      expect(nouvelles.length).toBeGreaterThan(0);
      expect((await enBase(expeditionId)).rentreeLe).toEqual(retour);
      const [recit] = await recitsDeRetour(territoireId);
      expect(recit.texte.split("\n").slice(1)).toEqual([
        `Rappelée à l'aller le ${formaterJourEtHeure(rappel, "Europe/Paris")}.`,
        "Aller 1 h 30, sans séjour, retour 1 h 30.",
        nouvelles.length === 1 ? "Une Case est sortie du brouillard." : `${nouvelles.length} Cases sont sorties du brouillard.`,
        "Aucune Bête ne s'est montrée.",
      ]);
    };
    // Page fermée depuis le départ : un seul rattrapage, après le retour, qui passe par le rappel.
    await lePasse(0, async (territoireId, _rappel, retour) => {
      await aLHeure(territoireId, apres(retour, 5 * 60 * MINUTE));
    });
    // Page ouverte du départ au retour : le temps avance par petits bouts, de part et d'autre du rappel.
    await lePasse(0, async (territoireId, rappel, retour) => {
      for (let instant = rappel; instant < retour; instant = apres(instant, 3 * MINUTE + 1_234)) await aLHeure(territoireId, instant);
      await aLHeure(territoireId, apres(retour, 5 * 60 * MINUTE));
    });
    // Le Territoire calculé jusqu'un peu avant le rappel, puis rattrapé d'un bloc.
    await lePasse(83, async (territoireId, _rappel, retour) => {
      await aLHeure(territoireId, retour);
    });
  }, 60_000);
});
