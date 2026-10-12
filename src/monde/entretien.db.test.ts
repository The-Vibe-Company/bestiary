import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { ENTRETIEN_HABITANT_PAR_HEURE } from "@/reglages";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { PRODUIRE } from "./production";
import { stocksDuTerritoire } from "./stocks";

const RESSOURCES = ["viande", "vegetaux", "bois", "pierre"] as const;
type Ressource = (typeof RESSOURCES)[number];
/** Un Stock tel qu'on le règle avant un essai, en texte exact ; sans limite, il reprend celle de départ. */
type Reglage = { quantite: string; reste?: string; limite?: string };
/** Un Stock tel qu'il est en base : quantité, reste et production entrée exacts, et l'instant où il est devenu plein, en microsecondes. */
type Compte = { quantite: string; reste: string; produit: string; plein: string | null };

const [ZERO, UN, DEUX, MILLE, MILLION] = [0, 1, 2, 1000, 1_000_000].map(BigInt);
/** Un millionième vaut 3 600 unités de reste. */
const UNITE_DE_RESTE = BigInt(3600);
const min = (a: bigint, b: bigint) => (a < b ? a : b);
const max = (a: bigint, b: bigint) => (a > b ? a : b);
/** Des millionièmes entiers, écrits comme la base écrit un numeric(24, 6). */
const enMillioniemes = (n: bigint) => `${n / MILLION}.${(n % MILLION).toString().padStart(6, "0")}`;
/** Un instant compté en microsecondes depuis l'origine des temps, écrit pour la base, microsecondes comprises. */
const instant = (us: bigint) => new Date(Number(us / MILLION) * 1000).toISOString().replace(".000Z", `.${(us % MILLION).toString().padStart(6, "0")}Z`);

/**
 * La règle de l'Entretien déroulée pas à pas, une microseconde à la fois, telle que PRODUIRE la décrit,
 * pour comparer son calcul d'un coup à la règle elle-même. Les Stocks sont en unités de reste
 * (quantité × 3 600 000 000 + reste) : une production de p par heure ajoute p à chaque pas.
 */
function deroulerPasAPas(depart: Record<Ressource, { s: bigint; l: bigint; p: bigint }>, habitants: number, t0: bigint, pas: bigint): Record<Ressource, Compte> {
  const e = BigInt(habitants * ENTRETIEN_HABITANT_PAR_HEURE);
  const moitie = e / DEUX;
  expect(moitie * DEUX).toBe(e);
  const etat = Object.fromEntries(RESSOURCES.map((id) => [id, { ...depart[id], produit: ZERO, plein: depart[id].s >= depart[id].l ? t0 : null }])) as Record<
    Ressource,
    { s: bigint; l: bigint; p: bigint; produit: bigint; plein: bigint | null }
  >;
  for (let t = t0; t < t0 + pas; t++) {
    // Chacun paie la moitié ; celui qui ne le peut pas donne tout ce qu'il a, l'autre paie le reste s'il le peut.
    const [v, g] = [etat.viande.s + etat.viande.p, etat.vegetaux.s + etat.vegetaux.p];
    let paie: Record<Ressource, bigint> = { viande: moitie, vegetaux: moitie, bois: ZERO, pierre: ZERO };
    if (v < moitie) paie = { ...paie, viande: v, vegetaux: min(g, e - v) };
    else if (g < moitie) paie = { ...paie, viande: min(v, e - g), vegetaux: g };
    for (const id of RESSOURCES) {
      const stock = etat[id];
      const c = paie[id];
      const apres = max(stock.s - c, min(stock.s + stock.p - c, stock.l));
      expect(apres).toBeGreaterThanOrEqual(ZERO);
      stock.produit += (apres + c * (t + UN)) / UNITE_DE_RESTE - (stock.s + c * t) / UNITE_DE_RESTE;
      stock.plein = apres < stock.l ? null : (stock.plein ?? t + UN);
      stock.s = apres;
    }
  }
  return Object.fromEntries(
    RESSOURCES.map((id) => {
      const { s, produit, plein } = etat[id];
      return [id, { quantite: enMillioniemes(s / UNITE_DE_RESTE), reste: `${s % UNITE_DE_RESTE}.000000`, produit: enMillioniemes(produit), plein: plein?.toString() ?? null }];
    }),
  ) as Record<Ressource, Compte>;
}

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de l'Entretien (US-0316)";

describe.skipIf(!URL_TEST)("l'Entretien des Habitants (US-0316, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `entretien-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  const HEURE = 3_600_000;

  /** Un Territoire tout neuf, et l'instant de sa naissance. */
  const naitre = async () => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Entr", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /** Règle les Stocks (à zéro ceux qu'on ne nomme pas) et le nombre d'Habitants du Territoire. */
  const regler = async (territoireId: number, habitants: number, stocks: Partial<Record<Ressource, Reglage>>) => {
    const lignes = RESSOURCES.map((id) => stocks[id] ?? { quantite: "0" });
    await pool.query(
      `update stock s set quantite = d.quantite, reste = d.reste, limite = coalesce(d.limite, r.limite_au_depart), produit_depuis_visite = 0, plein_depuis = null
       from unnest($2::text[], $3::numeric[], $4::numeric[], $5::numeric[]) as d(ressource_id, quantite, reste, limite)
         join ressource r on r.id = d.ressource_id
       where s.territoire_id = $1 and s.ressource_id = d.ressource_id`,
      [territoireId, [...RESSOURCES], lignes.map((l) => l.quantite), lignes.map((l) => l.reste ?? "0"), lignes.map((l) => l.limite ?? null)],
    );
    await pool.query(
      "with partis as (delete from habitant where territoire_id = $1) insert into habitant (territoire_id, prenom) select $1, 'Essai' from generate_series(1, $2)",
      [territoireId, habitants],
    );
  };
  const comptes = async (territoireId: number): Promise<Record<Ressource, Compte>> =>
    Object.fromEntries(
      (
        await pool.query<Compte & { id: Ressource }>(
          `select ressource_id as id, quantite::text, reste::text, produit_depuis_visite::text as produit,
             (extract(epoch from plein_depuis) * 1000000)::bigint::text as plein
           from stock where territoire_id = $1`,
          [territoireId],
        )
      ).rows.map(({ id, ...compte }) => [id, compte]),
    ) as Record<Ressource, Compte>;
  /** Ce qu'une Case de prairie, Biome du Foyer, produit par heure, tel que la base le tient de donnees/biomes.yaml. */
  const prairie = async (): Promise<Record<Ressource, number>> =>
    Object.fromEntries(
      (await pool.query<{ id: string; par_heure: string }>("select ressource_id as id, par_heure from production_biome where biome_id = 'prairie'")).rows.map(
        (p) => [p.id, Number(p.par_heure)],
      ),
    ) as Record<Ressource, number>;
  const avancerJusqua = (t: { territoireId: number; ne: Date }, heures: number) =>
    rattraper("territoire", t.territoireId, { pool, jusqua: new Date(t.ne.getTime() + heures * HEURE) });
  /** L'instant `heures` après la naissance, en microsecondes, comme le compte la base. */
  const microsecondesApres = (t: { ne: Date }, heures: number) => (BigInt(t.ne.getTime()) * MILLE + BigInt(Math.round(heures * HEURE * 1000))).toString();
  /** L'Entretien de n Habitants par heure, et la part de chaque Stock de Nourriture tant que les deux en ont. */
  const entretien = (n: number) => ({ total: n * ENTRETIEN_HABITANT_PAR_HEURE, moitie: (n * ENTRETIEN_HABITANT_PAR_HEURE) / 2 });

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("prend à chaque Habitant son Entretien chaque heure, moitié sur la Viande, moitié sur les Végétaux, pendant que la production continue", async () => {
    const t = await naitre();
    await regler(t.territoireId, 3, { viande: { quantite: "100" }, vegetaux: { quantite: "100" }, bois: { quantite: "100" }, pierre: { quantite: "100" } });
    await avancerJusqua(t, 1);
    const p = await prairie();
    const { moitie } = entretien(3);
    const fin = await comptes(t.territoireId);
    // Les deux Stocks de Nourriture baissent chacun de sa moitié ; la production entrée, elle, se compte entière (US-0216).
    expect(fin.viande).toMatchObject({ quantite: (100 + p.viande - moitie).toFixed(6), produit: p.viande.toFixed(6) });
    expect(fin.vegetaux).toMatchObject({ quantite: (100 + p.vegetaux - moitie).toFixed(6), produit: p.vegetaux.toFixed(6) });
    // Personne ne mange le Bois ni la Pierre.
    expect(fin.bois.quantite).toBe((100 + p.bois).toFixed(6));
    expect(fin.pierre.quantite).toBe((100 + p.pierre).toFixed(6));
  });

  it("compte chaque Habitant, qu'il ait un Métier ou non, et suit leur nombre d'un calcul à l'autre", async () => {
    const p = await prairie();
    for (const n of [0, 1, 7]) {
      const t = await naitre();
      await regler(t.territoireId, n, { viande: { quantite: "100" }, vegetaux: { quantite: "100" } });
      await pool.query("update habitant set metier = 'cueilleur' where id = (select min(id) from habitant where territoire_id = $1)", [t.territoireId]);
      await avancerJusqua(t, 1);
      const fin = await comptes(t.territoireId);
      expect([fin.viande.quantite, fin.vegetaux.quantite], `${n} Habitants`).toEqual([
        (100 + p.viande - entretien(n).moitie).toFixed(6),
        (100 + p.vegetaux - entretien(n).moitie).toFixed(6),
      ]);
      // Au total, n fois l'Entretien d'un Habitant.
      expect(200 + p.viande + p.vegetaux - Number(fin.viande.quantite) - Number(fin.vegetaux.quantite)).toBe(n * ENTRETIEN_HABITANT_PAR_HEURE);
    }
    // Sept Habitants une heure, puis quatre partent : trois la suivante.
    const t = await naitre();
    await regler(t.territoireId, 7, { viande: { quantite: "100" }, vegetaux: { quantite: "100" } });
    await avancerJusqua(t, 1);
    await pool.query("delete from habitant where id in (select id from habitant where territoire_id = $1 order by id limit 4)", [t.territoireId]);
    await avancerJusqua(t, 2);
    expect((await comptes(t.territoireId)).viande.quantite).toBe((100 + 2 * p.viande - entretien(7).moitie - entretien(3).moitie).toFixed(6));
  });

  it("quand la Viande est vide, prend tout l'Entretien sur les Végétaux ; la Viande ne descend pas sous zéro", async () => {
    const p = await prairie();
    const n = 10;
    const { total, moitie } = entretien(n);
    // La Viande ne couvre pas sa moitié avec sa production ; les Végétaux couvrent tout le reste.
    expect(moitie).toBeGreaterThan(p.viande);
    expect(p.vegetaux).toBeGreaterThanOrEqual(total - p.viande);
    const t = await naitre();
    // De quoi payer sa moitié pendant une heure exactement.
    await regler(t.territoireId, n, { viande: { quantite: String(moitie - p.viande) }, vegetaux: { quantite: "100" } });
    await avancerJusqua(t, 3);
    const fin = await comptes(t.territoireId);
    expect(fin.viande).toMatchObject({ quantite: "0.000000", reste: "0.000000" });
    // Une heure de partage, puis deux où les Végétaux paient tout ce que la production de Viande ne couvre pas.
    expect(fin.vegetaux.quantite).toBe((100 + (p.vegetaux - moitie) + 2 * (p.vegetaux - (total - p.viande))).toFixed(6));
    // Tout ce qui a été produit est compté, même mangé aussitôt.
    expect([fin.viande.produit, fin.vegetaux.produit]).toEqual([(3 * p.viande).toFixed(6), (3 * p.vegetaux).toFixed(6)]);
  });

  it("quand les Végétaux sont vides, prend tout l'Entretien sur la Viande", async () => {
    const p = await prairie();
    const n = 15;
    const { total, moitie } = entretien(n);
    expect(moitie).toBeGreaterThan(p.vegetaux);
    const t = await naitre();
    await regler(t.territoireId, n, { viande: { quantite: "100" }, vegetaux: { quantite: String(moitie - p.vegetaux) } });
    await avancerJusqua(t, 3);
    const fin = await comptes(t.territoireId);
    expect(fin.vegetaux.quantite).toBe("0.000000");
    expect(fin.viande.quantite).toBe((100 + (p.viande - moitie) + 2 * (p.viande - (total - p.vegetaux))).toFixed(6));
  });

  it("ne descend jamais sous zéro : quand les deux Stocks sont vides, l'Entretien qui manque n'est pas payé", async () => {
    const p = await prairie();
    const n = 20;
    const { moitie } = entretien(n);
    expect(moitie).toBeGreaterThan(p.vegetaux);
    const t = await naitre();
    // La Viande se vide en deux heures et demie ; il reste alors cinq Végétaux.
    await regler(t.territoireId, n, { viande: { quantite: String(2.5 * (moitie - p.viande)) }, vegetaux: { quantite: String(2.5 * (moitie - p.vegetaux) + 5) } });
    for (const heures of [1, 2]) {
      await avancerJusqua(t, heures);
      const fin = await comptes(t.territoireId);
      expect(Number(fin.viande.quantite)).toBeGreaterThan(0);
      expect(Number(fin.vegetaux.quantite)).toBeGreaterThan(5);
    }
    await avancerJusqua(t, 2.5);
    expect([(await comptes(t.territoireId)).viande.quantite, (await comptes(t.territoireId)).vegetaux.quantite]).toEqual(["0.000000", "5.000000"]);
    for (const heures of [3, 6, 10]) {
      await avancerJusqua(t, heures);
      const fin = await comptes(t.territoireId);
      expect(fin.viande, `${heures} h`).toMatchObject({ quantite: "0.000000", reste: "0.000000" });
      expect(fin.vegetaux, `${heures} h`).toMatchObject({ quantite: "0.000000", reste: "0.000000" });
    }
    // La production entrée reste comptée, au plus près du millionième (un arrondi par bascule).
    const fin = await comptes(t.territoireId);
    expect(Math.abs(Number(fin.viande.produit) - 10 * p.viande)).toBeLessThanOrEqual(0.000005);
    expect(Math.abs(Number(fin.vegetaux.produit) - 10 * p.vegetaux)).toBeLessThanOrEqual(0.000005);
  });

  it("arrête un Stock exactement à sa limite pendant que l'Entretien est payé, et en fait descendre un autre que sa production ne couvre plus", async () => {
    const p = await prairie();
    const { moitie } = entretien(3);
    const t = await naitre();
    // La Viande atteint sa limite au bout de douze minutes de production, Entretien payé.
    await regler(t.territoireId, 3, { viande: { quantite: String(1000 - 0.2 * (p.viande - moitie)) } });
    await avancerJusqua(t, 1);
    expect((await comptes(t.territoireId)).viande).toEqual({
      quantite: "1000.000000",
      reste: "0.000000",
      // Ce qui est entré : de quoi atteindre la limite, puis de quoi remplacer ce qui est mangé.
      produit: (0.2 * (p.viande - moitie) + moitie).toFixed(6),
      plein: microsecondesApres(t, 0.2),
    });

    // Quinze Habitants : les Végétaux, pleins, ne couvrent plus leur moitié et redescendent.
    const n = 15;
    expect(entretien(n).moitie).toBeGreaterThan(p.vegetaux);
    const u = await naitre();
    await regler(u.territoireId, n, { viande: { quantite: "500" }, vegetaux: { quantite: "1000" } });
    await avancerJusqua(u, 1);
    expect((await comptes(u.territoireId)).vegetaux).toMatchObject({ quantite: (1000 + p.vegetaux - entretien(n).moitie).toFixed(6), plein: null });
  });

  it("fait manger le surplus d'un Stock au-dessus de sa limite, qui ne produit pas tant qu'il y est (US-0230)", async () => {
    const p = await prairie();
    const n = 10;
    const { moitie } = entretien(n);
    expect(moitie).toBeGreaterThan(p.viande);
    const t = await naitre();
    // Une demi-heure d'Entretien au-dessus de la limite, puis le Stock reproduit sous elle.
    await regler(t.territoireId, n, { viande: { quantite: String(900 + 0.5 * moitie), limite: "900" }, vegetaux: { quantite: "100" } });
    await avancerJusqua(t, 0.25);
    expect((await comptes(t.territoireId)).viande).toMatchObject({ quantite: (900 + 0.25 * moitie).toFixed(6), produit: "0.000000", plein: microsecondesApres(t, 0) });
    await avancerJusqua(t, 1);
    expect((await comptes(t.territoireId)).viande).toMatchObject({ quantite: (900 + 0.5 * (p.viande - moitie)).toFixed(6), produit: (0.5 * p.viande).toFixed(6), plein: null });
  });

  describe("donne exactement le même résultat en un calcul de mille minutes, en mille calculs d'une minute et en 997 calculs inégaux", () => {
    // Mille minutes, à sept microsecondes d'une seconde ronde.
    const debut = "2026-01-01T00:00:00.000007Z";
    const arrivee = "2026-01-01T16:40:00.000007Z";
    const scenarios: { nom: string; habitants: number; stocks: Partial<Record<Ressource, Reglage>>; apres: (fin: Record<Ressource, Compte>) => void }[] = [
      {
        nom: "la Viande se vide en route, les Végétaux pleins quittent alors leur limite",
        habitants: 12,
        stocks: { viande: { quantite: "20.5", reste: "1234.5" }, vegetaux: { quantite: "994" }, bois: { quantite: "996.3", reste: "17" } },
        apres: (fin) => {
          expect(fin.viande.quantite).toBe("0.000000");
          expect(Number(fin.vegetaux.quantite)).toBeLessThan(1000);
          expect(fin.vegetaux.plein).toBeNull();
          expect(fin.bois.quantite).toBe("1000.000000");
        },
      },
      {
        nom: "les deux Stocks se vident, la Viande d'abord",
        habitants: 20,
        // La Viande vide vers 6 h, les Végétaux vers 16 h : la Famine commence avant la fin, mais le premier départ d'un
        // Habitant (US-0326), une heure après, tomberait au-delà ; PRODUIRE seul s'y arrêterait sans le faire partir.
        stocks: { viande: { quantite: "72.123456", reste: "17" }, vegetaux: { quantite: "215.654321", reste: "3599.999999" } },
        apres: (fin) => {
          expect([fin.viande.quantite, fin.vegetaux.quantite]).toEqual(["0.000000", "0.000000"]);
        },
      },
      {
        nom: "les Végétaux se vident d'abord, la Viande paie ensuite tout le reste",
        habitants: 15,
        stocks: { viande: { quantite: "200" }, vegetaux: { quantite: "3.3", reste: "1800" } },
        apres: (fin) => {
          expect(fin.vegetaux.quantite).toBe("0.000000");
          expect(Number(fin.viande.quantite)).toBeGreaterThan(0);
        },
      },
      {
        nom: "un surplus mangé jusqu'à la limite, un Stock qui atteint la sienne Entretien payé",
        habitants: 10,
        stocks: { viande: { quantite: "905.5", limite: "900" }, vegetaux: { quantite: "990.25", reste: "999.5" }, pierre: { quantite: "1001", limite: "1000" } },
        apres: (fin) => {
          expect(Number(fin.viande.quantite)).toBeLessThan(900);
          expect(fin.vegetaux.quantite).toBe("1000.000000");
          expect(fin.pierre.quantite).toBe("1001.000000");
        },
      },
      {
        nom: "trois Habitants, comme à la naissance",
        habitants: 3,
        stocks: { vegetaux: { quantite: "997.123" } },
        apres: (fin) => expect(fin.vegetaux.quantite).toBe("1000.000000"),
      },
    ];

    it.each(scenarios)("$nom", async ({ habitants, stocks, apres }) => {
      const { territoireId } = await naitre();
      const resultats: Record<Ressource, Compte>[] = [];
      // D'un coup.
      await regler(territoireId, habitants, stocks);
      await pool.query(PRODUIRE, [territoireId, debut, arrivee]);
      resultats.push(await comptes(territoireId));
      // Le calcul même du jeu, mille fois de suite côté base : mille minutes une à une.
      await regler(territoireId, habitants, stocks);
      await pool.query(
        `do $do$ begin
           for i in 0..999 loop
             execute $calcul$${PRODUIRE}$calcul$
               using ${territoireId}, timestamptz '${debut}' + make_interval(mins => i), timestamptz '${debut}' + make_interval(mins => i + 1);
           end loop;
         end $do$`,
      );
      resultats.push(await comptes(territoireId));
      // 997 calculs de durées inégales, à la microseconde près, qui ne tombent ni sur une minute ni sur une bascule.
      await regler(territoireId, habitants, stocks);
      await pool.query(
        `do $do$ begin
           for i in 0..996 loop
             execute $calcul$${PRODUIRE}$calcul$
               using ${territoireId}, timestamptz '${debut}' + ((i::bigint * 60000000000) / 997) * interval '1 microsecond',
                 timestamptz '${debut}' + (((i + 1)::bigint * 60000000000) / 997) * interval '1 microsecond';
           end loop;
         end $do$`,
      );
      resultats.push(await comptes(territoireId));
      expect(resultats[1]).toEqual(resultats[0]);
      expect(resultats[2]).toEqual(resultats[0]);
      apres(resultats[0]);
    }, 120_000);
  });

  it("suit exactement la règle déroulée microseconde par microseconde, en un ou plusieurs calculs, bascules, limites et surplus compris", async () => {
    const { territoireId } = await naitre();
    const p = await prairie();
    expect(Object.values(p).every(Number.isInteger)).toBe(true);
    // Un tirage fixé d'avance, pour des essais variés mais toujours les mêmes.
    let graine = 316;
    const tirer = (n: number) => {
      graine = (graine * 1103515245 + 12345) % 2147483648;
      return graine % n;
    };
    const choisir = <T,>(valeurs: T[]) => valeurs[tirer(valeurs.length)];
    const origine = BigInt(Date.UTC(2026, 0, 1)) * MILLE;
    for (let essai = 0; essai < 48; essai++) {
      const habitants = choisir([0, 3, 9, 10, 11, 12, 15, 20, 40]);
      // Des Stocks minuscules, en millionièmes et en reste, pour que tout bascule en quelques milliers de microsecondes.
      const depart = {} as Record<Ressource, { s: bigint; l: bigint; p: bigint }>;
      const reglages = {} as Record<Ressource, Reglage>;
      for (const id of RESSOURCES) {
        const limite = choisir([1, 2, 5]);
        const millioniemes = choisir([0, 0, limite - 1, limite, limite + 1, limite + 3]);
        const reste = millioniemes > limite || choisir([true, false]) ? tirer(3600) : 0;
        depart[id] = { s: BigInt(millioniemes * 3600 + reste), l: BigInt(limite * 3600), p: BigInt(p[id]) };
        reglages[id] = { quantite: enMillioniemes(BigInt(millioniemes)), reste: String(reste), limite: enMillioniemes(BigInt(limite)) };
      }
      const t0 = origine + BigInt(tirer(1_000_000));
      const pas = BigInt(choisir([0, 1, 2, 5, 50, 299, 1000, 2500]));
      // En un calcul, ou coupé en deux ou trois n'importe où, même en calculs vides.
      const coupes = [ZERO, ...Array.from({ length: tirer(3) }, () => BigInt(tirer(Number(pas) + 1))).sort((a, b) => (a < b ? -1 : 1)), pas];
      await regler(territoireId, habitants, reglages);
      for (let i = 0; i + 1 < coupes.length; i++) await pool.query(PRODUIRE, [territoireId, instant(t0 + coupes[i]), instant(t0 + coupes[i + 1])]);
      expect(await comptes(territoireId), `essai ${essai} : ${habitants} Habitants, ${pas} pas, coupé en ${coupes.join(", ")}`).toEqual(
        deroulerPasAPas(depart, habitants, t0, pas),
      );
    }
  }, 120_000);

  it("dit l'Entretien pris sur chaque Stock par heure, au rythme du moment, pour la barre du haut", async () => {
    const p = await prairie();
    const entretienAffiche = async (territoireId: number) =>
      Object.fromEntries((await stocksDuTerritoire(pool, territoireId)).map((s) => [s.id, s.entretienParHeure]));
    const t = await naitre();
    await regler(t.territoireId, 3, { viande: { quantite: "100" }, vegetaux: { quantite: "100" } });
    expect(await entretienAffiche(t.territoireId)).toEqual({ viande: entretien(3).moitie.toFixed(6), vegetaux: entretien(3).moitie.toFixed(6), bois: "0.000000", pierre: "0.000000" });
    // La Viande vide ne donne que sa production ; les Végétaux paient le reste.
    await regler(t.territoireId, 10, { viande: { quantite: "0" }, vegetaux: { quantite: "100" } });
    expect(await entretienAffiche(t.territoireId)).toMatchObject({ viande: p.viande.toFixed(6), vegetaux: (entretien(10).total - p.viande).toFixed(6) });
    // Les deux vides : chacun ne donne que sa production.
    await regler(t.territoireId, 40, {});
    expect(await entretienAffiche(t.territoireId)).toMatchObject({ viande: p.viande.toFixed(6), vegetaux: p.vegetaux.toFixed(6) });
    // Sans Habitants, personne ne mange.
    await regler(t.territoireId, 0, {});
    expect(await entretienAffiche(t.territoireId)).toMatchObject({ viande: "0.000000", vegetaux: "0.000000" });
  });
});
