import type { Pool } from "pg";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { betesSauvagesDUneCase } from "@/monde/betes-sauvages";
import { type Coordonnees, distance } from "@/monde/hex";
import { recitsDuTerritoire } from "@/monde/recits";
import { MARCHE_DES_EXPLORATEURS_KMH, PRESENCE_D_UNE_BETE_HEURES } from "@/reglages";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { dureeDuTrajetMinutes } from "./allure";
import { lancerLExpedition } from "./depart";
import { forceDUneBete } from "./force";

// La garde dit qui est connecté ; la page Récits lit pour de bon la base de test, à l'heure du jeu que l'essai choisit.
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

import Recits from "@/app/jeu/recits/page";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;
/** Le temps, en minutes, où aucune autre Bête n'apparaît avant ou après celle d'un essai : sa présence et 6 heures de marge. */
const CALME = PRESENCE_D_UNE_BETE_HEURES * HEURE + 6 * HEURE;
/** Le séjour des Expéditions des essais : une heure. */
const SEJOUR = HEURE;
/** Le titre des Récits de retour. */
const RETOUR = "Retour d'Expédition";

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de revenir chercher une Bête (US-0949)";

/** Une Espèce telle que l'essai la choisit pour une escorte : sa vitesse et la force d'une de ses Bêtes (US-0905). */
type Espece = { id: string; nom: string; vitesse: number; force: number };

describe.skipIf(!URL_TEST)("revenir chercher une Bête repérée (US-0949, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  /** Les Espèces du jeu, par identifiant ; la Souris grise, commune de force 473 (US-0905), dont deux Bêtes font la première escorte. */
  let especes: Map<string, Espece>;
  let faible: Espece;
  /** L'Espèce la plus forte qui va au moins au pas des explorateurs : l'escorte qui revient ne les ralentit pas. */
  let forte: Espece;
  const lancement = `revenir-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (suffixeDEssai). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les Cases déjà prises par un essai de ce fichier : chacun a la sienne, sans Expédition d'un autre. */
  const prises = new Set<number>();
  /** Une heure du jeu, `minutes` après `instant`. */
  const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);

  /** Un chef qui vient de naître dans le Monde d'essai, avec un explorateur et deux Souris grises. */
  const naitre = async () => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Rev", suffixe, n);
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
   * Une Bête sauvage plus rare que commune, seule, sur une Case libre à 2 à 5 Cases du Foyer du Territoire qu'aucun autre
   * essai n'a prise, apparue dans les 30 jours après `apresLe` : aucune autre n'apparaît sur sa Case de CALME minutes avant
   * elle à CALME minutes après. Sa Case et la Bête ; null si le Foyer n'en a aucune autour de lui.
   */
  const uneBeteRareSeule = async (territoireId: number, apresLe: Date) => {
    const fin = apres(apresLe, 30 * JOUR);
    for (let ecart = 2; ecart <= 5; ecart++) {
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
   * vers elle une Expédition arrivée une heure après elle, pour SEJOUR minutes : la Bête reste sur sa Case (US-0942) et le
   * joueur l'a repérée à son retour (US-0948). Son Territoire est mis à l'heure de ce retour. S'il n'y en a aucune, il
   * renaît ailleurs, jusqu'à trois fois.
   */
  const reperer = async () => {
    for (let essai = 0; essai < 3; essai++) {
      const chef = await naitre();
      const ici = await uneBeteRareSeule(chef.territoireId, apres(chef.ne, 3 * JOUR));
      if (!ici) continue;
      const { bete, place } = ici;
      expect(2 * faible.force).toBeLessThan(especes.get(bete.especeId)!.force);
      const { retour } = await partir(chef.territoireId, place, apres(bete.arrivee, HEURE), new Map([[faible.id, 2]]), [{ vitesse: faible.vitesse, nombre: 2 }], chef.foyer);
      expect(retour.getTime()).toBeLessThan(apres(bete.depart, -HEURE).getTime());
      await rattraperA(chef.territoireId, retour);
      return { ...chef, ...ici, retour };
    }
    throw new Error("Aucune Bête rare seule autour de trois Foyers.");
  };
  /** Une Expédition du Territoire vers `place`, arrivée à `arrivee` pour SEJOUR minutes, avec `escorte` : son identifiant, son arrivée et son retour. */
  const partir = async (
    territoireId: number,
    place: Coordonnees,
    arrivee: Date,
    escorte: Map<string, number>,
    allure: { vitesse: number; nombre: number }[],
    foyer: Coordonnees,
  ) => {
    const aller = dureeDuTrajetMinutes(distance(foyer, place), allure);
    const lancee = await lancerLExpedition(pool, territoireId, { destination: place, explorateurs: 1, escorte, sejourMinutes: SEJOUR }, apres(arrivee, -aller));
    if (!("expeditionId" in lancee)) throw new Error(lancee.refus);
    return { expeditionId: lancee.expeditionId, arrivee, retour: apres(arrivee, SEJOUR + aller) };
  };
  /** L'escorte assez forte pour la Bête de l'Espèce `especeId`, d'Espèce `forte`, versée dans l'effectif du Territoire. */
  const escorteAssezForte = async (territoireId: number, especeId: string) => {
    const nombre = Math.ceil(especes.get(especeId)!.force / forte.force);
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', $3)", [territoireId, forte.id, nombre]);
    return { escorte: new Map([[forte.id, nombre]]), allure: [{ vitesse: forte.vitesse, nombre }] };
  };
  /** Le Territoire mis à l'heure du jeu `instant`, comme à l'ouverture d'une page : le mécanisme unique du temps. */
  const rattraperA = (territoireId: number, instant: Date) => rattraper("territoire", territoireId, { pool, jusqua: instant });
  /** Le dernier Récit de retour du Territoire, tel que la page Récits le lit. */
  const dernierRetour = async (territoireId: number) => (await recitsDuTerritoire(pool, territoireId)).find((r) => r.titre === RETOUR)!;
  /** Les adresses des liens « Revenir la chercher » de la page Récits du joueur de ce Territoire, ouverte à l'heure du jeu `instant`. */
  const liensDesRecits = async (territoireId: number, instant: Date) => {
    garde.exigerCompte.mockResolvedValue({ id: 1, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId, recitLu: true });
    horloge.instant = instant;
    try {
      const html = renderToStaticMarkup(await Recits());
      return [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>Revenir la chercher<\/a>/g)].map(([, href]) => href.replace(/&amp;/g, "&"));
    } finally {
      horloge.instant = null;
    }
  };
  /** Une Expédition d'un autre Territoire posée sur la Case `caseId`, arrivée à `arrivee`, avec `nombre` Bêtes de l'Espèce `especeId`. */
  const poser = async (territoireId: number, caseId: number, arrivee: Date, especeId: string, nombre: number) => {
    const { rows } = await pool.query<{ id: number }>(
      "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, 30, $4) returning id",
      [territoireId, caseId, apres(arrivee, -30), SEJOUR],
    );
    await pool.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, $3)", [rows[0].id, especeId, nombre]);
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
    forte = [...especes.values()].filter((e) => e.vitesse >= MARCHE_DES_EXPLORATEURS_KMH).sort((a, b) => b.force - a.force)[0];
  }, 60_000);
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.query("delete from bete_partie p using case_du_monde c where c.id = p.case_id and c.monde_id = $1", [mondeId]);
    await pool.end();
  });

  it("le récit du retour mène à « Revenir la chercher », vers l'écran d'Expédition sur sa Case, tant qu'elle y est", async () => {
    const { territoireId, place, bete, retour } = await reperer();
    expect(await liensDesRecits(territoireId, retour)).toEqual([`/jeu/expeditions/nouvelle?q=${place.q}&r=${place.r}`]);
    await rattraperA(territoireId, bete.depart);
    expect(await liensDesRecits(territoireId, bete.depart)).toEqual([]);
  }, 60_000);

  it("encore là à l'arrivée d'une escorte assez forte, elle la suit dès son arrivée, et rentre au Foyer avec elle", async () => {
    const { territoireId, foyer, place, bete, retour } = await reperer();
    const { escorte, allure } = await escorteAssezForte(territoireId, bete.especeId);
    const arrivee = apres(retour, dureeDuTrajetMinutes(distance(foyer, place), allure) + 1);
    const deNouveau = await partir(territoireId, place, arrivee, escorte, allure, foyer);
    expect(deNouveau.arrivee.getTime()).toBeLessThan(bete.depart.getTime());
    await rattraperA(territoireId, deNouveau.retour);
    const { rows } = await pool.query<{ vueLe: Date; apprivoisee: boolean }>(
      'select vue_le as "vueLe", apprivoisee from rencontre where expedition_id = $1 and numero = $2',
      [deNouveau.expeditionId, bete.numero],
    );
    expect(rows).toEqual([{ vueLe: deNouveau.arrivee, apprivoisee: true }]);
    const recit = await dernierRetour(territoireId);
    expect(recit.texte).toContain(`Bête ramenée au Foyer : ${especes.get(bete.especeId)!.nom}`);
    expect(recit.texte).not.toContain("n'était plus sur la Case");
  }, 60_000);

  it("partie à la fin de sa durée avant l'arrivée, le récit du retour le dit", async () => {
    const { territoireId, foyer, place, bete } = await reperer();
    const { escorte, allure } = await escorteAssezForte(territoireId, bete.especeId);
    const deNouveau = await partir(territoireId, place, apres(bete.depart, 10), escorte, allure, foyer);
    await rattraperA(territoireId, deNouveau.retour);
    const recit = await dernierRetour(territoireId);
    expect(recit.survenuLe).toEqual(deNouveau.retour);
    expect(recit.texte.split("\n")).toContain(`${especes.get(bete.especeId)!.nom} n'était plus sur la Case à votre arrivée.`);
  }, 60_000);

  it("partie avec l'Expédition d'un voisin avant l'arrivée, le récit du retour le dit aussi", async () => {
    // Le voisin naît d'abord : né après le choix de la Case, son Foyer pourrait s'y poser, et la Bête n'y serait plus.
    const voisin = await naitre();
    const moi = await reperer();
    // Le voisin vient sur sa Case une demi-heure après le retour du joueur, assez fort pour qu'elle le suive (US-0934).
    await poser(voisin.territoireId, moi.caseId, apres(moi.retour, 30), moi.bete.especeId, 1);
    const { escorte, allure } = await escorteAssezForte(moi.territoireId, moi.bete.especeId);
    const arrivee = apres(moi.retour, 60);
    expect(arrivee.getTime()).toBeLessThan(moi.bete.depart.getTime());
    const deNouveau = await partir(moi.territoireId, moi.place, arrivee, escorte, allure, moi.foyer);
    await rattraperA(moi.territoireId, deNouveau.retour);
    expect((await dernierRetour(moi.territoireId)).texte.split("\n")).toContain(`${especes.get(moi.bete.especeId)!.nom} n'était plus sur la Case à votre arrivée.`);
  }, 60_000);

  it("encore là à l'arrivée d'une escorte trop faible, elle reste : le récit ne la dit pas partie", async () => {
    const { territoireId, foyer, place, bete, retour } = await reperer();
    const allure = [{ vitesse: faible.vitesse, nombre: 2 }];
    const deNouveau = await partir(territoireId, place, apres(retour, dureeDuTrajetMinutes(distance(foyer, place), allure) + 1), new Map([[faible.id, 2]]), allure, foyer);
    expect(deNouveau.arrivee.getTime()).toBeLessThan(bete.depart.getTime());
    await rattraperA(territoireId, deNouveau.retour);
    const recit = await dernierRetour(territoireId);
    expect(recit.texte).not.toContain("n'était plus sur la Case");
    expect(recit.rencontres).toEqual([expect.objectContaining({ especeId: bete.especeId, issue: "restee" })]);
  }, 60_000);
});
