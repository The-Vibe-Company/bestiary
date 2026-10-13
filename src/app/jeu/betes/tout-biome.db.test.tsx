import type { Pool } from "pg";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { dureeDuTrajetMinutes } from "@/expeditions/allure";
import { retourDUneExpedition } from "@/expeditions/phase";
import { programmerLeRetour } from "@/expeditions/retour";
import { type BeteSauvage, betesSauvagesDesCases, type Sexe, sexeTire } from "@/monde/betes-sauvages";
import { placesDeLHabitat } from "@/monde/habitat";
import { type Coordonnees, distance } from "@/monde/hex";
import { PLACES_DE_L_HABITAT_DU_FOYER } from "@/reglages";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";

// La garde dit qui est connecté ; les pages lisent pour de bon la base de test.
const garde = vi.hoisted(() => ({ exigerCompte: vi.fn() }));
vi.mock("@/comptes/garde", () => garde);
const base = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("@/db", async (original) => ({ ...(await original<object>()), getPool: () => base.pool }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));

import FicheDeLEspece from "../reserve/[espece]/page";
import Betes from "./page";

const MINUTE = 60_000;
const JOUR = 24 * 60 * MINUTE;
/** Le séjour des Expéditions de l'essai, en minutes de jeu. */
const SEJOUR = 60;
/** Le total des Places de l'Habitat du Foyer, écrit comme la page l'écrit (US-0822). */
const TOTAL = new Intl.NumberFormat("fr-FR").format(PLACES_DE_L_HABITAT_DU_FOYER).replace(/\s/g, "\u00a0");

/** Le Monde d'essai de ce fichier, où naissent ses chefs : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai des Bêtes de tout Biome (US-0823)";

/** Une Case du Monde d'essai, et sa distance au Foyer du chef de l'essai. */
type CaseDuMonde = Coordonnees & { id: number; distance: number };

describe.skipIf(!URL_TEST)("loger au Foyer les Bêtes de tout Biome (US-0823, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  /** La graine du Monde d'essai, d'où se tirent les sexes de ses Bêtes (US-0937). */
  let graine: number;
  const lancement = `tout-biome-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  let numero = 0;
  /** Les comptes des Territoires nés pendant l'essai en cours. */
  const nes: string[] = [];
  const apres = (instant: Date, ms: number) => new Date(instant.getTime() + ms);

  /** Un chef qui vient de naître dans le Monde d'essai : son Territoire, l'instant de sa naissance et son Foyer. */
  const naitre = async () => {
    const n = ++numero;
    nes.push(`${lancement}-${n}@essai.test`);
    const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
    expect(await enregistrerNomDeChef(pool, compte.id, nomDEssai("Biom", suffixe, n), Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
    const territoireId = (await territoireDuCompte(pool, compte.id))!;
    const { rows } = await pool.query<Coordonnees & { biome: string }>(
      "select f.q, f.r, f.biome_id as biome from territoire t join case_du_monde f on f.id = t.foyer_case_id where t.id = $1",
      [territoireId],
    );
    return { territoireId, ne: await lireMarquePage(pool, "territoire", territoireId), foyer: rows[0] };
  };
  /**
   * Une Bête sauvage commune du Biome `biome` à aller chercher : sur la Case libre de ce Biome la plus proche du Foyer
   * (hors des Cases des Bêtes de naissance du Territoire) où, dans les jours qui suivent la naissance du chef, une Bête
   * commune se montre seule pendant tout un séjour, à son apparition : l'Expédition qui arrive à cet instant ne voit
   * qu'elle, l'a à portée même sans escorte (US-0935) et ne peut la perdre au profit d'une autre ; aucune Bête rare ne
   * l'attaque. Toutes les Cases du Biome sont lues d'un coup : il peut être loin du Foyer.
   */
  const uneBeteSeule = async (t: { territoireId: number; ne: Date; foyer: Coordonnees }, biome: string) => {
    const { rows } = await pool.query<Coordonnees & { id: number }>(
      `select c.id, c.q, c.r from case_du_monde c
       where c.monde_id = $1 and c.biome_id = $2 and c.chef_id is null
         and not exists (select 1 from bete_de_naissance b where b.case_id = c.id and b.territoire_id = $3)`,
      [mondeId, biome, t.territoireId],
    );
    const cases: CaseDuMonde[] = rows.map((c) => ({ ...c, distance: distance(t.foyer, c) })).sort((a, b) => a.distance - b.distance || a.id - b.id);
    const fin = apres(t.ne, 4 * JOUR);
    const parCase = await betesSauvagesDesCases(pool, cases.map((c) => c.id), t.ne, fin);
    for (const laCase of cases) {
      const trajet = dureeDuTrajetMinutes(laCase.distance, []);
      const betes = parCase.get(laCase.id)!;
      const seule = betes.find((bete) => {
        const repart = apres(bete.arrivee, SEJOUR * MINUTE);
        return (
          bete.rareteId === "commune" &&
          bete.arrivee >= apres(t.ne, trajet * MINUTE) &&
          repart <= fin &&
          bete.depart >= repart &&
          betes.every((autre) => autre === bete || autre.arrivee >= repart || autre.depart <= bete.arrivee)
        );
      });
      if (seule) return { laCase, bete: seule, trajet, depart: apres(seule.arrivee, -trajet * MINUTE) };
    }
    throw new Error(`Aucune Bête commune seule sur une Case de ${biome}.`);
  };
  /**
   * Une Expédition du Territoire, sans escorte, avec un explorateur, partie à `depart` vers la Case `laCase` pour un
   * séjour : posée en base comme le font les essais des Rencontres, son retour programmé (US-0916) ; la portée
   * d'exploration (US-0908) n'y entre pas. Son instant de retour.
   */
  const partir = async (territoireId: number, laCase: CaseDuMonde, trajet: number, depart: Date) => {
    const { rows } = await pool.query<{ id: number }>(
      "insert into expedition (territoire_id, case_id, part_le, trajet_minutes, sejour_minutes) values ($1, $2, $3, $4, $5) returning id",
      [territoireId, laCase.id, depart, trajet, SEJOUR],
    );
    await pool.query("insert into habitant (territoire_id, prenom, metier, expedition_id) values ($1, 'Joran', 'explorateur', $2)", [territoireId, rows[0].id]);
    const horaires = { partLe: depart, trajetMinutes: trajet, sejourMinutes: SEJOUR };
    await programmerLeRetour(pool, territoireId, rows[0].id, horaires);
    return retourDUneExpedition(horaires)!;
  };
  /** La page Bêtes telle que le joueur du Territoire la voit : son texte, morceau par morceau, et ses liens. */
  const pageBetes = async (territoireId: number) => {
    garde.exigerCompte.mockResolvedValue({ id: 1, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId, recitLu: true });
    const html = renderToStaticMarkup(await Betes());
    return {
      texte: html
        .replace(/<[^>]+>/g, "|")
        .replace(/&#x27;/g, "'")
        .split("|")
        .map((m) => m.trim())
        .filter(Boolean)
        .join(" · "),
      liens: [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map(([, lien]) => lien.replace(/&amp;/g, "&")),
    };
  };
  /** Les caractéristiques de la fiche de l'Espèce `espece` (US-0803), telles que le joueur du Territoire les lit. */
  const caracteristiques = async (territoireId: number, espece: string) => {
    garde.exigerCompte.mockResolvedValue({ id: 1, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId, recitLu: true });
    const html = renderToStaticMarkup(await FicheDeLEspece({ params: Promise.resolve({ espece }), searchParams: Promise.resolve({}) }));
    return [...(html.match(/<dl[^>]*>(.*?)<\/dl>/)?.[1] ?? "").matchAll(/<dt[^>]*>(.*?)<\/dt><dd[^>]*>(.*?)<\/dd>/g)].map(
      ([, nom, valeur]) => `${nom} ${valeur.replace(/<[^>]+>/g, "")}`,
    );
  };

  beforeAll(async () => {
    pool = poolDeTest();
    base.pool = pool;
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);
    // Les Bêtes que ce fichier a fait partir lors d'un lancement précédent sont revenues sur leur Case : un départ resté
    // en base empêcherait de les apprivoiser de nouveau.
    await pool.query("delete from bete_partie p using case_du_monde c where c.id = p.case_id and c.monde_id = $1", [mondeId]);
    graine = Number((await pool.query<{ graine: string }>("select graine from monde where id = $1", [mondeId])).rows[0].graine);
  });
  afterEach(async () => {
    // Chaque essai rend ses Foyers à la Couronne du Monde d'essai.
    await pool.query("delete from compte where email = any($1)", [nes.splice(0)]);
  });
  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}-%`]);
    await pool.end();
  });

  it("une Bête de chaque Biome où vit une Espèce commune, hors de la prairie, ramenée par une Expédition, entre au Foyer en prairie et y prend ses Places ; sa fiche dit son Biome", async () => {
    const t = await naitre();
    // Le Foyer est en prairie (US-0152).
    expect(t.foyer.biome).toBe("prairie");

    // Chaque Biome où vit une Espèce commune, hors de la prairie, que la Bête d'une Expédition sans escorte peut suivre.
    const { rows: biomes } = await pool.query<{ id: string; nom: string }>(
      `select b.id, b.nom from biome b
       where b.id <> 'prairie' and exists (select 1 from espece e where e.biome_id = b.id and e.rarete_id = 'commune')
       order by b.id`,
    );
    expect(biomes.length).toBeGreaterThan(0);

    // Une Expédition par Biome va chercher, sur une Case de ce Biome, une Bête commune seule pendant son séjour.
    const parties: { biome: { id: string; nom: string }; bete: BeteSauvage; sexe: Sexe }[] = [];
    let dernierRetour = t.ne;
    for (const biome of biomes) {
      const { laCase, bete, trajet, depart } = await uneBeteSeule(t, biome.id);
      const retour = await partir(t.territoireId, laCase, trajet, depart);
      if (retour > dernierRetour) dernierRetour = retour;
      parties.push({ biome, bete, sexe: sexeTire({ graine, q: laCase.q, r: laCase.r }, bete.numero) });
    }
    // L'Espèce de chaque Bête, du Biome de sa Case.
    const { rows: especes } = await pool.query<{ id: string; nom: string; biome: string; taille: number }>(
      "select id, nom, biome_id as biome, taille from espece where id = any($1) order by nom",
      [parties.map((p) => p.bete.especeId)],
    );
    expect(especes.map((e) => e.biome).sort()).toEqual(biomes.map((b) => b.id));

    // Le temps passe jusqu'au dernier retour : chaque Bête suit son Expédition (US-0934) et arrive au Foyer avec elle (US-0938).
    await rattraper("territoire", t.territoireId, { pool, jusqua: apres(dernierRetour, MINUTE) });
    // Une Bête par Espèce : aucune ne réunit de Couple (US-0956), toutes restent dans l'effectif.
    const { rows: effectif } = await pool.query<{ especeId: string; sexe: Sexe; nombre: number }>(
      `select espece_id as "especeId", sexe, nombre from effectif where territoire_id = $1 and nombre > 0 order by espece_id`,
      [t.territoireId],
    );
    expect(effectif).toEqual(
      parties.map((p) => ({ especeId: p.bete.especeId, sexe: p.sexe, nombre: 1 })).sort((a, b) => a.especeId.localeCompare(b.especeId)),
    );

    // Les Places de l'Habitat du Foyer les accueillent toutes, chacune selon sa taille (US-0805, US-0822).
    const occupees = especes.reduce((somme, e) => somme + e.taille, 0);
    expect((await placesDeLHabitat(pool, t.territoireId)).occupees).toBeCloseTo(occupees, 6);
    expect(await pageBetes(t.territoireId)).toEqual({
      texte: [`Bêtes · ${especes.length} · Bêtes · Places : · ${Math.ceil(occupees)} / ${TOTAL}`, ...especes.map((e) => `${e.nom} · Commune · 1`)].join(" · "),
      liens: especes.map((e) => `/jeu/reserve/${e.id}?depuis=betes`),
    });

    // La fiche de chacune dit quand même son Biome d'Habitat, celui de la Case où elle vivait, jamais la prairie du Foyer.
    for (const e of especes) {
      const habitat = (await caracteristiques(t.territoireId, e.id)).find((c) => c.startsWith("Habitat "));
      expect(habitat).toBe(`Habitat ${biomes.find((b) => b.id === e.biome)!.nom}`);
    }
  }, 60_000);
});
