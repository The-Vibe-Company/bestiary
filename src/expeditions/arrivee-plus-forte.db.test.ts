// US-0966 : une Bête restée sur sa Case, trop forte pour l'escorte qui l'a vue (US-0942), suit une Expédition assez forte
// arrivée ensuite, d'un autre joueur ou du même, dès son arrivée ; quand plusieurs assez fortes arrivent au même instant,
// le tirage proportionnel à la force (US-0963) désigne la seule qui l'emporte. L'Expédition déjà présente qui la perd
// ainsi n'est plus attaquée (US-0943), et son récit dit qu'elle a suivi une autre Expédition, et à quelle heure (US-0964,
// US-0950). Le même résultat quel que soit le Territoire mis à l'heure le premier, d'un bloc ou page ouverte.
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bestiaireDuTerritoire } from "@/bestiaire/bestiaire";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { type BeteSauvage, betesSauvagesDesCases, hasardsDeLAttaque } from "@/monde/betes-sauvages";
import { recitsDuTerritoire } from "@/monde/recits";
import { PRESENCE_D_UNE_BETE_HEURES } from "@/reglages";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDansLaTransaction, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { lExpeditionSuivie } from "./apprivoisement";
import { chanceDAttaqueParHeure, instantDeLAttaque, type Regime } from "./attaque";
import { forceDUneBete } from "./force";
import { type HorairesDUneExpedition, retourDUneExpedition } from "./phase";
import { attaquesSubies } from "./rencontres";
import { programmerLeRetour } from "./retour";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;
/** Le temps, en minutes, où aucune autre Bête n'apparaît avant ou après celle d'un essai : sa présence et 6 heures de marge. */
const CALME = PRESENCE_D_UNE_BETE_HEURES * HEURE + 6 * HEURE;
/** L'aller et le retour des Expéditions des essais, posées sur la Case sans souci de la distance à leur Foyer. */
const TRAJET = 30;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai d'une Expédition assez forte arrivée ensuite (US-0966)";
type Joueur = "A" | "B" | "C" | "D";
const JOUEURS = ["A", "B", "C", "D"] as const;

/** Une Espèce telle que l'essai la choisit : la force d'une de ses Bêtes (US-0905) et son régime. */
type Espece = { id: string; rareteId: string; force: number; regime: Regime };
/** Une Expédition à poser : son joueur, son arrivée sur la Case, son séjour, et son escorte (Espèce, nombre), s'il en a une. */
type APoser = { joueur: Joueur; arrivee: Date; sejour: number; escorte?: [Espece, number] };
/** Ce qu'une Expédition a vécu de la Bête : son identifiant, sa Rencontre et ses attaques subies. */
type Vecue = { id: number; apprivoisee: boolean; vueLe: Date; attaques: Date[] };
/** La manière de vivre le temps : les Territoires mis à l'heure dans l'ordre `ordre`, d'un bloc, ou toutes les `pas` minutes. */
type Maniere = { ordre: readonly Joueur[]; pas?: number };

describe.skipIf(!URL_TEST)("une Expédition assez forte arrive ensuite (US-0966, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  let graine: number;
  const lancement = `ensuite-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms des chefs de ce lancement, qui n'y forme aucun mot interdit (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  let especes: Espece[];
  /** La commune la plus forte du jeu, dont les escortes assez fortes des essais sont faites. */
  let forte: Espece;
  const territoires = {} as Record<Joueur, number>;
  let ne: Date;
  /** La Bête des essais, plus rare que commune, seule sur sa Case, sa Case et son Espèce. */
  let laCase: { id: number; q: number; r: number };
  let bete: BeteSauvage;
  let espece: Espece;
  /** Combien de Bêtes de `forte` il faut à une escorte pour avoir la Bête à portée. */
  let assez: number;
  const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);
  /** L'instant où arrivent les Expéditions assez fortes : deux heures après la Bête, qui a encore quatre heures à rester. */
  const ensuite = () => apres(bete.arrivee, 2 * HEURE);
  /** Les horaires d'une Expédition qui arrive sur sa Case à `arrivee` et y séjourne `sejourMinutes`. */
  const arriveeA = (arrivee: Date, sejourMinutes: number): HorairesDUneExpedition => ({ partLe: apres(arrivee, -TRAJET), trajetMinutes: TRAJET, sejourMinutes });
  /** L'Expédition de A, sans escorte, arrivée une heure avant la Bête et restée huit heures : elle la voit, trop forte. */
  const premiere = (): APoser => ({ joueur: "A", arrivee: apres(bete.arrivee, -HEURE), sejour: 8 * HEURE });
  /** Une Expédition assez forte du joueur `joueur`, de `fois` escortes juste assez fortes, arrivée ensuite pour une heure. */
  const assezForte = (joueur: Joueur, fois = 1): APoser => ({ joueur, arrivee: ensuite(), sejour: HEURE, escorte: [forte, fois * assez] });

  /** Un chef qui vient de naître dans le Monde d'essai : son Territoire et l'instant de sa naissance. */
  const naitre = async () => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Ensu", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /** L'Expédition `x` posée en base sur la Case de la Bête comme un départ l'aurait fait, son retour programmé (US-0916). */
  const poser = async (client: PoolClient, x: APoser) => {
    const h = arriveeA(x.arrivee, x.sejour);
    const { rows } = await client.query<{ id: number }>(
      "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, $4, $5) returning id",
      [territoires[x.joueur], laCase.id, h.partLe, h.trajetMinutes, h.sejourMinutes],
    );
    if (x.escorte) await client.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, $3)", [rows[0].id, x.escorte[0].id, x.escorte[1]]);
    await programmerLeRetour(client, territoires[x.joueur], rows[0].id, h);
    return rows[0].id;
  };
  /**
   * Les Expéditions `posees`, vécues dans une transaction annulée ensuite jusqu'au retour de toutes, à la manière
   * `maniere` : pour chacune, sa Rencontre de la Bête et ses attaques subies ; pour chaque joueur, ses Récits de retour,
   * l'effectif de l'Espèce de la Bête et son état au Bestiaire.
   */
  const vivre = async (posees: APoser[], { ordre, pas }: Maniere) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const jeu = poolDansLaTransaction(client);
      const ids: number[] = [];
      for (const x of posees) ids.push(await poser(client, x));
      const fin = apres(new Date(Math.max(...posees.map((x) => retourDUneExpedition(arriveeA(x.arrivee, x.sejour))!.getTime()))), HEURE);
      const instants = [fin];
      if (pas) for (let t = apres(bete.arrivee, -2 * HEURE); t < fin; t = apres(t, pas)) instants.splice(-1, 0, t);
      for (const instant of instants) for (const joueur of ordre) await rattraper("territoire", territoires[joueur], { pool: jeu, jusqua: instant });
      const vecues: Vecue[] = [];
      for (const id of ids) {
        const { rows } = await client.query<{ apprivoisee: boolean; vueLe: Date }>(
          `select apprivoisee, vue_le as "vueLe" from rencontre where expedition_id = $1 and numero = $2`,
          [id, bete.numero],
        );
        expect(rows).toHaveLength(1);
        vecues.push({ id, ...rows[0], attaques: (await attaquesSubies(client, id)).map((a) => a.le) });
      }
      const joueurs = {} as Record<Joueur, { recits: Awaited<ReturnType<typeof recitsDuTerritoire>>; effectif: number; etat: string | undefined }>;
      for (const joueur of JOUEURS) {
        const { rows } = await client.query<{ nombre: number }>("select coalesce(sum(nombre), 0)::int as nombre from effectif where territoire_id = $1 and espece_id = $2", [
          territoires[joueur],
          bete.especeId,
        ]);
        joueurs[joueur] = {
          recits: (await recitsDuTerritoire(jeu, territoires[joueur])).filter((r) => r.titre === "Retour d'Expédition"),
          effectif: rows[0].nombre,
          etat: (await bestiaireDuTerritoire(jeu, territoires[joueur])).find((e) => e.especeId === bete.especeId)?.etat,
        };
      }
      return { vecues, joueurs };
    } finally {
      await client.query("rollback");
      client.release();
    }
  };
  /**
   * Ce qui ne dépend pas de la manière de vivre le temps, ni des identifiants des Expéditions, propres à chaque essai : qui
   * la Bête suit, et quand chacune la voit ; ce que chaque joueur en garde, et ce que ses récits disent de sa Rencontre.
   * Les attaques, elles, se tirent par Expédition (US-0943).
   */
  const sansLeHasard = ({ vecues, joueurs }: Awaited<ReturnType<typeof vivre>>) => ({
    suites: vecues.map(({ apprivoisee, vueLe }) => ({ apprivoisee, vueLe })),
    joueurs: JOUEURS.map((j) => ({ effectif: joueurs[j].effectif, etat: joueurs[j].etat, rencontres: joueurs[j].recits.map((r) => r.rencontres) })),
  });
  /**
   * Les attaques que l'Expédition `x` de A, vue la Bête à son apparition, doit avoir subies : la première que lui promettent
   * ses tirages si elles étaient restées ensemble jusqu'au départ de la Bête à la fin de sa durée (instantDeLAttaque),
   * seulement si elle tombe avant l'arrivée de l'Expédition assez forte, qui l'emmène : après, plus aucune.
   */
  const attaquesAttendues = (x: Vecue) => {
    const promise = instantDeLAttaque({ debut: bete.arrivee, fin: bete.depart }, chanceDAttaqueParHeure(espece.regime), (heure) =>
      hasardsDeLAttaque({ graine, q: laCase.q, r: laCase.r }, bete.numero, x.id, heure),
    );
    return promise && promise < ensuite() ? [promise] : [];
  };
  /** Le nom de l'Espèce de la Bête, tel que les récits le disent. */
  const nomDeLEspece = async () => (await pool.query<{ nom: string }>("select nom from espece where id = $1", [bete.especeId])).rows[0].nom;
  /** La Rencontre de la Bête dans le récit de retour de l'Expédition d'un joueur arrivée à `arrivee`. */
  const rencontreDuRecit = (recits: Awaited<ReturnType<typeof recitsDuTerritoire>>, arrivee: Date) =>
    recits.flatMap((r) => r.rencontres ?? []).find((r) => r.especeId === bete.especeId && r.vueLe.getTime() === Math.max(arrivee.getTime(), bete.arrivee.getTime()));

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    graine = Number((await pool.query<{ graine: string }>("select graine from monde where id = $1", [mondeId])).rows[0].graine);
    const { rows } = await pool.query<{ id: string; rareteId: string; regime: Regime; attaque: number; vie: number }>(
      'select id, rarete_id as "rareteId", regime, attaque, vie from espece order by id',
    );
    especes = rows.map(({ attaque, vie, ...e }) => ({ ...e, force: forceDUneBete({ attaque, vie }) }));
    forte = especes.filter((e) => e.rareteId === "commune").sort((x, y) => y.force - x.force || x.id.localeCompare(y.id))[0];
    for (const joueur of JOUEURS) {
      const chef = await naitre();
      territoires[joueur] = chef.territoireId;
      ne = chef.ne;
    }
    const { rows: libres } = await pool.query<{ id: number; q: number; r: number }>(
      `select c.id, c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) between 2 and 6
         and not exists (select 1 from bete_de_naissance n where n.case_id = c.id and n.territoire_id = any($2::int[]))
       order by c.id`,
      [territoires.A, JOUEURS.map((j) => territoires[j])],
    );
    // Une Bête plus rare que commune, seule sur sa Case, que le tirage entre trois escortes assez fortes arrivées ensuite
    // au même instant, de forces 3, 2 et 1 dans l'ordre où elles sont posées, donne à la deuxième : ni la première ni la
    // dernière posée, ni la plus forte ni la plus faible.
    const [de, a] = [apres(ne, 3 * JOUR), apres(ne, 40 * JOUR)];
    for (const [ici, betes] of await betesSauvagesDesCases(pool, libres.map((c) => c.id), de, a)) {
      const trouvee = betes.find((x, i) => {
        if (x.rareteId === "commune" || x.arrivee < apres(de, CALME) || x.arrivee > apres(a, -CALME)) return false;
        if ((i > 0 && betes[i - 1].arrivee > apres(x.arrivee, -CALME)) || (i < betes.length - 1 && betes[i + 1].arrivee < apres(x.arrivee, CALME))) return false;
        const f = especes.find((e) => e.id === x.especeId)!.force;
        const n = Math.ceil(f / forte.force);
        const sur = (arrivee: Date, sejour: number) => ({ arrivee, depart: apres(arrivee, sejour) });
        const suivie = lExpeditionSuivie({ ...x, force: f, caseId: ici, beteDeNaissanceId: null }, [
          { id: 1, ...sur(apres(x.arrivee, -HEURE), 8 * HEURE), escorte: null },
          ...[3, 2, 1].map((fois, k) => ({ id: k + 2, ...sur(apres(x.arrivee, 2 * HEURE), HEURE), escorte: fois * n * forte.force })),
        ]);
        return suivie?.expeditionId === 3;
      });
      if (trouvee) {
        [laCase, bete] = [libres.find((c) => c.id === ici)!, trouvee];
        break;
      }
    }
    if (!bete) throw new Error("Aucune Bête plus rare seule autour du Foyer de A pour qui le tirage entre trois escortes désigne la deuxième.");
    espece = especes.find((e) => e.id === bete.especeId)!;
    assez = Math.ceil(espece.force / forte.force);
  }, 60_000);

  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("une Expédition assez forte d'un autre joueur arrive ensuite : la Bête la suit dès son arrivée, et celle déjà présente la perd, sans plus être attaquée", async () => {
    const posees = [premiere(), assezForte("B")];
    const vecue = await vivre(posees, { ordre: ["A", "B"] });
    const { vecues, joueurs } = vecue;
    // Trop forte pour A, elle reste sur sa Case ; B arrive, assez fort : elle le suit à cet instant, et il la ramène.
    expect(vecues.map(({ apprivoisee, vueLe }) => ({ apprivoisee, vueLe }))).toEqual([
      { apprivoisee: false, vueLe: bete.arrivee },
      { apprivoisee: true, vueLe: ensuite() },
    ]);
    expect([joueurs.B.effectif, joueurs.B.etat]).toEqual([1, "apprivoisee"]);
    expect([joueurs.A.effectif, joueurs.A.etat]).toEqual([0, "croisee"]);
    expect(joueurs.B.recits.map((r) => r.texte.split("\n").at(-1))).toEqual([expect.stringMatching(/^Bête ramenée au Foyer : /)]);
    // Partie avec B, elle n'attaque plus A : seule l'attaque que ses tirages lui promettaient avant l'arrivée de B.
    expect(vecues[0].attaques).toEqual(attaquesAttendues(vecues[0]));
    // A, qui la perd, l'apprend à son retour : son récit dit qu'elle a suivi une autre Expédition (US-0964), et à quelle
    // heure (« Partie à … avec une autre Expédition »).
    const perdue = rencontreDuRecit(joueurs.A.recits, posees[0].arrivee)!;
    expect([perdue.issue, perdue.repartieLe]).toEqual(["emmenee", ensuite()]);
    expect(joueurs.A.recits[0].texte.split("\n")).toContain(`${await nomDeLEspece()} a suivi une autre Expédition.`);
    // Le même résultat B mis à l'heure le premier, et page ouverte, toutes les vingt minutes.
    for (const maniere of [{ ordre: ["B", "A"] }, { ordre: ["A", "B"], pas: 20 }] as Maniere[]) {
      const autre = await vivre(posees, maniere);
      expect(sansLeHasard(autre), JSON.stringify(maniere)).toEqual(sansLeHasard(vecue));
      expect(autre.vecues[0].attaques, JSON.stringify(maniere)).toEqual(attaquesAttendues(autre.vecues[0]));
    }
  }, 120_000);

  it("une Expédition assez forte du même joueur arrive ensuite : la Bête la suit, et l'autre Expédition du joueur la perd", async () => {
    const posees = [premiere(), assezForte("A")];
    const { vecues, joueurs } = await vivre(posees, { ordre: ["A"] });
    expect(vecues.map(({ apprivoisee, vueLe }) => ({ apprivoisee, vueLe }))).toEqual([
      { apprivoisee: false, vueLe: bete.arrivee },
      { apprivoisee: true, vueLe: ensuite() },
    ]);
    expect([joueurs.A.effectif, joueurs.A.etat]).toEqual([1, "apprivoisee"]);
    expect(vecues[0].attaques).toEqual(attaquesAttendues(vecues[0]));
    expect(joueurs.A.recits).toHaveLength(2);
    const perdue = rencontreDuRecit(joueurs.A.recits, posees[0].arrivee)!;
    expect([perdue.issue, perdue.repartieLe]).toEqual(["emmenee", ensuite()]);
    expect(rencontreDuRecit(joueurs.A.recits, ensuite())?.issue).toBe("apprivoisee");
  }, 60_000);

  it("plusieurs Expéditions assez fortes arrivent au même instant : une seule l'emporte, celle que désigne le tirage proportionnel à la force", async () => {
    // B, C et D, de forces 3, 2 et 1 fois celle qu'il faut : le tirage de cette Bête désigne C, ni la première ni la dernière
    // posée, ni la plus forte ni la plus faible.
    const posees = [premiere(), assezForte("B", 3), assezForte("C", 2), assezForte("D", 1)];
    const vecue = await vivre(posees, { ordre: ["A", "B", "C", "D"] });
    expect(vecue.vecues.map(({ apprivoisee, vueLe }) => ({ apprivoisee, vueLe }))).toEqual([
      { apprivoisee: false, vueLe: bete.arrivee },
      // B et D la voient au même instant que C, qu'elle suit (US-0962) : ils ne la ramènent pas.
      { apprivoisee: false, vueLe: ensuite() },
      { apprivoisee: true, vueLe: ensuite() },
      { apprivoisee: false, vueLe: ensuite() },
    ]);
    expect(JOUEURS.map((j) => vecue.joueurs[j].effectif)).toEqual([0, 0, 1, 0]);
    expect(JOUEURS.map((j) => vecue.joueurs[j].etat)).toEqual(["croisee", "croisee", "apprivoisee", "croisee"]);
    expect(sansLeHasard(await vivre(posees, { ordre: ["D", "C", "B", "A"] }))).toEqual(sansLeHasard(vecue));
  }, 60_000);
});
