// US-0922 : une Expédition partie, arrivée et rentrée pendant l'absence du joueur laisse exactement ce qu'elle aurait laissé
// page ouverte. Le mécanisme du temps (src/temps/avancer.ts) applique chacun de ses événements à son instant exact, page
// ouverte, au retour du joueur ou par la tâche planifiée : le brouillard levé (US-0914), les Rencontres (US-0932), les
// Bêtes qui la suivent (US-0934), le Bestiaire (US-0933), le retour (US-0916), son récit (US-0917), et le rappel
// (US-0920), à l'aller ou en séjour. Les mêmes Expéditions du même Territoire sont vécues ici des trois manières, et tout ce
// qu'elles laissent se compare. Aucune n'est attaquée (US-0943) : le tirage d'une attaque dépend de l'identifiant de
// l'Expédition, que chaque manière tire à nouveau. Escortées par l'Espèce la plus forte du jeu, A et B ont toute Bête à
// portée ; sans escorte, C et E séjournent là où ne se montre aucune Bête plus rare que commune.
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bestiaireDuTerritoire, type EspeceAuBestiaire } from "@/bestiaire/bestiaire";
import { enregistrerNomDeChef } from "@/chefs/chef";
import { creerCompte } from "@/comptes/compte";
import { betesSauvagesDUneCase } from "@/monde/betes-sauvages";
import { casesDecouvertes } from "@/monde/brouillard";
import { betesDisponibles, type EspeceDisponible } from "@/monde/effectif";
import { anneau, type Coordonnees, distance } from "@/monde/hex";
import { recitsDuTerritoire } from "@/monde/recits";
import { MONDE_RAYON, RATTRAPER_APRES_MINUTES } from "@/reglages";
import { rattraperLesAbsents } from "@/temps/absents";
import { formaterMinutes } from "@/temps/affichage";
import { definirAncre, maintenant } from "@/temps/horloge";
import { lireMarquePage } from "@/temps/marque-page";
import { rattraper } from "@/temps/rattraper";
import { mondeDEssai, nomDEssai, poolDansLaTransaction, poolDeTest, preparerMondeDeTest, suffixeDEssai, territoireDuCompte, URL_TEST } from "@/test/base";
import { dureeDuTrajetMinutes } from "./allure";
import { casesRevelees } from "./brouillard";
import { lancerLExpedition } from "./depart";
import { expeditionsEnCours } from "./en-cours";
import { forceDUneBete } from "./force";
import { type HorairesDUneExpedition, retourDUneExpedition, sejourDUneExpedition } from "./phase";
import { passagesDUneExpedition } from "./position";
import { rappelerLExpedition } from "./rappel";
import { type Rencontre, rencontresDUneExpedition } from "./rencontres";

const MINUTE_MS = 60_000;
const HEURE = 60;

/** Le Monde d'essai de ce fichier, où naît son chef : la Couronne d'Aube est partagée par toute la suite (src/test/base.ts). */
const MONDE_D_ESSAI = "Essai d'une Expédition vécue en mon absence (US-0922)";
/** Le titre des Récits de retour, pour les trier parmi ceux du Territoire (un Voyageur reparti en écrit aussi). */
const RETOUR = "Retour d'Expédition";

/**
 * Les manières de vivre les mêmes Expéditions : page ouverte du premier départ au dernier retour ; page fermée entre les
 * départs et les rappels, puis après le dernier, et rattrapée d'un bloc au retour du joueur ; ou page fermée, sans retour
 * du joueur, le temps avancé par la seule tâche planifiée, qui passe toutes les heures (vercel.json).
 */
const MANIERES = ["page ouverte", "d'un bloc", "par la tâche planifiée"] as const;
type Maniere = (typeof MANIERES)[number];

/** Les cinq Expéditions de l'essai, nommées dans l'ordre de leur départ. */
type Lettre = "A" | "B" | "C" | "D" | "E";

/**
 * Une Expédition de l'essai telle que le joueur la lance, puis la rappelle (`rappel`, US-0920), s'il le fait, avec les
 * horaires que son départ et son rappel lui fixeront, et l'heure de son retour.
 */
type Plan = {
  lettre: Lettre;
  destination: Coordonnees;
  caseId: number;
  escorte: Map<string, number>;
  horaires: HorairesDUneExpedition;
  rappel?: Date;
  retour: Date;
};

/** Tout ce que des Expéditions laissent à leur Territoire, une fois toutes rentrées. */
type Bilan = {
  /** Chaque Case découverte, avec l'Expédition qui l'a sortie du brouillard (null : les abords du Foyer, dès sa naissance). */
  decouvertes: (Coordonnees & { biome: string; par: Lettre | null })[];
  /** Chaque Expédition : l'heure où elle est rentrée et ses Rencontres, Bêtes suivies comprises. */
  expeditions: Partial<Record<Lettre, { rentreeLe: Date | null; rencontres: Omit<Rencontre, "id">[] }>>;
  /** Les Bêtes sauvages parties de leur Case en suivant une Expédition, et quand. */
  parties: { caseId: number; numero: number; partieLe: Date }[];
  bestiaire: EspeceAuBestiaire[];
  disponibles: EspeceDisponible[];
  explorateursAuFoyer: number;
  enCours: number;
  /** Les récits de retour tels que la page Récits les liste, du plus récent au plus ancien. */
  recits: { texte: string; survenuLe: Date; luLe: Date | null }[];
  /** Les Expéditions dans l'ordre où leurs récits ont été écrits. */
  ecrits: (Lettre | undefined)[];
};

describe.skipIf(!URL_TEST)("une Expédition vécue en mon absence (US-0922, sur base)", () => {
  let pool: Pool;
  let mondeId: number;
  let territoireId: number;
  /** L'Espèce la plus forte du jeu, dont deux Bêtes escortent A et B. */
  let forteId: string;
  const lancement = `absence-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** La fin des noms de chef de ce lancement, qu'aucun mot interdit ne refuse (src/test/base.ts). */
  const suffixe = suffixeDEssai();
  /** Les Expéditions de l'essai, dans l'ordre de leur départ. */
  let plans: Plan[];
  /** L'instant du jeu où tout est vécu : la dernière Expédition est rentrée, et la tâche planifiée vient de passer. */
  let fin: Date;
  const bilans = {} as Record<Maniere, Bilan>;
  const apres = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * MINUTE_MS);
  const plan = (lettre: Lettre) => plans.find((p) => p.lettre === lettre)!;
  /** Les instants où le joueur vient lancer ou rappeler une Expédition, dans l'ordre. */
  const instantsDuJoueur = () =>
    [...new Set(plans.flatMap((p) => [p.horaires.partLe, p.rappel ?? p.horaires.partLe]).map((d) => d.getTime()))]
      .sort((x, y) => x - y)
      .map((t) => new Date(t));
  /** Les Expéditions dans l'ordre de leurs retours. */
  const parRetour = () => [...plans].sort((x, y) => x.retour.getTime() - y.retour.getTime());

  /** Le bilan de ce qu'ont laissé au Territoire les Expéditions `ids`, lu avec `jeu` à l'instant `fin`. */
  const bilan = async (jeu: Pool, ids: Map<Lettre, number>): Promise<Bilan> => {
    const lettres = new Map([...ids].map(([lettre, id]) => [id, lettre]));
    const { rows: decouvertes } = await jeu.query<Coordonnees & { biome: string; expeditionId: number | null }>(
      `select c.q, c.r, c.biome_id as biome, d.expedition_id as "expeditionId" from case_decouverte d join case_du_monde c on c.id = d.case_id
       where d.territoire_id = $1 order by c.q, c.r`,
      [territoireId],
    );
    const expeditions: Bilan["expeditions"] = {};
    for (const [lettre, id] of ids) {
      const { rows } = await jeu.query<{ rentreeLe: Date | null }>('select rentree_le as "rentreeLe" from expedition where id = $1', [
        id,
      ]);
      // Sans leur identifiant, que chaque manière tire à nouveau : toEqual ne compte pas une propriété indéfinie.
      const rencontres = (await rencontresDUneExpedition(jeu, id)).map((r) => ({ ...r, id: undefined }));
      expeditions[lettre] = { rentreeLe: rows[0].rentreeLe, rencontres };
    }
    const { rows: parties } = await jeu.query<{ caseId: number; numero: string; partieLe: Date }>(
      `select p.case_id as "caseId", p.numero, p.partie_le as "partieLe" from bete_partie p join case_du_monde c on c.id = p.case_id
       where c.monde_id = $1 order by p.case_id, p.numero`,
      [mondeId],
    );
    const { rows: foyer } = await jeu.query<{ n: number }>(
      "select count(*)::int as n from habitant where territoire_id = $1 and metier = 'explorateur' and expedition_id is null",
      [territoireId],
    );
    const recits = (await recitsDuTerritoire(jeu, territoireId)).filter((r) => r.titre === RETOUR);
    const rentrees = new Map(Object.entries(expeditions).map(([lettre, x]) => [x.rentreeLe?.getTime(), lettre as Lettre]));
    return {
      decouvertes: decouvertes.map(({ expeditionId, ...c }) => ({
        ...c,
        par: expeditionId === null ? null : (lettres.get(expeditionId) ?? null),
      })),
      expeditions,
      parties: parties.map((p) => ({ ...p, numero: Number(p.numero) })),
      bestiaire: await bestiaireDuTerritoire(jeu, territoireId),
      disponibles: await betesDisponibles(jeu, territoireId),
      explorateursAuFoyer: foyer[0].n,
      enCours: (await expeditionsEnCours(jeu, territoireId, fin)).length,
      recits: recits.map(({ texte, survenuLe, luLe }) => ({ texte, survenuLe, luLe })),
      ecrits: [...recits].sort((x, y) => x.id - y.id).map((r) => rentrees.get(r.survenuLe.getTime())),
    };
  };

  /**
   * Les Expéditions de l'essai vécues de la manière `maniere`, dans une transaction annulée ensuite, où chaque transaction
   * du jeu (un rattrapage, un départ) devient un point de reprise (poolDansLaTransaction) : le bilan de ce qu'elles ont
   * laissé au Territoire à l'instant `fin`. La manière suivante repart du même Territoire, au même instant, devant les mêmes
   * Bêtes sauvages et de naissance.
   */
  const vivre = async (maniere: Maniere, instantsDeLaPage: Date[], passagesDeLaTache: Date[]): Promise<Bilan> => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const jeu = poolDansLaTransaction(client);
      const ids = new Map<Lettre, number>();
      /**
       * Le joueur ouvre une page à l'instant `instant` : son Territoire est mis à l'heure, puis il lance les Expéditions
       * prévues à cet instant, et rappelle celles qu'il rappelle alors.
       */
      const ouvrir = async (instant: Date) => {
        await rattraper("territoire", territoireId, { pool: jeu, jusqua: instant });
        for (const p of plans.filter((x) => x.horaires.partLe.getTime() === instant.getTime())) {
          const choix = { destination: p.destination, explorateurs: 1, escorte: p.escorte, sejourMinutes: p.horaires.sejourMinutes };
          const depart = await lancerLExpedition(jeu, territoireId, choix, instant);
          if (!("expeditionId" in depart)) throw new Error(depart.refus);
          ids.set(p.lettre, depart.expeditionId);
        }
        for (const p of plans.filter((x) => x.rappel?.getTime() === instant.getTime())) {
          expect(await rappelerLExpedition(jeu, territoireId, ids.get(p.lettre)!, instant)).toEqual({ rappeleeLe: instant });
        }
      };
      if (maniere === "page ouverte") {
        for (const instant of instantsDeLaPage) await ouvrir(instant);
      } else {
        // Le joueur ne vient que lancer et rappeler ses Expéditions, puis s'en va.
        for (const instant of instantsDuJoueur()) await ouvrir(instant);
        if (maniere === "d'un bloc") await ouvrir(fin);
        for (const instant of maniere === "par la tâche planifiée" ? passagesDeLaTache : []) {
          const passage = await rattraperLesAbsents({ pool: jeu, maintenant: instant, parmi: { territoire: [territoireId] } });
          expect(passage).toMatchObject({ rattrapes: 1, echecs: 0 });
        }
      }
      expect(await lireMarquePage(jeu, "territoire", territoireId)).toEqual(fin);
      return await bilan(jeu, ids);
    } finally {
      await client.query("rollback");
      client.release();
    }
  };

  beforeAll(async () => {
    pool = poolDeTest();
    await preparerMondeDeTest(pool);
    mondeId = await mondeDEssai(pool, MONDE_D_ESSAI);

    const { rows: especes } = await pool.query<{ id: string; attaque: number; vie: number; vitesse: number }>(
      "select id, attaque, vie, vitesse from espece order by id",
    );
    const forte = especes.reduce((x, y) => (forceDUneBete(y) > forceDUneBete(x) ? y : x));
    forteId = forte.id;
    const cle = ({ q, r }: Coordonnees) => `${q},${r}`;

    /**
     * Le `n`-ième chef qui naît dans le Monde d'essai, avec ses trois Bêtes de naissance (US-0975), cinq explorateurs et
     * deux Bêtes de l'Espèce la plus forte du jeu, qui escortent A et B : toute Bête sauvage est à leur portée (US-0934).
     * Son Territoire, l'instant de sa naissance, la place de son Foyer et les Cases de ses Bêtes de naissance.
     */
    const naitre = async (n: number) => {
      const compte = (await creerCompte(pool, `${lancement}-${n}@essai.test`, "une phrase de passe"))!;
      const nom = nomDEssai("Abs", suffixe, n);
      expect(await enregistrerNomDeChef(pool, compte.id, nom, Math.random, mondeId)).toMatchObject({ statut: "enregistre" });
      const id = (await territoireDuCompte(pool, compte.id))!;
      await pool.query(
        "insert into habitant (territoire_id, prenom, metier) select $1, unnest($2::text[]), 'explorateur'",
        [id, ["Joran", "Ilda", "Mael", "Nora", "Tibo"]],
      );
      await pool.query("insert into effectif (territoire_id, espece_id, sexe, nombre) values ($1, $2, 'male', 2)", [id, forte.id]);
      const { rows } = await pool.query<{ foyer: Coordonnees; naissance: (Coordonnees & { id: number })[] }>(
        `select json_build_object('q', f.q, 'r', f.r) as foyer,
           coalesce((select json_agg(json_build_object('id', c.id, 'q', c.q, 'r', c.r) order by n.id)
             from bete_de_naissance n join case_du_monde c on c.id = n.case_id where n.territoire_id = t.id), '[]') as naissance
         from territoire t join case_du_monde f on f.id = t.foyer_case_id where t.id = $1`,
        [id],
      );
      return { territoireId: id, ne: await lireMarquePage(pool, "territoire", id), ...rows[0] };
    };
    type Chef = Awaited<ReturnType<typeof naitre>>;
    /** Les Cases libres à `ecart` Cases du Foyer du chef, hors de celles de ses Bêtes de naissance, dans l'ordre de la carte. */
    const aLEcart = async (chef: Chef, ecart: number) =>
      (
        await pool.query<Coordonnees & { id: number }>(
          `select c.id, c.q, c.r from territoire t join case_du_monde f on f.id = t.foyer_case_id
             join case_du_monde c on c.monde_id = f.monde_id and c.chef_id is null
           where t.id = $1 and greatest(abs(c.q - f.q), abs(c.r - f.r), abs(c.q - f.q + c.r - f.r)) = $2
             and not (c.id = any($3::int[]))
           order by c.q, c.r`,
          [chef.territoireId, ecart, chef.naissance.map((c) => c.id)],
        )
      ).rows;
    /**
     * L'Expédition `lettre` du chef vers la Case `c`, partie à `partLe` pour `sejour` minutes, avec une Bête de chacune des
     * Espèces `escorte` ; son trajet, comme son départ le chiffrera (US-0912).
     */
    const prevoir = (chef: Chef, lettre: Lettre, c: Coordonnees & { id: number }, partLe: Date, sejour: number, escorte: typeof especes = []): Plan => {
      const trajetMinutes = dureeDuTrajetMinutes(distance(chef.foyer, c), escorte.map((e) => ({ vitesse: e.vitesse, nombre: 1 })));
      const horaires = { partLe, trajetMinutes, sejourMinutes: sejour };
      const retour = retourDUneExpedition(horaires)!;
      return { lettre, destination: { q: c.q, r: c.r }, caseId: c.id, escorte: new Map(escorte.map((e) => [e.id, 1])), horaires, retour };
    };
    /**
     * A, escortée, part la première, une minute après la naissance du chef, au plus loin, pour un jour sur une Case où
     * plusieurs Bêtes sauvages se montrent, dont une au moins pendant le séjour ; au-delà des abords du Foyer, et à plus de
     * 4 Cases de la Bête de naissance où va B : elle seule sort sa destination du brouillard. null sans une telle Case.
     */
    const versA = async (chef: Chef) => {
      for (const ecart of [8, 7, 6, 5]) {
        for (const c of (await aLEcart(chef, ecart)).filter((x) => distance(x, chef.naissance[0]) > 4)) {
          const a = prevoir(chef, "A", c, apres(chef.ne, 1), 24 * HEURE, [forte]);
          const { debut, fin: repart } = sejourDUneExpedition(a.horaires)!;
          const betes = await betesSauvagesDUneCase(pool, c.id, debut, repart);
          if (betes.length >= 2 && betes.some((x) => x.arrivee >= debut)) return a;
        }
      }
      return null;
    };
    // Né près de la banquise, où aucune Bête ne vit, le chef n'a pas de Case pour A : il renaît ailleurs, au hasard.
    let chef = await naitre(0);
    let a = await versA(chef);
    for (let n = 1; !a && n < 3; n++) {
      await pool.query("delete from compte where email = $1", [`${lancement}-${n - 1}@essai.test`]);
      chef = await naitre(n);
      a = await versA(chef);
    }
    if (!a) throw new Error(`Aucune Case où plusieurs Bêtes se montrent, à 5 à 8 Cases du Foyer ${cle(chef.foyer)}, au troisième essai.`);
    const { foyer, naissance } = chef;
    territoireId = chef.territoireId;
    /** Le premier départ, celui de A. */
    const premierDepart = a.horaires.partLe;
    // B, escortée, part dix minutes après A, pour quatre heures sur la Case d'une Bête de naissance, encore là à son arrivée.
    const b = prevoir(chef, "B", naissance[0], apres(premierDepart, 10), 4 * HEURE, [forte]);
    // C, sans escorte, part la dernière, tout près, pour une demi-heure, sur une Case calme, là où elle sort le plus de Cases
    // du brouillard que ni les abords du Foyer, découverts à sa naissance, ni A ni B ne sortent, et qui sont bien dans le
    // Monde.
    const revelees = (p: Plan) => casesRevelees(foyer, p.destination, p.horaires, p.retour);
    const dejaVues = new Set([...(await casesDecouvertes(pool, territoireId)), ...revelees(a), ...revelees(b)].map(cle));
    const neuves = (p: Plan) => revelees(p).filter((x) => anneau(x) <= MONDE_RAYON && !dejaVues.has(cle(x))).length;
    /**
     * Sans escorte, l'Expédition `p` ne voit sur sa Case que des Bêtes communes pendant tout son séjour : aucune n'est trop
     * forte pour elle, aucune ne peut l'attaquer, et chaque manière de vivre l'essai lui laisse le même récit.
     */
    const calme = async (p: Plan) => {
      const { debut, fin: repart } = sejourDUneExpedition(p.horaires)!;
      return (await betesSauvagesDUneCase(pool, p.caseId, debut, repart)).every((x) => x.rareteId === "commune");
    };
    const versC = [];
    for (const x of await aLEcart(chef, 3)) {
      const p = prevoir(chef, "C", x, apres(premierDepart, 40), 30);
      if (await calme(p)) versC.push(p);
    }
    expect(versC.length, "aucune Case calme à 3 Cases du Foyer pour C").toBeGreaterThan(0);
    const c = versC.reduce((x, y) => (neuves(y) > neuves(x) ? y : x));
    expect(neuves(c)).toBeGreaterThan(0);
    /** L'Expédition `p`, rappelée par le joueur à l'instant `le` (US-0920) : ses horaires, et son retour, en découlent. */
    const rappelee = (p: Plan, le: Date): Plan => {
      const horaires = { ...p.horaires, rappeleeLe: le };
      return { ...p, horaires, rappel: le, retour: retourDUneExpedition(horaires)! };
    };
    // D, sans escorte, part cinquante minutes après A, à 6 Cases, et le joueur la rappelle à l'aller, 1 h 47 après son
    // départ, entre deux Cases de son chemin : elle ne séjourne pas.
    const versD = (await aLEcart(chef, 6)).find((x) => x.id !== a.caseId)!;
    const d = rappelee(prevoir(chef, "D", versD, apres(premierDepart, 50), HEURE), apres(premierDepart, 50 + 107));
    expect(sejourDUneExpedition(d.horaires)).toBeNull();
    // E, sans escorte, part une heure après A, à 2 à 4 Cases, pour quatre heures là où se montrent le plus de Bêtes, toutes
    // communes, et le joueur la rappelle pendant son séjour, 2 h 03 après son arrivée : celles d'après ne la trouvent plus.
    const versE = [];
    for (const x of [...(await aLEcart(chef, 2)), ...(await aLEcart(chef, 3)), ...(await aLEcart(chef, 4))]) {
      const p = prevoir(chef, "E", x, apres(premierDepart, 60), 4 * HEURE);
      if (![a.caseId, c.caseId].includes(x.id) && (await calme(p))) versE.push(p);
    }
    const animation = new Map<Plan, number>();
    for (const p of versE) {
      const { debut, fin: repart } = sejourDUneExpedition(p.horaires)!;
      animation.set(p, (await betesSauvagesDUneCase(pool, p.caseId, debut, repart)).length);
    }
    expect(versE.length, "aucune Case calme à 2 à 4 Cases du Foyer pour E").toBeGreaterThan(0);
    const e0 = versE.reduce((x, y) => (animation.get(y)! > animation.get(x)! ? y : x));
    expect(animation.get(e0), "aucune Bête sur la Case de E").toBeGreaterThan(0);
    const e = rappelee(e0, apres(sejourDUneExpedition(e0.horaires)!.debut, 2 * HEURE + 3));
    plans = [a, b, c, d, e];
    // Elles ne rentrent pas dans l'ordre de leurs départs : C, partie après A et B, rentre la première ; A, la dernière.
    expect(parRetour()[0].lettre).toBe("C");
    expect(parRetour().at(-1)!.lettre).toBe("A");

    // La tâche planifiée passe toutes les heures, à partir de 13 minutes après la dernière venue du joueur, jusqu'à son
    // premier passage qui rattrape le dernier retour : c'est la fin de l'essai, pour toutes les manières.
    const passagesDeLaTache = [apres(instantsDuJoueur().at(-1)!, 13)];
    while (passagesDeLaTache.at(-1)! <= apres(a.retour, RATTRAPER_APRES_MINUTES)) {
      passagesDeLaTache.push(apres(passagesDeLaTache.at(-1)!, HEURE));
    }
    fin = passagesDeLaTache.at(-1)!;

    // Page ouverte : relue toutes les 5 minutes du jeu, et à chaque instant qui compte, une milliseconde avant, pile et une
    // après : chaque passage sur une Case du chemin, chaque arrivée, rappel, fin de séjour et retour, chaque Bête sauvage
    // qui arrive sur une destination ou qui en part.
    const instants = new Set([fin.getTime()]);
    for (let t = premierDepart.getTime(); t <= fin.getTime(); t += 5 * MINUTE_MS) instants.add(t);
    const autour = (instant: Date) => [-1, 0, 1].forEach((ms) => instants.add(instant.getTime() + ms));
    for (const p of plans) {
      passagesDUneExpedition(foyer, p.destination, p.horaires).forEach(({ le }) => autour(le));
      const sejour = sejourDUneExpedition(p.horaires);
      [sejour?.debut, sejour?.fin, p.rappel, p.retour].forEach((instant) => instant && autour(instant));
      for (const bete of await betesSauvagesDUneCase(pool, p.caseId, premierDepart, fin)) [bete.arrivee, bete.depart].forEach(autour);
    }
    const instantsDeLaPage = [...instants]
      .filter((t) => t >= premierDepart.getTime() && t <= fin.getTime())
      .sort((x, y) => x - y)
      .map((t) => new Date(t));

    for (const maniere of MANIERES) bilans[maniere] = await vivre(maniere, instantsDeLaPage, passagesDeLaTache);
    // Environ 450 rattrapages à la suite, page ouverte : sous la charge de la suite complète, bien plus que les 30 s par défaut.
  }, 240_000);

  afterAll(async () => {
    await pool.query("delete from compte where email like $1", [`${lancement}%`]);
    await pool.end();
  });

  const [ouverte, ...fermees] = MANIERES;

  it("chaque Expédition rentre à son heure, explorateurs et escorte compris, sans attendre le joueur", () => {
    for (const maniere of MANIERES) {
      const { expeditions, enCours, explorateursAuFoyer, disponibles } = bilans[maniere];
      for (const { lettre, retour } of plans) expect(expeditions[lettre]?.rentreeLe, `${lettre}, ${maniere}`).toEqual(retour);
      // Les deux Bêtes de l'escorte de A et B sont de nouveau disponibles.
      const auFoyer = { enCours, explorateursAuFoyer, escorte: disponibles.find((x) => x.id === forteId)?.disponibles };
      expect(auFoyer, maniere).toEqual({ enCours: 0, explorateursAuFoyer: 5, escorte: 2 });
    }
  });

  it("les mêmes Cases sorties du brouillard, chacune par la même Expédition, page fermée que page ouverte", () => {
    const { decouvertes } = bilans[ouverte];
    for (const lettre of ["A", "C"] as const) expect(decouvertes.filter((c) => c.par === lettre).length, lettre).toBeGreaterThan(0);
    for (const maniere of fermees) expect(bilans[maniere].decouvertes, maniere).toEqual(decouvertes);
  });

  it("les mêmes Rencontres, aux mêmes instants, et les mêmes Bêtes qui suivent l'Expédition, qui ont quitté leur Case au même instant", () => {
    const { expeditions, parties } = bilans[ouverte];
    // A voit plusieurs Bêtes et en emmène ; B voit la Bête de naissance de sa Case dès son arrivée, et l'emmène.
    expect(expeditions.A!.rencontres.length).toBeGreaterThanOrEqual(2);
    expect(expeditions.A!.rencontres.some((r) => r.apprivoisee)).toBe(true);
    const arriveeDeB = sejourDUneExpedition(plan("B").horaires)!.debut;
    const deNaissance = expect.objectContaining({ beteDeNaissanceId: expect.any(Number), vueLe: arriveeDeB, apprivoisee: true });
    expect(expeditions.B!.rencontres).toContainEqual(deNaissance);
    // Rappelée à l'aller, D ne voit aucune Bête ; rappelée en séjour, E n'en voit plus après son rappel.
    expect(expeditions.D!.rencontres).toEqual([]);
    for (const r of expeditions.E!.rencontres) expect(r.vueLe.getTime()).toBeLessThan(plan("E").rappel!.getTime());
    expect(parties.length).toBeGreaterThan(0);
    for (const maniere of fermees) {
      expect(bilans[maniere].expeditions, maniere).toEqual(expeditions);
      expect(bilans[maniere].parties, maniere).toEqual(parties);
    }
  });

  it("le même Bestiaire, chaque Espèce croisée au même instant, et le même effectif", () => {
    const { bestiaire, disponibles } = bilans[ouverte];
    expect(bestiaire.length).toBeGreaterThan(0);
    for (const maniere of fermees) {
      expect({ bestiaire: bilans[maniere].bestiaire, disponibles: bilans[maniere].disponibles }, maniere).toEqual({ bestiaire, disponibles });
    }
  });

  it("le même récit de retour pour chaque Expédition, daté de son retour", () => {
    const { recits } = bilans[ouverte];
    expect(recits.map((r) => r.survenuLe)).toEqual(parRetour().reverse().map((p) => p.retour));
    expect(recits[0].texte).toMatch(/\d+ Bêtes se sont montrées\./);
    const recitDe = (lettre: Lettre) => recits.find((r) => r.survenuLe.getTime() === plan(lettre).retour.getTime())!.texte;
    expect(recitDe("D")).toMatch(/^Rappelée à l'aller le .*\nAller 1 h 47, sans séjour, retour 1 h 47\.$/m);
    expect(recitDe("E")).toMatch(/^Rappelée pendant le séjour le .*\nAller .*, séjour 2 h 03, retour .*\.$/m);
    // Aucune attaque, dont le tirage dépend de l'identifiant de l'Expédition, tiré à nouveau par chaque manière (US-0943).
    for (const maniere of MANIERES) for (const { texte } of bilans[maniere].recits) expect(texte, maniere).not.toMatch(/^(Combat|Attaque) le /m);
    for (const maniere of fermees) expect(bilans[maniere].recits, maniere).toEqual(recits);
  });

  it("les récits arrivent dans l'ordre des retours, pas dans celui des départs", () => {
    const retours = parRetour().map((p) => p.lettre);
    expect(retours).not.toEqual(plans.map((p) => p.lettre));
    for (const maniere of MANIERES) expect(bilans[maniere].ecrits, maniere).toEqual(retours);
  });

  it("en vitesse accélérée, une Expédition complète se vit en quelques minutes réelles, page fermée, et rentre à son heure", async () => {
    // À ×60, C (une heure d'aller, une demi-heure de séjour, une heure de retour) rentre deux minutes et demie réelles
    // après son départ.
    const FACTEUR = 60;
    const { destination, escorte, horaires, retour } = plan("C");
    const enReel = (retour.getTime() - horaires.partLe.getTime()) / FACTEUR;
    expect(enReel).toBeLessThanOrEqual(5 * MINUTE_MS);
    const reel = Date.UTC(2026, 9, 9, 12);
    const client = await pool.connect();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await client.query("begin");
      const jeu = poolDansLaTransaction(client);
      definirAncre({ facteur: FACTEUR, reel, jeu: horaires.partLe.getTime() });
      vi.setSystemTime(reel);
      // Le joueur lance C, à l'heure du jeu, comme « Partir » (src/app/jeu/expeditions/nouvelle/actions.ts), puis ferme la page.
      await rattraper("territoire", territoireId, { pool: jeu });
      const choix = { destination, explorateurs: 1, escorte, sejourMinutes: horaires.sejourMinutes };
      const depart = await lancerLExpedition(jeu, territoireId, choix, maintenant());
      if (!("expeditionId" in depart)) throw new Error(depart.refus);
      /** Le joueur revient `ms` millisecondes réelles après le départ : ses récits de retour, et l'heure où C est rentrée. */
      const revenir = async (ms: number) => {
        vi.setSystemTime(reel + ms);
        await rattraper("territoire", territoireId, { pool: jeu });
        const { rows } = await jeu.query<{ rentreeLe: Date | null }>('select rentree_le as "rentreeLe" from expedition where id = $1', [
          depart.expeditionId,
        ]);
        const recits = (await recitsDuTerritoire(jeu, territoireId)).filter((r) => r.titre === RETOUR);
        return { rentreeLe: rows[0].rentreeLe, recits: recits.map(({ texte, survenuLe }) => ({ duree: texte.split("\n")[1], survenuLe })) };
      };
      expect(await revenir(enReel - 1_000)).toEqual({ rentreeLe: null, recits: [] });
      const [trajet, sejour] = [formaterMinutes(horaires.trajetMinutes!), formaterMinutes(horaires.sejourMinutes)];
      const duree = `Aller ${trajet}, séjour ${sejour}, retour ${trajet}.`;
      expect(await revenir(enReel + 1_000)).toEqual({ rentreeLe: retour, recits: [{ duree, survenuLe: retour }] });
    } finally {
      definirAncre(null);
      vi.useRealTimers();
      await client.query("rollback");
      client.release();
    }
  });
});
