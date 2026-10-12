import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { type BeteSauvage, betesSauvagesDUneCase } from "@/monde/betes-sauvages";
import { type Coordonnees, distance } from "@/monde/hex";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { dureeDuTrajetMinutes } from "./allure";
import { lancerLExpedition } from "./depart";
import { expeditionsEnCours } from "./en-cours";
import { forceDUneBete } from "./force";
import { rencontresDUneExpedition } from "./rencontres";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai d'une Bête à la fois (US-0936)";

/** Une Espèce telle que l'essai la choisit pour une escorte : sa Rareté, sa vitesse et la force d'une de ses Bêtes (US-0905). */
type Espece = { id: string; rareteId: string; vitesse: number; force: number };

describe.skipIf(!URL_TEST)("une Bête à la fois (US-0936, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  /** Les Espèces du jeu, par identifiant ; la commune la plus faible, seule Bête des escortes de ce fichier. */
  let especes: Map<string, Espece>;
  let faible: Espece;
  const lancement = `une-bete-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les Cases déjà prises par un essai de ce fichier : chacun a la sienne, sans Expédition d'un autre. */
  const prises = new Set<number>();
  /** Une heure du jeu, `minutes` après `instant`. */
  const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);
  /** Une Bête commune suit toujours l'Expédition (US-0934). */
  const commune = (b: BeteSauvage) => b.rareteId === "commune";

  /**
   * Un chef qui vient de naître dans le Monde d'essai, avec un explorateur : son Territoire, l'instant de sa naissance,
   * d'où part son temps, et la place de son Foyer.
   */
  const naitre = async () => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Une", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query("insert into habitant (territoire_id, prenom, metier) values ($1, 'Essai', 'explorateur')", [territoireId]);
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
       order by c.q, c.r limit 1 offset $3`,
      [territoireId, ecart, rang],
    );
    return rows[0] ? { place: { q: rows[0].q, r: rows[0].r }, caseId: rows[0].id } : null;
  };
  /**
   * Un séjour de `sejour` minutes sur une Case libre à 2 à 6 Cases du Foyer du Territoire, qu'aucun autre essai n'a prise,
   * après `apresLe` : l'Expédition y arrive à `arriverA(b)`, b étant l'une des Bêtes de la Case, et `accepte` veut les
   * Bêtes présentes pendant le séjour, dans l'ordre de leurs apparitions. Le sort de chacune face à une escorte d'une Bête
   * de la commune la plus faible ne fait pas de doute : commune, elle la suit ; plus rare, elle est plus forte qu'elle et
   * reste. Sa Case, l'arrivée et ces Bêtes.
   */
  const unSejour = async (
    territoireId: number,
    apresLe: Date,
    sejour: number,
    arriverA: (b: BeteSauvage) => Date,
    accepte: (presentes: BeteSauvage[], arrivee: Date) => boolean,
  ) => {
    const fin = apres(apresLe, 30 * JOUR);
    for (let ecart = 2; ecart <= 6; ecart++) {
      for (let rang = 0, ici = await aLEcart(territoireId, ecart); ici; ici = await aLEcart(territoireId, ecart, ++rang)) {
        if (prises.has(ici.caseId)) continue;
        const betes = await betesSauvagesDUneCase(pool, ici.caseId, apresLe, fin);
        for (const arrivee of betes.map(arriverA)) {
          if (arrivee < apresLe || apres(arrivee, sejour) > fin) continue;
          const presentes = betes.filter((b) => b.depart > arrivee && b.arrivee < apres(arrivee, sejour));
          if (presentes.every((b) => commune(b) || especes.get(b.especeId)!.force > faible.force) && accepte(presentes, arrivee)) {
            prises.add(ici.caseId);
            return { ...ici, arrivee, betes: presentes };
          }
        }
      }
    }
    throw new Error("Aucun séjour tel que l'essai le veut.");
  };
  /**
   * Une Expédition du Territoire vers la Case `caseId`, telle qu'un départ la poserait en base, arrivée à `arrivee` pour
   * `sejourMinutes`, avec une Bête de la commune la plus faible pour escorte, sans souci de la portée ni de l'effectif.
   */
  const poser = async (territoireId: number, caseId: number, arrivee: Date, sejourMinutes: number) => {
    const { rows } = await pool.query<{ id: number }>(
      "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, 30, $4) returning id",
      [territoireId, caseId, apres(arrivee, -30), sejourMinutes],
    );
    await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, 1)", [rows[0].id, faible.id]);
    return rows[0].id;
  };
  /** Le Territoire mis à l'heure du jeu `instant`, comme à l'ouverture d'une page : le mécanisme unique du temps. */
  const rattraperA = (territoireId: number, instant: Date) => rattraper("territoire", territoireId, { pool, jusqua: instant });
  /** Ce que l'Expédition a vu, Rencontre par Rencontre, dans l'ordre où le jeu les donne : la Bête, l'instant, et si elle a suivi. */
  const vues = async (expeditionId: number) =>
    (await rencontresDUneExpedition(pool, expeditionId)).map((r) => ({ numero: r.numero, vueLe: r.vueLe, apprivoisee: r.apprivoisee }));
  /** Ce qu'on attend de la Rencontre de la Bête `b` par une Expédition arrivée à `arrivee` : vue dès que toutes deux sont là ; commune, elle suit. */
  const attendue = (b: BeteSauvage, arrivee: Date) => ({ numero: b.numero, vueLe: b.arrivee > arrivee ? b.arrivee : arrivee, apprivoisee: commune(b) });
  /** Les Bêtes parties de la Case `caseId` en suivant une Expédition (bete_partie), chacune à son instant. */
  const parties = async (caseId: number) =>
    (
      await pool.query<{ numero: string; partieLe: Date }>('select numero, partie_le as "partieLe" from bete_partie where case_id = $1 order by numero', [caseId])
    ).rows.map((p) => ({ numero: Number(p.numero), partieLe: p.partieLe }));

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    // Les Bêtes emmenées lors d'un lancement précédent de ce fichier sont revenues sur leur Case.
    await pool.query("delete from bete_partie p using case_du_monde c where c.id = p.case_id and c.monde_id = $1", [mondeId]);
    const { rows } = await pool.query<Omit<Espece, "force"> & { attaque: number; vie: number }>(
      `select id, rarete_id as "rareteId", vitesse, attaque, vie from espece order by id`,
    );
    especes = new Map(rows.map(({ attaque, vie, ...e }) => [e.id, { ...e, force: forceDUneBete({ attaque, vie }) }]));
    faible = [...especes.values()].filter((e) => e.rareteId === "commune").sort((x, y) => x.force - y.force)[0];
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.query("delete from bete_partie p using case_du_monde c where c.id = p.case_id and c.monde_id = $1", [mondeId]);
    await pool.end();
  });

  it("un Apprivoisement n'amène qu'une seule Bête : de deux Bêtes déjà là à l'arrivée, chacune est sa Rencontre, et la commune suit seule", async () => {
    const { territoireId, ne } = await naitre();
    // L'escorte arrive une demi-heure après la seconde Bête, une commune, quand la première, plus forte qu'elle, est encore
    // là, et reste une heure : rien d'autre ne se montre.
    const { caseId, arrivee, betes } = await unSejour(
      territoireId,
      apres(ne, 3 * JOUR),
      HEURE,
      (b) => apres(b.arrivee, 30),
      (presentes, a) => presentes.length === 2 && presentes.every((b) => b.arrivee < a) && !commune(presentes[0]) && commune(presentes[1]),
    );
    const [plusForte, laCommune] = betes;
    const id = await poser(territoireId, caseId, arrivee, HEURE);

    await rattraperA(territoireId, apres(arrivee, JOUR));
    expect(await vues(id)).toEqual([
      { numero: plusForte.numero, vueLe: arrivee, apprivoisee: false },
      { numero: laCommune.numero, vueLe: arrivee, apprivoisee: true },
    ]);
    // La commune seule a quitté la Case ; l'autre y reste jusqu'à la fin de sa durée.
    expect(await parties(caseId)).toEqual([{ numero: laCommune.numero, partieLe: arrivee }]);
    expect((await betesSauvagesDUneCase(pool, caseId, arrivee, apres(arrivee, 1))).map((b) => ({ numero: b.numero, depart: b.depart }))).toEqual([
      { numero: plusForte.numero, depart: plusForte.depart },
    ]);
  });

  /**
   * Un séjour d'un jour où au moins trois Bêtes se montrent, toutes après l'arrivée de l'escorte : d'abord une ou plusieurs
   * plus fortes qu'elle, puis des communes. `rattrapage` met le Territoire à l'heure, de `de` à `a`. Rend ce que l'Expédition
   * a vu et les Bêtes parties de la Case (vues), à côté de ce qu'on en attend (attendues).
   */
  const plusieursBetes = async (rattrapage: (territoireId: number, de: Date, a: Date) => Promise<void>) => {
    const { territoireId, ne } = await naitre();
    const { caseId, arrivee, betes } = await unSejour(
      territoireId,
      apres(ne, 3 * JOUR),
      JOUR,
      (b) => apres(b.arrivee, -HEURE),
      (presentes, a) =>
        presentes.length >= 3 &&
        presentes.every((b) => b.arrivee >= a) &&
        !commune(presentes[0]) &&
        presentes.filter(commune).length >= 2 &&
        presentes.findLastIndex((b) => !commune(b)) < presentes.findIndex(commune),
    );
    const id = await poser(territoireId, caseId, arrivee, JOUR);
    await rattrapage(territoireId, apres(arrivee, -HEURE), apres(arrivee, JOUR + HEURE));
    return {
      vues: { rencontres: await vues(id), parties: await parties(caseId) },
      attendues: {
        rencontres: betes.map((b) => attendue(b, arrivee)),
        parties: betes.filter(commune).map((b) => ({ numero: b.numero, partieLe: b.arrivee })),
      },
    };
  };

  it("plusieurs Bêtes se montrent pendant un même séjour : chaque Rencontre est jugée à part, dans l'ordre des apparitions", async () => {
    const { vues: vu, attendues } = await plusieursBetes(async (territoireId, _de, a) => {
      await rattraperA(territoireId, a);
    });
    expect(vu).toEqual(attendues);
  });

  it("les mêmes Rencontres, jugées de même, quand le Territoire est rattrapé par tranches pendant le séjour", async () => {
    const { vues: vu, attendues } = await plusieursBetes(async (territoireId, de, a) => {
      // Des tranches de 25 minutes : chaque apparition tombe au milieu de l'une d'elles.
      for (let instant = de; instant < a; instant = apres(instant, 25)) await rattraperA(territoireId, instant);
      await rattraperA(territoireId, a);
    });
    expect(vu).toEqual(attendues);
  }, 60_000);

  it("après un Apprivoisement, l'Expédition poursuit son séjour jusqu'à son terme et en apprivoise d'autres, une par Rencontre", async () => {
    const { territoireId, ne, foyer } = await naitre();
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 1)", [territoireId, faible.id]);
    // Un séjour d'un jour où se montrent au moins deux communes, toutes après l'arrivée de l'escorte.
    const { place, caseId, arrivee, betes } = await unSejour(
      territoireId,
      apres(ne, 3 * JOUR),
      JOUR,
      (b) => apres(b.arrivee, -HEURE),
      (presentes, a) => presentes.length >= 2 && presentes.every((b) => b.arrivee >= a && commune(b)),
    );
    const aller = dureeDuTrajetMinutes(distance(foyer, place), [{ vitesse: faible.vitesse, nombre: 1 }]);
    const depart = apres(arrivee, -aller);
    const lancee = await lancerLExpedition(pool, territoireId, { destination: place, explorateurs: 1, escorte: new Map([[faible.id, 1]]), sejourMinutes: JOUR }, depart);
    if (!("expeditionId" in lancee)) throw new Error(lancee.refus);
    const id = lancee.expeditionId;
    const [premiere, ...suivantes] = betes;

    // Juste après le premier Apprivoisement, l'Expédition est toujours en séjour sur sa Case.
    const ensuite = apres(premiere.arrivee, 1);
    await rattraperA(territoireId, ensuite);
    expect(await vues(id)).toEqual([attendue(premiere, arrivee)]);
    expect((await expeditionsEnCours(pool, territoireId, ensuite)).map((x) => ({ id: x.id, phase: x.phase }))).toEqual([{ id, phase: "sejour" }]);

    // Rentrée au Foyer à l'heure prévue au départ, chaque commune venue ensuite l'a suivie, une par Rencontre.
    const retour = apres(depart, 2 * aller + JOUR);
    await rattraperA(territoireId, apres(retour, HEURE));
    const { rows } = await pool.query<{ rentreeLe: Date | null }>('select rentree_le as "rentreeLe" from expedition where id = $1', [id]);
    expect(rows[0].rentreeLe).toEqual(retour);
    expect(await vues(id)).toEqual(betes.map((b) => attendue(b, arrivee)));
    expect(suivantes.length).toBeGreaterThanOrEqual(1);
    expect(await parties(caseId)).toEqual(betes.map((b) => ({ numero: b.numero, partieLe: b.arrivee })));
  });
});
