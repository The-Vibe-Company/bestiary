import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bestiaireDuTerritoire } from "@/bestiaire/bestiaire";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { betesDeNaissancePresentes } from "@/monde/betes-de-naissance";
import { type BeteSauvage, betesSauvagesDUneCase } from "@/monde/betes-sauvages";
import { type Coordonnees, distance } from "@/monde/hex";
import { PRESENCE_D_UNE_BETE_HEURES } from "@/reglages";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, poolDeTest, preparerMondeDeTest, territoireDuCompte, URL_TEST } from "@/test/base";
import { dureeDuTrajetMinutes } from "./allure";
import { lancerLExpedition } from "./depart";
import { forceDUneBete } from "./force";
import { rencontresDUneExpedition } from "./rencontres";
import { betesQuiSuivent } from "./sexe";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;
/** Le temps, en minutes, où aucune autre Bête n'apparaît avant ou après celle d'un essai : sa présence et 6 heures de marge. */
const CALME = PRESENCE_D_UNE_BETE_HEURES * HEURE + 6 * HEURE;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de l'Apprivoisement (US-0934)";

/** Une Espèce telle que l'essai la choisit pour une escorte : sa Rareté, sa vitesse et la force d'une de ses Bêtes (US-0905). */
type Espece = { id: string; rareteId: string; vitesse: number; force: number };

describe.skipIf(!URL_TEST)("la Bête à portée suit l'Expédition (US-0934, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  /** Les Espèces du jeu, par identifiant ; la plus forte de toutes, et la commune la plus faible. */
  let especes: Map<string, Espece>;
  let [forte, faible]: Espece[] = [];
  const lancement = `apprivoisement-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let numero = 0;
  /** Les Cases déjà prises par un essai de ce fichier : chacun a la sienne, sans Expédition d'un autre. */
  const prises = new Set<number>();
  /** Une heure du jeu, `minutes` après `instant`. */
  const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);

  /**
   * Un chef qui vient de naître dans le Monde d'essai, avec `explorateurs` explorateurs : son Territoire, l'instant de sa
   * naissance, d'où part son temps, et la place de son Foyer.
   */
  const naitre = async (explorateurs = 1) => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = `Appr${lancement.slice(-5).replace(/[^a-z]/g, "x")}${"abcdefghij"[Math.floor(n / 10) % 10]}${"abcdefghij"[n % 10]}`;
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query(`insert into habitant (territoire_id, prenom, metier) select $1, 'Essai', 'explorateur' from generate_series(1, $2)`, [territoireId, explorateurs]);
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
   * Une Bête sauvage seule, telle que `accepte` la veut, sur une Case libre à 2 à 6 Cases du Foyer du Territoire qu'aucun
   * autre essai n'a prise, apparue après `apresLe` : aucune autre n'apparaît sur sa Case de CALME heures avant elle à CALME
   * heures après, et aucune n'y est donc de 6 heures avant son apparition à 6 heures après son départ. Sa Case et la Bête.
   */
  const uneBeteSeule = async (territoireId: number, apresLe: Date, accepte: (b: BeteSauvage) => boolean) => {
    const fin = apres(apresLe, 30 * JOUR);
    for (let ecart = 2; ecart <= 6; ecart++) {
      for (let rang = 0, ici = await aLEcart(territoireId, ecart); ici; ici = await aLEcart(territoireId, ecart, ++rang)) {
        if (prises.has(ici.caseId)) continue;
        const betes = await betesSauvagesDUneCase(pool, ici.caseId, apresLe, fin);
        const bete = betes.find(
          (b, i) =>
            accepte(b) &&
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
    throw new Error("Aucune Bête seule telle que l'essai la veut.");
  };
  /** Une Bête plus rare que commune : plus forte que la commune la plus faible. */
  const rare = (b: BeteSauvage) => b.rareteId !== "commune";
  /**
   * Une Expédition du Territoire vers la Case `caseId`, telle qu'un départ la poserait en base, avec les horaires et
   * l'escorte (Espèce par Espèce, le nombre de Bêtes) donnés, sans souci de la portée, des explorateurs ni de l'effectif :
   * pour mettre sur une même Case des Expéditions de Territoires éloignés.
   */
  const poser = async (territoireId: number, caseId: number, arrivee: Date, sejourMinutes: number, escorte: [Espece, number][] = []) => {
    const { rows } = await pool.query<{ id: number }>(
      "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, 30, $4) returning id",
      [territoireId, caseId, apres(arrivee, -30), sejourMinutes],
    );
    for (const [espece, nombre] of escorte) {
      await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, $3)", [rows[0].id, espece.id, nombre]);
    }
    return rows[0].id;
  };
  /** Le Territoire mis à l'heure du jeu `instant`, comme à l'ouverture d'une page : le mécanisme unique du temps. */
  const rattraperA = (territoireId: number, instant: Date) => rattraper("territoire", territoireId, { pool, jusqua: instant });
  /**
   * Les Rencontres retenues de l'Expédition, sans leur identifiant ni ce que le Bestiaire en dit (US-0933,
   * src/bestiaire/bestiaire.db.test.ts) : toEqual ne compte pas une propriété indéfinie.
   */
  const rencontres = async (expeditionId: number) =>
    (await rencontresDUneExpedition(pool, expeditionId)).map((r) => ({ ...r, id: undefined, nouvelleEspece: undefined }));
  /** Ce que retient la Rencontre de la Bête sauvage `b` de la Case `caseId`, vue à `vueLe`, et si elle suit l'Expédition. */
  const vue = (b: BeteSauvage, caseId: number, vueLe: Date, apprivoisee: boolean) => ({
    vueLe,
    caseId,
    apparueLe: b.arrivee,
    especeId: b.especeId,
    rareteId: b.rareteId,
    numero: b.numero,
    beteDeNaissanceId: null,
    apprivoisee,
  });
  /** L'instant où la Bête `numero` de la Case `caseId` en est partie en suivant une Expédition (bete_partie), null si elle y est restée. */
  const partieLe = async (caseId: number, numero: number) =>
    (await pool.query<{ partieLe: Date }>('select partie_le as "partieLe" from bete_partie where case_id = $1 and numero = $2', [caseId, numero])).rows[0]?.partieLe ?? null;

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
    const parForce = [...especes.values()].sort((x, y) => x.force - y.force);
    forte = parForce.at(-1)!;
    faible = parForce.find((e) => e.rareteId === "commune")!;
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.query("delete from bete_partie p using case_du_monde c where c.id = p.case_id and c.monde_id = $1", [mondeId]);
    await pool.end();
  });

  it("à portée, la Bête suit l'Expédition dès qu'elle la voit, sans combat : aucune Bête de l'escorte n'est blessée ni tuée", async () => {
    const { territoireId, ne, foyer } = await naitre();
    // Trois mâles : un mâle et une femelle au Foyer réuniraient leur Couple au retour (US-0956).
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 3)", [territoireId, forte.id]);
    // Une Bête d'une autre Espèce que l'escorte, pour la distinguer d'elle dans l'effectif à son arrivée au Foyer (US-0938).
    const { place, caseId, bete } = await uneBeteSeule(territoireId, apres(ne, 3 * JOUR), (b) => rare(b) && b.especeId !== forte.id);
    expect(forte.force).toBeGreaterThanOrEqual(especes.get(bete.especeId)!.force);
    // L'escorte, au complet, arrive une heure avant la Bête et reste quatre heures.
    const aller = dureeDuTrajetMinutes(distance(foyer, place), [{ vitesse: forte.vitesse, nombre: 3 }]);
    const depart = apres(bete.arrivee, -aller - HEURE);
    const lancee = await lancerLExpedition(pool, territoireId, { destination: place, explorateurs: 1, escorte: new Map([[forte.id, 3]]), sejourMinutes: 4 * HEURE }, depart);
    if (!("expeditionId" in lancee)) throw new Error(lancee.refus);
    const id = lancee.expeditionId;
    const lire = async () => ({
      effectif: (await pool.query("select espece_id, sexe, nombre from effectif where territoire_id = $1 order by espece_id, sexe", [territoireId])).rows,
      escorte: (await pool.query("select espece_id, nombre from expedition_escorte where expedition_id = $1", [id])).rows,
    });
    const avant = await lire();

    await rattraperA(territoireId, apres(bete.arrivee, 1));
    expect(await rencontres(id)).toEqual([vue(bete, caseId, bete.arrivee, true)]);
    expect(await lire()).toEqual(avant);
    // Rentrée au Foyer (US-0916) : l'escorte revient entière, et la Bête n'est plus sur sa Case depuis l'Apprivoisement.
    await rattraperA(territoireId, apres(depart, 2 * aller + 4 * HEURE + HEURE));
    const { rows } = await pool.query<{ rentreeLe: Date | null }>('select rentree_le as "rentreeLe" from expedition where id = $1', [id]);
    expect(rows[0].rentreeLe).toEqual(apres(depart, 2 * aller + 4 * HEURE));
    // US-0938 : la Bête qui la suit arrive au Foyer avec elle et entre dans l'effectif, à côté de toutes celles de l'escorte.
    const [{ sexe }] = await betesQuiSuivent(pool, id);
    const rentree = await lire();
    expect(rentree.escorte).toEqual(avant.escorte);
    expect(rentree.effectif).toEqual(expect.arrayContaining([...avant.effectif, { espece_id: bete.especeId, sexe, nombre: 1 }]));
    expect(rentree.effectif).toHaveLength(avant.effectif.length + 1);
    expect(await rencontres(id)).toEqual([vue(bete, caseId, bete.arrivee, true)]);
    expect(await partieLe(caseId, bete.numero)).toEqual(bete.arrivee);
  });

  it("une escorte d'une force au moins égale à celle de la Bête l'a à portée ; plus faible, elle la voit, mais la Bête reste sur sa Case", async () => {
    const { territoireId, ne } = await naitre();
    const egale = await uneBeteSeule(territoireId, apres(ne, 3 * JOUR), rare);
    const tropForte = await uneBeteSeule(territoireId, apres(ne, 3 * JOUR), rare);
    // Une Bête de son Espèce contre la première ; la commune la plus faible contre l'autre. Chacune arrive deux heures après sa Bête.
    const contreEgale = await poser(territoireId, egale.caseId, apres(egale.bete.arrivee, 2 * HEURE), 4 * HEURE, [[especes.get(egale.bete.especeId)!, 1]]);
    const tropFaible = await poser(territoireId, tropForte.caseId, apres(tropForte.bete.arrivee, 2 * HEURE), 4 * HEURE, [[faible, 1]]);
    expect(faible.force).toBeLessThan(especes.get(tropForte.bete.especeId)!.force);

    await rattraperA(territoireId, apres(new Date(Math.max(egale.bete.depart.getTime(), tropForte.bete.depart.getTime())), JOUR));
    expect(await rencontres(contreEgale)).toEqual([vue(egale.bete, egale.caseId, apres(egale.bete.arrivee, 2 * HEURE), true)]);
    expect(await partieLe(egale.caseId, egale.bete.numero)).toEqual(apres(egale.bete.arrivee, 2 * HEURE));
    expect(await rencontres(tropFaible)).toEqual([vue(tropForte.bete, tropForte.caseId, apres(tropForte.bete.arrivee, 2 * HEURE), false)]);
    expect(await partieLe(tropForte.caseId, tropForte.bete.numero)).toBeNull();
    expect((await betesSauvagesDUneCase(pool, tropForte.caseId, tropForte.bete.arrivee, apres(tropForte.bete.arrivee, 1))).find((b) => b.numero === tropForte.bete.numero)?.depart).toEqual(
      tropForte.bete.depart,
    );
  });

  it("une Bête commune suit toujours l'Expédition, même plus forte que son escorte", async () => {
    const { territoireId, ne } = await naitre();
    const { caseId, bete } = await uneBeteSeule(territoireId, apres(ne, 3 * JOUR), (b) => b.rareteId === "commune" && especes.get(b.especeId)!.force > faible.force);
    const id = await poser(territoireId, caseId, apres(bete.arrivee, -HEURE), 4 * HEURE, [[faible, 1]]);

    await rattraperA(territoireId, apres(bete.depart, JOUR));
    expect(await rencontres(id)).toEqual([vue(bete, caseId, bete.arrivee, true)]);
    expect(await partieLe(caseId, bete.numero)).toEqual(bete.arrivee);
  });

  /**
   * Trois Territoires sur la Case d'une Bête rare : avant l'Apprivoisement, une escorte trop faible et une Expédition sans
   * escorte la voient ; l'escorte forte de B arrive une heure après elle et l'emmène ; ensuite, ni une autre de B, ni une
   * escorte forte de A, ni celle de C arrivée au même instant mais partie plus tard, ne la voient. `rattrapages` met les
   * Territoires à l'heure ; rend ce que chaque Expédition a vu et l'instant où la Bête est partie (vues), à côté de ce
   * qu'on en attend (attendues).
   */
  const troisTerritoires = async (rattrapages: (a: number, b: number, c: number, debut: Date, fin: Date) => Promise<void>) => {
    const [a, b, c] = [await naitre(), await naitre(), await naitre()];
    const { caseId, bete } = await uneBeteSeule(a.territoireId, apres(a.ne, 3 * JOUR), rare);
    const [debut, fin] = [apres(bete.arrivee, -3 * HEURE), apres(bete.depart, 3 * HEURE)];
    const faibleDeA = await poser(a.territoireId, caseId, apres(bete.arrivee, -2 * HEURE), 6 * HEURE, [[faible, 1]]);
    const sansEscorteDeC = await poser(c.territoireId, caseId, apres(bete.arrivee, 30), 4 * HEURE);
    const forteDeB = await poser(b.territoireId, caseId, apres(bete.arrivee, HEURE), 4 * HEURE, [[forte, 1]]);
    const forteDeCEnMemeTemps = await poser(c.territoireId, caseId, apres(bete.arrivee, HEURE), 4 * HEURE, [[forte, 1]]);
    const autreDeB = await poser(b.territoireId, caseId, apres(bete.arrivee, 90), 4 * HEURE, [[forte, 2]]);
    const forteDeA = await poser(a.territoireId, caseId, apres(bete.arrivee, 2 * HEURE), 4 * HEURE, [[forte, 5]]);
    await rattrapages(a.territoireId, b.territoireId, c.territoireId, debut, fin);
    const vues = async (id: number) => (await rencontres(id)).map((r) => ({ ...r, depuisLApparition: r.vueLe.getTime() - bete.arrivee.getTime(), vueLe: undefined }));
    const sans = { caseId, apparueLe: bete.arrivee, especeId: bete.especeId, rareteId: bete.rareteId, numero: bete.numero, beteDeNaissanceId: null };
    return {
      attendues: {
        faibleDeA: [{ ...sans, depuisLApparition: 0, apprivoisee: false }],
        sansEscorteDeC: [{ ...sans, depuisLApparition: 30 * MINUTE_MS, apprivoisee: false }],
        forteDeB: [{ ...sans, depuisLApparition: HEURE * MINUTE_MS, apprivoisee: true }],
        forteDeCEnMemeTemps: [],
        autreDeB: [],
        forteDeA: [],
        partie: apres(bete.arrivee, HEURE),
      },
      vues: {
        faibleDeA: await vues(faibleDeA),
        sansEscorteDeC: await vues(sansEscorteDeC),
        forteDeB: await vues(forteDeB),
        forteDeCEnMemeTemps: await vues(forteDeCEnMemeTemps),
        autreDeB: await vues(autreDeB),
        forteDeA: await vues(forteDeA),
        partie: await partieLe(caseId, bete.numero),
      },
    };
  };

  it("dès qu'elle suit une Expédition, la Bête quitte sa Case : personne d'autre ne la rencontre plus, de son Territoire ou d'un autre", async () => {
    // Le Territoire de l'Expédition suivie rattrapé le premier, puis les autres, chacun d'un bloc.
    const { vues, attendues } = await troisTerritoires(async (a, b, c, _debut, fin) => {
      for (const t of [b, a, c]) await rattraperA(t, fin);
    });
    expect(vues).toEqual(attendues);
  });

  it("la même Bête suit la même Expédition quand son Territoire est rattrapé le dernier, après les autres", async () => {
    const { vues, attendues } = await troisTerritoires(async (a, b, c, _debut, fin) => {
      for (const t of [a, c, b]) await rattraperA(t, fin);
    });
    expect(vues).toEqual(attendues);
  });

  it("la même Bête suit la même Expédition quand les Territoires sont rattrapés par tranches, chacun à ses heures", async () => {
    const { vues, attendues } = await troisTerritoires(async (a, b, c, debut, fin) => {
      // Des tranches de 25 minutes, décalées de 0, 7 et 13 minutes : l'Apprivoisement tombe au milieu d'une tranche pour chacun.
      const heures = [
        [a, 0],
        [b, 7],
        [c, 13],
      ].flatMap(([t, decalage]) => Array.from({ length: Math.ceil((fin.getTime() - debut.getTime()) / (25 * MINUTE_MS)) }, (_, k) => ({ t, instant: apres(debut, decalage + 25 * k) })));
      for (const { t, instant } of heures.filter((h) => h.instant < fin).sort((x, y) => x.instant.getTime() - y.instant.getTime())) await rattraperA(t, instant);
      for (const t of [a, b, c]) await rattraperA(t, fin);
    });
    expect(vues).toEqual(attendues);
  }, 60_000);

  it("une Bête de naissance qui suit une Expédition quitte sa Case : les suivantes ne la voient plus, et elle ne rôde plus dans les abords", async () => {
    const { territoireId, ne } = await naitre();
    const { rows } = await pool.query<{ id: number; caseId: number; especeId: string; arrivee: Date }>(
      `select b.id, b.case_id as "caseId", b.espece_id as "especeId", b.arrivee from bete_de_naissance b
       join case_du_monde c on c.id = b.case_id where b.territoire_id = $1 and c.chef_id is null order by b.id limit 1`,
      [territoireId],
    );
    const bn = rows[0];
    const rodent = await betesDeNaissancePresentes(pool, territoireId, apres(ne, 2 * HEURE));
    // Une escorte arrive sur sa Case une heure après la naissance ; une autre du même Territoire, deux heures plus tard.
    const suivie = await poser(territoireId, bn.caseId, apres(ne, HEURE), HEURE, [[faible, 1]]);
    const ensuite = await poser(territoireId, bn.caseId, apres(ne, 3 * HEURE), HEURE, [[forte, 1]]);

    await rattraperA(territoireId, apres(ne, 10 * HEURE));
    expect((await rencontres(suivie)).filter((r) => r.beteDeNaissanceId !== null)).toEqual([
      { vueLe: apres(ne, HEURE), caseId: bn.caseId, apparueLe: bn.arrivee, especeId: bn.especeId, rareteId: "commune", numero: null, beteDeNaissanceId: bn.id, apprivoisee: true },
    ]);
    expect((await rencontres(ensuite)).filter((r) => r.beteDeNaissanceId !== null)).toEqual([]);
    expect(await betesDeNaissancePresentes(pool, territoireId, apres(ne, 2 * HEURE))).toBe(rodent - 1);
    expect(await betesDeNaissancePresentes(pool, territoireId, apres(ne, 30))).toBe(rodent);
  });

  /** Une Bête commune, toujours à portée, même d'une Expédition sans escorte (US-0935). */
  const commune = (b: BeteSauvage) => b.rareteId === "commune";
  /**
   * US-0935 : un explorateur part seul, sans escorte, comme depuis l'écran d'Expédition, vers la Case `place`, pour y
   * arriver une heure avant `avant` et y rester `sejourMinutes` : l'Expédition.
   */
  const partirSansEscorte = async (territoireId: number, foyer: Coordonnees, place: Coordonnees, avant: Date, sejourMinutes: number) => {
    const depart = apres(avant, -dureeDuTrajetMinutes(distance(foyer, place), []) - HEURE);
    const lancee = await lancerLExpedition(pool, territoireId, { destination: place, explorateurs: 1, escorte: new Map(), sejourMinutes }, depart);
    if (!("expeditionId" in lancee)) throw new Error(lancee.refus);
    return lancee.expeditionId;
  };

  it("sans escorte, une Bête commune suit l'Expédition dès qu'elle la voit, sans combat, et son Espèce entre au Bestiaire (US-0935)", async () => {
    const { territoireId, ne, foyer } = await naitre();
    const { place, caseId, bete } = await uneBeteSeule(territoireId, apres(ne, 3 * JOUR), commune);
    const id = await partirSansEscorte(territoireId, foyer, place, bete.arrivee, 4 * HEURE);

    await rattraperA(territoireId, apres(bete.depart, JOUR));
    expect(await rencontres(id)).toEqual([vue(bete, caseId, bete.arrivee, true)]);
    expect(await partieLe(caseId, bete.numero)).toEqual(bete.arrivee);
    // Croisée à sa Rencontre ; rentrée au Foyer avec l'Expédition, elle a fait passer son Espèce « apprivoisée » (US-0938).
    expect(await bestiaireDuTerritoire(pool, territoireId)).toEqual([{ especeId: bete.especeId, etat: "apprivoisee", croiseeLe: bete.arrivee }]);
  });

  it("sans escorte, une Bête plus rare n'est jamais à portée : l'Expédition la voit, elle reste sur sa Case, et son Espèce entre au Bestiaire (US-0935)", async () => {
    const { territoireId, ne, foyer } = await naitre();
    const { place, caseId, bete } = await uneBeteSeule(territoireId, apres(ne, 3 * JOUR), rare);
    const id = await partirSansEscorte(territoireId, foyer, place, bete.arrivee, 4 * HEURE);

    await rattraperA(territoireId, apres(bete.depart, JOUR));
    expect(await rencontres(id)).toEqual([vue(bete, caseId, bete.arrivee, false)]);
    expect(await partieLe(caseId, bete.numero)).toBeNull();
    expect((await betesSauvagesDUneCase(pool, caseId, bete.arrivee, apres(bete.arrivee, 1))).find((b) => b.numero === bete.numero)?.depart).toEqual(bete.depart);
    expect(await bestiaireDuTerritoire(pool, territoireId)).toEqual([{ especeId: bete.especeId, etat: "croisee", croiseeLe: bete.arrivee }]);
  });

  it("sans escorte, deux Bêtes communes du même séjour la suivent chacune à sa Rencontre : une Bête par Rencontre (US-0935, US-0936)", async () => {
    const { territoireId, ne, foyer } = await naitre();
    // Deux Bêtes communes à moins de dix heures d'écart sur une Case libre, sans autre Bête de CALME avant la première à
    // CALME après la seconde.
    const deuxCommunes = async () => {
      const [debut, fin] = [apres(ne, 3 * JOUR), apres(ne, 30 * JOUR)];
      for (let ecart = 2; ecart <= 6; ecart++) {
        for (let rang = 0, ici = await aLEcart(territoireId, ecart); ici; ici = await aLEcart(territoireId, ecart, ++rang)) {
          if (prises.has(ici.caseId)) continue;
          const betes = await betesSauvagesDUneCase(pool, ici.caseId, debut, fin);
          const i = betes.findIndex(
            (b, j) =>
              j + 1 < betes.length &&
              commune(b) &&
              commune(betes[j + 1]) &&
              b.arrivee >= apres(debut, CALME) &&
              betes[j + 1].arrivee < apres(b.arrivee, 10 * HEURE) &&
              (j === 0 || betes[j - 1].arrivee <= apres(b.arrivee, -CALME)) &&
              (j + 2 === betes.length || betes[j + 2].arrivee >= apres(betes[j + 1].arrivee, CALME)),
          );
          if (i >= 0) {
            prises.add(ici.caseId);
            return { ...ici, betes: [betes[i], betes[i + 1]] };
          }
        }
      }
      throw new Error("Aucune Case où se montrent deux Bêtes communes.");
    };
    const { place, caseId, betes } = await deuxCommunes();
    // Arrivée une heure avant la première, elle reste douze heures : la seconde se montre pendant son séjour.
    const id = await partirSansEscorte(territoireId, foyer, place, betes[0].arrivee, 12 * HEURE);

    await rattraperA(territoireId, apres(betes[1].depart, JOUR));
    expect(await rencontres(id)).toEqual(betes.map((b) => vue(b, caseId, b.arrivee, true)));
    for (const b of betes) expect(await partieLe(caseId, b.numero)).toEqual(b.arrivee);
  });
});
