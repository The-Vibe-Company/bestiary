import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { lancerLExpedition } from "@/expeditions/depart";
import { retourDUneExpedition } from "@/expeditions/phase";
import { PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE } from "@/reglages";
import { rattraperLesAbsents } from "@/temps/absents";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { betesSauvagesDesCases, type Sexe } from "./betes-sauvages";
import { couplesDuTerritoire } from "./couple";
import { betesDisponibles, faireEntrerDansLEffectif } from "./effectif";
import { elevageAcquis } from "./elevage";
import type { Coordonnees } from "./hex";

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;
/** Le séjour des Expéditions des essais, en minutes de jeu. */
const SEJOUR = 60;
/** L'Espèce dont ces essais réunissent le Couple, et une autre, qui n'en a pas. */
const ESPECE = "poule";
const AUTRE_ESPECE = "souris";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de l'Élevage acquis (US-0957)";

describe.skipIf(!URL_TEST)("l'Élevage s'ouvre pour toujours (US-0957, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `elevage-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    const nom = nomDEssai("Elv", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query("insert into habitant (territoire_id, prenom, metier) values ($1, 'Joran', 'explorateur'), ($1, 'Ilda', 'explorateur')", [territoireId]);
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /** Ajoute à l'effectif du Territoire `nombre` Bêtes de l'Espèce `especeId`, du sexe `sexe`. */
  const ajouter = (territoireId: number, especeId: string, sexe: Sexe, nombre: number) =>
    pool.query(
      `insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, $3, $4)
       on conflict (territoire_id, espece_id, sexe) do update set nombre = effectif.nombre + excluded.nombre`,
      [territoireId, especeId, sexe, nombre],
    );
  /**
   * Un explorateur part à `depart`, escorté de `escorte` Bêtes de l'Espèce des essais, vers une Case libre à deux Cases du
   * Foyer où aucune Bête ne se montre pendant son séjour, ni Bête sauvage ni Bête de naissance : aucune ne le suit, et
   * seule son escorte rentre avec lui. L'instant de son retour.
   */
  const partir = async (territoireId: number, depart: Date, escorte = 1) => {
    // Un aller au pas des explorateurs, plus lents que toutes les Bêtes (US-0912).
    const arrivee = apres(depart, 2 * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE * MINUTE);
    const { rows } = await pool.query<Coordonnees & { id: number }>(
      `select c.id, c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = 2
         and not exists (select 1 from bete_de_naissance n where n.territoire_id = t.id and n.case_id = c.id)
       order by c.q, c.r`,
      [territoireId],
    );
    const sauvages = await betesSauvagesDesCases(pool, rows.map((c) => c.id), arrivee, apres(arrivee, SEJOUR * MINUTE));
    const calme = rows.find((c) => sauvages.get(c.id)!.length === 0);
    if (!calme) throw new Error("Aucune Case à deux Cases du Foyer où rien ne se montre pendant le séjour.");
    const resultat = await lancerLExpedition(
      pool,
      territoireId,
      { destination: calme, explorateurs: 1, escorte: new Map(escorte > 0 ? [[ESPECE, escorte]] : []), sejourMinutes: SEJOUR },
      depart,
    );
    if (!("expeditionId" in resultat)) throw new Error(resultat.refus);
    const { rows: horaires } = await pool.query(
      `select part_le as "partLe", trajet_minutes as "trajetMinutes", sejour_minutes as "sejourMinutes", rappelee_le as "rappeleeLe" from expedition where id = $1`,
      [resultat.expeditionId],
    );
    return retourDUneExpedition(horaires[0])!;
  };
  /**
   * Un chef qui vient de naître, avec un mâle et `femelles` femelles de l'Espèce des essais, dont l'une part aussitôt en
   * escorte : l'escorte ne dit pas le sexe de ses Bêtes, son Couple attend donc son retour, qui le réunit (US-0956). Son
   * Territoire, et l'instant de ce retour.
   */
  const unCoupleAuRetour = async (femelles = 1) => {
    const t = await naitre();
    await ajouter(t.territoireId, ESPECE, "male", 1);
    await ajouter(t.territoireId, ESPECE, "femelle", femelles);
    return { t, retour: await partir(t.territoireId, t.ne) };
  };
  /** Le Territoire mis à l'heure du jeu `instant`, comme à l'ouverture d'une page : le mécanisme unique du temps. */
  const aLHeure = (territoireId: number, instant: Date) => rattraper("territoire", territoireId, { pool, jusqua: instant });
  /** Ce que l'écran d'Expédition propose de l'Espèce des essais pour l'escorte ; null quand il ne la propose pas. */
  const proposee = async (territoireId: number) => {
    const espece = (await betesDisponibles(pool, territoireId)).find((e) => e.id === ESPECE);
    return espece ? { disponibles: espece.disponibles, coupleReuni: espece.coupleReuni } : null;
  };

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

  describe("dès le Couple réuni, l'Élevage de l'Espèce est noté comme acquis pour toujours", () => {
    it("acquis à l'instant même où le Couple se réunit, pas avant ; pour son Espèce et son Territoire seulement", async () => {
      const { t, retour } = await unCoupleAuRetour();
      const voisin = await naitre();
      await ajouter(voisin.territoireId, ESPECE, "male", 1);

      await aLHeure(t.territoireId, apres(retour, -1));
      expect(await elevageAcquis(pool, t.territoireId, ESPECE)).toBe(false);
      await aLHeure(t.territoireId, retour);
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId: ESPECE, reuniLe: retour }]);
      expect(await elevageAcquis(pool, t.territoireId, ESPECE)).toBe(true);
      expect(await elevageAcquis(pool, t.territoireId, AUTRE_ESPECE)).toBe(false);
      expect(await elevageAcquis(pool, voisin.territoireId, ESPECE)).toBe(false);
    });

    it("toujours acquis des jours plus tard, retour après retour, et son Couple n'a pas bougé", async () => {
      const { t, retour } = await unCoupleAuRetour(2);
      await aLHeure(t.territoireId, retour);

      // La femelle restée dans l'effectif sort et rentre encore ; le temps passe.
      const encore = await partir(t.territoireId, apres(retour, HEURE));
      await aLHeure(t.territoireId, apres(encore, 3 * JOUR));
      expect(await elevageAcquis(pool, t.territoireId, ESPECE)).toBe(true);
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId: ESPECE, reuniLe: retour }]);
    });

    /**
     * Trois Territoires, chacun avec son Couple qui se réunit au retour de son escorte : l'un mis à l'heure page ouverte, par
     * tranches de sept minutes, l'autre d'un bloc, le dernier par la tâche planifiée, dont un passage à l'instant même du
     * retour. L'Élevage de chacun, juste avant ce retour, puis une heure après.
     */
    it("le même Élevage, acquis au même instant, en direct, au rattrapage et par la tâche planifiée", async () => {
      const [enDirect, dUnBloc, parLaTache] = [await unCoupleAuRetour(), await unCoupleAuRetour(), await unCoupleAuRetour()];
      const vecu: Record<string, boolean[]> = { enDirect: [], dUnBloc: [], parLaTache: [] };
      const lire = async (cle: string, territoireId: number) => vecu[cle].push(await elevageAcquis(pool, territoireId, ESPECE));

      let instant = enDirect.t.ne;
      for (; instant < enDirect.retour; instant = apres(instant, 7 * MINUTE + 3_123)) await aLHeure(enDirect.t.territoireId, instant);
      await lire("enDirect", enDirect.t.territoireId);
      for (; instant < apres(enDirect.retour, HEURE); instant = apres(instant, 7 * MINUTE + 3_123)) await aLHeure(enDirect.t.territoireId, instant);
      await aLHeure(enDirect.t.territoireId, apres(enDirect.retour, HEURE));
      await lire("enDirect", enDirect.t.territoireId);

      await lire("dUnBloc", dUnBloc.t.territoireId);
      await aLHeure(dUnBloc.t.territoireId, apres(dUnBloc.retour, HEURE));
      await lire("dUnBloc", dUnBloc.t.territoireId);

      for (const [i, le] of [apres(parLaTache.retour, -10 * MINUTE), parLaTache.retour, apres(parLaTache.retour, HEURE)].entries()) {
        expect(await rattraperLesAbsents({ pool, maintenant: le, parmi: { territoire: [parLaTache.t.territoireId] } })).toMatchObject({ rattrapes: 1, echecs: 0 });
        if (i !== 1) await lire("parLaTache", parLaTache.t.territoireId);
      }

      expect(vecu).toEqual({ enDirect: [false, true], dUnBloc: [false, true], parLaTache: [false, true] });
      // Réuni, et l'Élevage acquis, à l'instant même du retour, pour les trois.
      for (const { t, retour } of [enDirect, dUnBloc, parLaTache]) {
        expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId: ESPECE, reuniLe: retour }]);
      }
    }, 60_000);
  });

  describe("il reste acquis même si toutes les Bêtes de l'Espèce dans l'effectif meurent", () => {
    it("plus aucune Bête de l'Espèce à proposer pour l'escorte, et l'Élevage toujours acquis, le temps passant", async () => {
      const { t, retour } = await unCoupleAuRetour(3);
      await aLHeure(t.territoireId, retour);
      expect(await proposee(t.territoireId)).toEqual({ disponibles: 2, coupleReuni: true });

      // Les combats (étape 41) n'existent pas encore : les deux femelles restées dans l'effectif y meurent ici, à la main.
      await pool.query("delete from effectif where territoire_id = $1 and espece_id = $2", [t.territoireId, ESPECE]);
      expect(await proposee(t.territoireId)).toBeNull();
      expect(await elevageAcquis(pool, t.territoireId, ESPECE)).toBe(true);

      // Une autre Expédition, sans escorte, rentre ; le temps passe encore.
      const encore = await partir(t.territoireId, apres(retour, HEURE), 0);
      await aLHeure(t.territoireId, apres(encore, JOUR));
      expect(await elevageAcquis(pool, t.territoireId, ESPECE)).toBe(true);
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([{ especeId: ESPECE, reuniLe: retour }]);
    });
  });

  describe("le sexe des Bêtes élevées ne comptera pas : seul le Couple importe", () => {
    it("acquis quel que soit le sexe des Bêtes qui entrent ensuite dans l'effectif, que l'écran d'Expédition ne dit plus", async () => {
      const { t, retour } = await unCoupleAuRetour();
      await aLHeure(t.territoireId, retour);

      // Comme y entreront les Bêtes élevées (étape 34) : trois mâles, puis deux femelles.
      await faireEntrerDansLEffectif(pool, t.territoireId, Array.from({ length: 3 }, () => ({ especeId: ESPECE, sexe: "male" as const })));
      expect(await elevageAcquis(pool, t.territoireId, ESPECE)).toBe(true);
      expect(await proposee(t.territoireId)).toEqual({ disponibles: 3, coupleReuni: true });
      await faireEntrerDansLEffectif(pool, t.territoireId, Array.from({ length: 2 }, () => ({ especeId: ESPECE, sexe: "femelle" as const })));
      expect(await elevageAcquis(pool, t.territoireId, ESPECE)).toBe(true);
      expect(await proposee(t.territoireId)).toEqual({ disponibles: 5, coupleReuni: true });
    });

    it("sans Couple, nul Élevage, si nombreuses que soient les Bêtes d'un seul sexe", async () => {
      const t = await naitre();
      await ajouter(t.territoireId, ESPECE, "male", 5);
      const retour = await partir(t.territoireId, t.ne);

      await aLHeure(t.territoireId, apres(retour, HEURE));
      expect(await couplesDuTerritoire(pool, t.territoireId)).toEqual([]);
      expect(await elevageAcquis(pool, t.territoireId, ESPECE)).toBe(false);
      expect(await proposee(t.territoireId)).toEqual({ disponibles: 5, coupleReuni: false });
    });
  });
});
