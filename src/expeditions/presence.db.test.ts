import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { hacher } from "@/monde/couronne";
import type { Coordonnees } from "@/monde/hex";
import { PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE } from "@/reglages";
import { definirAncre } from "@/temps/horloge";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { lancerLExpedition } from "./depart";
import { expeditionsEnCours } from "./en-cours";
import { finDeLaPhase } from "./phase";
import { type ExpeditionPresente, expeditionsPresentesSurLaCase, expeditionsPresentesSurLesCases } from "./presence";

const MINUTE_MS = 60_000;
const JOUR_MS = 24 * 60 * MINUTE_MS;
/** Le pas des explorateurs sans escorte, en minutes de jeu par Case (US-0909). */
const PAS = PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE;
/** L'aller vers une Case à 2 Cases du Foyer. */
const ALLER = 2 * PAS;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de la présence sur la Case (US-0915)";

describe.skipIf(!URL_TEST)("le séjour sur la Case : les Expéditions présentes (US-0915, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `presence-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /**
   * L'heure du jeu du départ de chaque essai, à un mois de celle du précédent : les Expéditions d'un essai ne croisent
   * jamais celles d'un autre, même sur une même Case.
   */
  let essai = 0;
  const unDepart = () => new Date(Date.UTC(2026, 9, 9, 7, 42) + ++essai * 30 * JOUR_MS);
  /** Une heure du jeu, `minutes` après `depart`. */
  const apres = (depart: Date, minutes: number) => new Date(depart.getTime() + minutes * MINUTE_MS);
  /** L'instant `instant`, à `ms` millisecondes près. */
  const decale = (instant: Date, ms: number) => new Date(instant.getTime() + ms);

  /** Un chef qui vient de naître dans le Monde d'essai, avec `explorateurs` explorateurs : son Territoire et la Case de son Foyer. */
  const naitre = async (explorateurs = 1) => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Seja", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query(`insert into habitant (territoire_id, prenom, metier) select $1, 'Essai', 'explorateur' from generate_series(1, $2)`, [territoireId, explorateurs]);
    const { rows } = await pool.query<{ foyer: number }>("select foyer_case_id as foyer from territoire where id = $1", [territoireId]);
    return { territoireId, foyer: rows[0].foyer };
  };
  /** La `rang`-ième Case libre du Monde du Territoire à `ecart` Cases de son Foyer : sa place et son identifiant. */
  const aLEcart = async (territoireId: number, ecart: number, rang = 0) => {
    const { rows } = await pool.query<Coordonnees & { id: number }>(
      `select c.id, c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = $2
       order by c.q, c.r limit 1 offset $3`,
      [territoireId, ecart, rang],
    );
    return { place: { q: rows[0].q, r: rows[0].r }, caseId: rows[0].id };
  };
  /** Le départ d'un explorateur vers `destination`, à `instant`, pour `sejourMinutes` de séjour ; rend l'Expédition. */
  const partir = async (territoireId: number, destination: Coordonnees, instant: Date, sejourMinutes: number) => {
    const depart = await lancerLExpedition(pool, territoireId, { destination, explorateurs: 1, escorte: new Map(), sejourMinutes }, instant);
    if (!("expeditionId" in depart)) throw new Error(depart.refus);
    return depart.expeditionId;
  };
  /**
   * Une Expédition du Territoire vers la Case `caseId`, telle qu'un départ la poserait en base, avec les horaires donnés,
   * sans souci de la portée : pour mettre sur une même Case des Expéditions de Territoires éloignés. Un trajet null est
   * celui d'une escorte partie avant qu'il soit chiffré (US-0912).
   */
  const poser = async (territoireId: number, caseId: number, partLe: Date, trajetMinutes: number | null, sejourMinutes: number) => {
    const { rows } = await pool.query<{ id: number }>(
      "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, $4, $5) returning id",
      [territoireId, caseId, partLe, trajetMinutes, sejourMinutes],
    );
    return rows[0].id;
  };
  /** Les Expéditions présentes sur la Case à l'instant `instant`. */
  const presentesA = (caseId: number, instant: Date) => expeditionsPresentesSurLaCase(pool, caseId, instant);

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterEach(() => definirAncre(null));
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("n'est pas sur la Case pendant l'aller ; y est dès l'arrivée, en phase « séjour », avec le compte à rebours de la durée choisie", async () => {
    const depart = unDepart();
    const { territoireId, foyer } = await naitre();
    const { place, caseId } = await aLEcart(territoireId, 2);
    const id = await partir(territoireId, place, depart, 60);

    for (const instant of [depart, apres(depart, ALLER / 2), decale(apres(depart, ALLER), -1)]) expect(await presentesA(caseId, instant)).toEqual([]);
    const presente: ExpeditionPresente = { id, territoireId, arrivee: apres(depart, ALLER), depart: apres(depart, ALLER + 60) };
    expect(await presentesA(caseId, apres(depart, ALLER))).toEqual([presente]);
    // Ni au Foyer, d'où elle est partie, ni sur une autre Case : sur la sienne seulement.
    expect(await presentesA(foyer, apres(depart, ALLER))).toEqual([]);
    expect(await presentesA((await aLEcart(territoireId, 2, 1)).caseId, apres(depart, ALLER))).toEqual([]);

    const [enSejour] = await expeditionsEnCours(pool, territoireId, apres(depart, ALLER));
    expect(enSejour.phase).toBe("sejour");
    expect(finDeLaPhase(enSejour, apres(depart, ALLER))).toEqual(apres(depart, ALLER + 60));
  });

  it("y reste toute la durée choisie, puis repart seule vers le Foyer à la fin du séjour, sans action du joueur ni écriture", async () => {
    const depart = unDepart();
    const { territoireId } = await naitre();
    const { place, caseId } = await aLEcart(territoireId, 2);
    const id = await partir(territoireId, place, depart, 240);
    const avant = (await pool.query("select * from expedition where id = $1", [id])).rows;

    for (const minutes of [0, 1, 60, 239]) expect((await presentesA(caseId, apres(depart, ALLER + minutes))).map((x) => x.id)).toEqual([id]);
    expect((await presentesA(caseId, decale(apres(depart, ALLER + 240), -1))).map((x) => x.id)).toEqual([id]);
    for (const instant of [apres(depart, ALLER + 240), apres(depart, ALLER + 240 + ALLER / 2), apres(depart, 2 * ALLER + 240 + 1)]) {
      expect(await presentesA(caseId, instant)).toEqual([]);
    }
    expect((await expeditionsEnCours(pool, territoireId, apres(depart, ALLER + 240))).map((x) => x.phase)).toEqual(["retour"]);
    // Rien ne s'écrit à la fin du séjour : le départ de la Case se lit des horaires fixés au départ.
    expect((await pool.query("select * from expedition where id = $1", [id])).rows).toEqual(avant);
  });

  it("pendant une période, compte toute Expédition présente à un moment de celle-ci : début compris, fin exclue", async () => {
    const depart = unDepart();
    const { territoireId } = await naitre();
    const { place, caseId } = await aLEcart(territoireId, 2);
    const id = await partir(territoireId, place, depart, 60);
    const [arrivee, fin] = [apres(depart, ALLER), apres(depart, ALLER + 60)];
    const pendant = async (de: Date, a: Date) => (await expeditionsPresentesSurLaCase(pool, caseId, de, a)).map((x) => x.id);

    // Toute la période pendant l'aller, ou pendant le retour : personne.
    expect(await pendant(depart, arrivee)).toEqual([]);
    expect(await pendant(fin, apres(depart, 2 * ALLER + 60))).toEqual([]);
    // Une période qui chevauche l'arrivée, le séjour entier ou la fin du séjour, ou qui tombe au milieu : elle y est.
    expect(await pendant(depart, decale(arrivee, 1))).toEqual([id]);
    expect(await pendant(depart, apres(depart, 3 * ALLER + 60))).toEqual([id]);
    expect(await pendant(decale(fin, -1), apres(depart, 3 * ALLER + 60))).toEqual([id]);
    expect(await pendant(apres(depart, ALLER + 10), apres(depart, ALLER + 20))).toEqual([id]);
    // Une période vide ne compte personne.
    expect(await pendant(apres(depart, ALLER + 10), apres(depart, ALLER + 10))).toEqual([]);
  });

  it("met sur une même Case les Expéditions de plusieurs Territoires, chacune avec ses horaires, dans l'ordre des arrivées", async () => {
    const depart = unDepart();
    const [joueur, voisin] = [await naitre(3), await naitre()];
    const [ici, ailleurs] = [await aLEcart(joueur.territoireId, 2), await aLEcart(joueur.territoireId, 3)];
    const premiere = await partir(joueur.territoireId, ici.place, depart, 240);
    const seconde = await partir(joueur.territoireId, ici.place, apres(depart, 30), 60);
    const autre = await partir(joueur.territoireId, ailleurs.place, depart, 240);
    // Le voisin arrive entre les deux, après un aller de 5 minutes, et reste 2 h.
    const chezLui = await poser(voisin.territoireId, ici.caseId, apres(depart, ALLER + 10), 5, 120);
    // Une escorte partie avant que son trajet soit chiffré reste à l'aller (US-0912) : elle n'arrive jamais.
    await poser(voisin.territoireId, ici.caseId, depart, null, 60);
    const vide = (await aLEcart(joueur.territoireId, 2, 1)).caseId;

    const presentes = await expeditionsPresentesSurLesCases(pool, [ici.caseId, ailleurs.caseId, vide], apres(depart, ALLER + 30), apres(depart, ALLER + 31));
    expect(presentes).toEqual(
      new Map([
        [
          ici.caseId,
          [
            { id: premiere, territoireId: joueur.territoireId, arrivee: apres(depart, ALLER), depart: apres(depart, ALLER + 240) },
            { id: chezLui, territoireId: voisin.territoireId, arrivee: apres(depart, ALLER + 15), depart: apres(depart, ALLER + 15 + 120) },
            { id: seconde, territoireId: joueur.territoireId, arrivee: apres(depart, 30 + ALLER), depart: apres(depart, 30 + ALLER + 60) },
          ],
        ],
        [ailleurs.caseId, [{ id: autre, territoireId: joueur.territoireId, arrivee: apres(depart, 3 * PAS), depart: apres(depart, 3 * PAS + 240) }]],
        [vide, []],
      ]),
    );
    // Chacune part à son heure : à la fin de la seconde, il reste la première et le voisin.
    expect((await presentesA(ici.caseId, apres(depart, 30 + ALLER + 60))).map((x) => x.id)).toEqual([premiere, chezLui]);
    // Sur dix jours, l'escorte sans trajet n'y est toujours pas venue.
    expect((await expeditionsPresentesSurLaCase(pool, ici.caseId, depart, apres(depart, 10 * 24 * 60))).map((x) => x.id)).toEqual([premiere, chezLui, seconde]);
    // Une Case que le jeu n'a pas n'a personne.
    expect(await expeditionsPresentesSurLesCases(pool, [-1], depart, apres(depart, 10 * 60))).toEqual(new Map([[-1, []]]));
  });

  it("donne les mêmes Expéditions en direct et au rattrapage : quel que soit le découpage du temps, l'heure qu'il est, ou les autres Cases", async () => {
    const depart = unDepart();
    const [joueur, voisin] = [await naitre(), await naitre()];
    const [ici, ailleurs] = [await aLEcart(joueur.territoireId, 2), await aLEcart(joueur.territoireId, 4)];
    // Sur douze heures, des Expéditions qui se suivent et se chevauchent, et une sur une autre Case.
    const horaires: [number, number, number, number][] = [
      [joueur.territoireId, 0, 40, 60],
      [voisin.territoireId, 37, 13, 30],
      [joueur.territoireId, 95, 60, 240],
      [voisin.territoireId, 200, 40, 90],
      [joueur.territoireId, 410, 25, 30],
    ];
    for (const [territoireId, partie, trajet, sejour] of horaires) await poser(territoireId, ici.caseId, apres(depart, partie), trajet, sejour);
    await poser(voisin.territoireId, ailleurs.caseId, apres(depart, 60), 30, 120);
    const [de, a] = [depart, apres(depart, 12 * 60)];

    const dUnBloc = await expeditionsPresentesSurLaCase(pool, ici.caseId, de, a);
    expect(dUnBloc.map((x) => x.arrivee)).toEqual([40, 50, 155, 240, 435].map((m) => apres(depart, m)));
    /** Les Expéditions vues en parcourant [de, a) par morceaux, coupés aux instants `coupures`, chacune une fois. */
    const parMorceaux = async (coupures: number[]) => {
      const bornes = [de.getTime(), ...coupures.filter((t) => t > de.getTime() && t < a.getTime()).sort((x, y) => x - y), a.getTime()];
      const vues = new Map<number, ExpeditionPresente>();
      for (let i = 1; i < bornes.length; i++) {
        for (const x of await expeditionsPresentesSurLaCase(pool, ici.caseId, new Date(bornes[i - 1]), new Date(bornes[i]))) vues.set(x.id, x);
      }
      return [...vues.values()].sort((x, y) => x.arrivee.getTime() - y.arrivee.getTime() || x.id - y.id);
    };
    // Par pas de cinq minutes ; par heures, comme la tâche planifiée ; à des instants quelconques.
    const pas = (ms: number) => Array.from({ length: Math.ceil((a.getTime() - de.getTime()) / ms) }, (_, i) => de.getTime() + i * ms);
    const auHasard = Array.from({ length: 30 }, (_, i) => de.getTime() + Math.floor(hacher(i, 915) * (a.getTime() - de.getTime())));
    for (const coupures of [pas(5 * MINUTE_MS), pas(60 * MINUTE_MS), auHasard]) expect(await parMorceaux(coupures)).toEqual(dUnBloc);

    // Lue avant les arrivées, en direct, ou un mois après tous les retours : l'heure qu'il est n'y change rien.
    for (const jeu of [depart.getTime(), apres(depart, 6 * 60).getTime(), a.getTime() + 30 * JOUR_MS]) {
      definirAncre({ facteur: 1, reel: Date.now(), jeu });
      expect(await expeditionsPresentesSurLaCase(pool, ici.caseId, de, a)).toEqual(dUnBloc);
    }
    definirAncre(null);
    // Une Case seule comme au milieu d'autres.
    expect((await expeditionsPresentesSurLesCases(pool, [ailleurs.caseId, ici.caseId, joueur.foyer], de, a)).get(ici.caseId)).toEqual(dUnBloc);
  });
});
