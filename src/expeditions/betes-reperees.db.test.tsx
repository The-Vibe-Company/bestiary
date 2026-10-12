import type { Pool } from "pg";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { betesSauvagesDUneCase } from "@/monde/betes-sauvages";
import { type Coordonnees, distance } from "@/monde/hex";
import { recitsDuTerritoire } from "@/monde/recits";
import { PRESENCE_D_UNE_BETE_HEURES } from "@/reglages";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, poolDeTest, preparerMondeDeTest, territoireDuCompte, URL_TEST } from "@/test/base";
import { dureeDuTrajetMinutes } from "./allure";
import type { BeteReperee } from "./betes-reperees";
import { lancerLExpedition } from "./depart";
import { forceDUneBete } from "./force";

// La garde dit qui est connecté ; la page lit pour de bon la base de test, à l'heure du jeu que l'essai choisit.
const garde = vi.hoisted(() => ({ exigerCompte: vi.fn() }));
vi.mock("@/comptes/garde", () => garde);
const base = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/db", async (original) => ({ ...(await original<object>()), getPool: () => base.pool }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));
const horloge = vi.hoisted(() => ({ instant: null as Date | null }));
vi.mock("@/temps/horloge", async (original) => {
  const vraie = await original<typeof import("@/temps/horloge")>();
  return { ...vraie, maintenant: () => horloge.instant ?? vraie.maintenant() };
});
// Ce que la page envoie au navigateur pour la carte : les propriétés de CarteDuJeu, telles quelles.
vi.mock("@/app/jeu/carte/CarteDuJeu", () => ({ CarteDuJeu: (proprietes: object) => <canvas data-proprietes={JSON.stringify(proprietes)} /> }));
vi.mock("@/app/jeu/carte/Legende", () => ({ Legende: () => <aside /> }));
vi.mock("@/app/jeu/carte/Attente", () => ({ Attente: () => <div /> }));

import Carte from "@/app/jeu/carte/page";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;
/** Le temps, en minutes, où aucune autre Bête n'apparaît avant ou après celle d'un essai : sa présence et 6 heures de marge. */
const CALME = PRESENCE_D_UNE_BETE_HEURES * HEURE + 6 * HEURE;
/** Le séjour des Expéditions des essais : une heure. */
const SEJOUR = HEURE;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai des Bêtes repérées sur la carte (US-0948)";

/** Une Espèce telle que l'essai la choisit pour une escorte : sa vitesse et la force d'une de ses Bêtes (US-0905). */
type Espece = { id: string; nom: string; vitesse: number; force: number };

/** Une Bête repérée telle que la page l'envoie au navigateur : ses instants écrits en texte. */
type RepereeEnvoyee = Omit<BeteReperee, "jusquA"> & { jusquA: string };

describe.skipIf(!URL_TEST)("les Bêtes repérées que la carte reçoit, sur base (US-0948)", () => {
  let pool: Pool;
  let mondeId: number;
  /** Les Espèces du jeu, par identifiant ; la Souris grise, commune de force 473 (US-0905), dont deux Bêtes font l'escorte des essais. */
  let especes: Map<string, Espece>;
  let faible: Espece;
  const lancement = `betes-reperees-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    const nom = `Rep${lancement.slice(-5).replace(/[^a-z]/g, "x")}${"abcdefghij"[Math.floor(n / 10) % 10]}${"abcdefghij"[n % 10]}`;
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
  /**
   * Un chef né là où une Bête rare se montre seule autour de son Foyer, plus forte que ses deux Souris grises, qui lance
   * vers elle une Expédition arrivée une heure après elle, pour SEJOUR minutes : la Bête reste sur sa Case (US-0942). S'il
   * n'y en a aucune, il renaît ailleurs, jusqu'à trois fois. Son Territoire, la Case et la Bête, et l'instant du retour.
   */
  const voirUneBeteTropForte = async () => {
    for (let essai = 0; essai < 3; essai++) {
      const chef = await naitre();
      const ici = await uneBeteRareSeule(chef.territoireId, apres(chef.ne, 3 * JOUR));
      if (!ici) continue;
      const { bete, place } = ici;
      expect(2 * faible.force).toBeLessThan(especes.get(bete.especeId)!.force);
      const aller = dureeDuTrajetMinutes(distance(chef.foyer, place), [{ vitesse: faible.vitesse, nombre: 2 }]);
      const arrivee = apres(bete.arrivee, HEURE);
      const lancee = await lancerLExpedition(
        pool,
        chef.territoireId,
        { destination: place, explorateurs: 1, escorte: new Map([[faible.id, 2]]), sejourMinutes: SEJOUR },
        apres(arrivee, -aller),
      );
      if (!("expeditionId" in lancee)) throw new Error(lancee.refus);
      const retour = apres(arrivee, SEJOUR + aller);
      // Rentrée bien avant que la Bête s'en aille : la Bête est encore là à son retour.
      expect(retour.getTime()).toBeLessThan(apres(bete.depart, -HEURE).getTime());
      return { ...chef, ...ici, retour };
    }
    throw new Error("Aucune Bête rare seule autour de trois Foyers.");
  };
  /**
   * Une Expédition du Territoire vers la Case `caseId`, telle qu'un départ la poserait en base, arrivée à `arrivee` pour
   * SEJOUR minutes, avec `nombre` Bêtes de l'Espèce `especeId` en escorte, sans souci de la portée, des explorateurs ni de
   * l'effectif.
   */
  const poser = async (territoireId: number, caseId: number, arrivee: Date, especeId: string, nombre: number) => {
    const { rows } = await pool.query<{ id: number }>(
      "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, 30, $4) returning id",
      [territoireId, caseId, apres(arrivee, -30), SEJOUR],
    );
    await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, $3)", [rows[0].id, especeId, nombre]);
    return rows[0].id;
  };
  /** Le Territoire mis à l'heure du jeu `instant`, comme à l'ouverture d'une page : le mécanisme unique du temps. */
  const rattraperA = (territoireId: number, instant: Date) => rattraper("territoire", territoireId, { pool, jusqua: instant });
  /** Les Bêtes repérées que la page de la carte, ouverte à l'heure du jeu `instant`, envoie au navigateur du joueur de ce Territoire. */
  const surLaCarte = async (territoireId: number, instant: Date): Promise<RepereeEnvoyee[]> => {
    garde.exigerCompte.mockResolvedValue({ id: 1, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId, recitLu: true });
    horloge.instant = instant;
    try {
      const html = renderToStaticMarkup(await Carte({ params: Promise.resolve({}), searchParams: Promise.resolve({}) } as PageProps<"/jeu/carte">));
      const brut = html
        .match(/data-proprietes="([^"]*)"/)![1]
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, "&");
      return (JSON.parse(brut) as { betes: RepereeEnvoyee[] }).betes;
    } finally {
      horloge.instant = null;
    }
  };
  /** Le repère qu'attend la Bête `bete` de la Case `place` : son Espèce, sa force et la fin de sa durée. */
  const repereDe = (place: Coordonnees, bete: { especeId: string; depart: Date }) => ({
    id: expect.any(Number),
    laCase: place,
    especeId: bete.especeId,
    espece: especes.get(bete.especeId)!.nom,
    force: especes.get(bete.especeId)!.force,
    jusquA: bete.depart.toISOString(),
  });
  /** Les récits du Territoire survenus après l'instant `depuis` qui nomment l'Espèce `especeId` : le départ d'une Bête repérée n'en écrit aucun. */
  const recitsQuiLaNomment = async (territoireId: number, especeId: string, depuis: Date) => {
    const nom = especes.get(especeId)!.nom;
    return (await recitsDuTerritoire(pool, territoireId)).filter((r) => r.survenuLe > depuis && `${r.titre}\n${r.texte}`.includes(nom));
  };

  beforeAll(async () => {
    pool = poolDeTest();
    base.pool = pool;
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    // Les Bêtes emmenées lors d'un lancement précédent de ce fichier sont revenues sur leur Case.
    await pool.query("delete from bete_partie p using case_du_monde c where c.id = p.case_id and c.monde_id = $1", [mondeId]);
    const { rows } = await pool.query<Omit<Espece, "force"> & { attaque: number; vie: number }>(`select id, nom, vitesse, attaque, vie from espece order by id`);
    especes = new Map(rows.map(({ attaque, vie, ...e }) => [e.id, { ...e, force: forceDUneBete({ attaque, vie }) }]));
    faible = especes.get("souris")!;
  }, 60_000);
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.query("delete from bete_partie p using case_du_monde c where c.id = p.case_id and c.monde_id = $1", [mondeId]);
    await pool.end();
  });

  it("au retour de l'Expédition qui l'a vue, et pas avant, la Case de la Bête trop forte porte son repère : son Espèce, sa force, jusqu'à quand elle devrait rester", async () => {
    const { territoireId, place, bete, retour } = await voirUneBeteTropForte();
    // Sur le chemin du retour, l'Expédition l'a vue, mais le joueur n'en sait encore rien.
    await rattraperA(territoireId, apres(retour, -1));
    expect(await surLaCarte(territoireId, apres(retour, -1))).toEqual([]);
    await rattraperA(territoireId, retour);
    expect(await surLaCarte(territoireId, retour)).toEqual([repereDe(place, bete)]);
  });

  it("n'est visible que du joueur dont l'Expédition l'a vue, pas de son voisin", async () => {
    const moi = await voirUneBeteTropForte();
    const voisin = await naitre();
    await rattraperA(moi.territoireId, moi.retour);
    await rattraperA(voisin.territoireId, moi.retour);
    expect(await surLaCarte(moi.territoireId, moi.retour)).toEqual([repereDe(moi.place, moi.bete)]);
    expect(await surLaCarte(voisin.territoireId, moi.retour)).toEqual([]);
  });

  it("disparaît à la fin de sa durée, sans qu'aucun récit le dise", async () => {
    const { territoireId, place, bete, retour } = await voirUneBeteTropForte();
    await rattraperA(territoireId, apres(bete.depart, -1));
    expect(await surLaCarte(territoireId, apres(bete.depart, -1))).toEqual([repereDe(place, bete)]);
    await rattraperA(territoireId, bete.depart);
    expect(await surLaCarte(territoireId, bete.depart)).toEqual([]);
    await rattraperA(territoireId, apres(bete.depart, JOUR));
    expect(await recitsQuiLaNomment(territoireId, bete.especeId, retour)).toEqual([]);
  });

  it("disparaît dès qu'elle a suivi une autre Expédition, même celle d'un voisin qui n'a pas encore ouvert de page, sans récit", async () => {
    const moi = await voirUneBeteTropForte();
    const voisin = await naitre();
    // Le voisin vient sur sa Case une demi-heure après le retour du joueur, assez fort pour qu'elle le suive (US-0934).
    const arrivee = apres(moi.retour, 30);
    await poser(voisin.territoireId, moi.caseId, arrivee, moi.bete.especeId, 1);
    await rattraperA(moi.territoireId, apres(arrivee, -1));
    expect(await surLaCarte(moi.territoireId, apres(arrivee, -1))).toEqual([repereDe(moi.place, moi.bete)]);
    // Le Territoire du voisin n'est pas encore mis à l'heure : la Bête l'a pourtant suivi.
    await rattraperA(moi.territoireId, arrivee);
    expect(await surLaCarte(moi.territoireId, arrivee)).toEqual([]);
    await rattraperA(voisin.territoireId, apres(arrivee, 1));
    await rattraperA(moi.territoireId, apres(arrivee, 1));
    expect(await surLaCarte(moi.territoireId, apres(arrivee, 1))).toEqual([]);
    await rattraperA(moi.territoireId, apres(arrivee, JOUR));
    expect(await recitsQuiLaNomment(moi.territoireId, moi.bete.especeId, moi.retour)).toEqual([]);
  });
});
