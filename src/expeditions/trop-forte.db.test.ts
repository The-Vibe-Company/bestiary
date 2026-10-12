import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bestiaireDuTerritoire } from "@/bestiaire/bestiaire";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { type BeteSauvage, betesSauvagesDUneCase } from "@/monde/betes-sauvages";
import { type Coordonnees, distance } from "@/monde/hex";
import { PRESENCE_D_UNE_BETE_HEURES } from "@/reglages";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { dureeDuTrajetMinutes } from "./allure";
import { lancerLExpedition } from "./depart";
import { forceDUneBete } from "./force";
import { rencontresDUneExpedition } from "./rencontres";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;
/** Le temps, en minutes, où aucune autre Bête n'apparaît avant ou après celle d'un essai : sa présence et 6 heures de marge. */
const CALME = PRESENCE_D_UNE_BETE_HEURES * HEURE + 6 * HEURE;
/** Le séjour d'une Expédition arrivée une heure après la Bête et repartie une heure avant elle. */
const SEJOUR = (PRESENCE_D_UNE_BETE_HEURES - 2) * HEURE;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de la Bête trop forte (US-0942)";

/** Une Espèce telle que l'essai la choisit pour une escorte : sa vitesse et la force d'une de ses Bêtes (US-0905). */
type Espece = { id: string; rareteId: string; vitesse: number; force: number };

describe.skipIf(!URL_TEST)("la Bête trop forte reste sur sa Case (US-0942, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  /** Les Espèces du jeu, par identifiant ; la Souris grise, commune de force 473 (US-0905), dont deux Bêtes font l'escorte des essais. */
  let especes: Map<string, Espece>;
  let faible: Espece;
  const lancement = `trop-forte-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les Cases déjà prises par un essai de ce fichier : chacun a la sienne, sans Expédition d'un autre. */
  const prises = new Set<number>();
  /** Une heure du jeu, `minutes` après `instant`. */
  const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);

  /**
   * Un chef qui vient de naître dans le Monde d'essai, avec un explorateur et deux Souris grises :
   * son Territoire, l'instant de sa naissance et la place de son Foyer.
   */
  const naitre = async () => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Fort", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query("insert into habitant (territoire_id, prenom, metier) values ($1, 'Essai', 'explorateur')", [territoireId]);
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 2)", [territoireId, faible.id]);
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
  const naitrePresDUneBeteRare = async () => {
    for (let essai = 0; essai < 3; essai++) {
      const chef = await naitre();
      const ici = await uneBeteRareSeule(chef.territoireId, apres(chef.ne, 3 * JOUR));
      if (ici) return { ...chef, ...ici };
    }
    throw new Error("Aucune Bête rare seule autour de trois Foyers.");
  };
  /**
   * Une Expédition du Territoire vers la Case `caseId`, telle qu'un départ la poserait en base, arrivée à `arrivee` pour
   * `sejourMinutes`, avec `nombre` Bêtes de l'Espèce `espece` en escorte, sans souci de la portée, des explorateurs ni de
   * l'effectif : pour revenir sur la Case après une première Expédition.
   */
  const poser = async (territoireId: number, caseId: number, arrivee: Date, sejourMinutes: number, espece: Espece, nombre: number) => {
    const { rows } = await pool.query<{ id: number }>(
      "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, 30, $4) returning id",
      [territoireId, caseId, apres(arrivee, -30), sejourMinutes],
    );
    await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, $3)", [rows[0].id, espece.id, nombre]);
    return rows[0].id;
  };
  /** Le Territoire mis à l'heure du jeu `instant`, comme à l'ouverture d'une page : le mécanisme unique du temps. */
  const rattraperA = (territoireId: number, instant: Date) => rattraper("territoire", territoireId, { pool, jusqua: instant });
  /** Les Rencontres retenues de l'Expédition, sans leur identifiant ni ce que le Bestiaire en dit (US-0933). */
  const rencontres = async (expeditionId: number) =>
    (await rencontresDUneExpedition(pool, expeditionId)).map((r) => ({ ...r, id: undefined, nouvelleEspece: undefined }));
  /** Ce que retient la Rencontre de la Bête sauvage `b` de la Case `caseId`, vue à `vueLe`, sans qu'elle suive l'Expédition. */
  const vueSansSuite = (b: BeteSauvage, caseId: number, vueLe: Date) => ({
    vueLe,
    caseId,
    apparueLe: b.arrivee,
    especeId: b.especeId,
    rareteId: b.rareteId,
    numero: b.numero,
    beteDeNaissanceId: null,
    apprivoisee: false,
  });
  /** La Bête `numero` de la Case `caseId` telle qu'elle y est de `de` à `a` : son départ, ou undefined si elle n'y est pas. */
  const departSurLaCase = async (caseId: number, numero: number, de: Date, a: Date) =>
    (await betesSauvagesDUneCase(pool, caseId, de, a)).find((b) => b.numero === numero)?.depart;

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
    faible = especes.get("souris")!;
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.query("delete from bete_partie p using case_du_monde c where c.id = p.case_id and c.monde_id = $1", [mondeId]);
    await pool.end();
  });

  it("plus forte que l'escorte, la Bête ne suit pas : l'Expédition la voit dès son arrivée et pendant tout son séjour, et son Espèce s'inscrit « croisée »", async () => {
    const { territoireId, foyer, place, caseId, bete } = await naitrePresDUneBeteRare();
    expect(2 * faible.force).toBeLessThan(especes.get(bete.especeId)!.force);
    // Deux Souris grises, lancées depuis le Foyer, arrivent une heure après la Bête et repartent une heure avant elle.
    const aller = dureeDuTrajetMinutes(distance(foyer, place), [{ vitesse: faible.vitesse, nombre: 2 }]);
    const arrivee = apres(bete.arrivee, HEURE);
    const lancee = await lancerLExpedition(
      pool,
      territoireId,
      { destination: place, explorateurs: 1, escorte: new Map([[faible.id, 2]]), sejourMinutes: SEJOUR },
      apres(arrivee, -aller),
    );
    if (!("expeditionId" in lancee)) throw new Error(lancee.refus);
    const finDuSejour = apres(arrivee, SEJOUR);

    await rattraperA(territoireId, apres(finDuSejour, aller + HEURE));
    expect(await rencontres(lancee.expeditionId)).toEqual([vueSansSuite(bete, caseId, arrivee)]);
    // À la dernière minute du séjour, la Bête est toujours sur sa Case, jusqu'à la fin de sa durée.
    expect(await departSurLaCase(caseId, bete.numero, apres(finDuSejour, -1), finDuSejour)).toEqual(bete.depart);
    expect(await bestiaireDuTerritoire(pool, territoireId)).toEqual([{ especeId: bete.especeId, etat: "croisee", croiseeLe: arrivee }]);
  });

  it("restée sur sa Case jusqu'à la fin de sa durée, une Expédition qui y arrive après le départ de la première la voit encore ; pas après", async () => {
    const { territoireId, caseId, bete } = await naitrePresDUneBeteRare();
    // Trois escortes trop faibles : la première arrive une heure après la Bête et repart une heure avant elle ; la deuxième
    // arrive une demi-heure avant son départ ; la troisième, à son départ.
    const premiere = await poser(territoireId, caseId, apres(bete.arrivee, HEURE), SEJOUR, faible, 2);
    const deuxieme = await poser(territoireId, caseId, apres(bete.depart, -30), HEURE, faible, 2);
    const troisieme = await poser(territoireId, caseId, bete.depart, HEURE, faible, 2);

    await rattraperA(territoireId, apres(bete.depart, JOUR));
    expect(await rencontres(premiere)).toEqual([vueSansSuite(bete, caseId, apres(bete.arrivee, HEURE))]);
    expect(await rencontres(deuxieme)).toEqual([vueSansSuite(bete, caseId, apres(bete.depart, -30))]);
    expect(await rencontres(troisieme)).toEqual([]);
    expect(await departSurLaCase(caseId, bete.numero, bete.arrivee, bete.depart)).toEqual(bete.depart);
  });
});
