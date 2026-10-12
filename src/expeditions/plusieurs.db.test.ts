import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chefDuCompte, enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { betesDisponibles } from "@/monde/effectif";
import { explorateursDuTerritoire, prochainRetourDUnExplorateur } from "@/monde/explorateurs";
import type { Coordonnees } from "@/monde/hex";
import { PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE, PORTEE_D_EXPLORATION_CASES, SEJOUR_MINUTES, SEJOURS_TOUT_PRETS_MINUTES } from "@/reglages";
import { nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, URL_TEST } from "@/test/base";
import { type ChoixDuDepart, type Depart, EXPLORATEUR_PLUS_LIBRE, lancerLExpedition } from "./depart";
import { expeditionsEnCours } from "./en-cours";
import type { Phase } from "./phase";

const MINUTE_MS = 60_000;

/** US-0919 : ce qu'une Expédition a retenu à son départ : sa destination, ses horaires, son escorte et ses explorateurs. */
type Retenue = Coordonnees & { partLe: Date; trajetMinutes: number | null; sejourMinutes: number; escorte: Record<string, number>; explorateurs: number[] };

describe.skipIf(!URL_TEST)("plusieurs Expéditions à la fois (US-0919, sur base)", () => {
  let pool: Pool;
  const lancement = `plusieurs-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** L'heure du jeu du premier départ. */
  const INSTANT = new Date("2026-10-09T07:42:00.000Z");
  /** L'heure du jeu `minutes` après le premier départ. */
  const apres = (minutes: number) => new Date(INSTANT.getTime() + minutes * MINUTE_MS);
  /** Le pas des explorateurs, en minutes de jeu par Case (valeur provisoire). */
  const p = PAS_DES_EXPLORATEURS_MINUTES_PAR_CASE;

  /** Un joueur qui vient de naître, et son Territoire, avec ses trois Habitants sans Métier et sans Bête. */
  const nouveauTerritoire = async () => {
    const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Plu", suffixe, numero);
    expect(await enregistrerNomDeChef(pool, compte.id, nom)).toMatchObject({ statut: "enregistre" });
    return (await chefDuCompte(pool, compte.id))!.territoireId!;
  };
  /** `n` explorateurs de plus au Territoire. */
  const explorateurs = (territoireId: number, n: number) =>
    pool.query(`insert into habitant (territoire_id, prenom, metier) select $1, 'Essai', 'explorateur' from generate_series(1, $2)`, [territoireId, n]);
  /** Des Bêtes dans l'effectif du Territoire : une ligne par Espèce et par sexe, avec leur nombre. */
  const betes = (territoireId: number, lignes: [string, "male" | "femelle", number][]) =>
    pool.query(
      `insert into effectif (territoire_id, espece_id, sexe, nombre)
       select $1, e, s::sexe, n from unnest($2::text[], $3::text[], $4::int[]) as l(e, s, n)`,
      [territoireId, lignes.map((l) => l[0]), lignes.map((l) => l[1]), lignes.map((l) => l[2])],
    );
  /** Une Case libre du Monde du Territoire, à `ecart` Cases de son Foyer. */
  const aLEcart = async (territoireId: number, ecart: number): Promise<Coordonnees> => {
    const { rows } = await pool.query<Coordonnees>(
      `select c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
         join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
       where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = $2
       order by c.q, c.r limit 1`,
      [territoireId, ecart],
    );
    return rows[0];
  };
  /** Un départ vers `destination` : `n` explorateurs, l'escorte donnée Espèce par Espèce, et le séjour en minutes. */
  const choix = (destination: Coordonnees, n: number, sejourMinutes: number, escorte: [string, number][] = []): ChoixDuDepart => ({
    destination,
    explorateurs: n,
    escorte: new Map(escorte),
    sejourMinutes,
  });
  /** Une Expédition partie : son identifiant. */
  const partie = async (depart: Promise<Depart>) => {
    const fait = await depart;
    expect(fait).toEqual({ expeditionId: expect.any(Number) });
    return (fait as { expeditionId: number }).expeditionId;
  };
  /** Ce que l'Expédition a retenu à son départ. */
  const retenue = async (expeditionId: number) =>
    (
      await pool.query<Retenue>(
        `select c.q, c.r, x.part_le as "partLe", x.trajet_minutes as "trajetMinutes", x.sejour_minutes as "sejourMinutes",
           (select coalesce(json_object_agg(s.espece_id, s.nombre order by s.espece_id), '{}') from expedition_escorte s where s.expedition_id = x.id) as escorte,
           (select coalesce(array_agg(h.id order by h.id), '{}') from habitant h where h.expedition_id = x.id) as explorateurs
         from expedition x join case_du_monde c on c.id = x.case_id
         where x.id = $1`,
        [expeditionId],
      )
    ).rows[0];
  /** La phase de l'Expédition `id` dans la liste des Expéditions en cours du Territoire, à l'heure du jeu `instant`. */
  const phase = async (territoireId: number, id: number, instant: Date) => (await expeditionsEnCours(pool, territoireId, instant)).find((x) => x.id === id)?.phase;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("lance une nouvelle Expédition pendant qu'une autre est en route, tant qu'il reste au moins un explorateur libre", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, 4);
    const premiere = await partie(lancerLExpedition(pool, t, choix(await aLEcart(t, 1), 1, SEJOUR_MINUTES.min), INSTANT));
    expect(await explorateursDuTerritoire(pool, t)).toEqual({ libres: 3, total: 4 });

    // Le joueur repart pendant que la première marche, puis pendant qu'elle séjourne, puis pendant qu'elle rentre : au
    // milieu de chaque phase, d'après les réglages du moment.
    const moments: [number, Phase, number][] = [
      [p / 2, "aller", 2],
      [p + SEJOUR_MINUTES.min / 2, "sejour", 1],
      [p + SEJOUR_MINUTES.min + p / 2, "retour", 0],
    ];
    const departs = [premiere];
    for (const [i, [minutes, laPremiere, libres]] of moments.entries()) {
      expect(await phase(t, premiere, apres(minutes))).toBe(laPremiere);
      departs.push(await partie(lancerLExpedition(pool, t, choix(await aLEcart(t, 2 + i), 1, SEJOUR_MINUTES.min), apres(minutes))));
      expect(await explorateursDuTerritoire(pool, t)).toEqual({ libres, total: 4 });
    }
    const enfin = apres(moments[2][0]);
    expect((await expeditionsEnCours(pool, t, enfin)).map((x) => x.id)).toEqual(departs);

    // Plus aucun explorateur libre : un départ de plus est refusé, sans rien changer aux autres.
    const avant = await Promise.all(departs.map(retenue));
    expect(await lancerLExpedition(pool, t, choix(await aLEcart(t, 5), 1, SEJOUR_MINUTES.min), enfin)).toEqual({ refus: EXPLORATEUR_PLUS_LIBRE });
    expect(await Promise.all(departs.map(retenue))).toEqual(avant);
    expect((await expeditionsEnCours(pool, t, enfin)).map((x) => x.id)).toEqual(departs);
  });

  it("donne à chaque Expédition sa destination, son escorte et ses horaires, sans effet sur les autres", async () => {
    const t = await nouveauTerritoire();
    await explorateurs(t, 5);
    await betes(t, [
      ["souris", "male", 2],
      ["souris", "femelle", 1],
      ["poule", "femelle", 2],
    ]);
    const plusLong = SEJOURS_TOUT_PRETS_MINUTES.at(-1)!;
    const [versA, versB, versC, versD] = [await aLEcart(t, PORTEE_D_EXPLORATION_CASES), await aLEcart(t, 2), await aLEcart(t, 1), await aLEcart(t, 3)];
    // Le trajet d'une escorte change avec US-0912 : de b et de d, tout ce qu'elles ont retenu sauf lui.
    const sansTrajet = (retenu: Retenue) => ({ ...retenu, trajetMinutes: undefined });
    const un = [expect.any(Number)];

    // La plus lointaine part la première, deux explorateurs sans escorte, pour le plus long séjour tout prêt.
    const a = await partie(lancerLExpedition(pool, t, choix(versA, 2, plusLong), INSTANT));
    const aAuDepart = await retenue(a);
    expect(aAuDepart).toEqual({ ...versA, partLe: INSTANT, trajetMinutes: PORTEE_D_EXPLORATION_CASES * p, sejourMinutes: plusLong, escorte: {}, explorateurs: [...un, ...un] });
    // Puis deux escortes, chacune avec ses Bêtes, et la plus proche, sans escorte, pour le plus court séjour.
    const b = await partie(lancerLExpedition(pool, t, choix(versB, 1, SEJOUR_MINUTES.max, [["souris", 2]]), apres(5)));
    const c = await partie(lancerLExpedition(pool, t, choix(versC, 1, SEJOUR_MINUTES.min), apres(10)));
    const d = await partie(lancerLExpedition(pool, t, choix(versD, 1, SEJOUR_MINUTES.max, [["souris", 1], ["poule", 1]]), apres(15)));

    // Chacune a retenu ce qu'on lui a choisi, et rien de celles parties avant ou après elle.
    expect(await retenue(a)).toEqual(aAuDepart);
    expect(sansTrajet(await retenue(b))).toEqual({ ...versB, partLe: apres(5), sejourMinutes: SEJOUR_MINUTES.max, escorte: { souris: 2 }, explorateurs: un });
    expect(await retenue(c)).toEqual({ ...versC, partLe: apres(10), trajetMinutes: p, sejourMinutes: SEJOUR_MINUTES.min, escorte: {}, explorateurs: un });
    expect(sansTrajet(await retenue(d))).toEqual({ ...versD, partLe: apres(15), sejourMinutes: SEJOUR_MINUTES.max, escorte: { poule: 1, souris: 1 }, explorateurs: un });
    const partis = (await Promise.all([a, b, c, d].map(retenue))).flatMap((x) => x.explorateurs);
    expect(new Set(partis).size).toBe(5);
    // Les Bêtes disponibles retirent l'escorte de chacune : il ne reste qu'une poule.
    expect(await betesDisponibles(pool, t)).toEqual([expect.objectContaining({ id: "poule", disponibles: 1 })]);

    // Chacune vit à ses horaires : la plus proche arrive, séjourne et rentre pendant que la plus lointaine marche encore.
    // Avec les réglages du moment (valeurs provisoires), c est rentrée avant que a n'arrive.
    const [arriveeDeC, departDeC, retourDeC, arriveeDeA] = [10 + p, 10 + p + SEJOUR_MINUTES.min, 10 + 2 * p + SEJOUR_MINUTES.min, PORTEE_D_EXPLORATION_CASES * p];
    expect(retourDeC).toBeLessThan(arriveeDeA);
    const auSejourDeC = apres(arriveeDeC + SEJOUR_MINUTES.min / 2);
    const auRetourDeC = apres(departDeC + p / 2);
    expect([await phase(t, a, auSejourDeC), await phase(t, c, auSejourDeC)]).toEqual(["aller", "sejour"]);
    expect([await phase(t, a, auRetourDeC), await phase(t, c, auRetourDeC)]).toEqual(["aller", "retour"]);
    expect(await phase(t, a, apres(arriveeDeA + plusLong / 2))).toBe("sejour");
    // Le prochain retour (US-0903) est celui de c, la plus proche sans escorte, partie après a.
    expect(await explorateursDuTerritoire(pool, t)).toEqual({ libres: 0, total: 5 });
    expect(await prochainRetourDUnExplorateur(pool, t)).toEqual(apres(retourDeC));
  });

  it("n'a d'autre plafond que les explorateurs libres : une Expédition par explorateur, puis une de plus dès qu'un explorateur s'ajoute", async () => {
    const t = await nouveauTerritoire();
    const n = 10;
    await explorateurs(t, n);
    const destination = await aLEcart(t, 3);
    const ids: number[] = [];
    for (let i = 0; i < n; i++) ids.push(await partie(lancerLExpedition(pool, t, choix(destination, 1, 240), apres(i))));
    expect((await expeditionsEnCours(pool, t, apres(n))).map((x) => x.id)).toEqual(ids);
    expect(await explorateursDuTerritoire(pool, t)).toEqual({ libres: 0, total: n });
    expect(await lancerLExpedition(pool, t, choix(destination, 1, 240), apres(n))).toEqual({ refus: EXPLORATEUR_PLUS_LIBRE });

    // Seul un explorateur libre de plus permet une Expédition de plus.
    await explorateurs(t, 1);
    ids.push(await partie(lancerLExpedition(pool, t, choix(destination, 1, 240), apres(n + 1))));
    expect((await expeditionsEnCours(pool, t, apres(n + 1))).map((x) => x.id)).toEqual(ids);
  });
});
