// US-0945 : une Expédition en fuite quitte la Case pour tous les joueurs. Sur une Case partagée, l'Expédition X du joueur
// A fuit à l'attaque d'une Bête rare ; puis une Bête commune se montre, que le tirage (US-0963) aurait donnée à X si elle
// était restée. L'Expédition Y du joueur B, seule encore sur la Case, l'emmène : que A soit rattrapé avant B, après lui,
// ou seulement à la fin pendant que B joue en ligne, les fuites de la Case se calculent des mêmes faits
// (src/expeditions/fuites-de-la-case.ts), sans attendre le rattrapage du Territoire de X : la Bête emmenée, les retours et
// les récits des deux joueurs sont les mêmes dans toutes les manières.
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { type BeteSauvage, betesSauvagesDesCases } from "@/monde/betes-sauvages";
import { recitsDuTerritoire } from "@/monde/recits";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { attaqueTiree } from "@/test/attaques";
import { mondeDEssai, nomDEssai, poolDansLaTransaction, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { lExpeditionSuivie } from "./apprivoisement";
import { forceDUneBete } from "./force";
import { expeditionsPresentesSurLaCaseApresLesFuites } from "./fuites-des-cases";
import { type HorairesDUneExpedition, retourDUneExpedition } from "./phase";
import { expeditionsPresentesSurLaCase } from "./presence";
import { programmerLeRetour } from "./retour";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;
/** L'aller et le retour des Expéditions de l'essai, posées sur la Case sans souci de la distance à leur Foyer. */
const TRAJET = 30;
/** Au plus tant d'Expéditions X posées pour en trouver une que la Bête rare attaque. */
const POSEES_AU_PLUS = 100;

/** La ligne du récit de retour qui dit que d'autres joueurs séjournaient sur la Case, sans les nommer. */
const AUTRES = "D'autres Expéditions séjournaient sur la Case.";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai d'une fuite sur une Case partagée (US-0945)";

/** Les manières de rattraper les deux joueurs : l'un puis l'autre, d'un bloc, ou B pendant que A est absent. */
const MANIERES = [
  "d'un bloc, A d'abord",
  "d'un bloc, B d'abord",
  "B en ligne, A absent jusqu'à la fin",
  // Le Territoire de B, déjà calculé après le départ de la Bête rare, reprend d'ici sans la revoir : la Case se relit plus tôt.
  "B en deux fois, après le départ de la rare, A absent jusqu'à la fin",
] as const;
type Maniere = (typeof MANIERES)[number];

/** Une Espèce telle que l'essai la choisit pour une escorte : sa Rareté et la force d'une de ses Bêtes (US-0905). */
type Espece = { id: string; rareteId: string; force: number };

/** Ce que l'essai relit d'une Expédition : son demi-tour, sa fuite, son retour et ses Rencontres. */
type Lue = {
  rappeleeLe: Date | null;
  enFuite: boolean;
  rentreeLe: Date | null;
  rencontres: { numero: number; apprivoisee: boolean; attaqueLe: Date | null }[];
};

describe.skipIf(!URL_TEST)("une Expédition en fuite quitte la Case pour tous les joueurs (US-0945, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `fuite-partagee-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms des chefs de ce lancement, qui n'y forme aucun mot interdit (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  let especes: Espece[];
  /** La commune la plus faible du jeu, qui escorte X et Y. */
  let faible: Espece;
  const territoires = {} as Record<"A" | "B", number>;
  /** La Case, la Bête rare qui attaque X, et la Bête commune qui se montre après la fuite. */
  let caseId = 0;
  let rare: BeteSauvage;
  let commune: BeteSauvage;
  /** Pour chaque manière : X et Y relues, l'instant de l'attaque sur X, et ce que l'effectif de chacun a gagné de l'Espèce de la commune. */
  const lus = {} as Record<
    Maniere,
    {
      x: Lue;
      y: Lue;
      attaque: Date;
      gagnees: Record<"A" | "B", number>;
      recits: Record<"A" | "B", string[]>;
      /** Qui est sur la Case à l'apparition de la commune, selon les fuites écrites seules (brute) ou calculées (apres), avant tout rattrapage puis après tous. */
      presents: Record<"avant" | "apres", { brute: number[]; apres: number[] }>;
      ids: { x: number; y: number };
    }
  >;
  let retourDeY: Date;
  const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);
  const forceDe = (id: string) => especes.find((e) => e.id === id)!.force;

  /** Un chef qui vient de naître dans le Monde d'essai : son Territoire et l'instant de sa naissance. */
  const naitre = async () => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Fuit", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /** Les horaires d'une Expédition qui arrive sur la Case à `arrivee` et en repart au plus tôt à `depart`, à la minute. */
  const horaires = (arrivee: Date, depart: Date): HorairesDUneExpedition => ({
    partLe: apres(arrivee, -TRAJET),
    trajetMinutes: TRAJET,
    sejourMinutes: Math.ceil((depart.getTime() - arrivee.getTime()) / MINUTE_MS),
  });
  /**
   * L'Expédition d'un joueur sur la Case, posée en base comme un départ l'aurait fait, escortée d'une Bête de la commune
   * la plus faible, avec son retour au Foyer programmé (US-0916).
   */
  const poser = async (client: PoolClient, territoireId: number, h: HorairesDUneExpedition, id?: number) => {
    const { rows } = await client.query<{ id: number }>(
      "insert into expedition (id, territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) overriding system value values (coalesce($1::int, nextval(pg_get_serial_sequence('expedition', 'id'))), $2, $3, $4, $5, $6) returning id",
      [id ?? null, territoireId, caseId, h.partLe, h.trajetMinutes, h.sejourMinutes],
    );
    await client.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, 1)", [rows[0].id, faible.id]);
    await programmerLeRetour(client, territoireId, rows[0].id, h);
    return rows[0].id;
  };
  /** Une Expédition relue avec `client`. */
  const lire = async (client: PoolClient, id: number): Promise<Lue> => {
    const { rows } = await client.query<Omit<Lue, "rencontres">>(
      'select rappelee_le as "rappeleeLe", en_fuite as "enFuite", rentree_le as "rentreeLe" from expedition where id = $1',
      [id],
    );
    const { rows: rencontres } = await client.query<{ numero: string; apprivoisee: boolean; attaqueLe: Date | null }>(
      'select numero, apprivoisee, attaque_le as "attaqueLe" from rencontre where expedition_id = $1 order by vue_le',
      [id],
    );
    return { ...rows[0], rencontres: rencontres.map((r) => ({ ...r, numero: Number(r.numero) })) };
  };

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    const { rows } = await pool.query<{ id: string; rareteId: string; attaque: number; vie: number }>('select id, rarete_id as "rareteId", attaque, vie from espece order by id');
    especes = rows.map(({ attaque, vie, ...e }) => ({ ...e, force: forceDUneBete({ attaque, vie }) })).sort((x, y) => x.force - y.force || x.id.localeCompare(y.id));
    faible = especes.find((e) => e.rareteId === "commune" && e.force > 0)!;
    const a = await naitre();
    territoires.A = a.territoireId;
    territoires.B = (await naitre()).territoireId;
    const { rows: libres } = await pool.query<{ id: number }>(
      `select c.id from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) between 2 and 8
         and not exists (select 1 from bete_de_naissance n where n.case_id = c.id and n.territoire_id = any($2::int[]))
       order by c.id`,
      [territoires.A, [territoires.A, territoires.B]],
    );

    // Une Bête rare, trop forte pour une escorte de la plus faible commune, puis, après son départ, une commune d'une autre
    // Espèce, que le tirage donne à la première posée de deux Expéditions d'escortes égales : X. Aucune autre Bête sur la
    // Case de deux heures avant la rare à deux heures après la commune.
    const [de, jusqua] = [apres(a.ne, 3 * JOUR), apres(a.ne, 60 * JOUR)];
    for (const [ici, betes] of await betesSauvagesDesCases(pool, libres.map((c) => c.id), de, jusqua)) {
      const i = betes.findIndex((r, k) => {
        const s = betes[k + 1];
        if (!s || r.rareteId === "commune" || forceDe(r.especeId) <= faible.force) return false;
        if (s.rareteId !== "commune" || s.especeId === faible.id || s.arrivee < apres(r.depart, 1) || s.arrivee > apres(r.arrivee, 16 * HEURE)) return false;
        if ((k > 0 && betes[k - 1].depart > apres(r.arrivee, -2 * HEURE)) || (betes[k + 2] && betes[k + 2].arrivee < apres(s.arrivee, 2 * HEURE))) return false;
        const sur = { arrivee: apres(s.arrivee, -HEURE), depart: apres(s.arrivee, HEURE) };
        const suivie = lExpeditionSuivie({ ...s, force: forceDe(s.especeId), caseId: ici, beteDeNaissanceId: null }, [
          { id: 1, ...sur, escorte: faible.force },
          { id: 2, ...sur, escorte: faible.force },
        ]);
        return suivie?.expeditionId === 1;
      });
      if (i >= 0) {
        [caseId, rare, commune] = [ici, betes[i], betes[i + 1]];
        break;
      }
    }
    if (!caseId) throw new Error("Aucune Case où une Bête rare précède une commune que le tirage donnerait à X.");

    // X arrive une heure avant la rare et resterait jusqu'à une heure après l'apparition de la commune ; Y arrive au départ
    // de la rare, qu'elle ne voit pas, et reste de même.
    const deX = horaires(apres(rare.arrivee, -HEURE), apres(commune.arrivee, HEURE));
    const deY = horaires(rare.depart, apres(commune.arrivee, HEURE));
    const fin = apres(retourDUneExpedition(deX)!, HEURE);
    retourDeY = retourDUneExpedition(deY)!;
    // L'identifiant de X, tel que ses tirages la font attaquer par la rare : le même dans toutes les manières, pour que
    // l'attaque, et tout ce qu'elle laisse, soient les mêmes.
    let idDeX = 0;
    let attaque: Date | null = null;
    for (let essais = 0; !attaque; essais++) {
      if (essais === POSEES_AU_PLUS) throw new Error(`${POSEES_AU_PLUS} identifiants essayés, aucun attaqué.`);
      idDeX = Number((await pool.query<{ id: string }>("select nextval(pg_get_serial_sequence('expedition', 'id')) as id")).rows[0].id);
      attaque = await attaqueTiree(pool, { caseId, especeId: rare.especeId, numero: rare.numero }, idDeX, { debut: rare.arrivee, fin: rare.depart });
    }
    for (const maniere of MANIERES) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const jeu = poolDansLaTransaction(client);
        const x = await poser(client, territoires.A, deX, idDeX);
        const y = await poser(client, territoires.B, deY);
        const presents = async () => ({
          brute: (await expeditionsPresentesSurLaCase(client, caseId, commune.arrivee)).map((e) => e.id).sort((p, q) => p - q),
          apres: (await expeditionsPresentesSurLaCaseApresLesFuites(client, caseId, commune.arrivee)).map((e) => e.id).sort((p, q) => p - q),
        });
        const avantTout = await presents();
        const effectif = async (territoireId: number) =>
          (await client.query<{ n: number }>("select coalesce(sum(nombre), 0)::int as n from effectif where territoire_id = $1 and espece_id = $2", [territoireId, commune.especeId]))
            .rows[0].n;
        const avant = { A: await effectif(territoires.A), B: await effectif(territoires.B) };
        const aLHeure = (joueur: "A" | "B", instant: Date) => rattraper("territoire", territoires[joueur], { pool: jeu, jusqua: instant });
        if (maniere === "d'un bloc, A d'abord") {
          await aLHeure("A", fin);
          await aLHeure("B", fin);
        } else if (maniere === "d'un bloc, B d'abord") {
          await aLHeure("B", fin);
          await aLHeure("A", fin);
        } else if (maniere === "B en ligne, A absent jusqu'à la fin") {
          for (let t = deY.partLe; t < fin; t = apres(t, 20)) await aLHeure("B", t);
          await aLHeure("B", fin);
          await aLHeure("A", fin);
        } else {
          await aLHeure("B", apres(rare.depart, 1));
          await aLHeure("B", fin);
          await aLHeure("A", fin);
        }
        // Le récit de retour de chaque joueur, ligne à ligne.
        const recitDe = async (joueur: "A" | "B") =>
          (await recitsDuTerritoire(client, territoires[joueur])).filter((r) => r.titre === "Retour d'Expédition").flatMap((r) => r.texte.split("\n"));
        const gagnees = { A: (await effectif(territoires.A)) - avant.A, B: (await effectif(territoires.B)) - avant.B };
        lus[maniere] = {
          x: await lire(client, x),
          y: await lire(client, y),
          attaque,
          gagnees,
          recits: { A: await recitDe("A"), B: await recitDe("B") },
          presents: { avant: avantTout, apres: await presents() },
          ids: { x, y },
        };
      } finally {
        await client.query("rollback");
        client.release();
      }
    }
    // Une centaine de rattrapages de B, page ouverte : sous la charge de la suite complète, bien plus que les 30 s par défaut.
  }, 240_000);

  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it.each(MANIERES)("%s : X fuit à l'attaque, et Y, seule encore sur la Case, emmène la commune", (maniere) => {
    const { x, y, attaque, gagnees } = lus[maniere];
    expect(x).toEqual({
      rappeleeLe: attaque,
      enFuite: true,
      rentreeLe: apres(attaque, TRAJET),
      rencontres: [{ numero: rare.numero, apprivoisee: false, attaqueLe: attaque }],
    });
    expect(y).toEqual({
      rappeleeLe: null,
      enFuite: false,
      rentreeLe: retourDeY,
      rencontres: [{ numero: commune.numero, apprivoisee: true, attaqueLe: null }],
    });
    expect(gagnees).toEqual({ A: 0, B: 1 });
  });

  it.each(MANIERES)("%s : la présence que lisent les récits et les Bêtes repérées ne compte pas X, en fuite, même avant le rattrapage de A", (maniere) => {
    const { presents, ids } = lus[maniere];
    // Avant tout rattrapage, les fuites écrites seules la laissent sur la Case ; calculées pour la Case, elles la font partir.
    expect(presents.avant.brute).toEqual([ids.x, ids.y].sort((p, q) => p - q));
    expect(presents.avant.apres).toEqual([ids.y]);
    // Tous rattrapés, sa fuite est écrite : les deux lectures disent la même chose.
    expect(presents.apres).toEqual({ brute: [ids.y], apres: [ids.y] });
  });

  it.each(MANIERES)("%s : le récit de retour de B ne compte pas X sur la Case, qui l'avait quittée, comme celui de A, qui ne la dit pas partie avec Y", (maniere) => {
    const { recits } = lus[maniere];
    // X est partie avant l'arrivée de Y : aucun joueur ne trouve l'autre sur la Case.
    for (const joueur of ["A", "B"] as const) expect(recits[joueur]).not.toContain(AUTRES);
    // Les mêmes récits, quelle que soit la manière de rattraper les deux joueurs.
    expect(recits).toEqual(lus[MANIERES[0]].recits);
  });
});
