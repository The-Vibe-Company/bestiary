// US-0954 : les Blessés guérissent seuls avec le temps, GUERISON_DES_BLESSES_HEURES après leur retour au Foyer, même le
// joueur absent, et un Récit le dit, daté de la guérison. Le temps qui avance (src/temps/avancer.ts) l'écrit en chemin,
// quel que soit son découpage : la même guérison est vécue ici page ouverte, d'un bloc au retour du joueur et par la seule
// tâche planifiée, et ce qu'elle laisse se compare. Les Expéditions qui rentrent avec des Blessés séjournent là où rien ne
// se montre : aucune Rencontre, donc aucun combat ; leurs Blessés sont posés sur l'escorte, comme un combat les y aurait
// laissés (US-0951). Seule l'Expédition B d'un essai est attaquée, pour que sa fuite arrête le temps (US-0945). US-0955 :
// un éleveur libre au Foyer au retour soigne les Blessés, qui guérissent alors en GUERISON_DES_BLESSES_SOIGNES_HEURES.
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { lancerLExpedition } from "@/expeditions/depart";
import { forceDUneBete } from "@/expeditions/force";
import { type HorairesDUneExpedition, retourDUneExpedition } from "@/expeditions/phase";
import { programmerLeRetour } from "@/expeditions/retour";
import { GUERISON_DES_BLESSES_HEURES, GUERISON_DES_BLESSES_SOIGNES_HEURES, PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE } from "@/reglages";
import { rattraperLesAbsents } from "@/temps/absents";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { attaqueTiree } from "@/test/attaques";
import { mondeDEssai, nomDEssai, poolDansLaTransaction, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { blessesAuFoyer } from "./blesses";
import { blessesAffiches } from "./blesses-affiches";
import { type BeteSauvage, betesSauvagesDesCases } from "./betes-sauvages";
import { betesDisponibles, effectifParEspece } from "./effectif";
import type { Coordonnees } from "./hex";
import { estUnRecitDeGuerison } from "./recit-de-guerison";
import { recitsDuTerritoire } from "./recits";

/** La durée de la guérison, en heures : celle du jeu, sauf pour l'essai d'une durée qui n'est pas un nombre entier d'heures. */
const duree = vi.hoisted(() => ({ heures: null as number | null }));
vi.mock("@/reglages", async (original) => {
  const reglages = await original<typeof import("@/reglages")>();
  return {
    ...reglages,
    get GUERISON_DES_BLESSES_HEURES() {
      return duree.heures ?? reglages.GUERISON_DES_BLESSES_HEURES;
    },
  };
});

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de la guérison avec le temps (US-0954)";

/** Les manières de vivre la même guérison : page ouverte d'heure en heure, d'un bloc au retour du joueur, ou par la seule tâche planifiée. */
const MANIERES = ["page ouverte", "d'un bloc", "par la tâche planifiée"] as const;
type Maniere = (typeof MANIERES)[number];

/** Ce qu'une guérison laisse au Territoire : ses Récits de guérison, et ses Blessés encore au Foyer. */
type Bilan = { guerisons: { titre: string; texte: string; survenuLe: Date }[]; blesses: Record<string, unknown> };

describe.skipIf(!URL_TEST)("la guérison des Blessés avec le temps (US-0954, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `guerison-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];
  const apres = (instant: Date, ms: number) => new Date(instant.getTime() + ms);

  /**
   * Un chef qui vient de naître dans le Monde d'essai, avec deux explorateurs, quatre souris et trois pigeons, tous mâles :
   * un mâle et une femelle au Foyer réuniraient leur Couple au retour (US-0956). Son Territoire et l'instant de sa naissance.
   */
  const naitre = async () => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Gue", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query(
      `with partis as (delete from habitant where territoire_id = $1)
       insert into habitant (territoire_id, prenom, metier) values ($1, 'Joran', 'explorateur'), ($1, 'Ilda', 'explorateur')`,
      [territoireId],
    );
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, 'souris', 'male', 4), ($1, 'pigeon', 'male', 3)", [
      territoireId,
    ]);
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };

  /** US-0955 : Hael, un éleveur au Foyer du Territoire : libre, ou à l'Élevage d'une Espèce (US-0843). */
  const engagerUnEleveur = async (territoireId: number, aLElevage: string | null = null) => {
    await pool.query("insert into habitant (territoire_id, prenom, metier, espece_elevee) values ($1, 'Hael', 'eleveur', $2)", [territoireId, aLElevage]);
  };

  /**
   * Une Expédition partie à `instant` vers une Case à deux Cases du Foyer où rien ne se montre pendant son heure de séjour,
   * escortée de `escorte` ; puis, Espèce par Espèce, ses Bêtes perdues au combat et ses Blessées parmi elles, posées sur
   * l'escorte comme un combat les y aurait laissées. Son identifiant et l'instant de son retour au Foyer.
   */
  const partir = async (territoireId: number, instant: Date, escorte: [string, number][], pertes: [string, number, number][]) => {
    await rattraper("territoire", territoireId, { pool, jusqua: instant });
    const arrivee = apres(instant, 2 * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE * MINUTE);
    const { rows } = await pool.query<Coordonnees & { id: number }>(
      `select c.id, c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = 2
         and not exists (select 1 from bete_de_naissance n where n.territoire_id = t.id and n.case_id = c.id)
       order by c.q, c.r`,
      [territoireId],
    );
    const sauvages = await betesSauvagesDesCases(pool, rows.map((c) => c.id), arrivee, apres(arrivee, HEURE));
    const calme = rows.find((c) => sauvages.get(c.id)!.length === 0);
    if (!calme) throw new Error("Aucune Case à deux Cases du Foyer où rien ne se montre pendant le séjour.");
    const depart = await lancerLExpedition(
      pool,
      territoireId,
      { destination: { q: calme.q, r: calme.r }, explorateurs: 1, escorte: new Map(escorte), sejourMinutes: 60 },
      instant,
    );
    if (!("expeditionId" in depart)) throw new Error(depart.refus);
    for (const [especeId, perdues, blessees] of pertes) {
      await pool.query("update expedition_escorte set perdues = $3, blessees = $4 where expedition_id = $1 and espece_id = $2", [
        depart.expeditionId,
        especeId,
        perdues,
        blessees,
      ]);
    }
    const { rows: horaires } = await pool.query<{ partLe: Date; trajetMinutes: number; sejourMinutes: number }>(
      `select part_le as "partLe", trajet_minutes as "trajetMinutes", sejour_minutes as "sejourMinutes" from expedition where id = $1`,
      [depart.expeditionId],
    );
    return { expeditionId: depart.expeditionId, retour: retourDUneExpedition(horaires[0])! };
  };

  /** Les Récits de guérison du Territoire, du plus récent au plus ancien, et ses Blessés au Foyer à l'instant `instant`. */
  const bilan = async (jeu: Pool, territoireId: number, instant: Date): Promise<Bilan> => ({
    guerisons: (await recitsDuTerritoire(jeu, territoireId))
      .filter((r) => estUnRecitDeGuerison(r.titre))
      .map(({ titre, texte, survenuLe }) => ({ titre, texte, survenuLe })),
    blesses: Object.fromEntries(await blessesAuFoyer(jeu, territoireId, instant)),
  });

  /**
   * Le Territoire `t` vécu de chacune des trois manières jusqu'à `fin`, dans une transaction annulée ensuite, où chaque
   * transaction du jeu devient un point de reprise (poolDansLaTransaction) : ce que chacune laisse, et (page ouverte) ce
   * qu'elle a laissé une milliseconde avant l'instant `avant`, puis à cet instant. La tâche planifiée passe toutes les
   * heures (vercel.json).
   */
  const vivreDeTroisManieres = async (t: { territoireId: number; ne: Date }, fin: Date, avant?: Date) => {
    const depuis = await lireMarquePage(pool, "territoire", t.territoireId);
    const heures = Math.ceil((fin.getTime() - depuis.getTime()) / HEURE);
    const passages = Array.from({ length: heures }, (_, i) => new Date(Math.min(depuis.getTime() + (i + 1) * HEURE, fin.getTime())));
    const bilans = {} as Record<Maniere, Bilan>;
    let justeAvant: Bilan | null = null;
    let aLInstant: Bilan | null = null;
    for (const maniere of MANIERES) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const jeu = poolDansLaTransaction(client);
        if (maniere === "page ouverte") {
          for (const instant of passages.filter((p) => !avant || p < avant)) await rattraper("territoire", t.territoireId, { pool: jeu, jusqua: instant });
          if (avant) {
            await rattraper("territoire", t.territoireId, { pool: jeu, jusqua: apres(avant, -1) });
            justeAvant = await bilan(jeu, t.territoireId, apres(avant, -1));
            await rattraper("territoire", t.territoireId, { pool: jeu, jusqua: avant });
            aLInstant = await bilan(jeu, t.territoireId, avant);
          }
          await rattraper("territoire", t.territoireId, { pool: jeu, jusqua: fin });
        } else if (maniere === "d'un bloc") {
          await rattraper("territoire", t.territoireId, { pool: jeu, jusqua: fin });
        } else {
          for (const instant of passages) {
            expect(await rattraperLesAbsents({ pool: jeu, maintenant: instant, parmi: { territoire: [t.territoireId] } })).toMatchObject({
              rattrapes: 1,
              echecs: 0,
            });
          }
        }
        expect(await lireMarquePage(jeu, "territoire", t.territoireId)).toEqual(fin);
        bilans[maniere] = await bilan(jeu, t.territoireId, fin);
      } finally {
        await client.query("rollback");
        client.release();
      }
    }
    return { ...bilans, justeAvant, aLInstant };
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

  it(
    "les Blessés guérissent GUERISON_DES_BLESSES_HEURES après leur retour, et un Récit le dit à cet instant : le même page ouverte, d'un bloc ou par la tâche planifiée",
    async () => {
      const t = await naitre();
      const { retour } = await partir(
        t.territoireId,
        t.ne,
        [
          ["souris", 3],
          ["pigeon", 2],
        ],
        [
          ["souris", 2, 2],
          ["pigeon", 2, 1],
        ],
      );
      const guerison = apres(retour, GUERISON_DES_BLESSES_HEURES * HEURE);
      const fin = apres(guerison, HEURE);

      const bilans = await vivreDeTroisManieres(t, fin, guerison);
      // Une milliseconde avant la guérison, ils sont encore Blessés, et rien ne l'a dit.
      expect(bilans.justeAvant).toEqual({
        guerisons: [],
        blesses: { pigeon: [{ nombre: 1, gueriLe: guerison }], souris: [{ nombre: 2, gueriLe: guerison }] },
      });
      // À l'instant même, le Récit le dit, et blessesAuFoyer ne les compte plus.
      expect(bilans.aLInstant).toEqual({
        guerisons: [{ titre: "3 Blessés ont guéri", texte: "De nouveau valides : Pigeon biset (1) et Souris grise (2).", survenuLe: guerison }],
        blesses: {},
      });
      expect(bilans["page ouverte"]).toEqual(bilans.aLInstant);
      expect(bilans["d'un bloc"]).toEqual(bilans["page ouverte"]);
      expect(bilans["par la tâche planifiée"]).toEqual(bilans["page ouverte"]);
    },
    120_000,
  );

  it("une Expédition rentrée sans Blessé, avec ou sans pertes, ne guérit personne, et aucun Récit ne le dit", async () => {
    const t = await naitre();
    const sansPerte = await partir(t.territoireId, t.ne, [["souris", 1]], []);
    const desMorts = await partir(t.territoireId, t.ne, [["pigeon", 2]], [["pigeon", 2, 0]]);
    const fin = apres(desMorts.retour, (GUERISON_DES_BLESSES_HEURES + 1) * HEURE);
    expect(sansPerte.retour).toEqual(desMorts.retour);

    await rattraper("territoire", t.territoireId, { pool, jusqua: fin });
    expect(await bilan(pool, t.territoireId, fin)).toEqual({ guerisons: [], blesses: {} });
  }, 60_000);

  it("des Blessés rentrés à des instants différents guérissent chacun à son heure, chacun avec son Récit", async () => {
    const t = await naitre();
    const premiere = await partir(t.territoireId, t.ne, [["souris", 2]], [["souris", 1, 1]]);
    const seconde = await partir(t.territoireId, apres(t.ne, 3 * HEURE), [["pigeon", 3]], [["pigeon", 3, 3]]);
    const fin = apres(seconde.retour, (GUERISON_DES_BLESSES_HEURES + 1) * HEURE);

    await rattraper("territoire", t.territoireId, { pool, jusqua: fin });
    expect((await bilan(pool, t.territoireId, fin)).guerisons).toEqual([
      { titre: "3 Blessés ont guéri", texte: "De nouveau valides : Pigeon biset (3).", survenuLe: apres(seconde.retour, GUERISON_DES_BLESSES_HEURES * HEURE) },
      { titre: "1 Blessé a guéri", texte: "De nouveau valide : Souris grise (1).", survenuLe: apres(premiere.retour, GUERISON_DES_BLESSES_HEURES * HEURE) },
    ]);
  }, 60_000);

  it("des Blessés rentrés au même instant, par deux Expéditions, guérissent ensemble : un seul Récit (US-0952, un groupe)", async () => {
    const t = await naitre();
    const premiere = await partir(t.territoireId, t.ne, [["souris", 2]], [["souris", 2, 1]]);
    const seconde = await partir(t.territoireId, t.ne, [["souris", 2], ["pigeon", 1]], [["souris", 1, 1], ["pigeon", 1, 1]]);
    expect(seconde.retour).toEqual(premiere.retour);
    const guerison = apres(premiere.retour, GUERISON_DES_BLESSES_HEURES * HEURE);

    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(guerison, HEURE) });
    expect((await bilan(pool, t.territoireId, guerison)).guerisons).toEqual([
      { titre: "3 Blessés ont guéri", texte: "De nouveau valides : Pigeon biset (1) et Souris grise (2).", survenuLe: guerison },
    ]);
  }, 60_000);

  it("les Blessés d'un autre joueur ne guérissent pas chez soi : son Récit est le sien", async () => {
    const t = await naitre();
    const voisin = await naitre();
    const { retour } = await partir(voisin.territoireId, voisin.ne, [["souris", 2]], [["souris", 2, 2]]);
    const fin = apres(retour, (GUERISON_DES_BLESSES_HEURES + 1) * HEURE);

    await rattraper("territoire", t.territoireId, { pool, jusqua: fin });
    await rattraper("territoire", voisin.territoireId, { pool, jusqua: fin });
    expect((await bilan(pool, t.territoireId, fin)).guerisons).toEqual([]);
    expect((await bilan(pool, voisin.territoireId, fin)).guerisons).toEqual([
      { titre: "2 Blessés ont guéri", texte: "De nouveau valides : Souris grise (2).", survenuLe: apres(retour, GUERISON_DES_BLESSES_HEURES * HEURE) },
    ]);
  }, 60_000);

  it(
    "une guérison qui tombe juste après l'attaque d'une autre Expédition, dans la même avancée, n'est dite qu'une fois (US-0945)",
    async () => {
      const t = await naitre();
      // L'escorte de B : une Bête de la commune la plus faible ; la Bête rare qui l'attaque est plus forte qu'elle.
      const { rows: especes } = await pool.query<{ id: string; rareteId: string; attaque: number; vie: number }>(
        'select id, rarete_id as "rareteId", attaque, vie from espece order by id',
      );
      const forces = new Map(especes.map((e) => [e.id, forceDUneBete(e)]));
      const faible = especes.filter((e) => e.rareteId === "commune" && forces.get(e.id)! > 0).sort((x, y) => forces.get(x.id)! - forces.get(y.id)!)[0];
      const { rows: cases } = await pool.query<{ id: number }>(
        `select c.id from territoire t join case_du_monde f on f.id = t.foyer_case_id
           join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
         where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) between 2 and 8
           and not exists (select 1 from bete_de_naissance n where n.territoire_id = t.id and n.case_id = c.id)
         order by c.id`,
        [t.territoireId],
      );
      // Une Bête rare seule sur sa Case, plus de 36 h après la naissance, que l'Expédition B, posée en base avec un
      // identifiant choisi, voit à son arrivée et qui l'attaque à l'instant X : B s'enfuit, le temps s'arrête à X.
      const chercherB = async (): Promise<{ caseId: number; rare: BeteSauvage; id: number; attaque: Date } | null> => {
        const sauvages = await betesSauvagesDesCases(pool, cases.map((c) => c.id), apres(t.ne, 36 * HEURE), apres(t.ne, 20 * 24 * HEURE));
        for (const [caseId, betes] of sauvages) {
          for (const [i, rare] of betes.entries()) {
            if (rare.rareteId === "commune" || forces.get(rare.especeId)! <= forces.get(faible.id)! || rare.arrivee < apres(t.ne, 36 * HEURE)) continue;
            if ((i > 0 && betes[i - 1].depart > apres(rare.arrivee, -2 * HEURE)) || (betes[i + 1] && betes[i + 1].arrivee < apres(rare.depart, HEURE))) continue;
            for (let essais = 0; essais < 20; essais++) {
              const id = Number((await pool.query<{ id: string }>("select nextval(pg_get_serial_sequence('expedition', 'id')) as id")).rows[0].id);
              const attaque = await attaqueTiree(pool, { caseId, especeId: rare.especeId, numero: rare.numero }, id, { debut: rare.arrivee, fin: rare.depart });
              if (attaque) return { caseId, rare, id, attaque };
            }
          }
        }
        return null;
      };
      const b = await chercherB();
      if (!b) throw new Error("Aucune Bête rare seule qui attaquerait l'Expédition B.");
      const deB: HorairesDUneExpedition = {
        partLe: apres(b.rare.arrivee, -90 * MINUTE),
        trajetMinutes: 30,
        sejourMinutes: Math.ceil((b.rare.depart.getTime() - b.rare.arrivee.getTime()) / MINUTE) + 60,
      };
      await pool.query(
        "insert into expedition (id, territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) overriding system value values ($1, $2, $3, $4, $5, $6)",
        [b.id, t.territoireId, b.caseId, deB.partLe, deB.trajetMinutes, deB.sejourMinutes],
      );
      await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, 1)", [b.id, faible.id]);
      const client = await pool.connect();
      try {
        await programmerLeRetour(client, t.territoireId, b.id, deB);
      } finally {
        client.release();
      }
      // A rentre avec ses Blessés de sorte qu'ils guérissent une minute après l'attaque de B, avant le retour de B : sans
      // arrêt du temps à X, la même guérison serait dite une fois avant l'arrêt, puis une fois après.
      const guerison = apres(b.attaque, MINUTE);
      const aller = 2 * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE * MINUTE;
      const a = await partir(t.territoireId, apres(guerison, -GUERISON_DES_BLESSES_HEURES * HEURE - 2 * aller - HEURE), [["souris", 2]], [["souris", 2, 2]]);
      expect(apres(a.retour, GUERISON_DES_BLESSES_HEURES * HEURE)).toEqual(guerison);
      expect(guerison.getTime()).toBeLessThan(retourDUneExpedition(deB)!.getTime());
      const fin = apres(guerison, HEURE);

      const bilans = await vivreDeTroisManieres(t, fin);
      expect(bilans["page ouverte"]).toMatchObject({
        guerisons: [{ titre: "2 Blessés ont guéri", texte: "De nouveau valides : Souris grise (2).", survenuLe: guerison }],
      });
      expect(bilans["d'un bloc"]).toEqual(bilans["page ouverte"]);
      expect(bilans["par la tâche planifiée"]).toEqual(bilans["page ouverte"]);
      // B a bien été attaquée à X, et s'est enfuie : le temps s'y est arrêté.
      await rattraper("territoire", t.territoireId, { pool, jusqua: fin });
      const { rows: fuite } = await pool.query<{ enFuite: boolean; attaqueLe: Date | null }>(
        'select x.en_fuite as "enFuite", r.attaque_le as "attaqueLe" from expedition x join rencontre r on r.expedition_id = x.id where x.id = $1',
        [b.id],
      );
      expect(fuite).toEqual([{ enFuite: true, attaqueLe: b.attaque }]);
    },
    180_000,
  );

  it(
    "une durée de guérison qui n'est pas un nombre entier d'heures : le Récit tombe à l'instant même où blessesAuFoyer ne les compte plus",
    async () => {
      duree.heures = 36.25;
      try {
        const t = await naitre();
        const { retour } = await partir(t.territoireId, t.ne, [["souris", 2]], [["souris", 1, 1]]);
        const guerison = apres(retour, 36.25 * HEURE);
        const bilans = await vivreDeTroisManieres(t, apres(guerison, HEURE), guerison);
        expect(bilans.justeAvant).toEqual({ guerisons: [], blesses: { souris: [{ nombre: 1, gueriLe: guerison }] } });
        expect(bilans.aLInstant).toEqual({
          guerisons: [{ titre: "1 Blessé a guéri", texte: "De nouveau valide : Souris grise (1).", survenuLe: guerison }],
          blesses: {},
        });
        expect(bilans["d'un bloc"]).toEqual(bilans["page ouverte"]);
        expect(bilans["par la tâche planifiée"]).toEqual(bilans["page ouverte"]);
      } finally {
        duree.heures = null;
      }
    },
    120_000,
  );

  it("jamais plus de Blessés guéris que l'effectif n'en compte, comme la page Bêtes les montrait juste avant ; une Espèce sans Bête n'en dit rien", async () => {
    const t = await naitre();
    const premiere = await partir(
      t.territoireId,
      t.ne,
      [
        ["souris", 3],
        ["pigeon", 2],
      ],
      [
        ["souris", 2, 2],
        ["pigeon", 1, 1],
      ],
    );
    const seconde = await partir(t.territoireId, apres(t.ne, 3 * HEURE), [["pigeon", 1]], [["pigeon", 1, 1]]);
    // Rentrées, l'effectif baisse sans que leurs Blessés ne changent, comme quand un Couple réuni part en Réserve (US-0956) :
    // une souris de plus, aucun pigeon.
    await rattraper("territoire", t.territoireId, { pool, jusqua: seconde.retour });
    await pool.query("update effectif set nombre = 1 where territoire_id = $1 and espece_id = 'souris'", [t.territoireId]);
    await pool.query("update effectif set nombre = 0 where territoire_id = $1 and espece_id = 'pigeon'", [t.territoireId]);
    const guerisons = [premiere, seconde].map((x) => apres(x.retour, GUERISON_DES_BLESSES_HEURES * HEURE));

    // Juste avant la première guérison, la page Bêtes montre une souris Blessée, et aucun pigeon.
    const avant = apres(guerisons[0], -1);
    const groupes = await blessesAuFoyer(pool, t.territoireId, avant);
    const effectif = new Map((await effectifParEspece(pool, t.territoireId)).map((e) => [e.especeId, e.effectif]));
    expect(Object.fromEntries([...groupes].map(([espece, g]) => [espece, blessesAffiches(g, avant, effectif.get(espece) ?? 0).map((x) => x.nombre)]))).toEqual({
      pigeon: [],
      souris: [1],
    });

    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(guerisons[1], HEURE) });
    expect((await bilan(pool, t.territoireId, guerisons[1])).guerisons).toEqual([
      { titre: "1 Blessé a guéri", texte: "De nouveau valide : Souris grise (1).", survenuLe: guerisons[0] },
    ]);
  }, 60_000);

  it(
    "un éleveur libre au Foyer au retour soigne les Blessés : ils guérissent en GUERISON_DES_BLESSES_SOIGNES_HEURES, le temps affiché en tient compte, le même de trois manières (US-0955)",
    async () => {
      expect(GUERISON_DES_BLESSES_SOIGNES_HEURES).toBeLessThan(GUERISON_DES_BLESSES_HEURES);
      const t = await naitre();
      await engagerUnEleveur(t.territoireId);
      const { retour } = await partir(t.territoireId, t.ne, [["souris", 2]], [["souris", 2, 2]]);
      const guerison = apres(retour, GUERISON_DES_BLESSES_SOIGNES_HEURES * HEURE);

      const bilans = await vivreDeTroisManieres(t, apres(guerison, HEURE), guerison);
      expect(bilans.justeAvant).toEqual({ guerisons: [], blesses: { souris: [{ nombre: 2, gueriLe: guerison, soignes: true }] } });
      expect(bilans.aLInstant).toEqual({
        guerisons: [{ titre: "2 Blessés ont guéri", texte: "De nouveau valides : Souris grise (2).", survenuLe: guerison }],
        blesses: {},
      });
      expect(bilans["d'un bloc"]).toEqual(bilans["page ouverte"]);
      expect(bilans["par la tâche planifiée"]).toEqual(bilans["page ouverte"]);
    },
    120_000,
  );

  it("sans éleveur libre au retour, ni soins ni gain : l'éleveur à l'Élevage n'en donne pas, ni celui engagé après le retour (US-0955)", async () => {
    const t = await naitre();
    await engagerUnEleveur(t.territoireId, "souris");
    const { retour } = await partir(t.territoireId, t.ne, [["souris", 2]], [["souris", 1, 1]]);
    await rattraper("territoire", t.territoireId, { pool, jusqua: retour });
    // Le retour a eu lieu : un éleveur libre engagé maintenant n'y change rien.
    await pool.query("update habitant set espece_elevee = null where territoire_id = $1 and metier = 'eleveur'", [t.territoireId]);
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(retour, HEURE) });
    expect(Object.fromEntries(await blessesAuFoyer(pool, t.territoireId, apres(retour, HEURE)))).toEqual({
      souris: [{ nombre: 1, gueriLe: apres(retour, GUERISON_DES_BLESSES_HEURES * HEURE) }],
    });
  }, 60_000);

  it(
    "des Blessés soignés, rentrés plus tard, guérissent avant d'autres qui ne le sont pas : les pages les montrent dans l'ordre de leur guérison, un Récit à chaque instant, de trois manières (US-0955)",
    async () => {
      const t = await naitre();
      const premiere = await partir(t.territoireId, t.ne, [["souris", 2]], [["souris", 1, 1]]);
      const seconde = await partir(t.territoireId, apres(t.ne, HEURE), [["souris", 2]], [["souris", 2, 2]]);
      // La première rentre sans éleveur ; un éleveur arrive ; la seconde rentre, et ses Blessés sont soignés.
      await rattraper("territoire", t.territoireId, { pool, jusqua: premiere.retour });
      await engagerUnEleveur(t.territoireId);
      await rattraper("territoire", t.territoireId, { pool, jusqua: seconde.retour });
      const [g1, g2] = [apres(premiere.retour, GUERISON_DES_BLESSES_HEURES * HEURE), apres(seconde.retour, GUERISON_DES_BLESSES_SOIGNES_HEURES * HEURE)];
      expect(g2.getTime()).toBeLessThan(g1.getTime());
      const groupes = await blessesAuFoyer(pool, t.territoireId, seconde.retour);
      expect(Object.fromEntries(groupes)).toEqual({
        souris: [
          { nombre: 2, gueriLe: g2, soignes: true },
          { nombre: 1, gueriLe: g1 },
        ],
      });
      // Plafonnés à deux, les derniers à guérir sont retranchés les premiers : les soignés restent.
      expect(blessesAffiches(groupes.get("souris")!, seconde.retour, 2).map((g) => g.nombre)).toEqual([2]);

      const bilans = await vivreDeTroisManieres(t, apres(g1, HEURE), g2);
      expect(bilans.justeAvant).toEqual({
        guerisons: [],
        blesses: {
          souris: [
            { nombre: 2, gueriLe: g2, soignes: true },
            { nombre: 1, gueriLe: g1 },
          ],
        },
      });
      expect(bilans.aLInstant).toEqual({
        guerisons: [{ titre: "2 Blessés ont guéri", texte: "De nouveau valides : Souris grise (2).", survenuLe: g2 }],
        blesses: { souris: [{ nombre: 1, gueriLe: g1 }] },
      });
      expect(bilans["page ouverte"]).toEqual({
        guerisons: [
          { titre: "1 Blessé a guéri", texte: "De nouveau valide : Souris grise (1).", survenuLe: g1 },
          { titre: "2 Blessés ont guéri", texte: "De nouveau valides : Souris grise (2).", survenuLe: g2 },
        ],
        blesses: {},
      });
      expect(bilans["d'un bloc"]).toEqual(bilans["page ouverte"]);
      expect(bilans["par la tâche planifiée"]).toEqual(bilans["page ouverte"]);
    },
    120_000,
  );

  it("des Blessés soignés et d'autres qui ne le sont pas, guéris au même instant : deux groupes jusque-là, un seul Récit (US-0955)", async () => {
    const t = await naitre();
    const premiere = await partir(t.territoireId, t.ne, [["souris", 2]], [["souris", 1, 1]]);
    // La seconde rentre GUERISON_DES_BLESSES_HEURES - GUERISON_DES_BLESSES_SOIGNES_HEURES après la première, soignée : même instant.
    await rattraper("territoire", t.territoireId, { pool, jusqua: premiere.retour });
    await engagerUnEleveur(t.territoireId);
    const ecart = (GUERISON_DES_BLESSES_HEURES - GUERISON_DES_BLESSES_SOIGNES_HEURES) * HEURE;
    const seconde = await partir(t.territoireId, apres(t.ne, ecart), [["souris", 2]], [["souris", 2, 2]]);
    const guerison = apres(premiere.retour, GUERISON_DES_BLESSES_HEURES * HEURE);
    expect(apres(seconde.retour, GUERISON_DES_BLESSES_SOIGNES_HEURES * HEURE)).toEqual(guerison);
    await rattraper("territoire", t.territoireId, { pool, jusqua: seconde.retour });

    // Jusque-là, deux groupes de la même heure, le premier rentré d'abord.
    expect(Object.fromEntries(await blessesAuFoyer(pool, t.territoireId, apres(guerison, -1)))).toEqual({
      souris: [
        { nombre: 1, gueriLe: guerison },
        { nombre: 2, gueriLe: guerison, soignes: true },
      ],
    });
    const bilans = await vivreDeTroisManieres(t, apres(guerison, HEURE), guerison);
    expect(bilans.aLInstant).toEqual({
      guerisons: [{ titre: "3 Blessés ont guéri", texte: "De nouveau valides : Souris grise (3).", survenuLe: guerison }],
      blesses: {},
    });
    expect(bilans["d'un bloc"]).toEqual(bilans["page ouverte"]);
    expect(bilans["par la tâche planifiée"]).toEqual(bilans["page ouverte"]);
  }, 120_000);

  it("seuls les Blessés du Territoire dont l'éleveur attend au Foyer sont soignés : pas ceux d'un autre joueur, rattrapé avant ou après (US-0955)", async () => {
    const avecEleveur = await naitre();
    const sansEleveur = await naitre();
    await engagerUnEleveur(avecEleveur.territoireId);
    const a = await partir(avecEleveur.territoireId, avecEleveur.ne, [["souris", 2]], [["souris", 2, 2]]);
    const b = await partir(sansEleveur.territoireId, sansEleveur.ne, [["souris", 2]], [["souris", 2, 2]]);
    const lus = async (t: { territoireId: number }, retour: Date) =>
      Object.fromEntries(await blessesAuFoyer(pool, t.territoireId, apres(retour, HEURE)));
    for (const ordre of [
      [sansEleveur, avecEleveur],
      [avecEleveur, sansEleveur],
    ] as const) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const jeu = poolDansLaTransaction(client);
        for (const t of ordre) await rattraper("territoire", t.territoireId, { pool: jeu, jusqua: apres(t === avecEleveur ? a.retour : b.retour, HEURE) });
        const lire = async (t: { territoireId: number }, retour: Date) =>
          Object.fromEntries(await blessesAuFoyer(jeu, t.territoireId, apres(retour, HEURE)));
        expect(await lire(avecEleveur, a.retour)).toEqual({
          souris: [{ nombre: 2, gueriLe: apres(a.retour, GUERISON_DES_BLESSES_SOIGNES_HEURES * HEURE), soignes: true }],
        });
        expect(await lire(sansEleveur, b.retour)).toEqual({ souris: [{ nombre: 2, gueriLe: apres(b.retour, GUERISON_DES_BLESSES_HEURES * HEURE) }] });
      } finally {
        await client.query("rollback");
        client.release();
      }
    }
    // Rien n'est resté des deux essais : ni l'un ni l'autre n'est encore rentré.
    expect([await lus(avecEleveur, a.retour), await lus(sansEleveur, b.retour)]).toEqual([{}, {}]);
  }, 120_000);

  it("soignés, ils redeviennent disponibles pour une escorte à leur guérison, GUERISON_DES_BLESSES_SOIGNES_HEURES après leur retour (US-0953, US-0955)", async () => {
    const t = await naitre();
    await engagerUnEleveur(t.territoireId);
    const { retour } = await partir(t.territoireId, t.ne, [["souris", 2]], [["souris", 2, 2]]);
    const guerison = apres(retour, GUERISON_DES_BLESSES_SOIGNES_HEURES * HEURE);
    const souris = async (instant: Date) => {
      await rattraper("territoire", t.territoireId, { pool, jusqua: instant });
      const { disponibles, blesses } = (await betesDisponibles(pool, t.territoireId, instant)).find((e) => e.id === "souris")!;
      return { disponibles, blesses };
    };
    expect(await souris(apres(guerison, -1))).toEqual({ disponibles: 2, blesses: 2 });
    expect(await souris(guerison)).toEqual({ disponibles: 4, blesses: undefined });
  }, 60_000);
});
