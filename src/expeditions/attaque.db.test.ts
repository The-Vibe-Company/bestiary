// US-0943 : la Bête trop forte, restée sur sa Case (US-0942), peut attaquer l'Expédition qui la voit tant que toutes deux y
// sont, à l'heure que disent ses tirages : la même page ouverte, au retour du joueur ou par la tâche planifiée, une seule
// fois ; jamais après le rappel de l'Expédition, ni après avoir suivi une autre Expédition ; celle qui n'attaque pas laisse
// l'Expédition finir son séjour normalement. Le combat (US-0944) et la fuite (US-0945) viendront ensuite.
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { hasardsDeLAttaqueDUneBeteDeNaissance } from "@/monde/betes-de-naissance";
import { type BeteSauvage, betesSauvagesDUneCase, hasardsDeLAttaque } from "@/monde/betes-sauvages";
import { type Coordonnees, distance } from "@/monde/hex";
import { PRESENCE_D_UNE_BETE_HEURES, RATTRAPER_APRES_MINUTES } from "@/reglages";
import { rattraperLesAbsents } from "@/temps/absents";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { dureeDuTrajetMinutes } from "./allure";
import { chanceDAttaqueParHeure, instantDeLAttaque, type Regime } from "./attaque";
import { lancerLExpedition } from "./depart";
import { forceDUneBete } from "./force";
import { type HorairesDUneExpedition, retourDUneExpedition } from "./phase";
import { rappelerLExpedition } from "./rappel";
import { attaquesSubies, rencontresDUneExpedition } from "./rencontres";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;
/** Le temps, en minutes, où aucune autre Bête n'apparaît avant ou après celle d'un essai : sa présence et 6 heures de marge. */
const CALME = PRESENCE_D_UNE_BETE_HEURES * HEURE + 6 * HEURE;
/** Le séjour d'une Expédition arrivée une heure après la Bête et repartie une heure avant elle. */
const SEJOUR = (PRESENCE_D_UNE_BETE_HEURES - 2) * HEURE;
/**
 * Au plus tant d'Expéditions lancées vers une même Bête pour trouver celles qu'un essai demande : avec un herbivore, à 5 %
 * par heure, 40 manquaient encore une fois sur vingt-cinq à l'essai d'un séjour repris au bout de deux heures.
 */
const LANCEES_AU_PLUS = 100;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de l'attaque de la Bête trop forte (US-0943)";

/** Une Espèce telle que l'essai la voit : sa vitesse, la force d'une de ses Bêtes (US-0905) et son régime. */
type Espece = { id: string; rareteId: string; vitesse: number; force: number; regime: Regime };
/** Une Expédition de l'essai : son identifiant, et son séjour sur la Case, de son arrivée à son départ (exclu). */
type Expedition = { id: number; arrivee: Date; depart: Date };
/** Un chef né près d'une Bête rare seule : son Territoire, sa naissance, son Foyer, la Case de la Bête et la Bête. */
type Chef = { territoireId: number; ne: Date; foyer: Coordonnees; place: Coordonnees; caseId: number; bete: BeteSauvage };

describe.skipIf(!URL_TEST)("la Bête trop forte peut attaquer (US-0943, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  let graine: number;
  /** Les Espèces du jeu, par identifiant ; la Souris grise, commune de force 473 (US-0905), escorte trop faible des essais. */
  let especes: Map<string, Espece>;
  let faible: Espece;
  const lancement = `attaque-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les Cases déjà prises par un essai de ce fichier : chacun a la sienne, sans Expédition d'un autre. */
  const prises = new Set<number>();
  /** Une heure du jeu, `minutes` après `instant`. */
  const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);

  /**
   * Un chef qui vient de naître dans le Monde d'essai, avec LANCEES_AU_PLUS explorateurs et deux Souris grises pour chacun :
   * son Territoire, l'instant de sa naissance et la place de son Foyer.
   */
  const naitre = async () => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Assaut", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query("insert into habitant (territoire_id, prenom, metier) select $1, 'Essai', 'explorateur' from generate_series(1, $2)", [
      territoireId,
      LANCEES_AU_PLUS,
    ]);
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', $3)", [territoireId, faible.id, 2 * LANCEES_AU_PLUS]);
    const { rows } = await pool.query<{ foyer: Coordonnees }>(
      "select json_build_object('q', f.q, 'r', f.r) as foyer from territoire t join case_du_monde f on f.id = t.foyer_case_id where t.id = $1",
      [territoireId],
    );
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId), foyer: rows[0].foyer };
  };
  /** La `rang`-ième Case libre du Monde du Territoire à `ecart` Cases de son Foyer : sa place et son identifiant ; null au-delà de la dernière. */
  const aLEcart = async (territoireId: number, ecart: number, rang = 0) => {
    const { rows } = await pool.query<Coordonnees & { id: number }>(
      `select c.id, c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = $2
         and not exists (select 1 from bete_de_naissance n where n.territoire_id = t.id and n.case_id = c.id)
       order by c.q, c.r limit 1 offset $3`,
      [territoireId, ecart, rang],
    );
    return rows[0] ? { place: { q: rows[0].q, r: rows[0].r }, caseId: rows[0].id } : null;
  };
  /**
   * Une Bête sauvage plus rare que commune, seule, sur une Case libre à 2 à 6 Cases du Foyer du Territoire qu'aucun autre
   * essai n'a prise, apparue dans les 30 jours après `apresLe` : aucune autre n'apparaît sur sa Case de CALME minutes avant
   * elle à CALME minutes après. Sa Case et la Bête ; null si le Foyer n'en a aucune autour de lui.
   */
  const uneBeteRareSeule = async (territoireId: number, apresLe: Date) => {
    const fin = apres(apresLe, 30 * JOUR);
    for (let ecart = 2; ecart <= 6; ecart++) {
      for (let rang = 0, ici = await aLEcart(territoireId, ecart); ici; ici = await aLEcart(territoireId, ecart, ++rang)) {
        if (prises.has(ici.caseId)) continue;
        const betes = await betesSauvagesDUneCase(pool, ici.caseId, apresLe, fin);
        const bete = betes.find(
          (b, i) =>
            b.rareteId !== "commune" &&
            b.arrivee >= apres(apresLe, CALME) &&
            b.arrivee <= apres(fin, -CALME) &&
            (i === 0 || betes[i - 1].arrivee <= apres(b.arrivee, -CALME)) &&
            (i === betes.length - 1 || betes[i + 1].arrivee >= apres(b.arrivee, CALME)),
        );
        if (bete) {
          prises.add(ici.caseId);
          return { ...ici, bete };
        }
      }
    }
    return null;
  };
  /** Un chef né là où une Bête rare se montre seule autour de son Foyer : s'il n'y en a aucune, il renaît ailleurs, jusqu'à trois fois. */
  const naitrePresDUneBeteRare = async (): Promise<Chef> => {
    for (let essai = 0; essai < 3; essai++) {
      const chef = await naitre();
      const ici = await uneBeteRareSeule(chef.territoireId, apres(chef.ne, 3 * JOUR));
      if (ici) return { ...chef, ...ici };
    }
    throw new Error("Aucune Bête rare seule autour de trois Foyers.");
  };

  /**
   * L'instant où, d'après ses tirages, la Bête du chef attaquerait l'Expédition `x` si elles restaient ensemble sur la Case
   * de leur Rencontre jusqu'à `fin` ; null si elle ne l'attaquerait pas.
   */
  const attaqueTiree = ({ bete, place }: Chef, x: Expedition, fin: Date) =>
    instantDeLAttaque(
      { debut: new Date(Math.max(bete.arrivee.getTime(), x.arrivee.getTime())), fin },
      chanceDAttaqueParHeure(especes.get(bete.especeId)!.regime),
      (heure) => hasardsDeLAttaque({ graine, ...place }, bete.numero, x.id, heure),
    );
  /**
   * L'instant où, d'après ses tirages, la Bête du chef attaque l'Expédition `x`, ensemble sur la Case de leur Rencontre
   * jusqu'au départ de l'une ou l'autre, ou jusqu'à `fin` ; null si elle ne l'attaque pas.
   */
  const attaquePromise = (chef: Chef, x: Expedition, fin = x.depart) =>
    attaqueTiree(chef, x, new Date(Math.min(chef.bete.depart.getTime(), x.depart.getTime(), fin.getTime())));
  /**
   * Des Expéditions du chef, chacune d'un explorateur et de deux Souris grises, trop faibles pour sa Bête, lancées depuis
   * le Foyer pour arriver une heure après la Bête et repartir une heure avant elle, l'une après l'autre jusqu'à ce que
   * `assez` dise qu'il y en a assez, d'après l'attaque que leurs tirages leur promettent.
   */
  const lancerJusqua = async (chef: Chef, assez: (lancees: (Expedition & { promise: Date | null })[]) => boolean) => {
    const aller = dureeDuTrajetMinutes(distance(chef.foyer, chef.place), [{ vitesse: faible.vitesse, nombre: 2 }]);
    const arrivee = apres(chef.bete.arrivee, HEURE);
    const lancees: (Expedition & HorairesDUneExpedition & { promise: Date | null })[] = [];
    while (!assez(lancees)) {
      if (lancees.length === LANCEES_AU_PLUS) throw new Error(`${LANCEES_AU_PLUS} Expéditions lancées sans trouver celles qu'il faut.`);
      const partLe = apres(arrivee, -aller);
      const lancee = await lancerLExpedition(
        pool,
        chef.territoireId,
        { destination: chef.place, explorateurs: 1, escorte: new Map([[faible.id, 2]]), sejourMinutes: SEJOUR },
        partLe,
      );
      if (!("expeditionId" in lancee)) throw new Error(lancee.refus);
      const x = { id: lancee.expeditionId, arrivee, depart: apres(arrivee, SEJOUR) };
      lancees.push({ ...x, promise: attaquePromise(chef, x), partLe, trajetMinutes: aller, sejourMinutes: SEJOUR });
    }
    return lancees;
  };
  /**
   * Une Expédition du Territoire vers la Case `caseId`, telle qu'un départ la poserait en base, arrivée à `arrivee` pour
   * `sejourMinutes`, avec `nombre` Bêtes de l'Espèce `espece` en escorte, sans souci de la portée, des explorateurs ni de
   * l'effectif.
   */
  const poser = async (territoireId: number, caseId: number, arrivee: Date, sejourMinutes: number, espece: Espece, nombre: number): Promise<Expedition> => {
    const { rows } = await pool.query<{ id: number }>(
      "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, 30, $4) returning id",
      [territoireId, caseId, apres(arrivee, -30), sejourMinutes],
    );
    await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, $3)", [rows[0].id, espece.id, nombre]);
    return { id: rows[0].id, arrivee, depart: apres(arrivee, sejourMinutes) };
  };
  /** Le Territoire mis à l'heure du jeu `instant`, comme à l'ouverture d'une page : le mécanisme unique du temps. */
  const rattraperA = (territoireId: number, instant: Date) => rattraper("territoire", territoireId, { pool, jusqua: instant });
  /** Les attaques qu'a subies l'Expédition, telles que le combat (US-0944) les lira : l'instant et l'Espèce de la Bête. */
  const attaques = async (expeditionId: number) => (await attaquesSubies(pool, expeditionId)).map(({ le, especeId }) => ({ le, especeId }));
  /** L'attaque qu'attend l'essai : à l'instant `le`, de la Bête du chef ; aucune sans instant. */
  const attendue = ({ bete }: Chef, le: Date | null) => (le ? [{ le, especeId: bete.especeId }] : []);
  /** L'instant du jeu où l'Expédition est rentrée au Foyer, ou null. */
  const rentreeLe = async (expeditionId: number) =>
    (await pool.query<{ rentreeLe: Date | null }>(`select rentree_le as "rentreeLe" from expedition where id = $1`, [expeditionId])).rows[0].rentreeLe;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    graine = Number((await pool.query<{ graine: string }>("select graine from monde where id = $1", [mondeId])).rows[0].graine);
    // Les Bêtes emmenées lors d'un lancement précédent de ce fichier sont revenues sur leur Case.
    await pool.query("delete from bete_partie p using case_du_monde c where c.id = p.case_id and c.monde_id = $1", [mondeId]);
    const { rows } = await pool.query<Omit<Espece, "force"> & { attaque: number; vie: number }>(
      `select id, rarete_id as "rareteId", vitesse, attaque, vie, regime from espece order by id`,
    );
    especes = new Map(rows.map(({ attaque, vie, ...e }) => [e.id, { ...e, force: forceDUneBete({ attaque, vie }) }]));
    faible = especes.get("souris")!;
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.query("delete from bete_partie p using case_du_monde c where c.id = p.case_id and c.monde_id = $1", [mondeId]);
    await pool.end();
  });

  /**
   * Les manières de vivre le temps : page ouverte toutes les dix minutes, et juste à l'instant de chaque attaque ; d'un
   * bloc, au retour du joueur ; ou par la seule tâche planifiée, qui passe toutes les heures (vercel.json).
   */
  const MANIERES = {
    "page ouverte": async (territoireId: number, de: Date, a: Date, instants: Date[]) => {
      const pas = new Set<number>([...instants.flatMap((t) => [t.getTime(), t.getTime() + 1])]);
      for (let t = de.getTime(); t < a.getTime(); t += 10 * MINUTE_MS) pas.add(t);
      for (const t of [...pas, a.getTime()].sort((x, y) => x - y)) await rattraperA(territoireId, new Date(t));
    },
    "d'un bloc": async (territoireId: number, _de: Date, a: Date) => {
      await rattraperA(territoireId, a);
    },
    "par la tâche planifiée": async (territoireId: number, de: Date, a: Date) => {
      for (let t = de.getTime(); t <= a.getTime() + (HEURE + RATTRAPER_APRES_MINUTES) * MINUTE_MS; t += HEURE * MINUTE_MS) {
        await rattraperLesAbsents({ pool, maintenant: new Date(t), parmi: { territoire: [territoireId] } });
      }
    },
  };

  it.each(Object.keys(MANIERES) as (keyof typeof MANIERES)[])(
    "trop forte, la Bête attaque l'Expédition à l'heure que disent ses tirages, une seule fois ; épargnée, l'Expédition finit son séjour : %s",
    async (maniere) => {
      const chef = await naitrePresDUneBeteRare();
      expect(2 * faible.force).toBeLessThan(especes.get(chef.bete.especeId)!.force);
      // Assez d'Expéditions pour que l'une soit attaquée, et une autre épargnée.
      const lancees = await lancerJusqua(chef, (xs) => xs.some((x) => x.promise) && xs.some((x) => !x.promise));
      const retours = lancees.map((x) => retourDUneExpedition(x)!);
      const fin = apres(new Date(Math.max(...retours.map((r) => r.getTime()))), HEURE);

      await rattraperA(chef.territoireId, lancees[0].partLe);
      await MANIERES[maniere](
        chef.territoireId,
        lancees[0].partLe,
        fin,
        lancees.flatMap((x) => (x.promise ? [x.promise] : [])),
      );
      for (const [i, x] of lancees.entries()) {
        expect({ x: x.id, attaques: await attaques(x.id) }).toEqual({ x: x.id, attaques: attendue(chef, x.promise) });
        // Vue sans la suivre, la Bête trop forte reste sur sa Case (US-0942), attaque ou non.
        expect((await rencontresDUneExpedition(pool, x.id)).map((r) => r.apprivoisee)).toEqual([false]);
        if (!x.promise) expect(await rentreeLe(x.id)).toEqual(retours[i]);
      }
    },
    60_000,
  );

  it("rappelée avant que la Bête l'attaque, l'Expédition n'est plus attaquée ; rappelée après, l'attaque reste", async () => {
    const chef = await naitrePresDUneBeteRare();
    // Deux Expéditions attaquées : la première l'est, la seconde l'aurait été plus de deux minutes après, et plus d'une
    // minute après son arrivée.
    const lesDeux = (xs: (Expedition & { promise: Date | null })[]) => {
      const attaquees = xs.filter((x) => x.promise).sort((x, y) => x.promise!.getTime() - y.promise!.getTime());
      const seconde = attaquees.find((x) => x.promise!.getTime() - attaquees[0].promise!.getTime() > 2 * MINUTE_MS && apres(x.promise!, -1) > x.arrivee);
      return seconde ? [attaquees[0], seconde] : null;
    };
    const [premiere, seconde] = lesDeux(await lancerJusqua(chef, (xs) => lesDeux(xs) !== null))!;

    // La première, rappelée une minute après son attaque ; la seconde, une minute avant la sienne.
    await rattraperA(chef.territoireId, apres(premiere.promise!, 1));
    expect(await rappelerLExpedition(pool, chef.territoireId, premiere.id, apres(premiere.promise!, 1))).toEqual({ rappeleeLe: apres(premiere.promise!, 1) });
    await rattraperA(chef.territoireId, apres(seconde.promise!, -1));
    expect(await rappelerLExpedition(pool, chef.territoireId, seconde.id, apres(seconde.promise!, -1))).toEqual({ rappeleeLe: apres(seconde.promise!, -1) });
    await rattraperA(chef.territoireId, apres(chef.bete.depart, JOUR));

    expect(await attaques(premiere.id)).toEqual(attendue(chef, premiere.promise));
    expect(await attaques(seconde.id)).toEqual([]);
  }, 60_000);

  it("repartie au bout de son séjour, l'Expédition n'est plus attaquée ; repartie au bout de sa durée, la Bête n'attaque plus", async () => {
    const chef = await naitrePresDUneBeteRare();
    const { territoireId, caseId, bete } = chef;
    const arrivee = apres(bete.arrivee, HEURE);
    // Une Expédition repartie deux heures après son arrivée, que la Bête aurait attaquée ensuite si elle était restée ; une
    // autre restée huit heures, qu'elle aurait attaquée après son propre départ si elle était restée, elle.
    const plusTard = (instant: Date | null, que: Date) => instant !== null && instant >= que;
    let [courte, longue] = [null as Expedition | null, null as Expedition | null];
    for (let posees = 0; !courte || !longue; posees++) {
      if (posees === LANCEES_AU_PLUS) throw new Error(`${LANCEES_AU_PLUS} Expéditions posées sans trouver celles qu'il faut.`);
      const x = await poser(territoireId, caseId, arrivee, courte ? 8 * HEURE : 2 * HEURE, faible, 2);
      if (!courte && plusTard(attaqueTiree(chef, x, bete.depart), x.depart)) courte = x;
      if (courte && x !== courte && plusTard(attaqueTiree(chef, x, x.depart), bete.depart)) longue = x;
    }

    await rattraperA(territoireId, apres(bete.depart, JOUR));
    expect(await attaques(courte.id)).toEqual([]);
    expect(await attaques(longue.id)).toEqual([]);
  }, 60_000);

  it("partie avec une Expédition assez forte arrivée après, la Bête n'attaque plus celle qu'elle n'a pas suivie, ni celle qu'elle suit, ni celle arrivée en même temps", async () => {
    const chef = await naitrePresDUneBeteRare();
    const { territoireId, caseId, bete } = chef;
    // L'Expédition forte arrive deux heures après la Bête : elle la suit dès son arrivée.
    const arriveeDeLaForte = apres(bete.arrivee, 2 * HEURE);
    // Des Expéditions trop faibles, arrivées une heure après la Bête, jusqu'à ce que l'une ait une attaque promise après le
    // départ de la Bête avec la forte.
    const faibles: (Expedition & { promise: Date | null })[] = [];
    while (!faibles.some((x) => x.promise && x.promise >= arriveeDeLaForte)) {
      if (faibles.length === LANCEES_AU_PLUS) throw new Error(`${LANCEES_AU_PLUS} Expéditions posées sans attaque promise après la forte.`);
      const x = await poser(territoireId, caseId, apres(bete.arrivee, HEURE), SEJOUR, faible, 2);
      faibles.push({ ...x, promise: attaquePromise(chef, x) });
    }
    const forte = await poser(territoireId, caseId, arriveeDeLaForte, HEURE, faible, Math.ceil(especes.get(bete.especeId)!.force / faible.force));
    // Une Expédition trop faible arrivée au même instant que la forte voit encore la Bête (US-0962), sans plus de temps pour
    // être attaquée.
    const simultanee = await poser(territoireId, caseId, arriveeDeLaForte, SEJOUR, faible, 2);

    await rattraperA(territoireId, apres(bete.depart, JOUR));
    expect((await rencontresDUneExpedition(pool, forte.id)).map((r) => [r.apprivoisee, r.vueLe])).toEqual([[true, arriveeDeLaForte]]);
    expect(await attaques(forte.id)).toEqual([]);
    expect((await rencontresDUneExpedition(pool, simultanee.id)).map((r) => [r.apprivoisee, r.vueLe])).toEqual([[false, arriveeDeLaForte]]);
    expect(await attaques(simultanee.id)).toEqual([]);
    for (const x of faibles) {
      const avantLeDepart = attaquePromise(chef, x, arriveeDeLaForte);
      expect({ x: x.id, attaques: await attaques(x.id) }).toEqual({ x: x.id, attaques: attendue(chef, avantLeDepart) });
    }
  }, 60_000);

  it("trop forte, une Bête de naissance attaque de même l'Expédition de son Territoire, à l'heure que disent ses tirages, une seule fois", async () => {
    // Toujours communes, les Bêtes de naissance sont aujourd'hui toujours à portée : l'essai en pose une plus rare, sur une
    // Case libre où aucune Bête sauvage ordinaire ne se montre pendant sa présence.
    const chef = await naitre();
    const rare = [...especes.values()].find((e) => e.rareteId !== "commune" && e.force > 2 * faible.force)!;
    const arrivee = apres(chef.ne, 3 * JOUR);
    const depart = apres(arrivee, PRESENCE_D_UNE_BETE_HEURES * HEURE);
    let ici: { caseId: number } | null = null;
    for (let ecart = 2; !ici && ecart <= 6; ecart++) {
      for (let rang = 0, c = await aLEcart(chef.territoireId, ecart); c && !ici; c = await aLEcart(chef.territoireId, ecart, ++rang)) {
        if (!prises.has(c.caseId) && (await betesSauvagesDUneCase(pool, c.caseId, apres(arrivee, -HEURE), apres(depart, HEURE))).length === 0) ici = c;
      }
    }
    if (!ici) throw new Error("Aucune Case calme autour du Foyer.");
    prises.add(ici.caseId);
    const { rows } = await pool.query<{ id: number }>(
      "insert into bete_de_naissance (territoire_id, case_id, espece_id, arrivee, depart) values ($1, $2, $3, $4, $5) returning id",
      [chef.territoireId, ici.caseId, rare.id, arrivee, depart],
    );
    const beteId = rows[0].id;
    // Des Expéditions trop faibles, arrivées une heure après elle et reparties une heure avant, jusqu'à en avoir une attaquée
    // et une épargnée.
    const posees: (Expedition & { promise: Date | null })[] = [];
    while (!posees.some((x) => x.promise) || !posees.some((x) => !x.promise)) {
      if (posees.length === LANCEES_AU_PLUS) throw new Error(`${LANCEES_AU_PLUS} Expéditions posées sans trouver celles qu'il faut.`);
      const x = await poser(chef.territoireId, ici.caseId, apres(arrivee, HEURE), SEJOUR, faible, 2);
      const promise = instantDeLAttaque({ debut: x.arrivee, fin: x.depart }, chanceDAttaqueParHeure(rare.regime), (heure) =>
        hasardsDeLAttaqueDUneBeteDeNaissance(graine, beteId, x.id, heure),
      );
      posees.push({ ...x, promise });
    }

    await MANIERES["page ouverte"](
      chef.territoireId,
      apres(arrivee, -HEURE),
      apres(depart, HEURE),
      posees.flatMap((x) => (x.promise ? [x.promise] : [])),
    );
    for (const x of posees) {
      expect({ x: x.id, attaques: await attaques(x.id) }).toEqual({ x: x.id, attaques: x.promise ? [{ le: x.promise, especeId: rare.id }] : [] });
      const { rows: vues } = await pool.query(
        `select numero, bete_de_naissance_id as "beteDeNaissanceId", apprivoisee from rencontre where expedition_id = $1`,
        [x.id],
      );
      expect(vues).toEqual([{ numero: null, beteDeNaissanceId: beteId, apprivoisee: false }]);
    }
  }, 60_000);
});
