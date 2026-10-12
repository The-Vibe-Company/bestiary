import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { type BeteSauvage, betesSauvagesDesCases } from "@/monde/betes-sauvages";
import type { Coordonnees } from "@/monde/hex";
import { recitsDuTerritoire } from "@/monde/recits";
import { ABORDS_DU_FOYER_CASES, PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE } from "@/reglages";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, poolDeTest, preparerMondeDeTest, territoireDuCompte, URL_TEST } from "@/test/base";
import { lancerLExpedition } from "./depart";
import { forceDUneBete } from "./force";
import { retourDUneExpedition, sejourDUneExpedition } from "./phase";
import { attaquesSubies } from "./rencontres";

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
/** L'écart au Foyer des destinations des essais, en Cases : au-delà des abords du Foyer et de ses Bêtes de naissance (US-0975). */
const ECART = ABORDS_DU_FOYER_CASES + 2;
/** L'aller vers ces destinations, au pas des explorateurs sans escorte (US-0909), en minutes de jeu. */
const ALLER = ECART * PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE;
/** Le séjour des Expéditions des essais, en minutes de jeu : quatre heures, moins que la présence d'une Bête (US-0926). */
const SEJOUR = 240;
/** Le titre des Récits de retour, pour les trier parmi ceux du Territoire. */
const RETOUR = "Retour d'Expédition";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du récit de Rencontre (US-0940)";

/** Une Bête commune suit toujours l'Expédition, même sans escorte (US-0935) ; une plus rare, jamais. */
const commune = (b: BeteSauvage) => b.rareteId === "commune";

describe.skipIf(!URL_TEST)("le récit de Rencontre (US-0940, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `recit-rencontre-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];
  /** Les Cases déjà prises par un essai de ce fichier : chacun a la sienne, sans les Bêtes qu'un autre aurait emmenées. */
  const prises = new Set<number>();
  const apres = (instant: Date, ms: number) => new Date(instant.getTime() + ms);

  /** Un chef qui vient de naître dans le Monde d'essai, avec un explorateur : son Territoire et l'instant de sa naissance. */
  const naitre = async () => {
    const n = ++numero;
    const email = `${lancement}-${n}@essai.test`;
    nes.push(email);
    const compte = (await creerCompte(pool, email, "une phrase de passe"))!;
    const nom = `Ren${lancement.slice(-5).replace(/[^a-z]/g, "x")}${"abcdefghij"[Math.floor(n / 10) % 10]}${"abcdefghij"[n % 10]}`;
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query("insert into habitant (territoire_id, prenom, metier) values ($1, 'Joran', 'explorateur')", [territoireId]);
    return { email, territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /**
   * Un séjour de SEJOUR minutes sur une Case libre à ECART Cases du Foyer, qu'aucun autre essai n'a prise, d'une Expédition
   * partie à l'heure pile dans les neuf jours après la naissance : `accepte` veut les Bêtes qui s'y montrent, dans l'ordre
   * de leurs apparitions, l'arrivée et la fin du séjour. Un Foyer né sans un tel séjour autour de lui renaît ailleurs,
   * jusqu'à trois fois. Le Territoire, la destination, le départ, et les Bêtes qui se montreront.
   */
  const unSejourOu = async (accepte: (montrees: BeteSauvage[], arrivee: Date, fin: Date) => boolean) => {
    for (let essai = 0; essai < 3; essai++) {
      const { email, territoireId, ne } = await naitre();
      const { rows: cases } = await pool.query<Coordonnees & { id: number }>(
        `select c.id, c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
           join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
         where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = $2
           and not exists (select 1 from bete_de_naissance n where n.territoire_id = t.id and n.case_id = c.id)
         order by c.q, c.r`,
        [territoireId, ECART],
      );
      const libres = cases.filter((c) => !prises.has(c.id));
      const debut = new Date(Math.ceil(ne.getTime() / HEURE) * HEURE);
      const betes = await betesSauvagesDesCases(pool, libres.map((c) => c.id), debut, apres(debut, 10 * 24 * HEURE));
      for (const c of libres) {
        for (let depart = debut; depart < apres(debut, 9 * 24 * HEURE); depart = apres(depart, HEURE)) {
          const arrivee = apres(depart, ALLER * MINUTE);
          const fin = apres(arrivee, SEJOUR * MINUTE);
          const montrees = betes.get(c.id)!.filter((b) => b.arrivee < fin && b.depart > arrivee);
          if (accepte(montrees, arrivee, fin)) {
            prises.add(c.id);
            return { territoireId, caseId: c.id, destination: { q: c.q, r: c.r }, depart, arrivee, fin, montrees };
          }
        }
      }
      await pool.query("delete from compte where email = $1", [email]);
    }
    throw new Error(`Aucun séjour à ${ECART} Cases tel que l'essai le veut, en trois naissances.`);
  };
  /** Un explorateur, sans escorte, part à `depart` vers `destination` : l'Expédition et l'instant de son retour. */
  const partir = async (territoireId: number, destination: Coordonnees, depart: Date) => {
    const resultat = await lancerLExpedition(pool, territoireId, { destination, explorateurs: 1, escorte: new Map(), sejourMinutes: SEJOUR }, depart);
    if (!("expeditionId" in resultat)) throw new Error(resultat.refus);
    const horaires = { partLe: depart, trajetMinutes: ALLER, sejourMinutes: SEJOUR };
    expect(sejourDUneExpedition(horaires)!.debut).toEqual(apres(depart, ALLER * MINUTE));
    return { expeditionId: resultat.expeditionId, retour: retourDUneExpedition(horaires)! };
  };
  /** Le Territoire mis à l'heure du jeu `instant`, comme à l'ouverture d'une page : le mécanisme unique du temps. */
  const aLHeure = (territoireId: number, instant: Date) => rattraper("territoire", territoireId, { pool, jusqua: instant });
  /** Le Récit du retour, tel que la page Récits le lit. */
  const leRecit = async (territoireId: number) => {
    const recits = (await recitsDuTerritoire(pool, territoireId)).filter((r) => r.titre === RETOUR);
    expect(recits).toHaveLength(1);
    return recits[0];
  };
  /** L'Espèce `id` telle que le récit la montre : son nom, son illustration et sa Rareté. */
  const espece = async (id: string) =>
    (
      await pool.query<{ nom: string; illustration: string | null; rarete: { id: string; nom: string } }>(
        `select e.nom, e.illustration, json_build_object('id', ra.id, 'nom', ra.nom) as rarete from espece e join rarete ra on ra.id = e.rarete_id where e.id = $1`,
        [id],
      )
    ).rows[0];
  /** La force d'une Bête de l'Espèce `id` (US-0905) : sans escorte, toute celle qui manquait (US-0942). */
  const force = async (id: string) =>
    forceDUneBete((await pool.query<{ attaque: number; vie: number }>("select attaque, vie from espece where id = $1", [id])).rows[0]);
  /** Les sexes que le jeu a tirés aux Apprivoisements de l'Expédition (US-0937), Bête par Bête. */
  const sexes = async (expeditionId: number) =>
    (await pool.query<{ especeId: string; sexe: string }>('select espece_id as "especeId", sexe from rencontre where expedition_id = $1 and apprivoisee order by apparue_le, id', [expeditionId]))
      .rows;

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

  it("une Bête commune vue : son heure, son Espèce et sa Rareté, apprivoisée avec son sexe, et sa nouvelle Espèce au Bestiaire", async () => {
    const { territoireId, destination, depart, arrivee, montrees } = await unSejourOu((m) => m.length === 1 && commune(m[0]));
    const { expeditionId, retour } = await partir(territoireId, destination, depart);

    await aLHeure(territoireId, retour);
    const [bete] = montrees;
    const [{ sexe }] = await sexes(expeditionId);
    expect((await leRecit(territoireId)).rencontres).toEqual([
      {
        especeId: bete.especeId,
        vueLe: bete.arrivee > arrivee ? bete.arrivee : arrivee,
        issue: "apprivoisee",
        sexe,
        // Le chef vient de naître : c'est la première fois qu'il voit cette Espèce (US-0933).
        nouvelleEspece: true,
        ...(await espece(bete.especeId)),
      },
    ]);
  });

  it("une Bête plus rare encore là à la fin du séjour : trop forte pour l'Expédition sans escorte, restée sur sa Case", async () => {
    const { territoireId, destination, depart, arrivee, montrees } = await unSejourOu((m, _arrivee, fin) => m.length === 1 && !commune(m[0]) && m[0].depart >= fin);
    const { retour } = await partir(territoireId, destination, depart);

    await aLHeure(territoireId, retour);
    const [bete] = montrees;
    expect((await leRecit(territoireId)).rencontres).toEqual([
      {
        especeId: bete.especeId,
        vueLe: bete.arrivee > arrivee ? bete.arrivee : arrivee,
        issue: "restee",
        sexe: null,
        nouvelleEspece: true,
        // Sans escorte, il manquait toute sa force (US-0942).
        manque: await force(bete.especeId),
        // US-0949 : sa Case et son numéro sur sa Case, pour revenir la chercher tant qu'elle y est.
        laCase: destination,
        numero: bete.numero,
        ...(await espece(bete.especeId)),
      },
    ]);
  });

  it("une Bête plus rare emmenée pendant le séjour par l'Expédition plus forte d'un voisin : repartie, même avant que le voisin ne soit rattrapé", async () => {
    // Une Bête plus rare qui serait encore là à la fin du séjour, vue au moins deux heures avant.
    const { territoireId, caseId, destination, depart, arrivee, montrees } = await unSejourOu(
      (m, arrivee, fin) => m.length === 1 && !commune(m[0]) && m[0].depart >= fin && Math.max(m[0].arrivee.getTime(), arrivee.getTime()) < fin.getTime() - 2 * HEURE,
    );
    const { retour } = await partir(territoireId, destination, depart);
    const [bete] = montrees;
    // Une heure après que l'Expédition l'a vue, celle d'un voisin arrive sur la Case, avec une escorte assez forte pour elle.
    const emmenee = apres(bete.arrivee > arrivee ? bete.arrivee : arrivee, HEURE);
    const voisin = await naitre();
    const { rows: especes } = await pool.query<{ id: string; attaque: number; vie: number }>("select id, attaque, vie from espece");
    const forte = especes.map((e) => ({ id: e.id, force: forceDUneBete(e) })).sort((x, y) => y.force - x.force)[0];
    const { rows } = await pool.query<{ id: number }>(
      "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, 30, 60) returning id",
      [voisin.territoireId, caseId, apres(emmenee, -30 * MINUTE)],
    );
    await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, $3)", [
      rows[0].id,
      forte.id,
      Math.ceil((await force(bete.especeId)) / forte.force),
    ]);

    // Seul le Territoire du joueur avance : celui du voisin n'a pas encore retenu le départ de la Bête.
    await aLHeure(territoireId, retour);
    expect((await pool.query("select 1 from bete_partie where case_id = $1 and numero = $2", [caseId, bete.numero])).rowCount).toBe(0);
    expect((await leRecit(territoireId)).rencontres).toEqual([expect.objectContaining({ especeId: bete.especeId, issue: "repartie", repartieLe: emmenee, sexe: null })]);
    expect((await leRecit(territoireId)).rencontres![0]).not.toHaveProperty("manque");
  });

  it("une Bête plus rare partie de sa Case avant la fin du séjour : repartie à la fin de sa durée, à son heure ; l'Expédition finit son séjour sans plus être attaquée (US-0950)", async () => {
    const { territoireId, destination, depart, arrivee, fin, montrees } = await unSejourOu((m, _arrivee, fin) => m.length === 1 && !commune(m[0]) && m[0].depart < fin);
    const { expeditionId, retour } = await partir(territoireId, destination, depart);

    await aLHeure(territoireId, retour);
    const [bete] = montrees;
    expect(bete.depart < fin).toBe(true);
    expect((await leRecit(territoireId)).rencontres).toEqual([
      {
        especeId: bete.especeId,
        vueLe: bete.arrivee > arrivee ? bete.arrivee : arrivee,
        issue: "repartie",
        // US-0950 : l'heure où elle a quitté sa Case, à la fin de sa durée.
        repartieLe: bete.depart,
        sexe: null,
        nouvelleEspece: true,
        ...(await espece(bete.especeId)),
      },
    ]);
    // Partie, elle n'attaque plus (US-0943) ; l'Expédition rentre à son heure.
    expect((await attaquesSubies(pool, expeditionId)).filter(({ le }) => le >= bete.depart)).toEqual([]);
    expect((await pool.query<{ rentreeLe: Date }>(`select rentree_le as "rentreeLe" from expedition where id = $1`, [expeditionId])).rows[0].rentreeLe).toEqual(retour);
  }, 60_000);

  it("plusieurs Bêtes vues : chacune à son heure, dans l'ordre des apparitions, avec ce qu'il en advint", async () => {
    const { territoireId, destination, depart, arrivee, fin, montrees } = await unSejourOu((m) => m.length >= 2);
    const { expeditionId, retour } = await partir(territoireId, destination, depart);

    await aLHeure(territoireId, retour);
    const recit = await leRecit(territoireId);
    const tirages = await sexes(expeditionId);
    const especesVues = new Set<string>();
    const attendues = [];
    for (const b of montrees) {
      const issue = commune(b) ? "apprivoisee" : b.depart < fin ? "repartie" : "restee";
      attendues.push({
        especeId: b.especeId,
        vueLe: b.arrivee > arrivee ? b.arrivee : arrivee,
        issue,
        sexe: issue === "apprivoisee" ? tirages.shift()!.sexe : null,
        // Une Espèce n'est nouvelle au Bestiaire qu'à sa première Rencontre.
        nouvelleEspece: !especesVues.has(b.especeId),
        ...(issue === "restee" ? { manque: await force(b.especeId), laCase: destination, numero: b.numero } : {}),
        ...(issue === "repartie" ? { repartieLe: b.depart } : {}),
        ...(await espece(b.especeId)),
      });
      especesVues.add(b.especeId);
    }
    expect(recit.rencontres).toEqual(attendues);
    expect(tirages).toEqual([]);
  });

  it("sans Bête vue, le Récit du retour reste du texte, sans Rencontre", async () => {
    const { territoireId, destination, depart } = await unSejourOu((m) => m.length === 0);
    const { retour } = await partir(territoireId, destination, depart);

    await aLHeure(territoireId, retour);
    const recit = await leRecit(territoireId);
    expect(recit.texte).toContain("Aucune Bête ne s'est montrée.");
    expect("rencontres" in recit).toBe(false);
  });
});
