// Les fuites des Cases, lues en base (US-0945) : chaque Territoire, et chaque récit qui dit qui était sur une Case, calcule
// les fuites de toutes les Expéditions de la Case, de tous les joueurs, des mêmes faits (src/expeditions/fuites-de-la-case.ts) :
// une Expédition en fuite a quitté sa Case pour tous, avant même que son Territoire ne soit rattrapé. Les Cases se lisent avec
// les Bêtes sauvages ordinaires, les Bêtes de naissance de chaque Territoire présent, les escortes et les tirages d'attaque.
// Côté serveur uniquement.
import "server-only";
import type { Pool, PoolClient } from "pg";
import { betesDeNaissanceDesCases, hasardsDeLAttaqueDUneBeteDeNaissance } from "@/monde/betes-de-naissance";
import { betesSauvagesDesCases, hasardsDeLAttaque } from "@/monde/betes-sauvages";
import { chanceDAttaqueParHeure, type Regime } from "./attaque";
import { forcesDesEscortes, forcesDesEspeces } from "./forces-en-base";
import { type AttaqueDeLaCase, type BeteDeLaCase, type ExpeditionDeLaCase, fuitesDeLaCase } from "./fuites-de-la-case";
import {
  type ExpeditionPresente,
  type ExpeditionPresenteEtSonTerritoire,
  expeditionsPresentesEtLeurTerritoire,
  expeditionsPresentesSurLesCases,
} from "./presence";

/**
 * US-0945 : au plus tant de relectures d'une Case, chacune depuis une arrivée plus tôt : la chaîne s'arrête dès qu'aucune
 * Bête n'est arrivée avant la lecture, et les séjours et les présences sont bornés, loin en deçà : au-delà, une erreur
 * plutôt qu'une présence incomplète.
 */
const RELECTURES_AU_PLUS = 100;

/**
 * US-0945 : une Bête lue sur sa Case pour les fuites : sa présence, son Espèce et sa Rareté ; une Bête sauvage ordinaire
 * par son numéro, une Bête de naissance par sa ligne et son Territoire, à qui seul elle se montre.
 */
type BeteLue = Omit<BeteDeLaCase, "force" | "chance" | "hasards">;

/**
 * US-0945 : les fuites des Expéditions présentes sur les Cases `caseIds` jusqu'à `a`, de tous les Territoires, et les
 * attaques qui les causent (fuitesDeLaCase), calculées des mêmes faits par chacun : les attaques d'une Expédition sont
 * connues jusqu'à l'instant où son Territoire est calculé (avant lui, sa fuite serait écrite). Le Territoire `propre`, que
 * l'on rattrape, ne l'est que jusqu'au début de sa tranche, `de` : la sienne n'est pas encore écrite. Les Cases se lisent
 * depuis `depuis`, puis plus tôt tant qu'il le faut : depuis l'arrivée de chaque Bête présente pendant qu'une attaque n'est
 * pas encore connue, avec chaque Expédition présente depuis, qu'elle a pu suivre. Dans la transaction de l'appelant.
 */
export async function fuitesDesCases(
  base: Pool | PoolClient,
  caseIds: number[],
  depuis: Date,
  a: Date,
  propre?: { territoireId: number; de: Date },
): Promise<{ fuites: Map<number, Date>; attaques: AttaqueDeLaCase[] }> {
  const connuesJusqua = (x: ExpeditionPresenteEtSonTerritoire) => (propre && x.territoireId === propre.territoireId ? propre.de : x.calculeJusqua);
  let debut = depuis;
  let expeditions: ExpeditionPresenteEtSonTerritoire[] = [];
  let betes: BeteLue[] = [];
  for (let lecture = 1; ; lecture++) {
    expeditions = await expeditionsPresentesEtLeurTerritoire(base, caseIds, debut, a);
    // Les attaques encore inconnues tombent après ceci : seules les Bêtes présentes depuis peuvent les faire.
    const inconnues = Math.min(a.getTime(), ...expeditions.filter((x) => !x.enFuite).map((x) => Math.max(connuesJusqua(x).getTime(), x.arrivee.getTime())));
    betes = inconnues < a.getTime() ? await betesDesCases(base, caseIds, [...new Set(expeditions.map((x) => x.territoireId))], new Date(inconnues), a) : [];
    // Qui suit chacune se décide dès son arrivée, parmi les Expéditions présentes depuis : la Case se relit de là.
    const premiere = Math.min(debut.getTime(), ...betes.map((b) => b.arrivee.getTime()));
    if (premiere >= debut.getTime()) break;
    if (lecture === RELECTURES_AU_PLUS) throw new Error(`Les Cases ${caseIds.join(", ")} remontent encore plus tôt après ${RELECTURES_AU_PLUS} lectures.`);
    debut = new Date(premiere);
  }
  if (betes.length === 0) return { fuites: new Map(), attaques: [] };
  const escortes = await forcesDesEscortes(base, expeditions.map((x) => x.id));
  const forces = await forcesDesEspeces(base, [...new Set(betes.map((b) => b.especeId))]);
  const { rows: especes } = await base.query<{ id: string; regime: Regime }>("select id, regime from espece where id = any($1::text[])", [
    [...new Set(betes.map((b) => b.especeId))],
  ]);
  const regimes = new Map(especes.map((e) => [e.id, e.regime]));
  const { rows: cases } = await base.query<{ id: number; q: number; r: number; graine: string }>(
    "select c.id, c.q, c.r, m.graine from case_du_monde c join monde m on m.id = c.monde_id where c.id = any($1::int[])",
    [caseIds],
  );
  const lesCases = new Map(cases.map((c) => [c.id, { q: c.q, r: c.r, graine: Number(c.graine) }]));
  const fuites = new Map<number, Date>();
  const attaques: AttaqueDeLaCase[] = [];
  for (const caseId of caseIds) {
    const laCase = lesCases.get(caseId)!;
    const deLaCase: ExpeditionDeLaCase[] = expeditions
      .filter((x) => x.caseId === caseId)
      .map((x) => ({ id: x.id, territoireId: x.territoireId, arrivee: x.arrivee, depart: x.depart, escorte: escortes.get(x.id) ?? null, enFuite: x.enFuite, connuesJusqua: connuesJusqua(x) }));
    const surLaCase: BeteDeLaCase[] = betes
      .filter((b) => b.caseId === caseId)
      .map((b) => ({
        ...b,
        force: forces.get(b.especeId)!,
        chance: chanceDAttaqueParHeure(regimes.get(b.especeId)!),
        // US-0943 : les tirages d'une Bête sauvage ordinaire, de la graine de son Monde, de sa Case et de son numéro ; ceux
        // d'une Bête de naissance, de la graine et de sa ligne.
        hasards: (expeditionId: number, heure: number) =>
          b.numero !== null
            ? hasardsDeLAttaque(laCase, b.numero, expeditionId, heure)
            : hasardsDeLAttaqueDUneBeteDeNaissance(laCase.graine, b.beteDeNaissanceId!, expeditionId, heure),
      }));
    const deCetteCase = fuitesDeLaCase(deLaCase, surLaCase, a);
    for (const [id, le] of deCetteCase.fuites) fuites.set(id, le);
    attaques.push(...deCetteCase.attaques);
  }
  return { fuites, attaques };
}

/**
 * US-0945 : les Bêtes présentes à un moment de [de, a) sur les Cases `caseIds` qui peuvent attaquer une Expédition : les
 * Bêtes sauvages ordinaires, que toutes voient, comptées encore à l'instant où elles en suivent une (departCompris), et
 * les Bêtes de naissance des Territoires `territoires`, chacune à son seul Territoire (US-0975).
 */
async function betesDesCases(base: Pool | PoolClient, caseIds: number[], territoires: number[], de: Date, a: Date): Promise<BeteLue[]> {
  // L'une après l'autre : sur le client d'une transaction, deux requêtes ne partent pas à la fois.
  const sauvages = await betesSauvagesDesCases(base, caseIds, de, a, { departCompris: true });
  const betes: BeteLue[] = caseIds.flatMap((caseId) =>
    sauvages.get(caseId)!.map((b) => ({ arrivee: b.arrivee, depart: b.depart, especeId: b.especeId, rareteId: b.rareteId, caseId, numero: b.numero, beteDeNaissanceId: null, territoireId: null })),
  );
  for (const territoire of territoires) {
    const deNaissance = await betesDeNaissanceDesCases(base, territoire, caseIds, de, a);
    for (const caseId of caseIds) {
      for (const b of deNaissance.get(caseId)!) {
        betes.push({ arrivee: b.arrivee, depart: b.depart, especeId: b.especeId, rareteId: b.rareteId, caseId, numero: null, beteDeNaissanceId: b.id, territoireId: territoire });
      }
    }
  }
  return betes;
}

/**
 * US-0945 : les Expéditions présentes à un moment de [de, a) sur les Cases `caseIds`, de tous les Territoires, comme
 * expeditionsPresentesSurLesCases, chacune n'y étant plus après sa fuite, écrite ou calculée (fuitesDesCases) : pour les
 * récits et les Bêtes repérées, qui lisent la présence des autres joueurs sans attendre le rattrapage de leur Territoire.
 */
export async function expeditionsPresentesApresLesFuites(base: Pool | PoolClient, caseIds: number[], de: Date, a: Date): Promise<Map<number, ExpeditionPresente[]>> {
  const presentes = await expeditionsPresentesSurLesCases(base, caseIds, de, a);
  const { fuites } = await fuitesDesCases(base, caseIds, de, a);
  return new Map(
    [...presentes].map(([caseId, expeditions]) => [
      caseId,
      expeditions
        .map((x) => {
          const fuite = fuites.get(x.id);
          return fuite && fuite < x.depart ? { ...x, depart: fuite } : x;
        })
        // Parties avant la période, elles n'y sont plus à aucun de ses instants.
        .filter((x) => Math.max(x.arrivee.getTime(), de.getTime()) < Math.min(x.depart.getTime(), a.getTime())),
    ]),
  );
}

/** US-0945 : les Expéditions présentes sur la Case `caseId` à un moment de [de, a), comme expeditionsPresentesApresLesFuites ; sans `a`, à l'instant `de`. */
export async function expeditionsPresentesSurLaCaseApresLesFuites(base: Pool | PoolClient, caseId: number, de: Date, a = new Date(de.getTime() + 1)): Promise<ExpeditionPresente[]> {
  return (await expeditionsPresentesApresLesFuites(base, [caseId], de, a)).get(caseId)!;
}
