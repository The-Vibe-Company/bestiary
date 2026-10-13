// US-0944 : quand une Bête trop forte attaque une Expédition (US-0943), le combat se règle par la somme des forces : la
// Bête l'emporte, l'escorte perd des Bêtes au prorata de ses Espèces, à l'instant de l'attaque, et elles quittent
// l'effectif ; jamais les explorateurs, ni les Bêtes restées au Foyer, ni les Couples ; la Bête reste sur sa Case. Les
// mêmes pertes page ouverte, au retour du joueur ou par la tâche planifiée. US-0945 : puis l'Expédition fuit : elle
// abandonne son séjour et rentre aussitôt au Foyer, avec tous ses explorateurs et les Bêtes qui lui restent.
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { type BeteSauvage, betesSauvagesDUneCase, hasardsDeLAttaque } from "@/monde/betes-sauvages";
import { couplesDuTerritoire } from "@/monde/couple";
import { betesDisponibles } from "@/monde/effectif";
import { explorateursDuTerritoire } from "@/monde/explorateurs";
import { type Coordonnees, distance } from "@/monde/hex";
import { recitsDuTerritoire } from "@/monde/recits";
import { PRESENCE_D_UNE_BETE_HEURES, RATTRAPER_APRES_MINUTES } from "@/reglages";
import { rattraperLesAbsents } from "@/temps/absents";
import { formaterJourEtHeure, formaterMinutes } from "@/temps/affichage";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDansLaTransaction, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { dureeDuTrajetMinutes } from "./allure";
import { chanceDAttaqueParHeure, instantDeLAttaque, type Regime } from "./attaque";
import { blessesParmi, type Perte, pertesDuCombat } from "./combat";
import { lancerLExpedition } from "./depart";
import { subirLesCombats } from "./pertes";
import { expeditionsEnCours } from "./en-cours";
import { forceDUneBete } from "./force";
import { retourDUneExpedition } from "./phase";
import { expeditionsPresentesSurLaCase } from "./presence";
import { RAPPEL_DEJA_AU_RETOUR, rappelerLExpedition } from "./rappel";
import { raconterLeRetour } from "./recit-de-retour";
import { combatsDUneExpedition } from "./recit-du-combat";
import { attaquesSubies } from "./rencontres";

const MINUTE_MS = 60_000;
const HEURE = 60;
const JOUR = 24 * HEURE;
/** Le temps, en minutes, où aucune autre Bête n'apparaît avant ou après celle d'un essai : sa présence et 6 heures de marge. */
const CALME = PRESENCE_D_UNE_BETE_HEURES * HEURE + 6 * HEURE;
/** Le séjour d'une Expédition arrivée une heure après la Bête et repartie une heure avant elle. */
const SEJOUR = (PRESENCE_D_UNE_BETE_HEURES - 2) * HEURE;
/**
 * Au plus tant d'Expéditions lancées vers une même Bête pour en trouver une qu'elle attaque : avec un herbivore, à 5 % par
 * heure, une sur cinq environ l'est ; cent sans attaque n'arrivent qu'une fois sur un milliard.
 */
const LANCEES_AU_PLUS = 100;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du combat (US-0944)";

/** Une Espèce telle que l'essai la voit : sa vitesse, la force d'une de ses Bêtes (US-0905) et son régime. */
type Espece = { id: string; vitesse: number; force: number; regime: Regime };
/** Un chef né près d'une Bête rare seule : son Territoire, sa naissance, son Foyer, la Case de la Bête et la Bête. */
type Chef = { territoireId: number; ne: Date; foyer: Coordonnees; place: Coordonnees; caseId: number; bete: BeteSauvage };
/**
 * Une Expédition de l'essai : son identifiant, son départ, son aller en minutes, son retour prévu au départ, et l'instant
 * où la Bête l'attaque (null : jamais).
 */
type Lancee = { id: number; partLe: Date; aller: number; retour: Date; attaque: Date | null };

describe.skipIf(!URL_TEST)("le combat par la somme des forces (US-0944, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  let graine: number;
  /** Les Espèces du jeu, par identifiant ; la Souris grise et la poule, communes, font les escortes des essais. */
  let especes: Map<string, Espece>;
  const lancement = `combat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les Cases déjà prises par un essai de ce fichier : chacun a la sienne, sans Expédition d'un autre. */
  const prises = new Set<number>();
  const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);

  /**
   * Un chef qui vient de naître dans le Monde d'essai, avec LANCEES_AU_PLUS explorateurs et de quoi les nourrir des
   * semaines, sans Famine qui les fasse partir (US-0326) : son Territoire, sa naissance et son Foyer.
   */
  const naitre = async () => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Combat", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    await pool.query("insert into habitant (territoire_id, prenom, metier) select $1, 'Essai', 'explorateur' from generate_series(1, $2)", [
      territoireId,
      LANCEES_AU_PLUS,
    ]);
    await pool.query("update stock set limite = 1e9, quantite = 1e8 where territoire_id = $1 and ressource_id in ('viande', 'vegetaux')", [territoireId]);
    const { rows } = await pool.query<{ foyer: Coordonnees }>(
      "select json_build_object('q', f.q, 'r', f.r) as foyer from territoire t join case_du_monde f on f.id = t.foyer_case_id where t.id = $1",
      [territoireId],
    );
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId), foyer: rows[0].foyer };
  };
  /** La `rang`-ième Case libre du Monde du Territoire à `ecart` Cases de son Foyer, hors de ses Bêtes de naissance ; null au-delà de la dernière. */
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
   * Une Bête sauvage plus rare que commune, seule, sur une Case libre à 2 à 6 Cases du Foyer qu'aucun autre essai n'a
   * prise, apparue dans les 30 jours après `apresLe` : aucune autre n'apparaît sur sa Case de CALME minutes avant elle à
   * CALME minutes après. Sa Case et la Bête ; null si le Foyer n'en a aucune autour de lui.
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
  const naitrePresDUneBeteRare = async (): Promise<Chef> => {
    for (let essai = 0; essai < 3; essai++) {
      const chef = await naitre();
      const ici = await uneBeteRareSeule(chef.territoireId, apres(chef.ne, 3 * JOUR));
      if (ici) return { ...chef, ...ici };
    }
    throw new Error("Aucune Bête rare seule autour de trois Foyers.");
  };
  /**
   * Une escorte de poules et de Souris grises un peu moins forte que la Bête du chef : assez de poules pour en approcher la
   * force, au moins une, puis des Souris grises tant qu'elle reste plus forte. Trop forte pour l'escorte, la Bête ne la suit
   * pas (US-0942), et le combat ne lui coûte que peu de Bêtes.
   */
  const presqueAussiForte = ({ bete }: Chef): Map<string, number> => {
    const [poule, souris, force] = [especes.get("poule")!, especes.get("souris")!, especes.get(bete.especeId)!.force];
    const poules = Math.max(1, Math.floor((force - 1) / poule.force) - 1);
    return new Map([
      ["poule", poules],
      ["souris", Math.floor((force - 1 - poules * poule.force) / souris.force)],
    ]);
  };
  /**
   * Des Expéditions du chef, chacune d'un explorateur et de l'escorte `escorte`, lancées depuis le Foyer pour arriver une
   * heure après la Bête et repartir une heure avant elle, l'une après l'autre jusqu'à ce que la Bête en attaque une,
   * d'après ses tirages : la dernière. L'effectif compte pour elles assez de mâles de chaque Espèce, et une femelle.
   */
  const lancerJusquALAttaque = async (chef: Chef, escorte: Map<string, number>): Promise<Lancee[]> => {
    for (const [especeId, nombre] of escorte) {
      await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', $3), ($1, $2, 'femelle', 1)", [
        chef.territoireId,
        especeId,
        nombre * LANCEES_AU_PLUS,
      ]);
    }
    const betes = [...escorte].map(([id, nombre]) => ({ vitesse: especes.get(id)!.vitesse, nombre }));
    const aller = dureeDuTrajetMinutes(distance(chef.foyer, chef.place), betes);
    const arrivee = apres(chef.bete.arrivee, HEURE);
    const partLe = apres(arrivee, -aller);
    const lancees: Lancee[] = [];
    while (!lancees.at(-1)?.attaque) {
      if (lancees.length === LANCEES_AU_PLUS) throw new Error(`${LANCEES_AU_PLUS} Expéditions lancées sans qu'aucune soit attaquée.`);
      const lancee = await lancerLExpedition(pool, chef.territoireId, { destination: chef.place, explorateurs: 1, escorte, sejourMinutes: SEJOUR }, partLe);
      if (!("expeditionId" in lancee)) throw new Error(lancee.refus);
      const id = lancee.expeditionId;
      const attaque = instantDeLAttaque(
        { debut: arrivee, fin: new Date(Math.min(chef.bete.depart.getTime(), apres(arrivee, SEJOUR).getTime())) },
        chanceDAttaqueParHeure(especes.get(chef.bete.especeId)!.regime),
        (heure) => hasardsDeLAttaque({ graine, ...chef.place }, chef.bete.numero, id, heure),
      );
      lancees.push({ id, partLe, aller, retour: retourDUneExpedition({ partLe, trajetMinutes: aller, sejourMinutes: SEJOUR })!, attaque });
    }
    return lancees;
  };
  /** Le Territoire mis à l'heure du jeu `instant` avec `jeu`, comme à l'ouverture d'une page : le mécanisme unique du temps. */
  const rattraperA = (territoireId: number, instant: Date, jeu: Pool = pool) => rattraper("territoire", territoireId, { pool: jeu, jusqua: instant });
  /** Ce que la liste des Expéditions en cours montre de l'escorte de l'Expédition `id` : Espèce par Espèce, combien il en reste. */
  const escorteEnCours = async (territoireId: number, id: number, instant: Date, jeu: Pool = pool) =>
    Object.fromEntries((await expeditionsEnCours(jeu, territoireId, instant)).find((x) => x.id === id)!.escorte.map((e) => [e.id, e.nombre]));
  /** Ce que l'écran d'Expédition propose des Espèces de l'escorte : les disponibles, et les mâles et femelles possédés. */
  const proposees = async (territoireId: number, escorte: Map<string, number>, jeu: Pool = pool) =>
    Object.fromEntries(
      (await betesDisponibles(jeu, territoireId)).filter((e) => escorte.has(e.id)).map((e) => [e.id, { disponibles: e.disponibles, males: e.males, femelles: e.femelles }]),
    );
  /** US-0951 : parmi les pertes `pertes`, combien de Bêtes de l'Espèce `id` sont mortes : les autres ne sont que blessées (blessesParmi). */
  const mortes = (pertes: Perte[], id: string) => {
    const perdues = pertes.find((p) => p.especeId === id)?.nombre ?? 0;
    return perdues - blessesParmi(perdues);
  };
  /** L'instant du jeu où l'Expédition est rentrée au Foyer, ou null. */
  const rentreeLe = async (expeditionId: number) =>
    (await pool.query<{ rentreeLe: Date | null }>(`select rentree_le as "rentreeLe" from expedition where id = $1`, [expeditionId])).rows[0].rentreeLe;
  /** Ce que l'escorte `escorte` perd au combat contre la Bête du chef, Espèce par Espèce, selon la règle (src/expeditions/combat.ts). */
  const pertesAttendues = ({ bete }: Chef, escorte: Map<string, number>): Perte[] =>
    pertesDuCombat(
      especes.get(bete.especeId)!.force,
      [...escorte].map(([especeId, nombre]) => ({ especeId, nombre, force: especes.get(especeId)!.force })),
    );

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    graine = Number((await pool.query<{ graine: string }>("select graine from monde where id = $1", [mondeId])).rows[0].graine);
    // Les Bêtes emmenées lors d'un lancement précédent de ce fichier sont revenues sur leur Case.
    await pool.query("delete from bete_partie p using case_du_monde c where c.id = p.case_id and c.monde_id = $1", [mondeId]);
    const { rows } = await pool.query<Omit<Espece, "force"> & { attaque: number; vie: number }>("select id, vitesse, attaque, vie, regime from espece");
    especes = new Map(rows.map(({ attaque, vie, ...e }) => [e.id, { ...e, force: forceDUneBete({ attaque, vie }) }]));
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.query("delete from bete_partie p using case_du_monde c where c.id = p.case_id and c.monde_id = $1", [mondeId]);
    await pool.end();
  });

  it("à l'instant de l'attaque, l'escorte perd des Bêtes au prorata de ses Espèces, qui quittent l'effectif ; ni les explorateurs, ni les Bêtes restées au Foyer, ni les Couples ; la Bête reste sur sa Case", async () => {
    const chef = await naitrePresDUneBeteRare();
    const escorte = presqueAussiForte(chef);
    // Les Couples des deux Espèces de l'escorte, réunis avant, à l'abri en Réserve : aucun autre ne se formera au retour.
    await pool.query("insert into couple (territoire_id, espece_id, reuni_le) values ($1, 'poule', $2), ($1, 'souris', $2)", [chef.territoireId, chef.ne]);
    const lancees = await lancerJusquALAttaque(chef, escorte);
    const x = lancees.at(-1)!;
    const le = x.attaque!;
    const pertes = pertesAttendues(chef, escorte);
    // Plus forte que l'escorte, la Bête l'emporte : l'escorte perd au moins une Bête, mais pas toutes, la force lui manquant à peine.
    const perdues = pertes.reduce((n, p) => n + p.nombre, 0);
    expect(perdues).toBeGreaterThan(0);
    expect(perdues).toBeLessThan([...escorte.values()].reduce((n, x) => n + x, 0));

    await rattraperA(chef.territoireId, apres(le, -1 / 60_000));
    const avant = await proposees(chef.territoireId, escorte);
    expect(await escorteEnCours(chef.territoireId, x.id, le)).toEqual(Object.fromEntries(escorte));
    const explorateurs = await explorateursDuTerritoire(pool, chef.territoireId);

    await rattraperA(chef.territoireId, apres(le, 1 / 60_000));
    // L'escorte en cours n'a plus que ses survivantes.
    expect(await escorteEnCours(chef.territoireId, x.id, le)).toEqual(
      Object.fromEntries([...escorte].map(([id, nombre]) => [id, nombre - (pertes.find((p) => p.especeId === id)?.nombre ?? 0)])),
    );
    // Les Bêtes mortes ont quitté l'effectif, prises au sexe le plus nombreux : les mâles ; celles du Foyer, toujours là.
    // US-0951 : les Blessés y restent, sortis avec l'Expédition jusqu'à son retour.
    expect(await proposees(chef.territoireId, escorte)).toEqual(
      Object.fromEntries(Object.entries(avant).map(([id, p]) => [id, { ...p, males: p.males - mortes(pertes, id) }])),
    );
    // Les explorateurs n'ont rien perdu ; les Couples non plus.
    expect(await explorateursDuTerritoire(pool, chef.territoireId)).toEqual(explorateurs);
    expect(await couplesDuTerritoire(pool, chef.territoireId)).toEqual([
      { especeId: "poule", reuniLe: chef.ne },
      { especeId: "souris", reuniLe: chef.ne },
    ]);
    // La Bête sauvage n'a rien perdu : elle reste sur sa Case jusqu'à la fin de sa durée.
    expect((await betesSauvagesDUneCase(pool, chef.caseId, le, apres(le, 1))).map((b) => b.numero)).toEqual([chef.bete.numero]);
    expect(await attaquesSubies(pool, x.id)).toEqual([expect.objectContaining({ especeId: chef.bete.especeId, le })]);

    // Au retour, l'escorte rentre sans les Bêtes mortes, et avec ses Blessés (US-0951) : l'écran d'Expédition en propose
    // d'autant moins que de mortes.
    const retour = new Date(Math.max(...lancees.map((l) => l.retour.getTime())));
    await rattraperA(chef.territoireId, retour);
    expect(await proposees(chef.territoireId, escorte)).toEqual(
      Object.fromEntries(
        [...escorte].map(([id, nombre]) => {
          const morte = mortes(pertes, id);
          return [id, { disponibles: nombre * LANCEES_AU_PLUS + 1 - morte, males: nombre * LANCEES_AU_PLUS - morte, femelles: 1 }];
        }),
      ),
    );
    expect(await explorateursDuTerritoire(pool, chef.territoireId)).toEqual({ libres: LANCEES_AU_PLUS, total: LANCEES_AU_PLUS });
  }, 60_000);

  it("au retour, le récit donne, Espèce par Espèce, le nombre de morts et de Blessés de l'escorte (US-0951)", async () => {
    const chef = await naitrePresDUneBeteRare();
    const escorte = presqueAussiForte(chef);
    const lancees = await lancerJusquALAttaque(chef, escorte);
    const pertes = pertesAttendues(chef, escorte);
    await rattraperA(chef.territoireId, new Date(Math.max(...lancees.map((l) => l.retour.getTime()))));
    const noms: Record<string, string> = { poule: "Poule", souris: "Souris grise" };
    const dites = pertes.map(({ especeId, nombre }) => {
      const [mortes, blessees] = [nombre - blessesParmi(nombre), blessesParmi(nombre)];
      const dits = [mortes > 0 && `${mortes} ${mortes > 1 ? "morts" : "mort"}`, blessees > 0 && `${blessees} ${blessees > 1 ? "Blessés" : "Blessé"}`];
      return `${noms[especeId]} (${dits.filter(Boolean).join(", ")})`;
    });
    // Seul le retour de l'Expédition attaquée le dit, une seule fois.
    const lignes = (await recitsDuTerritoire(pool, chef.territoireId)).flatMap((r) => r.texte.split("\n")).filter((l) => l.startsWith("Pertes au combat"));
    expect(lignes).toEqual([`Pertes au combat : ${dites.length > 1 ? `${dites.slice(0, -1).join(", ")} et ${dites.at(-1)}` : dites[0]}.`]);
  }, 60_000);

  it("attaquée sans escorte, l'Expédition ne perd aucune Bête, et celles du Foyer restent toutes", async () => {
    const chef = await naitrePresDUneBeteRare();
    const lancees = await lancerJusquALAttaque(chef, new Map());
    // Cinq mâles : au retour, aucun Couple ne se réunit (US-0956), et l'effectif reste celui du Foyer.
    await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, 'souris', 'male', 5)", [chef.territoireId]);
    const x = lancees.at(-1)!;
    await rattraperA(chef.territoireId, apres(x.attaque!, 1));
    expect(await attaquesSubies(pool, x.id)).toEqual([expect.objectContaining({ le: x.attaque })]);
    expect(await proposees(chef.territoireId, new Map([["souris", 0]]))).toEqual({ souris: { disponibles: 5, males: 5, femelles: 0 } });
    expect(await escorteEnCours(chef.territoireId, x.id, x.attaque!)).toEqual({});
    // US-0945 : elle fuit de même, sans rien perdre, et rentre à l'heure de sa fuite.
    expect((await expeditionsEnCours(pool, chef.territoireId, apres(x.attaque!, 1))).find((e) => e.id === x.id)).toMatchObject({ phase: "retour", enFuite: true });
    const rentree = apres(x.attaque!, x.aller);
    await rattraperA(chef.territoireId, rentree);
    expect(await rentreeLe(x.id)).toEqual(rentree);
    expect(await proposees(chef.territoireId, new Map([["souris", 0]]))).toEqual({ souris: { disponibles: 5, males: 5, femelles: 0 } });
  }, 60_000);

  it("après le combat, l'Expédition fuit : elle quitte sa Case, rentre aussitôt, le retour aussi long que l'aller, avec tous ses explorateurs et ses Bêtes survivantes ; le joueur ne la rappelle plus", async () => {
    const chef = await naitrePresDUneBeteRare();
    const escorte = presqueAussiForte(chef);
    // Les Couples des deux Espèces déjà réunis : au retour, aucun autre ne se réunit (US-0956), l'effectif ne bouge pas.
    await pool.query("insert into couple (territoire_id, espece_id, reuni_le) values ($1, 'poule', $2), ($1, 'souris', $2)", [chef.territoireId, chef.ne]);
    const lancees = await lancerJusquALAttaque(chef, escorte);
    const x = lancees.at(-1)!;
    const le = x.attaque!;
    const rentree = apres(le, x.aller);
    // Bien avant son retour prévu au départ.
    expect(rentree < x.retour).toBe(true);
    const pertes = pertesAttendues(chef, escorte);
    const total = [...escorte.values()].reduce((n, nombre) => n + nombre, 0);

    await rattraperA(chef.territoireId, apres(le, -1 / 60_000));
    expect((await expeditionsEnCours(pool, chef.territoireId, le)).find((e) => e.id === x.id)).toMatchObject({ phase: "sejour", enFuite: false });
    await rattraperA(chef.territoireId, apres(le, 1 / 60_000));
    // Dans la liste et sur la carte : au retour, en fuite, avec son retour avancé.
    const enFuite = (await expeditionsEnCours(pool, chef.territoireId, apres(le, 1 / 60_000))).find((e) => e.id === x.id)!;
    expect(enFuite).toMatchObject({ phase: "retour", enFuite: true, rappeleeLe: le });
    expect(retourDUneExpedition(enFuite)).toEqual(rentree);
    // Elle a quitté sa Case : la Bête n'y voit plus personne.
    expect((await expeditionsPresentesSurLaCase(pool, chef.caseId, apres(le, -1))).map((e) => e.id)).toContain(x.id);
    expect((await expeditionsPresentesSurLaCase(pool, chef.caseId, le)).map((e) => e.id)).not.toContain(x.id);
    expect(await rappelerLExpedition(pool, chef.territoireId, x.id, apres(le, 1))).toEqual({ refus: RAPPEL_DEJA_AU_RETOUR });

    await rattraperA(chef.territoireId, apres(rentree, -1 / 60_000));
    expect(await rentreeLe(x.id)).toBeNull();
    await rattraperA(chef.territoireId, rentree);
    expect(await rentreeLe(x.id)).toEqual(rentree);
    // Son explorateur est de retour ; ses Bêtes survivantes, Blessés compris (US-0951), sont de nouveau proposées, les autres
    // Expéditions toujours dehors.
    const { rows } = await pool.query("select count(*)::int as n from habitant where expedition_id = $1", [x.id]);
    expect(rows[0].n).toBe(0);
    expect((await explorateursDuTerritoire(pool, chef.territoireId)).libres).toBe(LANCEES_AU_PLUS - (lancees.length - 1));
    const disponibles = Object.fromEntries((await betesDisponibles(pool, chef.territoireId)).map((e) => [e.id, e.disponibles]));
    for (const [id, nombre] of escorte) {
      expect(disponibles[id], id).toBe(nombre * LANCEES_AU_PLUS + 1 - (lancees.length - 1) * nombre - mortes(pertes, id));
    }
    expect(pertes.reduce((n, p) => n + p.nombre, 0)).toBeLessThan(total);
    // Son récit ne la dit pas rappelée : son séjour s'est arrêté à l'attaque.
    const recit = (await recitsDuTerritoire(pool, chef.territoireId)).find((r) => r.titre === "Retour d'Expédition")!;
    expect(recit.survenuLe).toEqual(rentree);
    expect(recit.texte).not.toMatch(/Rappelée/);
    expect(recit.texte).toContain(`séjour ${formaterMinutes(Math.ceil((le.getTime() - apres(x.partLe, x.aller).getTime()) / MINUTE_MS))}`);
  }, 60_000);

  it("une attaque dont la Rencontre manque ne s'écrit pas : l'Expédition ne fuit pas, et le temps ne s'arrête pas sans fin", async () => {
    const chef = await naitrePresDUneBeteRare();
    const x = (await lancerJusquALAttaque(chef, new Map())).at(-1)!;
    // Sa Rencontre retenue, puis effacée, comme une donnée héritée incohérente : rien ne peut porter son attaque.
    await rattraperA(chef.territoireId, apres(x.attaque!, -1 / 60_000));
    await pool.query("delete from rencontre where expedition_id = $1", [x.id]);

    await rattraperA(chef.territoireId, x.retour);
    expect(await attaquesSubies(pool, x.id)).toEqual([]);
    expect(await rentreeLe(x.id)).toEqual(x.retour);
    const { rows } = await pool.query("select rappelee_le, en_fuite from expedition where id = $1", [x.id]);
    expect(rows[0]).toEqual({ rappelee_le: null, en_fuite: false });
  }, 60_000);

  it("au retour, le récit dit le combat : son heure, la Bête et sa force, la force de l'escorte, ses pertes Espèce par Espèce, puis la fuite des explorateurs (US-0947)", async () => {
    const chef = await naitrePresDUneBeteRare();
    const escorte = presqueAussiForte(chef);
    const lancees = await lancerJusquALAttaque(chef, escorte);
    const x = lancees.at(-1)!;
    await rattraperA(chef.territoireId, new Date(Math.max(...lancees.map((l) => l.retour.getTime()))));

    const noms = new Map((await pool.query<{ id: string; nom: string }>("select id, nom from espece")).rows.map((e) => [e.id, e.nom]));
    const entier = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/\s/g, "\u00a0");
    const pertes = pertesAttendues(chef, escorte);
    const force = [...escorte].reduce((n, [id, nombre]) => n + especes.get(id)!.force * nombre, 0);
    // Seul le retour de l'Expédition attaquée raconte un combat ; il le fait en dernier, ses pertes (US-0951) avant la fuite.
    const recits = (await recitsDuTerritoire(pool, chef.territoireId)).filter((r) => r.texte.includes("\nCombat le "));
    expect(recits).toHaveLength(1);
    const lignes = recits[0].texte.split("\n");
    expect(lignes.slice(-3, -2)).toEqual([
      `Combat le ${formaterJourEtHeure(x.attaque!, "Europe/Paris")} : ${noms.get(chef.bete.especeId)}, de force ${entier(especes.get(chef.bete.especeId)!.force)}, contre votre escorte, de force ${entier(force)}.`,
    ]);
    expect(lignes.at(-2)).toMatch(/^Pertes au combat : /);
    expect(lignes.at(-1)).toBe("Vos explorateurs ont fui et sont tous rentrés au Foyer.");
    // Le résumé du récit compte ses Bêtes mortes sur la Rencontre de la Bête qui a attaqué (US-0941) ; rien sans mort.
    const morts = pertes.reduce((n, p) => n + mortes(pertes, p.especeId), 0);
    expect(recits[0].rencontres!.map((r) => r.perdues)).toEqual([morts > 0 ? morts : undefined]);
  }, 60_000);

  describe("les mêmes pertes, au même instant, page ouverte, au retour du joueur ou par la tâche planifiée", () => {
    /** Ce que le combat laisse au Territoire : chaque escorte, et ses pertes, et l'effectif de chaque Espèce, par sexe. */
    const bilan = async (jeu: Pool, territoireId: number) => ({
      escortes: (
        await jeu.query(
          `select s.expedition_id, s.espece_id, s.nombre, s.perdues, s.blessees from expedition_escorte s join expedition x on x.id = s.expedition_id
           where x.territoire_id = $1 order by 1, 2`,
          [territoireId],
        )
      ).rows,
      effectif: (await jeu.query("select espece_id, sexe, nombre from effectif where territoire_id = $1 order by 1, 2", [territoireId])).rows,
      // US-0945 : la fuite, et le retour, chacun à son heure.
      expeditions: (
        await jeu.query(
          `select id, rappelee_le, en_fuite, rentree_le, (select count(*)::int from habitant h where h.expedition_id = x.id) as dehors
           from expedition x where territoire_id = $1 order by id`,
          [territoireId],
        )
      ).rows,
    });
    /** L'essai dans une transaction annulée ensuite, où chaque transaction du jeu devient un point de reprise : le suivant repart du même état. */
    const enEssai = async <T,>(essai: (jeu: Pool) => Promise<T>): Promise<T> => {
      const client: PoolClient = await pool.connect();
      try {
        await client.query("begin");
        return await essai(poolDansLaTransaction(client));
      } finally {
        await client.query("rollback");
        client.release();
      }
    };

    it("le même combat, et les mêmes Bêtes perdues, quel que soit le découpage du temps", async () => {
      const chef = await naitrePresDUneBeteRare();
      const escorte = presqueAussiForte(chef);
      const lancees = await lancerJusquALAttaque(chef, escorte);
      const [debut, fin] = [lancees[0].partLe, apres(new Date(Math.max(...lancees.map((l) => l.retour.getTime()))), HEURE)];
      const le = lancees.at(-1)!.attaque!;
      await rattraperA(chef.territoireId, debut);
      const bilans = [
        // Page ouverte toutes les sept minutes, et de part et d'autre de l'attaque.
        await enEssai(async (jeu) => {
          const pas = new Set([le.getTime(), le.getTime() + 1]);
          for (let t = debut.getTime(); t < fin.getTime(); t += 7 * MINUTE_MS + 3_123) pas.add(t);
          for (const t of [...pas, fin.getTime()].sort((a, b) => a - b)) await rattraperA(chef.territoireId, new Date(t), jeu);
          return bilan(jeu, chef.territoireId);
        }),
        // D'un bloc, au retour du joueur.
        await enEssai(async (jeu) => {
          await rattraperA(chef.territoireId, fin, jeu);
          return bilan(jeu, chef.territoireId);
        }),
        // Par la seule tâche planifiée, toutes les heures.
        await enEssai(async (jeu) => {
          for (let t = debut.getTime(); t <= fin.getTime() + (HEURE + RATTRAPER_APRES_MINUTES) * MINUTE_MS; t += HEURE * MINUTE_MS) {
            await rattraperLesAbsents({ pool: jeu, maintenant: new Date(t), parmi: { territoire: [chef.territoireId] } });
          }
          return bilan(jeu, chef.territoireId);
        }),
      ];
      expect(bilans[1]).toEqual(bilans[0]);
      expect(bilans[2]).toEqual(bilans[0]);
      // Seule l'Expédition attaquée a fui, et elle est rentrée à l'heure de sa fuite, d'un bloc comme par morceaux.
      expect(bilans[0].expeditions).toEqual(
        lancees.map((l) => ({
          id: l.id,
          rappelee_le: l.attaque,
          en_fuite: l.attaque !== null,
          rentree_le: l.attaque ? apres(l.attaque, l.aller) : l.retour,
          dehors: 0,
        })),
      );
      // Seule l'Expédition attaquée a perdu des Bêtes, celles que dit la règle ; US-0951 : et les mêmes Blessés parmi elles.
      const pertes = new Map(pertesAttendues(chef, escorte).map((p) => [p.especeId, p.nombre]));
      expect(bilans[0].escortes).toEqual(
        lancees.flatMap((l) =>
          [...escorte]
            .map(([id, nombre]) => {
              const perdues = l.attaque ? (pertes.get(id) ?? 0) : 0;
              return { expedition_id: l.id, espece_id: id, nombre, perdues, blessees: blessesParmi(perdues) };
            })
            .sort((a, b) => (a.espece_id < b.espece_id ? -1 : 1)),
        ),
      );
    }, 60_000);
  });
  describe("plusieurs combats, dans l'ordre du temps (subirLesCombats)", () => {
    /**
     * Un essai dans une transaction annulée ensuite : un chef qui vient de naître, l'effectif `effectif` (Espèce, mâles,
     * femelles), et des Expéditions posées en base sur une Case libre de son Monde, chacune avec son escorte (Espèce par
     * Espèce, son nombre de Bêtes). `essai` reçoit le client de la transaction, le Territoire et les Expéditions.
     */
    const avecDesExpeditions = async (
      effectif: [string, number, number][],
      escortes: [string, number][][],
      essai: (client: PoolClient, territoireId: number, ids: number[]) => Promise<void>,
    ) => {
      const { territoireId, ne } = await naitre();
      const client = await pool.connect();
      try {
        await client.query("begin");
        for (const [especeId, males, femelles] of effectif) {
          await client.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', $3), ($1, $2, 'femelle', $4)", [
            territoireId,
            especeId,
            males,
            femelles,
          ]);
        }
        const ids: number[] = [];
        for (const escorte of escortes) {
          const { rows } = await client.query<{ id: number }>(
            `insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes)
             select $1, c.id, $3, 30, 600 from case_du_monde c where c.monde_id = $2 and c.chef_id is null order by c.id limit 1 returning id`,
            [territoireId, mondeId, ne],
          );
          for (const [especeId, nombre] of escorte) {
            await client.query("insert into expedition_escorte (expedition_id, espece_id, nombre) values ($1, $2, $3)", [rows[0].id, especeId, nombre]);
          }
          ids.push(rows[0].id);
        }
        await essai(client, territoireId, ids);
      } finally {
        await client.query("rollback");
        client.release();
      }
    };
    /** Les Bêtes perdues de chaque Espèce de l'escorte de l'Expédition `id`. */
    const perdues = async (client: PoolClient, id: number) =>
      Object.fromEntries((await client.query("select espece_id, perdues from expedition_escorte where expedition_id = $1", [id])).rows.map((r) => [r.espece_id, r.perdues]));
    /** L'effectif de l'Espèce `especeId` : ses mâles et ses femelles. */
    const sexes = async (client: PoolClient, territoireId: number, especeId: string) =>
      Object.fromEntries(
        (await client.query("select sexe, nombre from effectif where territoire_id = $1 and espece_id = $2", [territoireId, especeId])).rows.map((r) => [r.sexe, r.nombre]),
      );
    const t0 = new Date(Date.UTC(2031, 0, 1));
    const combat = (expeditionId: number, especeId: string, minutes: number, numero: number | null = null, beteDeNaissanceId: number | null = null) => ({
      expeditionId,
      especeId,
      le: apres(t0, minutes),
      numero,
      beteDeNaissanceId,
    });

    it("le combat suivant ne compte que les survivantes ; une escorte perdue tout entière ne perd plus rien, et l'effectif jamais sous zéro", async () => {
      // Dix Souris grises (473 chacune, 4 730) contre des poules (9 457) : la moitié, puis les trois quarts des survivantes, puis la dernière.
      await avecDesExpeditions([["souris", 10, 0]], [[["souris", 10]]], async (client, territoireId, [x]) => {
        const suite = [];
        for (let i = 0; i < 4; i++) {
          await subirLesCombats(client, [combat(x, "poule", i)]);
          suite.push((await perdues(client, x)).souris);
        }
        expect(suite).toEqual([5, 9, 10, 10]);
        // US-0951 : 3 Blessées parmi les 5 premières perdues, 2 parmi les 4 suivantes, et la dernière, seule perdue de son
        // combat, Blessée : 2 + 2 mortes ont quitté l'effectif.
        expect(await sexes(client, territoireId, "souris")).toEqual({ male: 6, femelle: 0 });
      });
      // Un effectif plus court que les mortes de son escorte (deux souris pour dix sorties) s'arrête à zéro.
      await avecDesExpeditions([["souris", 2, 0]], [[["souris", 10]]], async (client, territoireId, [x]) => {
        for (let i = 0; i < 4; i++) await subirLesCombats(client, [combat(x, "poule", i)]);
        expect(await sexes(client, territoireId, "souris")).toEqual({ male: 0, femelle: 0 });
      });
    });

    it("dans l'ordre du temps, quel que soit l'ordre où ils arrivent : l'escorte affaiblie par le premier perd davantage au second", async () => {
      // Six Souris grises (2 838) : une poule (9 457) en emporte 5 ; un pigeon (2 216) n'en prend aucune à six, la dernière à une.
      await avecDesExpeditions([["souris", 6, 0]], [[["souris", 6]]], async (client, _territoireId, [x]) => {
        await subirLesCombats(client, [combat(x, "pigeon", 10), combat(x, "poule", 5)]);
        expect(await perdues(client, x)).toEqual({ souris: 6 });
      });
      await avecDesExpeditions([["souris", 6, 0]], [[["souris", 6]]], async (client, _territoireId, [x]) => {
        await subirLesCombats(client, [combat(x, "poule", 10), combat(x, "pigeon", 5)]);
        expect(await perdues(client, x)).toEqual({ souris: 5 });
      });
    });

    it("au même instant, dans l'ordre des Bêtes : les sauvages ordinaires par leur numéro, puis les Bêtes de naissance par leur ligne", async () => {
      // Six Souris grises, comme ci-dessus : la poule d'abord, elles perdent tout ; le pigeon d'abord, cinq seulement.
      const perduesSelon = async (combats: (x: number) => ReturnType<typeof combat>[]) => {
        let resultat = 0;
        await avecDesExpeditions([["souris", 6, 0]], [[["souris", 6]]], async (client, _territoireId, [x]) => {
          await subirLesCombats(client, combats(x));
          resultat = (await perdues(client, x)).souris;
        });
        return resultat;
      };
      expect(await perduesSelon((x) => [combat(x, "pigeon", 5, 8), combat(x, "poule", 5, 3)])).toBe(6);
      expect(await perduesSelon((x) => [combat(x, "poule", 5, 3), combat(x, "pigeon", 5, 8)])).toBe(6);
      expect(await perduesSelon((x) => [combat(x, "poule", 5, 8), combat(x, "pigeon", 5, 3)])).toBe(5);
      expect(await perduesSelon((x) => [combat(x, "poule", 5, null, 1), combat(x, "pigeon", 5, 3)])).toBe(5);
      expect(await perduesSelon((x) => [combat(x, "pigeon", 5, null, 2), combat(x, "poule", 5, null, 1)])).toBe(6);
    }, 60_000);

    it("le récit rejoue ces combats tels qu'ils se sont livrés : dans leur ordre, chacun contre les survivantes du précédent ; puis leurs pertes retenues (US-0947)", async () => {
      // Six Souris grises (2 838) : au même instant, la poule (9 457, une Bête sauvage ordinaire, numéro 3) passe avant le
      // pigeon (2 216, une Bête de naissance) : elle en emporte cinq, il prend la dernière.
      await avecDesExpeditions([["souris", 6, 0]], [[["souris", 6]]], async (client, territoireId, [x]) => {
        const { rows } = await client.query<{ id: number }>(
          `insert into bete_de_naissance (territoire_id, case_id, espece_id, arrivee, depart) select $1, case_id, 'pigeon', $2, $3 from expedition where id = $4
           on conflict (territoire_id, case_id) do update set espece_id = excluded.espece_id, arrivee = excluded.arrivee, depart = excluded.depart returning id`,
          [territoireId, t0, apres(t0, 600), x],
        );
        const naissance = rows[0].id;
        await client.query(
          `insert into rencontre (expedition_id, numero, bete_de_naissance_id, espece_id, apparue_le, vue_le, attaque_le)
           values ($1, 3, null, 'poule', $2, $2, $3), ($1, null, $4, 'pigeon', $2, $2, $3)`,
          [x, t0, apres(t0, 5), naissance],
        );
        await subirLesCombats(client, [combat(x, "pigeon", 5, null, naissance), combat(x, "poule", 5, 3)]);

        const souris = especes.get("souris")!.force;
        expect((await combatsDUneExpedition(client, x)).map((c) => [c.bete.nom, c.le, c.escorte, c.sansEscorte])).toEqual([
          ["Poule", apres(t0, 5), 6 * souris, false],
          ["Pigeon biset", apres(t0, 5), souris, false],
        ]);
        // Au retour, le récit dit les deux combats, puis leurs pertes retenues : 5 Souris grises au premier, dont 3 Blessées
        // (US-0951), et la dernière, Blessée, au second ; le résumé compte les mortes sur la dernière Bête qui a attaqué.
        expect(await perdues(client, x)).toEqual({ souris: 6 });
        await raconterLeRetour(client, territoireId, x, apres(t0, 700));
        const [recit] = await recitsDuTerritoire(client, territoireId);
        const [entier, heure] = [(n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/\s/g, "\u00a0"), formaterJourEtHeure(apres(t0, 5), "Europe/Paris")];
        const force = (id: string) => entier(especes.get(id)!.force);
        expect(recit.texte.split("\n").slice(-4)).toEqual([
          `Combat le ${heure} : Poule, de force ${force("poule")}, contre votre escorte, de force ${entier(6 * souris)}.`,
          `Combat le ${heure} : Pigeon biset, de force ${force("pigeon")}, contre votre escorte, de force ${entier(souris)}.`,
          `Pertes au combat : Souris grise (${5 - blessesParmi(5)} morts, ${blessesParmi(5) + blessesParmi(1)} Blessés).`,
          "Vos explorateurs ont fui et sont tous rentrés au Foyer.",
        ]);
        expect(recit.rencontres!.map((r) => [r.especeId, r.perdues])).toEqual([
          ["poule", undefined],
          ["pigeon", 5 - blessesParmi(5)],
        ]);
      });
    });

    it("deux Expéditions du même Territoire prennent leurs pertes à l'effectif l'une après l'autre, chacune au sexe le plus nombreux d'alors", async () => {
      // Cinq mâles et quatre femelles ; chaque escorte de quatre souris (1 892) en perd quatre contre une poule (9 457),
      // dont deux mortes (US-0951).
      await avecDesExpeditions([["souris", 5, 4]], [[["souris", 4]], [["souris", 4]]], async (client, territoireId, [x, y]) => {
        await subirLesCombats(client, [combat(y, "poule", 1), combat(x, "poule", 1)]);
        expect([await perdues(client, x), await perdues(client, y)]).toEqual([{ souris: 4 }, { souris: 4 }]);
        // Mâle (5 contre 4), puis mâle à égalité (4 contre 4), puis femelle (3 contre 4), puis mâle à égalité (3 contre 3).
        expect(await sexes(client, territoireId, "souris")).toEqual({ male: 2, femelle: 3 });
      });
    });

    describe("des Blessés parmi les pertes (US-0951)", () => {
      /** Les pertes de chaque Espèce de l'escorte de l'Expédition `id` : combien perdues, et combien de Blessés parmi elles. */
      const blessees = async (client: PoolClient, id: number) =>
        Object.fromEntries(
          (await client.query("select espece_id, perdues, blessees from expedition_escorte where expedition_id = $1", [id])).rows.map((r) => [
            r.espece_id,
            { perdues: r.perdues, blessees: r.blessees },
          ]),
        );
      /** Ce que l'écran d'Expédition propose de l'Espèce `especeId` : ses disponibles, et ses mâles et femelles possédés. */
      const proposee = async (client: PoolClient, territoireId: number, especeId: string) => {
        const e = (await betesDisponibles(client, territoireId)).find((x) => x.id === especeId);
        return e ? { disponibles: e.disponibles, males: e.males, femelles: e.femelles } : null;
      };

      it("parmi les pertes d'un combat, une part sont des Blessés, Espèce par Espèce, retenus sur l'escorte ; les autres meurent", async () => {
        // Quatre Souris grises et un pigeon (4 108) contre une poule (9 457) : deux souris et le pigeon perdus ; une souris
        // blessée, l'autre morte ; le pigeon, seul perdu de son Espèce, blessé.
        await avecDesExpeditions(
          [
            ["souris", 4, 0],
            ["pigeon", 1, 0],
          ],
          [
            [
              ["souris", 4],
              ["pigeon", 1],
            ],
          ],
          async (client, territoireId, [x]) => {
            await subirLesCombats(client, [combat(x, "poule", 1)]);
            expect(await blessees(client, x)).toEqual({ souris: { perdues: 2, blessees: 1 }, pigeon: { perdues: 1, blessees: 1 } });
            // Seule la souris morte quitte l'effectif.
            expect([await sexes(client, territoireId, "souris"), await sexes(client, territoireId, "pigeon")]).toEqual([
              { male: 3, femelle: 0 },
              { male: 1, femelle: 0 },
            ]);
          },
        );
      });

      it("les morts quittent l'effectif pour toujours ; les Blessés, sortis avec l'Expédition, rentrent au Foyer avec elle", async () => {
        // Dix Souris grises sur douze contre une poule : cinq perdues, trois Blessées, deux mortes.
        await avecDesExpeditions([["souris", 12, 0]], [[["souris", 10]]], async (client, territoireId, [x]) => {
          expect(await proposee(client, territoireId, "souris")).toEqual({ disponibles: 2, males: 12, femelles: 0 });
          await subirLesCombats(client, [combat(x, "poule", 1)]);
          expect(await blessees(client, x)).toEqual({ souris: { perdues: 5, blessees: 3 } });
          // Les deux mortes ne sont plus à personne ; les trois Blessées restent avec l'Expédition : rien de plus au Foyer.
          expect(await proposee(client, territoireId, "souris")).toEqual({ disponibles: 2, males: 10, femelles: 0 });
          // De retour au Foyer, les cinq survivantes et les trois Blessées y sont avec les deux qui n'étaient pas parties.
          await client.query("update expedition set rentree_le = $2 where id = $1", [x, apres(t0, 60)]);
          expect(await proposee(client, territoireId, "souris")).toEqual({ disponibles: 10, males: 10, femelles: 0 });
          // Un second combat de la même Expédition ne compte que ses survivantes valides, sans ses Blessées.
          await client.query("update expedition set rentree_le = null where id = $1", [x]);
          await subirLesCombats(client, [combat(x, "poule", 2)]);
          expect(await blessees(client, x)).toEqual({ souris: { perdues: 9, blessees: 5 } });
        });
      });

      it("une seule Bête perdue n'est que blessée : aucune ne quitte l'effectif", async () => {
        // Une Souris grise (473) contre un pigeon (2 216) : elle est perdue, blessée.
        await avecDesExpeditions([["souris", 1, 1]], [[["souris", 1]]], async (client, territoireId, [x]) => {
          await subirLesCombats(client, [combat(x, "pigeon", 1)]);
          expect(await blessees(client, x)).toEqual({ souris: { perdues: 1, blessees: 1 } });
          expect(await sexes(client, territoireId, "souris")).toEqual({ male: 1, femelle: 1 });
        });
      });
    });
  });
});
