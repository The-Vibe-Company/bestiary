import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { ENTRETIEN_HABITANT_PAR_HEURE } from "@/reglages";
import { rattraperLesAbsents } from "@/temps/absents";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";

const RESSOURCES = ["viande", "vegetaux", "bois", "pierre"] as const;
type Ressource = (typeof RESSOURCES)[number];
type ParRessource<T> = Record<Ressource, T>;
/** Un Stock tel qu'on le règle au départ, en texte exact ; sans limite, il garde celle de départ. */
type Reglage = { quantite: string; reste?: string; limite?: string };
/** Un Stock tel que la base l'écrit : quantité et reste exacts. */
type Stock = { quantite: string; reste: string };
/** Un Stock tel qu'il est en base, avec la production entrée et l'instant où il est devenu plein, en microsecondes depuis la naissance. */
type Compte = Stock & { produit: string; plein: string | null };

const [ZERO, DEUX, MILLION] = [0, 2, 1_000_000].map(BigInt);
/** Un millionième vaut 3 600 unités de reste (US-0219). */
const UNITE_DE_RESTE = BigInt(3600);
/** Une heure compte 3 600 000 000 pas d'une microseconde, la plus petite durée du jeu. */
const MICROSECONDES_PAR_HEURE = BigInt(3_600_000_000);
const HEURE = 3_600_000;
const min = (a: bigint, b: bigint) => (a < b ? a : b);
const max = (a: bigint, b: bigint) => (a > b ? a : b);

/** Un Stock en unités de reste, comme le compte PRODUIRE : quantité × 3 600 000 000 + reste. */
function enUnites(quantite: string, reste = "0"): bigint {
  const [entiers, decimales = ""] = quantite.split(".");
  return BigInt(entiers + decimales.padEnd(6, "0")) * UNITE_DE_RESTE + BigInt(reste);
}

/** Un Stock en unités de reste, écrit comme la base l'écrit. */
function enStock(s: bigint): Stock {
  const millioniemes = s / UNITE_DE_RESTE;
  return {
    quantite: `${millioniemes / MILLION}.${(millioniemes % MILLION).toString().padStart(6, "0")}`,
    reste: `${s % UNITE_DE_RESTE}.000000`,
  };
}

/**
 * L'absence déroulée heure par heure, en décimaux exacts (unités de reste, en BigInt) : chaque heure, chaque
 * Stock reçoit sa production et paie sa part de l'Entretien, et sa production ne le pousse pas au-delà de sa
 * limite. La Viande et les Végétaux paient chacun la moitié ; celui qui ne le peut pas donne tout ce qu'il a
 * (son Stock et sa production de l'heure), l'autre paie le reste s'il le peut. Au-dessus de sa limite, un
 * Stock ne produit pas. Rend les Stocks au départ, puis à la fin de chaque heure.
 *
 * `pasParHeure` découpe chaque heure en pas plus fins, à la même règle : 3 600 pour la seconde.
 */
function derouler(
  depart: ParRessource<{ s: bigint; l: bigint }>,
  production: ParRessource<number>,
  habitants: number,
  heures: number,
  pasParHeure = 1,
): ParRessource<bigint>[] {
  const duree = MICROSECONDES_PAR_HEURE / BigInt(pasParHeure);
  // Une production de p par heure ajoute p unités de reste par microseconde ; l'Entretien de même.
  const entretien = BigInt(habitants * ENTRETIEN_HABITANT_PAR_HEURE) * duree;
  const moitie = entretien / DEUX;
  const p = Object.fromEntries(RESSOURCES.map((id) => [id, BigInt(production[id]) * duree])) as ParRessource<bigint>;
  const s = Object.fromEntries(RESSOURCES.map((id) => [id, depart[id].s])) as ParRessource<bigint>;
  const trace = [{ ...s }];
  for (let h = 0; h < heures; h++) {
    for (let i = 0; i < pasParHeure; i++) {
      const [viande, vegetaux] = [s.viande + p.viande, s.vegetaux + p.vegetaux];
      let paie: ParRessource<bigint> = { viande: moitie, vegetaux: moitie, bois: ZERO, pierre: ZERO };
      if (viande < moitie) paie = { ...paie, viande, vegetaux: min(vegetaux, entretien - viande) };
      else if (vegetaux < moitie) paie = { ...paie, viande: min(viande, entretien - vegetaux), vegetaux };
      for (const id of RESSOURCES) s[id] = max(s[id] - paie[id], min(s[id] + p[id] - paie[id], depart[id].l));
    }
    trace.push({ ...s });
  }
  return trace;
}

/** Ce que produit une Case de prairie, Biome du Foyer, et l'Entretien de n Habitants, par heure. */
type Rythmes = { p: ParRessource<number>; entretien: number; moitie: number };

type Scenario = {
  nom: string;
  habitants: number;
  heures: number;
  /** Les Stocks au départ de l'absence, réglés d'après la production pour que les bascules tombent sur des heures rondes. */
  stocks: (r: Rythmes) => Partial<ParRessource<Reglage>>;
  /** Les heures où la tâche planifiée passe pendant l'absence. */
  tache: number[];
  /** Ce que le déroulement heure par heure montre de l'absence (en quantités entières, Stock par Stock). */
  deroule: (quantites: ParRessource<number>[], r: Rythmes) => void;
};

const SCENARIOS: Scenario[] = [
  {
    nom: "la Viande, qui produit moins que sa part de l'Entretien, se vide ; les Végétaux atteignent leur limite puis en redescendent",
    habitants: 12,
    heures: 20,
    stocks: ({ p, entretien, moitie }) => {
      expect(moitie).toBeGreaterThan(p.viande);
      expect(p.vegetaux).toBeGreaterThan(moitie);
      expect(entretien).toBeGreaterThan(p.viande + p.vegetaux);
      return {
        // Vide au bout de dix heures.
        viande: { quantite: String(10 * (moitie - p.viande)) },
        // Pleins au bout de cinq heures.
        vegetaux: { quantite: String(1000 - 5 * (p.vegetaux - moitie)) },
        bois: { quantite: "950.654321", reste: "1799" },
        pierre: { quantite: "123.456789", reste: "3599" },
      };
    },
    tache: [3.5, 10, 12.25],
    deroule: (q, { p, entretien, moitie }) => {
      expect(q[9].viande).toBeGreaterThan(0);
      for (let h = 10; h <= 20; h++) expect(q[h].viande, `${h} h`).toBe(0);
      expect(q[4].vegetaux).toBeLessThan(1000);
      for (let h = 5; h <= 10; h++) expect(q[h].vegetaux, `${h} h`).toBe(1000);
      // Une fois la Viande vide, les Végétaux paient tout ce que la production de Viande ne couvre pas, et redescendent.
      for (let h = 11; h <= 20; h++) expect(q[h].vegetaux, `${h} h`).toBe(1000 - (h - 10) * (entretien - p.viande - p.vegetaux));
      // La limite s'applique en route, pas seulement à la fin : appliquée au seul total, elle n'aurait rien retenu
      // (le total reste sous elle), alors que ce qui l'aurait dépassée de 5 h à 10 h est perdu.
      const totalSansLimite = q[0].vegetaux + 10 * (p.vegetaux - moitie) - 10 * (entretien - p.viande - p.vegetaux);
      expect(totalSansLimite).toBeLessThan(1000);
      expect(q[20].vegetaux).toBe(totalSansLimite - 5 * (p.vegetaux - moitie));
      expect(q[12].bois).toBeLessThan(1000);
      expect(q[13].bois).toBe(1000);
      expect(q[20].bois).toBe(1000);
    },
  },
  {
    nom: "l'Entretien dépasse toute la production de Nourriture : les deux Stocks se vident, et l'Entretien qui manque n'est pas payé",
    habitants: 20,
    heures: 12,
    stocks: ({ p, entretien, moitie }) => {
      expect(moitie).toBeGreaterThan(p.viande);
      expect(moitie).toBeGreaterThan(p.vegetaux);
      return {
        // La Viande se vide au bout de trois heures, les Végétaux deux heures plus tard.
        viande: { quantite: String(3 * (moitie - p.viande)) },
        vegetaux: { quantite: String(3 * (moitie - p.vegetaux) + 2 * (entretien - p.viande - p.vegetaux)) },
        bois: { quantite: "990.5", reste: "1234" },
        // Au-dessus de sa limite, la Pierre ne produit pas, et personne ne la mange (US-0230).
        pierre: { quantite: "1001.25", limite: "1000" },
      };
    },
    tache: [1.75, 4, 9],
    deroule: (q) => {
      expect(q[2].viande).toBeGreaterThan(0);
      expect(q[4].vegetaux).toBeGreaterThan(0);
      for (let h = 3; h <= 12; h++) expect(q[h].viande, `${h} h`).toBe(0);
      for (let h = 5; h <= 12; h++) expect(q[h].vegetaux, `${h} h`).toBe(0);
      expect(q[2].bois).toBeLessThan(1000);
      expect(q[3].bois).toBe(1000);
      for (let h = 0; h <= 12; h++) expect(q[h].pierre, `${h} h`).toBe(1001.25);
    },
  },
  {
    nom: "les Végétaux se vident d'abord ; la Viande, au-dessus de sa limite, mange son surplus, puis paie tout le reste de l'Entretien",
    habitants: 15,
    heures: 24,
    stocks: ({ p, moitie }) => {
      expect(moitie).toBeGreaterThan(p.viande);
      expect(moitie).toBeGreaterThan(p.vegetaux);
      return {
        // Une heure d'Entretien au-dessus de sa limite.
        viande: { quantite: String(900 + moitie), limite: "900" },
        // Vides au bout de cinq heures.
        vegetaux: { quantite: String(5 * (moitie - p.vegetaux)) },
        bois: { quantite: "0" },
        pierre: { quantite: "999.999999", reste: "3599" },
      };
    },
    tache: [0.5, 5, 17.9],
    deroule: (q, { p, entretien, moitie }) => {
      expect(q[1].viande).toBe(900);
      for (let h = 2; h <= 5; h++) expect(q[h].viande, `${h} h`).toBe(900 - (h - 1) * (moitie - p.viande));
      for (let h = 6; h <= 24; h++) expect(q[h].viande, `${h} h`).toBe(900 - 4 * (moitie - p.viande) - (h - 5) * (entretien - p.vegetaux - p.viande));
      expect(q[4].vegetaux).toBeGreaterThan(0);
      for (let h = 5; h <= 24; h++) expect(q[h].vegetaux, `${h} h`).toBe(0);
      expect(q[24].bois).toBe(24 * p.bois);
      expect(q[1].pierre).toBe(1000);
    },
  },
];

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai de l'Entretien après une absence (US-0317)";

describe.skipIf(!URL_TEST)("rattraper l'Entretien après une absence (US-0317, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  const lancement = `rattrapage-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  let prairie: ParRessource<number>;

  /** Un Territoire tout neuf, et l'instant de sa naissance, d'où part l'absence. */
  const naitre = async () => {
    const n = ++numero;
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    const nom = nomDEssai("Ratt", suffixe, n);
    expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId) };
  };
  /** Règle les Stocks (à zéro ceux qu'on ne nomme pas) et le nombre d'Habitants du Territoire. */
  const regler = async (territoireId: number, habitants: number, stocks: Partial<ParRessource<Reglage>>) => {
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
  /** Les Stocks du Territoire en base, en unités de reste avec leur limite : le départ du déroulement. */
  const depart = async (territoireId: number) =>
    Object.fromEntries(
      (
        await pool.query<{ id: Ressource; quantite: string; reste: string; limite: string }>(
          "select ressource_id as id, quantite::text, reste::text, limite::text from stock where territoire_id = $1",
          [territoireId],
        )
      ).rows.map((r) => [r.id, { s: enUnites(r.quantite, r.reste.replace(/\.0+$/, "")), l: enUnites(r.limite) }]),
    ) as ParRessource<{ s: bigint; l: bigint }>;
  const comptes = async (territoireId: number): Promise<ParRessource<Compte>> =>
    Object.fromEntries(
      (
        await pool.query<Compte & { id: Ressource }>(
          `select s.ressource_id as id, s.quantite::text, s.reste::text, s.produit_depuis_visite::text as produit,
             (extract(epoch from s.plein_depuis - t.ne_le) * 1000000)::bigint::text as plein
           from stock s join territoire t on t.id = s.territoire_id where s.territoire_id = $1`,
          [territoireId],
        )
      ).rows.map(({ id, ...compte }) => [id, compte]),
    ) as ParRessource<Compte>;
  const stocks = async (territoireId: number): Promise<ParRessource<Stock>> =>
    Object.fromEntries(Object.entries(await comptes(territoireId)).map(([id, { quantite, reste }]) => [id, { quantite, reste }])) as ParRessource<Stock>;
  const attendus = (etat: ParRessource<bigint>) => Object.fromEntries(RESSOURCES.map((id) => [id, enStock(etat[id])])) as ParRessource<Stock>;
  const apres = (ne: Date, heures: number) => new Date(ne.getTime() + heures * HEURE);

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    prairie = Object.fromEntries(
      (await pool.query<{ id: string; par_heure: string }>("select ressource_id as id, par_heure from production_biome where biome_id = 'prairie'")).rows.map((p) => [
        p.id,
        Number(p.par_heure),
      ]),
    ) as ParRessource<number>;
    expect(Object.values(prairie).every(Number.isInteger)).toBe(true);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  describe.each(SCENARIOS)("$nom", (scenario) => {
    let rythmes: Rythmes;
    let reglages: Partial<ParRessource<Reglage>>;
    /** Les Stocks au départ de l'absence, tels que la base les tient après réglage. */
    let debut: ParRessource<{ s: bigint; l: bigint }>;
    /** Le déroulement heure par heure, de l'heure 0 à la dernière. */
    let reference: ParRessource<bigint>[];
    /** La page fermée toute l'absence, rouverte au retour : un seul rattrapage. */
    let fermee: ParRessource<Compte>;

    /** Un Territoire réglé comme le scénario, parti des mêmes Stocks. */
    const preparer = async () => {
      const t = await naitre();
      await regler(t.territoireId, scenario.habitants, reglages);
      expect(await depart(t.territoireId)).toEqual(debut);
      return t;
    };

    beforeAll(async () => {
      const entretien = scenario.habitants * ENTRETIEN_HABITANT_PAR_HEURE;
      rythmes = { p: prairie, entretien, moitie: entretien / 2 };
      reglages = scenario.stocks(rythmes);
      const t = await naitre();
      await regler(t.territoireId, scenario.habitants, reglages);
      debut = await depart(t.territoireId);
      reference = derouler(debut, prairie, scenario.habitants, scenario.heures);
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, scenario.heures) });
      fermee = await comptes(t.territoireId);
    });

    it("se déroule de même heure par heure et seconde par seconde, comme le scénario le prévoit", () => {
      // Un pas d'une heure ou d'une seconde donne les mêmes Stocks à chaque heure : les bascules du scénario tombent
      // sur des heures rondes, et le déroulement heure par heure est bien la règle du jeu.
      expect(derouler(debut, prairie, scenario.habitants, scenario.heures, 3600)).toEqual(reference);
      scenario.deroule(
        reference.map((etat) => Object.fromEntries(RESSOURCES.map((id) => [id, Number(etat[id]) / 3_600_000_000])) as ParRessource<number>),
        rythmes,
      );
    });

    it("page fermée : au retour, chaque Stock vaut exactement le déroulement heure par heure", () => {
      expect(fermee).toMatchObject(attendus(reference[scenario.heures]));
    });

    it("page ouverte : à chaque heure, chaque Stock vaut exactement le déroulement, et l'absence finit comme page fermée", async () => {
      const t = await preparer();
      for (let h = 0; h < scenario.heures; h++) {
        // Des rattrapages fréquents, à des instants quelconques, puis à l'heure ronde.
        for (const ms of [787_123, 2_519_999, HEURE]) await rattraper("territoire", t.territoireId, { pool, jusqua: new Date(t.ne.getTime() + h * HEURE + ms) });
        expect(await stocks(t.territoireId), `${h + 1} h`).toEqual(attendus(reference[h + 1]));
      }
      // Production comptée et instant de remplissage compris.
      expect(await comptes(t.territoireId)).toEqual(fermee);
    }, 120_000);

    it("tâche planifiée passée au milieu : même résultat qu'à la page fermée", async () => {
      const t = await preparer();
      for (const heures of scenario.tache) {
        const passage = await rattraperLesAbsents({ pool, maintenant: apres(t.ne, heures), parmi: { territoire: [t.territoireId] } });
        expect(passage, `passage à ${heures} h`).toMatchObject({ rattrapes: 1, echecs: 0 });
      }
      await rattraper("territoire", t.territoireId, { pool, jusqua: apres(t.ne, scenario.heures) });
      expect(await stocks(t.territoireId)).toEqual(attendus(reference[scenario.heures]));
      expect(await comptes(t.territoireId)).toEqual(fermee);
    }, 60_000);
  });
});
