import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { GUERISON_DES_BLESSES_HEURES, GUERISON_DES_BLESSES_SOIGNES_HEURES } from "@/reglages";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { lancerLExpedition } from "@/expeditions/depart";
import { reunirLesCouples } from "./couple";
import { betesDisponibles, faireEntrerDansLEffectif } from "./effectif";
import { placesDeLHabitat } from "./habitat";
import { affecterUneBete, retirerUneBete, rolesAuFoyer } from "./roles";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai des Bêtes affectées à leur Rôle (US-0837)";

const HEURE_MS = 3_600_000;
/** Le Rôle de la poule (donnees/especes.yaml), qui sert au Foyer. */
const NOURRICIER = { id: "nourricier", nom: "Nourricier" };

describe.skipIf(!URL_TEST)("affecter une Bête à son Rôle (US-0837, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `roles-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];
  /** Un instant du jeu de référence, et un autre `heures` après lui. */
  const t0 = new Date(Date.UTC(2031, 0, 10, 12));
  const a = (heures: number) => new Date(t0.getTime() + heures * HEURE_MS);

  /** Un joueur qui vient de naître dans le Monde d'essai : son Territoire. */
  const naitre = async () => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Rol", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    return (await territoireDuCompte(pool, compte.id))!;
  };
  /** Des Bêtes dans l'effectif du Territoire : une ligne par Espèce et par sexe, avec leur nombre. */
  const ajouter = (territoireId: number, lignes: [string, "male" | "femelle", number][]) =>
    pool.query(
      `insert into effectif (territoire_id, espece_id, sexe, nombre)
       select $1, e, s::sexe, n from unnest($2::text[], $3::text[], $4::int[]) as l(e, s, n)`,
      [territoireId, lignes.map((l) => l[0]), lignes.map((l) => l[1]), lignes.map((l) => l[2])],
    );
  /**
   * Une Expédition du Territoire posée en base, rentrée `rentreeA` heures après t0 (null : encore dehors), escortée de
   * `nombre` Bêtes de l'Espèce `especeId`, dont `blessees` Blessées au combat ; son identifiant.
   */
  const expedition = async (territoireId: number, rentreeA: number | null, especeId: string, nombre: number, blessees = 0) => {
    const { rows } = await pool.query<{ id: number }>(
      `insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes, rentree_le)
       select $1, c.id, $3, 30, 60, $4 from case_du_monde c where c.monde_id = $2 and c.chef_id is null order by c.id limit 1 returning id`,
      [territoireId, mondeId, a(-48), rentreeA === null ? null : a(rentreeA)],
    );
    // Une Blessée compte parmi les pertes de l'escorte (US-0951), mais reste dans l'effectif.
    await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre, perdues, blessees) values ($1, $2, $3, $4, $4)", [
      rows[0].id,
      especeId,
      nombre,
      blessees,
    ]);
    return rows[0].id;
  };
  /** Réunit les Couples du Territoire à l'instant t0, comme au retour d'une Expédition (US-0956) : les Espèces réunies. */
  const reunir = async (territoireId: number) => {
    const client = await pool.connect();
    try {
      return await reunirLesCouples(client, territoireId, t0);
    } finally {
      client.release();
    }
  };
  /**
   * Une Expédition lancée pour de bon à t0 (lancerLExpedition), un explorateur du Territoire et `nombre` poules en escorte,
   * vers une Case libre à deux Cases du Foyer ; son identifiant.
   */
  const partir = async (territoireId: number, nombre: number) => {
    await pool.query("insert into habitant (territoire_id, prenom, metier) values ($1, 'Joran', 'explorateur')", [territoireId]);
    const { rows } = await pool.query<{ q: number; r: number }>(
      `select c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = 2 order by c.q, c.r limit 1`,
      [territoireId],
    );
    const depart = await lancerLExpedition(pool, territoireId, { destination: rows[0], explorateurs: 1, escorte: new Map([["poule", nombre]]), sejourMinutes: 60 }, t0);
    if (!("expeditionId" in depart)) throw new Error(depart.refus);
    return depart.expeditionId;
  };
  /** Les Rôles au Foyer du Territoire à l'instant `instant`, Espèce par Espèce, en objet simple. */
  const lus = async (territoireId: number, instant = t0) => Object.fromEntries(await rolesAuFoyer(pool, territoireId, instant));
  /** `fois` « + » de suite sur l'Espèce `especeId`, à l'instant `instant` : ce que chacun a rendu. */
  const plus = async (territoireId: number, especeId: string, fois: number, instant = t0) => {
    const rendus: boolean[] = [];
    for (let i = 0; i < fois; i++) rendus.push(await affecterUneBete(pool, territoireId, especeId, instant));
    return rendus;
  };
  /** `fois` « − » de suite sur l'Espèce `especeId`, à l'instant `instant` : ce que chacun a rendu. */
  const moins = async (territoireId: number, especeId: string, fois: number, instant = t0) => {
    const rendus: boolean[] = [];
    for (let i = 0; i < fois; i++) rendus.push(await retirerUneBete(pool, territoireId, especeId, instant));
    return rendus;
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

  it("lit, pour chaque Espèce de l'effectif dont le Rôle sert au Foyer, son Rôle, ses Bêtes affectées et ses Bêtes valides ; ni l'Éclaireur ni une Espèce sans Rôle", async () => {
    const t = await naitre();
    await ajouter(t, [
      ["poule", "femelle", 3],
      ["pigeon", "male", 2],
      ["souris", "male", 4],
    ]);
    // Le pigeon est Éclaireur : il s'affecte au départ d'une Expédition (US-0976), pas d'ici ; la souris n'a aucun Rôle.
    expect(await lus(t)).toEqual({ poule: { role: NOURRICIER, affectees: 0, valides: 3 } });
  });

  it("« + » affecte une Bête de plus, tant qu'il en reste de valides ; « − » en retire une, tant qu'il en reste d'affectées", async () => {
    const t = await naitre();
    await ajouter(t, [["poule", "femelle", 3]]);
    expect(await plus(t, "poule", 4)).toEqual([true, true, true, false]);
    expect(await lus(t)).toEqual({ poule: { role: NOURRICIER, affectees: 3, valides: 3 } });
    expect(await moins(t, "poule", 4)).toEqual([true, true, true, false]);
    expect(await lus(t)).toEqual({ poule: { role: NOURRICIER, affectees: 0, valides: 3 } });
  });

  it("n'affecte ni l'Éclaireur, ni une Espèce sans Rôle, ni une Espèce absente de l'effectif, et ne touche jamais un autre Territoire", async () => {
    const [t, voisin] = [await naitre(), await naitre()];
    await ajouter(t, [
      ["poule", "femelle", 2],
      ["pigeon", "male", 2],
      ["souris", "male", 2],
    ]);
    // Le voisin n'a pas encore de poule.
    expect(await plus(voisin, "poule", 1)).toEqual([false]);
    await ajouter(voisin, [["poule", "male", 2]]);
    expect(await plus(t, "pigeon", 1)).toEqual([false]);
    expect(await plus(t, "souris", 1)).toEqual([false]);
    expect(await plus(t, "inconnue", 1)).toEqual([false]);
    expect(await plus(voisin, "poule", 1)).toEqual([true]);
    expect(await lus(t)).toEqual({ poule: { role: NOURRICIER, affectees: 0, valides: 2 } });
    expect(await moins(t, "poule", 1)).toEqual([false]);
    expect(await lus(voisin)).toEqual({ poule: { role: NOURRICIER, affectees: 1, valides: 2 } });
  });

  it("n'affecte que les Bêtes valides au Foyer : ni celles sorties en escorte, ni les Blessées, jusqu'à leur guérison", async () => {
    const t = await naitre();
    await ajouter(t, [["poule", "femelle", 6]]);
    // Deux poules sont dehors avec une Expédition ; une autre, rentrée blessée il y a une heure, guérit au Foyer.
    await expedition(t, null, "poule", 2);
    await expedition(t, -1, "poule", 1, 1);
    expect(await lus(t)).toEqual({ poule: { role: NOURRICIER, affectees: 0, valides: 3 } });
    expect(await plus(t, "poule", 4)).toEqual([true, true, true, false]);
    // Les valides sont les Bêtes que l'escorte peut emmener (US-0953) : une seule règle.
    expect((await betesDisponibles(pool, t, t0)).find((e) => e.id === "poule")?.disponibles).toBe(3);
    // Guérie, la Blessée peut l'être à son tour.
    const gueries = a(GUERISON_DES_BLESSES_HEURES);
    expect(await lus(t, gueries)).toEqual({ poule: { role: NOURRICIER, affectees: 3, valides: 4 } });
    expect(await plus(t, "poule", 2, gueries)).toEqual([true, false]);
  });

  it("une Blessée soignée à son retour redevient valide plus tôt, comme pour l'escorte (US-0955)", async () => {
    expect(GUERISON_DES_BLESSES_SOIGNES_HEURES).toBeLessThan(GUERISON_DES_BLESSES_HEURES - 1);
    const t = await naitre();
    await ajouter(t, [["poule", "femelle", 3]]);
    // Une poule rentrée blessée il y a une heure, soignée à son retour.
    const soignee = await expedition(t, -1, "poule", 1, 1);
    await pool.query("update expedition set blesses_soignes = true where id = $1", [soignee]);
    const disponibles = async (instant: Date) => (await betesDisponibles(pool, t, instant)).find((e) => e.id === "poule")?.disponibles;
    const avant = a(GUERISON_DES_BLESSES_SOIGNES_HEURES - 1.5);
    expect(await lus(t, avant)).toEqual({ poule: { role: NOURRICIER, affectees: 0, valides: 2 } });
    expect(await disponibles(avant)).toBe(2);
    // Guérie au bout de la guérison des soignés, bien avant celle des autres Blessés.
    const gueries = a(GUERISON_DES_BLESSES_SOIGNES_HEURES - 1);
    expect(await lus(t, gueries)).toEqual({ poule: { role: NOURRICIER, affectees: 0, valides: 3 } });
    expect(await disponibles(gueries)).toBe(3);
  });

  it("l'escorte emmène d'abord les Bêtes non affectées ; au-delà, celles qui partent ne sont plus affectées, même rentrées", async () => {
    const t = await naitre();
    await ajouter(t, [["poule", "femelle", 6]]);
    expect(await plus(t, "poule", 2)).toEqual([true, true]);
    // Trois poules partent (US-0842 retirera les affectées de l'escorte) : il en reste trois au Foyer, dont les deux affectées.
    const premiere = await partir(t, 3);
    expect(await lus(t)).toEqual({ poule: { role: NOURRICIER, affectees: 2, valides: 3 } });
    // Deux de plus : il n'en reste qu'une, et une seule affectée.
    const seconde = await partir(t, 2);
    expect(await lus(t)).toEqual({ poule: { role: NOURRICIER, affectees: 1, valides: 1 } });
    // Rentrées, les cinq poules sont de nouveau valides ; aucune n'est redevenue affectée.
    await pool.query("update expedition set rentree_le = $2 where id = any($1)", [[premiere, seconde], a(3)]);
    expect(await lus(t, a(4))).toEqual({ poule: { role: NOURRICIER, affectees: 1, valides: 6 } });
  });

  it("si le nombre retenu dépassait les valides, la lecture, « + » et « − » partiraient des valides", async () => {
    const t = await naitre();
    await ajouter(t, [["poule", "femelle", 3]]);
    await pool.query("insert into affectation (territoire_id, espece_id, nombre) values ($1, 'poule', 9)", [t]);
    expect(await lus(t)).toEqual({ poule: { role: NOURRICIER, affectees: 3, valides: 3 } });
    expect(await plus(t, "poule", 1)).toEqual([false]);
    expect(await moins(t, "poule", 1)).toEqual([true]);
    expect(await lus(t)).toEqual({ poule: { role: NOURRICIER, affectees: 2, valides: 3 } });
  });

  it("une Bête affectée reste dans l'effectif, avec ses Places : elle continue de les occuper", async () => {
    const t = await naitre();
    await ajouter(t, [["poule", "femelle", 3]]);
    const [effectif, places] = [
      (await pool.query("select espece_id, sexe, nombre from effectif where territoire_id = $1", [t])).rows,
      await placesDeLHabitat(pool, t),
    ];
    expect(await plus(t, "poule", 2)).toEqual([true, true]);
    expect((await pool.query("select espece_id, sexe, nombre from effectif where territoire_id = $1", [t])).rows).toEqual(effectif);
    expect(await placesDeLHabitat(pool, t)).toEqual(places);
  });

  it("n'affecte pas les Bêtes d'un Couple, parties en Réserve hors de l'effectif (décidé le 2026-10-13)", async () => {
    const t = await naitre();
    await ajouter(t, [
      ["poule", "male", 1],
      ["poule", "femelle", 2],
    ]);
    expect(await reunir(t)).toEqual(["poule"]);
    // Le Couple est en Réserve : seule la troisième poule, restée dans l'effectif, peut l'être.
    expect(await lus(t)).toEqual({ poule: { role: NOURRICIER, affectees: 0, valides: 1 } });
    expect(await plus(t, "poule", 2)).toEqual([true, false]);
  });

  it("des poules affectées qui partent en Réserve avec leur Couple ne le sont plus, même quand d'autres arrivent", async () => {
    const [t, autre] = [await naitre(), await naitre()];
    await ajouter(t, [
      ["poule", "male", 1],
      ["poule", "femelle", 2],
    ]);
    await ajouter(autre, [
      ["poule", "male", 1],
      ["poule", "femelle", 1],
    ]);
    expect(await plus(t, "poule", 3)).toEqual([true, true, true]);
    expect(await plus(autre, "poule", 2)).toEqual([true, true]);
    expect(await reunir(t)).toEqual(["poule"]);
    expect(await reunir(autre)).toEqual(["poule"]);
    expect(await lus(t)).toEqual({ poule: { role: NOURRICIER, affectees: 1, valides: 1 } });
    // Toutes les poules de l'autre sont en Réserve : plus aucune sur la page Bêtes.
    expect(await lus(autre)).toEqual({});
    // Deux poules arrivent chez l'un, une chez l'autre (US-0938) : aucune n'est affectée d'elle-même.
    await faireEntrerDansLEffectif(pool, t, [
      { especeId: "poule", sexe: "male" },
      { especeId: "poule", sexe: "male" },
    ]);
    await faireEntrerDansLEffectif(pool, autre, [{ especeId: "poule", sexe: "femelle" }]);
    expect(await lus(t)).toEqual({ poule: { role: NOURRICIER, affectees: 1, valides: 3 } });
    expect(await lus(autre)).toEqual({ poule: { role: NOURRICIER, affectees: 0, valides: 1 } });
  });

  it("des « + » envoyés au même instant n'affectent jamais plus de Bêtes qu'il n'y en a de valides", async () => {
    const t = await naitre();
    await ajouter(t, [["poule", "femelle", 3]]);
    const rendus = await Promise.all(Array.from({ length: 8 }, () => affecterUneBete(pool, t, "poule", t0)));
    expect(rendus.filter(Boolean)).toHaveLength(3);
    expect(await lus(t)).toEqual({ poule: { role: NOURRICIER, affectees: 3, valides: 3 } });
    const retraits = await Promise.all(Array.from({ length: 8 }, () => retirerUneBete(pool, t, "poule", t0)));
    expect(retraits.filter(Boolean)).toHaveLength(3);
    expect(await lus(t)).toEqual({ poule: { role: NOURRICIER, affectees: 0, valides: 3 } });
  });
});
