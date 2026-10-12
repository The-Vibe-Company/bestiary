import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { stocksDuTerritoire } from "@/monde/stocks";
import { ecartAvantVoyageur } from "@/monde/voyageurs";
import { ENTRETIEN_HABITANT_PAR_HEURE, VOYAGEUR_ATTEND_HEURES, VOYAGEURS_EN_ATTENTE_MAX } from "@/reglages";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { rattraperLesAbsents } from "./absents";
import { definirAncre, maintenant } from "./horloge";
import { lireMarquePage } from "./marque-page";
import { rattraper } from "./rattraper";
import { SAUTS, sauterDansLeTemps } from "./sauter";
import { synchroniserHorloge } from "./synchroniser-horloge";

const R0 = new Date("2026-03-01T12:00:00Z").getTime();
const MINUTE = 60_000;

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai du temps accéléré (US-0038)";

describe.skipIf(!URL_TEST)("temps accéléré (sur base)", () => {
  let pool: Pool;
  let mondeId: number;

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
  });
  beforeEach(async () => {
    // L'horloge de la base de test repart de zéro à chaque test.
    await pool.query("delete from horloge");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(R0);
  });
  afterEach(() => {
    vi.useRealTimers();
    definirAncre(null);
  });
  afterAll(async () => {
    await pool.query("delete from horloge");
    await pool.end();
  });

  it("fait passer le temps cent fois plus vite à ×100", async () => {
    await synchroniserHorloge(pool, 100);
    vi.setSystemTime(R0 + MINUTE);
    expect(maintenant()).toEqual(new Date(R0 + 100 * MINUTE));
  });

  it("ne fait jamais reculer l'heure du jeu quand on change de vitesse", async () => {
    await synchroniserHorloge(pool, 100);
    vi.setSystemTime(R0 + MINUTE);
    const avant = maintenant().getTime();
    await synchroniserHorloge(pool, 1); // retour à vitesse normale
    expect(maintenant().getTime()).toBeGreaterThanOrEqual(avant);
    vi.setSystemTime(R0 + 2 * MINUTE);
    expect(maintenant()).toEqual(new Date(R0 + 101 * MINUTE)); // une minute de plus, à vitesse normale
    await synchroniserHorloge(pool, 1); // même vitesse : rien ne bouge
    expect(maintenant()).toEqual(new Date(R0 + 101 * MINUTE));
  });

  it("reprend l'ancre enregistrée au redémarrage du serveur", async () => {
    await synchroniserHorloge(pool, 100);
    vi.setSystemTime(R0 + 3 * MINUTE);
    definirAncre(null); // un autre serveur qui démarre
    await synchroniserHorloge(pool, 100);
    expect(maintenant()).toEqual(new Date(R0 + 300 * MINUTE));
  });

  it("entraîne le rattrapage à l'ouverture d'une page et la tâche planifiée", async () => {
    await synchroniserHorloge(pool, 100);
    const ids: number[] = [];
    for (let i = 0; i < 2; i++) {
      const { rows } = await pool.query<{ id: number }>(
        "insert into monde (nom, calcule_jusqu_a) values ($1, $2) returning id",
        [`essai-${randomUUID()}`, new Date(R0)],
      );
      ids.push(rows[0].id);
    }
    vi.setSystemTime(R0 + MINUTE);
    await rattraper("monde", ids[0], { pool });
    await rattraperLesAbsents({ pool, parmi: { monde: [ids[1]] } });
    for (const id of ids) expect(await lireMarquePage(pool, "monde", id)).toEqual(new Date(R0 + 100 * MINUTE));
  });

  describe("saut dans le temps (US-0038) et production en temps accéléré (US-0218)", () => {
    const lancement = `vitesse-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
    const suffixe = suffixeDEssai();
    let numero = 0;
    const HEURE = 60 * MINUTE;

    /** Un Foyer né à l'heure du jeu, ses Stocks remis à zéro et sans Habitants : la production seule, sans Entretien (US-0316). */
    const naitre = async () => {
      const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
      expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Vite", suffixe, numero), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
      const territoireId = (await territoireDuCompte(pool, compte.id))!;
      await pool.query("update stock set quantite = 0 where territoire_id = $1", [territoireId]);
      await pool.query("delete from habitant where territoire_id = $1", [territoireId]);
      return territoireId;
    };
    const stocks = async (territoireId: number) =>
      Object.fromEntries((await pool.query<{ id: string; q: string }>("select ressource_id as id, quantite::text as q from stock where territoire_id = $1", [territoireId])).rows.map((r) => [r.id, r.q]));
    const nFois = async (n: number) =>
      Object.fromEntries((await pool.query<{ id: string; q: string }>("select ressource_id as id, (par_heure * $1)::numeric(24, 6)::text as q from production_biome where biome_id = 'prairie'", [n])).rows.map((r) => [r.id, r.q]));

    beforeAll(async () => {
      await preparerMondeDeTest(pool);
    });
    afterAll(async () => {
      await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    });

    it("avance l'heure du jeu d'un bloc, sans changer sa vitesse", async () => {
      await synchroniserHorloge(pool, 100);
      vi.setSystemTime(R0 + MINUTE);
      await sauterDansLeTemps(pool, SAUTS.jour);
      expect(maintenant()).toEqual(new Date(R0 + 100 * MINUTE + 24 * HEURE));
      vi.setSystemTime(R0 + 2 * MINUTE);
      expect(maintenant()).toEqual(new Date(R0 + 200 * MINUTE + 24 * HEURE));
      definirAncre(null); // un autre serveur qui démarre retrouve le saut
      await synchroniserHorloge(pool, 100);
      expect(maintenant()).toEqual(new Date(R0 + 200 * MINUTE + 24 * HEURE));
    });

    it("refuse de sauter en production", async () => {
      await expect(sauterDansLeTemps(pool, SAUTS.heure, { VERCEL_ENV: "production" })).rejects.toThrow("pas en production");
    });

    it("à ×100, ajoute une heure de production toutes les 36 secondes réelles", async () => {
      await synchroniserHorloge(pool, 100);
      const territoireId = await naitre();
      vi.setSystemTime(R0 + 36_000);
      await rattraper("territoire", territoireId, { pool });
      expect(await stocks(territoireId)).toEqual(await nFois(1));
    });

    it("après un saut d'un jour, ajoute exactement 24 fois la production horaire", async () => {
      await synchroniserHorloge(pool, 1);
      const territoireId = await naitre();
      await sauterDansLeTemps(pool, SAUTS.jour);
      await rattraper("territoire", territoireId, { pool });
      expect(await stocks(territoireId)).toEqual(await nFois(24));
    });

    describe("la limite en temps accéléré (US-0232)", () => {
      /** Le Bois est placé à N unités de sa limite. */
      const N = 2;

      /** Chaque Stock du Territoire, tel qu'il est en base : quantité, limite et reste exacts, et l'instant où il est devenu plein. */
      const etats = async (territoireId: number) =>
        Object.fromEntries(
          (
            await pool.query<{ id: string; q: string; limite: string; reste: string; plein_depuis: Date | null }>(
              "select ressource_id as id, quantite::text as q, limite::text as limite, reste::text as reste, plein_depuis from stock where territoire_id = $1",
              [territoireId],
            )
          ).rows.map((s) => [s.id, s]),
        );
      /** Ce qu'une Case de prairie produit par heure, tel que la base le tient de donnees/biomes.yaml. */
      const prairie = async () =>
        Object.fromEntries(
          (await pool.query<{ id: string; par_heure: string }>("select ressource_id as id, par_heure from production_biome where biome_id = 'prairie'")).rows.map(
            (p) => [p.id, Number(p.par_heure)],
          ),
        );
      /** Le Stock est devenu plein à l'instant de jeu attendu, à la seconde près. */
      const pleinA = (pleinDepuis: Date | null, attendu: number) => {
        expect(pleinDepuis).not.toBeNull();
        expect(Math.abs(pleinDepuis!.getTime() - attendu)).toBeLessThan(1000);
      };

      it("à ×100, un Stock proche de sa limite l'atteint à l'instant prévu et s'y arrête", async () => {
        await synchroniserHorloge(pool, 100);
        const territoireId = await naitre();
        await pool.query("update stock set quantite = limite - $2 where territoire_id = $1 and ressource_id = 'bois'", [territoireId, N]);
        const depuis = (await lireMarquePage(pool, "territoire", territoireId)).getTime();
        // Les N unités manquantes viennent en N / par_heure heures de jeu, soit cent fois moins de temps réel.
        const duree = (N / (await prairie()).bois) * HEURE;
        const reel = R0 + duree / 100;

        // Une seconde réelle avant (cent secondes de jeu) : encore sous la limite.
        vi.setSystemTime(reel - 1000);
        await rattraper("territoire", territoireId, { pool });
        const avant = (await etats(territoireId)).bois;
        expect(Number(avant.q)).toBeLessThan(Number(avant.limite));
        expect(avant.plein_depuis).toBeNull();

        // Une seconde réelle après : exactement la limite, pleine depuis l'instant prévu.
        vi.setSystemTime(reel + 1000);
        await rattraper("territoire", territoireId, { pool });
        const apres = (await etats(territoireId)).bois;
        expect(apres.q).toBe(apres.limite);
        expect(Number(apres.reste)).toBe(0);
        pleinA(apres.plein_depuis, depuis + duree);

        // Dix minutes réelles plus tard, plus de seize heures de jeu : le Bois ne bouge plus.
        vi.setSystemTime(reel + 10 * MINUTE);
        await rattraper("territoire", territoireId, { pool });
        expect((await etats(territoireId)).bois).toEqual(apres);
      });

      it("page fermée tout ce temps, la réouverture montre le Stock exactement à sa limite, plein", async () => {
        await synchroniserHorloge(pool, 100);
        const territoireId = await naitre();
        await pool.query("update stock set quantite = limite - $2 where territoire_id = $1 and ressource_id = 'bois'", [territoireId, N]);
        const depuis = (await lireMarquePage(pool, "territoire", territoireId)).getTime();
        const duree = (N / (await prairie()).bois) * HEURE;

        // Aucun rattrapage pendant dix minutes réelles, plus de seize heures de jeu ; puis la page se rouvre.
        vi.setSystemTime(R0 + 10 * MINUTE);
        await rattraper("territoire", territoireId, { pool });
        expect(await lireMarquePage(pool, "territoire", territoireId)).toEqual(new Date(R0 + 1000 * MINUTE));
        // Ce que lit la page : la quantité égale la limite, et la barre signale « plein » dès quantité ≥ limite.
        const bois = (await stocksDuTerritoire(pool, territoireId)).find((s) => s.id === "bois")!;
        expect(bois.quantite).toBe(bois.limite);
        const etat = (await etats(territoireId)).bois;
        expect(Number(etat.reste)).toBe(0);
        pleinA(etat.plein_depuis, depuis + duree);
      });

      it("après un saut d'une semaine depuis la page de contrôle, chaque Stock vaut exactement sa limite", async () => {
        await synchroniserHorloge(pool, 100);
        const territoireId = await naitre();
        // Chaque Stock à mi-chemin de sa limite : une semaine de prairie la dépasse pour les quatre.
        await pool.query("update stock set quantite = limite / 2 where territoire_id = $1", [territoireId]);
        const depart = await etats(territoireId);
        const parHeure = await prairie();
        const depuis = (await lireMarquePage(pool, "territoire", territoireId)).getTime();

        await sauterDansLeTemps(pool, SAUTS.semaine);
        await rattraper("territoire", territoireId, { pool });
        const apres = await etats(territoireId);
        expect(Object.keys(apres).sort()).toEqual(["bois", "pierre", "vegetaux", "viande"]);
        for (const [id, stock] of Object.entries(apres)) {
          expect(stock.q, id).toBe(stock.limite);
          expect(Number(stock.reste), id).toBe(0);
          pleinA(stock.plein_depuis, depuis + ((Number(stock.limite) - Number(depart[id].q)) / parHeure[id]) * HEURE);
        }
      });
    });
  });

  describe("l'Entretien en temps accéléré (US-0317)", () => {
    const lancement = `faim-vite-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
    const suffixe = suffixeDEssai();
    let numero = 0;
    const HEURE = 60 * MINUTE;
    const JOUR = 24 * HEURE;
    const HABITANTS = 12;
    const ENTRETIEN = HABITANTS * ENTRETIEN_HABITANT_PAR_HEURE;

    /** Ce qu'une Case de prairie produit par heure, tel que la base le tient de donnees/biomes.yaml. */
    const prairie = async () =>
      Object.fromEntries(
        (await pool.query<{ id: string; par_heure: string }>("select ressource_id as id, par_heure from production_biome where biome_id = 'prairie'")).rows.map(
          (p) => [p.id, Number(p.par_heure)],
        ),
      );
    /**
     * Un Foyer né à l'heure du jeu, avec douze Habitants : la Viande, qui produit moins que sa part de l'Entretien,
     * se vide en dix heures ; les Végétaux atteignent leur limite en cinq heures, puis en redescendent quand ils
     * paient seuls l'Entretien ; le Bois atteint la sienne en route.
     */
    const naitre = async () => {
      const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
      expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Faim", suffixe, numero), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
      const territoireId = (await territoireDuCompte(pool, compte.id))!;
      const p = await prairie();
      await pool.query(
        `update stock set produit_depuis_visite = 0, plein_depuis = null,
           quantite = case ressource_id when 'viande' then $2 when 'vegetaux' then limite - $3 when 'bois' then 950.5 else 123.456789 end,
           reste = case ressource_id when 'bois' then 1234 when 'pierre' then 17 else 0 end
         where territoire_id = $1`,
        [territoireId, 10 * (ENTRETIEN / 2 - p.viande), 5 * (p.vegetaux - ENTRETIEN / 2)],
      );
      await pool.query(
        "with partis as (delete from habitant where territoire_id = $1) insert into habitant (territoire_id, prenom) select $1, 'Essai' from generate_series(1, $2)",
        [territoireId, HABITANTS],
      );
      return territoireId;
    };
    /** Chaque Stock du Territoire, exact : quantité, reste, production entrée, limite, et l'instant où il est devenu plein, en microsecondes. */
    const etats = async (territoireId: number) =>
      Object.fromEntries(
        (
          await pool.query<{ id: string; q: string; reste: string; produit: string; limite: string; plein: string | null }>(
            `select ressource_id as id, quantite::text as q, reste::text as reste, produit_depuis_visite::text as produit, limite::text as limite,
               (extract(epoch from plein_depuis) * 1000000)::bigint::text as plein
             from stock where territoire_id = $1`,
            [territoireId],
          )
        ).rows.map(({ id, ...stock }) => [id, stock]),
      );
    /** Une journée de jeu : la page ouverte aux instants réels `visites`, la tâche planifiée aux instants réels `passages`, puis le retour. */
    const vivreUneJournee = async (territoireId: number, facteur: number, visites: number[], passages: number[]) => {
      const instants = [...visites.map((ms) => ({ ms, tache: false })), ...passages.map((ms) => ({ ms, tache: true }))].sort((a, b) => a.ms - b.ms);
      for (const { ms, tache } of instants) {
        vi.setSystemTime(R0 + ms);
        if (tache) expect(await rattraperLesAbsents({ pool, parmi: { territoire: [territoireId] } })).toMatchObject({ rattrapes: 1, echecs: 0 });
        else await rattraper("territoire", territoireId, { pool });
      }
      vi.setSystemTime(R0 + JOUR / facteur);
      await rattraper("territoire", territoireId, { pool });
      expect(await lireMarquePage(pool, "territoire", territoireId)).toEqual(new Date(R0 + JOUR));
    };

    beforeAll(async () => {
      await preparerMondeDeTest(pool);
    });
    afterAll(async () => {
      await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    });

    it("à ×100, une journée de jeu (864 secondes réelles) donne exactement les mêmes Stocks qu'une journée réelle, Habitants compris", async () => {
      const p = await prairie();
      expect(ENTRETIEN / 2).toBeGreaterThan(p.viande);
      expect(p.vegetaux).toBeGreaterThan(ENTRETIEN / 2);
      expect(ENTRETIEN).toBeGreaterThan(p.viande + p.vegetaux);

      // Une journée réelle, à vitesse normale : la page ouverte toutes les trois heures, la tâche planifiée entre deux.
      await synchroniserHorloge(pool, 1);
      const normal = await naitre();
      await vivreUneJournee(normal, 1, [3, 6, 9, 12, 15, 18, 21].map((h) => h * HEURE), [10.5 * HEURE, 16 * HEURE]);

      // La même journée à ×100, sur une horloge neuve partie du même instant : la page ouverte toutes les 37 secondes réelles.
      await pool.query("delete from horloge");
      definirAncre(null);
      vi.setSystemTime(R0);
      await synchroniserHorloge(pool, 100);
      const accelere = await naitre();
      await vivreUneJournee(accelere, 100, Array.from({ length: 23 }, (_, i) => (i + 1) * 37_000), [300_500, 600_500]);

      // Quantité et reste exacts, production entrée et instant de remplissage compris.
      const fin = await etats(accelere);
      expect(fin).toEqual(await etats(normal));
      // Les Habitants ont mangé toute la journée, et les limites ont joué en route.
      expect(fin.viande).toMatchObject({ q: "0.000000", reste: "0.000000" });
      expect(fin.vegetaux.q).toBe((Number(fin.vegetaux.limite) - 14 * (ENTRETIEN - p.viande - p.vegetaux)).toFixed(6));
      expect(fin.vegetaux.plein).toBeNull();
      expect(fin.bois.q).toBe(fin.bois.limite);
      expect(fin.pierre.q).toBe((123.456789 + 24 * p.pierre).toFixed(6));
    }, 60_000);
  });

  describe("les Voyageurs en temps accéléré (US-0331)", () => {
    const lancement = `voyageurs-vite-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
    const suffixe = suffixeDEssai();
    let numero = 0;
    const HEURE = 60 * MINUTE;
    const JOUR = 24 * HEURE;

    /** Un Foyer né à l'heure du jeu. */
    const naitre = async () => {
      const compte = (await creerCompte(pool, `${lancement}-${++numero}@essai.test`, "une phrase de passe"))!;
      expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Voya", suffixe, numero), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
      return (await territoireDuCompte(pool, compte.id))!;
    };
    /** Les arrivées prévues sans base, de la naissance `ne` jusqu'à `jusqua` compris : numéro et instant de jeu. */
    const prevues = (territoireId: number, ne: number, jusqua: number) => {
      const liste: number[][] = [];
      let instant = ne + ecartAvantVoyageur(territoireId, 1);
      while (instant <= jusqua) {
        liste.push([liste.length + 1, instant]);
        instant += ecartAvantVoyageur(territoireId, liste.length + 1);
      }
      return liste;
    };
    /** Les arrivées traitées du Territoire, numéro et instant de jeu, et les instants de jeu où ses Voyageurs se sont présentés. */
    const arrivees = async (territoireId: number) => ({
      traitees: (
        await pool.query<{ numero: number; traite_le: Date }>(
          `select (donnees->>'numero')::int as numero, traite_le from evenement
           where element = 'territoire' and element_id = $1 and type = 'arrivee_voyageur' and traite_le is not null order by traite_le, id`,
          [territoireId],
        )
      ).rows.map((e) => [e.numero, e.traite_le.getTime()]),
      venus: (await pool.query<{ arrive_le: Date }>("select arrive_le from voyageur where territoire_id = $1 order by arrive_le, id", [territoireId])).rows.map((v) =>
        v.arrive_le.getTime(),
      ),
    });
    /**
     * Ce que le Territoire né à R0 doit avoir vu arriver au bout d'une journée de jeu : un Voyageur à chaque arrivée qui
     * trouve de la place aux portes, celle des Voyageurs repartis au bout de leur attente libérée (US-0337).
     */
    const uneJournee = (territoireId: number) => {
      const traitees = prevues(territoireId, R0, R0 + JOUR);
      const venus: number[] = [];
      for (const [, instant] of traitees) {
        if (venus.filter((v) => v + VOYAGEUR_ATTEND_HEURES * HEURE > instant).length < VOYAGEURS_EN_ATTENTE_MAX) venus.push(instant);
      }
      return { traitees, venus };
    };

    beforeAll(async () => {
      await preparerMondeDeTest(pool);
    });
    afterAll(async () => {
      await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    });

    it("à ×100, le premier Voyageur se présente cent fois plus tôt en temps réel, à son instant de jeu exact", async () => {
      await synchroniserHorloge(pool, 100);
      const territoireId = await naitre();
      expect(await lireMarquePage(pool, "territoire", territoireId)).toEqual(new Date(R0));
      const ecart = ecartAvantVoyageur(territoireId, 1);

      // Une seconde réelle avant (cent secondes de jeu) : personne encore.
      vi.setSystemTime(R0 + Math.floor(ecart / 100) - 1000);
      await rattraper("territoire", territoireId, { pool });
      expect((await arrivees(territoireId)).venus).toEqual([]);

      // Une seconde réelle après : il s'est présenté à l'instant de jeu prévu.
      vi.setSystemTime(R0 + Math.floor(ecart / 100) + 1000);
      await rattraper("territoire", territoireId, { pool });
      expect(await arrivees(territoireId)).toEqual({ traitees: [[1, R0 + ecart]], venus: [R0 + ecart] });
    });

    it("à ×100, une journée de jeu (864 secondes réelles) donne les arrivées prévues, comme une journée réelle à vitesse normale", async () => {
      // Une journée réelle, à vitesse normale : la page ouverte toutes les trois heures, la tâche planifiée entre deux.
      await synchroniserHorloge(pool, 1);
      const normal = await naitre();
      for (const h of [3, 6, 9, 10.5, 12, 15, 16, 18, 21]) {
        vi.setSystemTime(R0 + h * HEURE);
        if (h % 3) expect(await rattraperLesAbsents({ pool, parmi: { territoire: [normal] } })).toMatchObject({ rattrapes: 1, echecs: 0 });
        else await rattraper("territoire", normal, { pool });
      }
      vi.setSystemTime(R0 + JOUR);
      await rattraper("territoire", normal, { pool });

      // La même journée à ×100, sur une horloge neuve partie du même instant : la page ouverte toutes les 37 secondes
      // réelles, la tâche planifiée deux fois entre deux.
      await pool.query("delete from horloge");
      definirAncre(null);
      vi.setSystemTime(R0);
      await synchroniserHorloge(pool, 100);
      const accelere = await naitre();
      for (let s = 37; s < 864; s += 37) {
        vi.setSystemTime(R0 + s * 1000);
        await rattraper("territoire", accelere, { pool });
        if (s === 296 || s === 592) {
          vi.setSystemTime(R0 + (s + 18) * 1000);
          expect(await rattraperLesAbsents({ pool, parmi: { territoire: [accelere] } })).toMatchObject({ rattrapes: 1, echecs: 0 });
        }
      }
      vi.setSystemTime(R0 + JOUR / 100);
      await rattraper("territoire", accelere, { pool });

      for (const territoireId of [normal, accelere]) {
        expect(await lireMarquePage(pool, "territoire", territoireId)).toEqual(new Date(R0 + JOUR));
        // Chaque arrivée traitée à son instant de jeu, chaque Voyageur venu au sien, rien de perdu ni d'inventé.
        expect(await arrivees(territoireId)).toEqual(uneJournee(territoireId));
        // Une journée de jeu voit passer au moins deux arrivées, de quatre à douze heures d'écart.
        expect(uneJournee(territoireId).traitees.length).toBeGreaterThanOrEqual(2);
      }
    }, 60_000);
  });
});

