// Le récit de retour d'une Expédition (US-0917) : à son retour au Foyer (src/expeditions/retour.ts), un Récit du
// Territoire dit où elle est allée, combien de temps ont duré son aller, son séjour et son retour, combien de Cases elle
// a sorties du brouillard et si des Bêtes se sont montrées. US-0940 : le détail de ses Rencontres, Bête par Bête, s'y joint
// (src/expeditions/recit-de-rencontre.ts).
// US-0920 : rappelée, il le dit, et quand. US-0938 : et les Bêtes qui l'ont suivie jusqu'au Foyer. US-0942 : les Bêtes
// trop fortes pour son escorte, restées sur leur Case, et la force qui lui manquait. US-0962 : et, sans les nommer, que
// d'autres joueurs avaient une Expédition sur la Case pendant son séjour : le joueur ne l'apprend que là. US-0949 : et
// les Bêtes que le joueur y avait repérées à son départ, parties avant son arrivée. US-0951 : et les morts et les Blessés de
// son escorte au combat, Espèce par Espèce. US-0947 : attaquée, il finit par le récit de chaque combat
// (src/expeditions/recit-du-combat.ts), ses pertes et la fuite des explorateurs. Côté serveur uniquement.
import "server-only";
import type { PoolClient } from "pg";
import type { Sexe } from "@/monde/betes-sauvages";
import { type Coordonnees, distance } from "@/monde/hex";
import { ecrireUnRecit, type NouveauRecit } from "@/monde/recits";
import { formaterJourEtHeure, formaterMinutes } from "@/temps/affichage";
import { COMMUNE, forceQuiManque } from "./apprivoisement";
import { betesReperees } from "./betes-reperees";
import { casesLeveesParLExpedition } from "./brouillard";
import { casesDuFoyer } from "./choix-de-destination";
import { demiTourDUneExpedition, type HorairesDUneExpedition, sejourDUneExpedition } from "./phase";
import { expeditionsPresentesSurLaCase } from "./presence";
import { rencontresARaconter } from "./recit-de-rencontre";
import { type CombatARaconter, combatsDUneExpedition } from "./recit-du-combat";
import { forcesDesEscortes, forcesDesEspeces, type Rencontre, rencontresDUneExpedition } from "./rencontres";
import { RETOUR_D_EXPEDITION } from "./resume-du-retour";
import { betesQuiSuivent } from "./sexe";

const MINUTE_MS = 60_000;

/** US-0942 : une force dite en chiffres comme la Force de l'écran d'Expédition : « 37 340 », à espace insécable. */
const entier = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/ /g, " ");

/** US-0920 : le fuseau des heures dites dans les Récits, comme sur la page Récits, en attendant celui de chaque joueur. */
const FUSEAU = "Europe/Paris";

/** US-0917 : les durées réelles d'une Expédition rentrée, en minutes de jeu : son aller, son séjour sur sa Case et son retour. */
export type DureesReelles = { aller: number; sejour: number; retour: number };

/** US-0920 : le rappel d'une Expédition : l'instant du jeu où le joueur l'a rappelée, et pendant quelle phase, l'aller ou le séjour. */
export type RappelARaconter = { le: Date; pendant: "aller" | "sejour" };

/**
 * US-0917 : ce que raconte le retour d'une Expédition : sa destination, avec son Biome désormais connu (une eau par sa
 * variante, comme la fiche de la Case) et sa distance au Foyer, en Cases ; ses durées réelles ; le nombre de Cases qu'elle
 * a sorties du brouillard (US-0914) et celui des Bêtes qu'elle a vues (US-0932) ; l'instant du jeu où elle est rentrée.
 * US-0920 : son rappel, si le joueur l'a rappelée (absent ou null sinon) ; une destination jamais atteinte, encore sous
 * le brouillard, se dit « Case inconnue ».
 */
export type RetourARaconter = {
  destination: { biome: string; distance: number };
  durees: DureesReelles;
  casesLevees: number;
  rencontres: number;
  /**
   * US-0935 : quand seules des Bêtes plus rares que communes se sont montrées et qu'aucune n'a suivi l'Expédition, les noms
   * de leurs Espèces, chacune une fois, dans l'ordre des apparitions (especesVuesSansSuite) ; absent sinon.
   */
  vuesSansSuite?: string[];
  /**
   * US-0942 : les Espèces des Bêtes vues restées sur leur Case, trop fortes pour l'escorte, chacune une fois, dans l'ordre
   * des apparitions (especesTropFortes) ; absentes ou vides : aucune.
   */
  tropFortes?: TropForte[];
  rentreeLe: Date;
  rappel?: RappelARaconter | null;
  /** US-0938 : les Bêtes qui l'ont suivie jusqu'au Foyer, dans l'ordre de leur Apprivoisement ; absentes : aucune. */
  ramenees?: BeteRamenee[];
  /** US-0962 : l'Expédition d'un autre joueur était sur la Case à un instant de son séjour ; absent : aucune. */
  autresExpeditions?: boolean;
  /**
   * US-0949 : les Espèces des Bêtes que le joueur avait repérées sur la Case à son départ et qui n'y étaient plus à son
   * arrivée, chacune une fois (betesPartiesAvantLArrivee) ; absentes ou vides : aucune.
   */
  partiesAvant?: string[];
  /** US-0951 : les pertes de son escorte au combat, Espèce par Espèce (pertesDeLEscorte) ; absentes ou vides : aucune. */
  pertes?: PerteRacontee[];
  /** US-0947 : les combats qu'elle a livrés, dans l'ordre où ils se sont livrés (combatsDUneExpedition) ; absents : aucun. */
  combats?: CombatDuRetour[];
};

/** US-0951 : les pertes d'une Espèce de l'escorte au combat : le nom de l'Espèce, ses Bêtes mortes et ses Blessés. */
export type PerteRacontee = { nom: string; mortes: number; blessees: number };

/**
 * US-0947 : un combat tel que le récit du retour le dit (CombatARaconter) : son instant, le nom de l'Espèce de la Bête et sa
 * force, la force de l'escorte à cet instant, et si elle n'avait plus aucune Bête.
 */
export type CombatDuRetour = Pick<CombatARaconter, "le" | "bete" | "escorte" | "sansEscorte">;

/** US-0942 : une Espèce trop forte pour l'escorte : son nom et la force qui manquait à l'escorte (forceQuiManque). */
export type TropForte = { nom: string; manque: number };

/** US-0938 : une Bête qui a suivi l'Expédition jusqu'au Foyer : le nom de son Espèce et son sexe. */
export type BeteRamenee = { nom: string; sexe: Sexe };

/**
 * US-0917 : les durées réelles d'une Expédition rentrée à l'instant du jeu `rentreeLe` : l'aller jusqu'à son arrivée sur la
 * Case, son séjour, et son retour jusqu'à l'heure où elle est vraiment rentrée. Aucune tant que son trajet n'est pas
 * chiffré (US-0912). US-0920 : rappelée à l'aller, l'aller jusqu'au rappel, et aucun séjour ; en séjour, le séjour
 * jusqu'au rappel, à la minute supérieure : un séjour commencé, si court soit-il, n'est jamais « sans séjour ».
 */
export function dureesReelles(horaires: HorairesDUneExpedition, rentreeLe: Date): DureesReelles | null {
  const demiTour = demiTourDUneExpedition(horaires);
  if (!demiTour) return null;
  const sejour = sejourDUneExpedition(horaires);
  const minutes = (ms: number) => Math.round(ms / MINUTE_MS);
  return {
    aller: minutes(demiTour.allerMs),
    sejour: sejour ? Math.ceil((sejour.fin.getTime() - sejour.debut.getTime()) / MINUTE_MS) : 0,
    retour: minutes(rentreeLe.getTime() - demiTour.le.getTime()),
  };
}

/**
 * US-0920 : le rappel d'une Expédition, s'il y en a eu un avant son demi-tour prévu : son instant, et la phase où il l'a
 * trouvée : en séjour s'il a commencé, à l'aller sinon (rappelée à l'arrivée pile, elle n'a pas séjourné) ; null sinon.
 */
export function rappelDUneExpedition(horaires: HorairesDUneExpedition): RappelARaconter | null {
  const demiTour = demiTourDUneExpedition(horaires);
  if (!demiTour || !horaires.rappeleeLe || demiTour.le.getTime() !== horaires.rappeleeLe.getTime()) return null;
  const sejour = sejourDUneExpedition(horaires);
  return { le: horaires.rappeleeLe, pendant: sejour && sejour.fin > sejour.debut ? "sejour" : "aller" };
}

/** US-0920 : « Rappelée à l'aller le 9 octobre à 14:50. », « Rappelée pendant le séjour le 9 octobre à 15:30. ». */
function rappelee({ le, pendant }: RappelARaconter): string {
  return `Rappelée ${pendant === "aller" ? "à l'aller" : "pendant le séjour"} le ${formaterJourEtHeure(le, FUSEAU)}.`;
}

/** US-0917 : « 12 Cases sont sorties du brouillard. », « Une Case est sortie… », « Aucune Case n'est sortie… ». */
function casesSorties(nombre: number): string {
  if (nombre === 0) return "Aucune Case n'est sortie du brouillard.";
  return nombre === 1 ? "Une Case est sortie du brouillard." : `${nombre} Cases sont sorties du brouillard.`;
}

/** US-0962 : la ligne qui dit que d'autres joueurs séjournaient sur la Case, sans nommer leurs chefs (décidé le 2026-10-10). */
export const AUTRES_EXPEDITIONS = "D'autres Expéditions séjournaient sur la Case.";

/** US-0949 : « Pigeon biset n'était plus sur la Case à votre arrivée. », « Pigeon biset et Poule n'étaient plus… ». */
function partiesAvantLArrivee(especes: string[]): string {
  return `${enumeres(especes)} ${especes.length > 1 ? "n'étaient" : "n'était"} plus sur la Case à votre arrivée.`;
}

/** US-0917 : quand rien ne s'est passé, « Aucune Bête ne s'est montrée. » ; sinon « Une Bête s'est montrée. », « 3 Bêtes se sont montrées. ». */
function betesMontrees(nombre: number): string {
  if (nombre === 0) return "Aucune Bête ne s'est montrée.";
  return nombre === 1 ? "Une Bête s'est montrée." : `${nombre} Bêtes se sont montrées.`;
}

/**
 * US-0951 : « Pertes au combat : Souris grise (2 morts, 1 Blessé) et Pigeon biset (2 Blessés). » : chaque Espèce de
 * l'escorte qui a perdu des Bêtes, ses morts puis ses Blessés, sans dire un nombre nul.
 */
function pertesAuCombat(pertes: readonly PerteRacontee[]): string {
  const especes = pertes.map(({ nom, mortes, blessees }) => {
    const dits = [mortes > 0 && `${mortes} ${mortes > 1 ? "morts" : "mort"}`, blessees > 0 && `${blessees} ${blessees > 1 ? "Blessés" : "Blessé"}`];
    return `${nom} (${dits.filter(Boolean).join(", ")})`;
  });
  return `Pertes au combat : ${enumeres(especes)}.`;
}

/** US-0938 : « 2 mâles », « 1 femelle » ; une Bête seule, son sexe : « mâle ». */
function sexes({ male, femelle }: Record<Sexe, number>): string {
  if (male + femelle === 1) return male ? "mâle" : "femelle";
  const dits = [male > 0 && `${male} ${male > 1 ? "mâles" : "mâle"}`, femelle > 0 && `${femelle} ${femelle > 1 ? "femelles" : "femelle"}`];
  return dits.filter(Boolean).join(", ");
}

/**
 * US-0938 : « Bête ramenée au Foyer : Renard roux (mâle). », « Bêtes ramenées au Foyer : Souris grise (2 mâles, 1 femelle)
 * et Poule (femelle). » : chaque Espèce une fois, dans l'ordre de son premier Apprivoisement, avec ses mâles et ses femelles.
 */
function betesRamenees(betes: readonly BeteRamenee[]): string {
  const parEspece = new Map<string, Record<Sexe, number>>();
  for (const { nom, sexe } of betes) {
    const compte = parEspece.get(nom) ?? { male: 0, femelle: 0 };
    compte[sexe]++;
    parEspece.set(nom, compte);
  }
  const especes = [...parEspece].map(([nom, compte]) => `${nom} (${sexes(compte)})`);
  const liste = especes.length > 1 ? `${especes.slice(0, -1).join(", ")} et ${especes.at(-1)}` : especes[0];
  return `${betes.length > 1 ? "Bêtes ramenées" : "Bête ramenée"} au Foyer : ${liste}.`;
}

/**
 * US-0935 : les Espèces que l'Expédition a vues sans qu'aucune Bête ne la suive, quand seules des Bêtes plus rares que
 * communes se sont montrées, dans l'ordre de ses Rencontres (rencontresDUneExpedition), chacune une fois ; null dès
 * qu'une Bête commune s'est montrée, qu'une Bête l'a suivie, ou que rien ne s'est montré.
 */
export function especesVuesSansSuite(rencontres: Pick<Rencontre, "especeId" | "rareteId" | "apprivoisee">[]): string[] | null {
  if (rencontres.length === 0 || rencontres.some((r) => r.rareteId === COMMUNE || r.apprivoisee)) return null;
  return [...new Set(rencontres.map((r) => r.especeId))];
}

/**
 * US-0942 : les Espèces des Bêtes que l'Expédition a vues sans qu'elles la suivent, chacune une fois, dans l'ordre de ses
 * Rencontres : trop fortes pour son escorte, car une Bête à portée suit la première Expédition qui la voit, et les
 * suivantes ne la voient plus (lExpeditionSuivie, src/expeditions/apprivoisement.ts) ; ou à portée, mais partie avec une
 * autre Expédition à l'instant même où celle-ci la voyait (US-0962) : aucune force ne lui manquait (especesRestees).
 */
export function especesTropFortes(rencontres: Pick<Rencontre, "especeId" | "apprivoisee">[]): string[] {
  return [...new Set(rencontres.filter((r) => !r.apprivoisee).map((r) => r.especeId))];
}

/** « Renard roux », « Renard roux et Loup gris », « Renard roux, Loup gris et Lion ». */
function enumeres(mots: string[]): string {
  return mots.length > 1 ? `${mots.slice(0, -1).join(", ")} et ${mots.at(-1)}` : mots[0];
}

/**
 * US-0942 : « trop forte pour votre escorte, il lui manquait 37 340 de force » ; plusieurs Espèces, la force qui manquait
 * pour chacune : « trop fortes pour votre escorte, il lui manquait 37 340 de force pour Renard roux et 150 000 pour Loup gris ».
 */
function tropFortesPourLEscorte(tropFortes: TropForte[]): string {
  if (tropFortes.length === 1) return `trop forte pour votre escorte, il lui manquait ${entier(tropFortes[0].manque)} de force`;
  const manques = tropFortes.map(({ nom, manque }, i) => `${entier(manque)}${i === 0 ? " de force" : ""} pour ${nom}`);
  return `trop fortes pour votre escorte, il lui manquait ${enumeres(manques)}`;
}

/**
 * US-0935 : « Vos explorateurs ont vu Renard roux et Loup gris, mais aucune Bête ne les a suivis. ». US-0942 : suivi de
 * la raison, trop fortes pour l'escorte, et de combien : « … ne les a suivis : trop forte pour votre escorte, il lui
 * manquait 37 340 de force. ».
 */
function vuesSansQueRienNeSuive(especes: string[], tropFortes?: TropForte[]): string {
  const raison = tropFortes?.length ? ` : ${tropFortesPourLEscorte(tropFortes)}` : "";
  return `Vos explorateurs ont vu ${enumeres(especes)}, mais aucune Bête ne les a suivis${raison}.`;
}

/**
 * US-0942 : quand d'autres Bêtes ont suivi l'Expédition, celles restées sur leur Case : « Renard roux n'a pas suivi vos
 * explorateurs : Bête trop forte pour votre escorte, il lui manquait 37 340 de force. ». « Bête » porte l'accord de
 * « trop forte », quel que soit le genre du nom de l'Espèce.
 */
function resteesSurLeurCase(tropFortes: TropForte[]): string {
  const [noms, plusieurs] = [enumeres(tropFortes.map((e) => e.nom)), tropFortes.length > 1];
  return `${noms} ${plusieurs ? "n'ont" : "n'a"} pas suivi vos explorateurs : ${plusieurs ? "Bêtes" : "Bête"} ${tropFortesPourLEscorte(tropFortes)}.`;
}

/**
 * US-0947 : « Combat le 9 octobre à 14:05 : <Espèce de la Bête>, de force 37 340, contre votre escorte, de force 35 900. » ;
 * attaquée sans escorte, ou après l'avoir toute perdue : « Attaque le … : <Espèce de la Bête>, de force 37 340, contre vos
 * explorateurs, sans escorte. ».
 */
function combat({ le, bete, escorte, sansEscorte }: CombatDuRetour): string {
  const contre = sansEscorte ? "contre vos explorateurs, sans escorte" : `contre votre escorte, de force ${entier(escorte)}`;
  return `${sansEscorte ? "Attaque" : "Combat"} le ${formaterJourEtHeure(le, FUSEAU)} : ${bete.nom}, de force ${entier(bete.force)}, ${contre}.`;
}

/** US-0947 : la ligne qui finit le récit d'un combat : les explorateurs ne combattent jamais, ils fuient (US-0945). */
export const FUITE_DES_EXPLORATEURS = "Vos explorateurs ont fui et sont tous rentrés au Foyer.";

/**
 * US-0947 : la fin du récit d'une Expédition attaquée : chaque combat, puis ses pertes (US-0951), « Aucune perte. » sans
 * perte, et la fuite des explorateurs. Sans combat, les seules pertes, s'il y en a.
 */
function finDuRecit(combats: readonly CombatDuRetour[], pertes: readonly PerteRacontee[]): string[] {
  const lignePertes = pertes.length ? [pertesAuCombat(pertes)] : [];
  if (combats.length === 0) return lignePertes;
  return [...combats.map(combat), ...(lignePertes.length ? lignePertes : ["Aucune perte."]), FUITE_DES_EXPLORATEURS];
}

/**
 * US-0917 : le Récit du retour d'une Expédition, daté de l'instant où elle est rentrée : « Retour d'Expédition », puis une
 * ligne par fait : sa destination et son Biome, ses durées, les Cases sorties du brouillard, et les Bêtes qui se sont
 * montrées, ou la phrase qui dit qu'aucune ne l'a fait : il n'est jamais vide. US-0920 : rappelée, une ligne le dit, et
 * quand, avant ses durées ; sans séjour, « sans séjour ». US-0935 : quand seules des Bêtes plus rares se sont montrées et
 * qu'aucune n'a suivi, la ligne des Bêtes nomme les Espèces vues et le dit. US-0942 : elle dit aussi qu'elles étaient
 * trop fortes pour l'escorte, et la force qui lui manquait ; quand d'autres ont suivi, une ligne après elle le dit des
 * Bêtes restées sur leur Case. US-0938 : puis, si des Bêtes ont suivi l'Expédition, une ligne les dit arrivées au Foyer.
 * US-0962 : quand d'autres joueurs séjournaient sur la Case, une ligne le dit, avant les Bêtes. US-0949 : puis, quand des
 * Bêtes que le joueur y avait repérées en étaient parties avant l'arrivée, une ligne les nomme. US-0947 : attaquée, il finit
 * par chaque combat, dans l'ordre du temps, puis ses pertes, Espèce par Espèce, en morts et en Blessés (US-0951), ou « Aucune
 * perte. », et la fuite des explorateurs.
 */
export function recitDeRetour({
  destination,
  durees,
  casesLevees,
  rencontres,
  vuesSansSuite,
  tropFortes,
  rentreeLe,
  rappel,
  ramenees,
  autresExpeditions,
  partiesAvant,
  pertes,
  combats,
}: RetourARaconter): NouveauRecit {
  const sejour = durees.sejour === 0 ? "sans séjour" : `séjour ${formaterMinutes(durees.sejour)}`;
  return {
    titre: RETOUR_D_EXPEDITION,
    texte: [
      `Destination : ${destination.biome}, à ${casesDuFoyer(destination.distance)}.`,
      ...(rappel ? [rappelee(rappel)] : []),
      `Aller ${formaterMinutes(durees.aller)}, ${sejour}, retour ${formaterMinutes(durees.retour)}.`,
      casesSorties(casesLevees),
      ...(autresExpeditions ? [AUTRES_EXPEDITIONS] : []),
      ...(partiesAvant?.length ? [partiesAvantLArrivee(partiesAvant)] : []),
      // Le résumé des Bêtes ; leur détail, Bête par Bête, est le récit de Rencontre (US-0940), joint au Récit.
      ...(vuesSansSuite?.length
        ? [vuesSansQueRienNeSuive(vuesSansSuite, tropFortes)]
        : [betesMontrees(rencontres), ...(tropFortes?.length ? [resteesSurLeurCase(tropFortes)] : [])]),
      ...(ramenees?.length ? [betesRamenees(ramenees)] : []),
      ...finDuRecit(combats ?? [], pertes ?? []),
    ].join("\n"),
    survenuLe: rentreeLe,
  };
}

/**
 * US-0917 : écrit le Récit du retour de l'Expédition `expeditionId` du Territoire, rentrée à l'instant du jeu `rentreeLe`.
 * Appelée par rentrerAuFoyer, dans la transaction du temps qui avance : le Territoire est calculé jusqu'au retour, ses
 * Cases levées et ses Rencontres sont donc toutes retenues, les mêmes en direct qu'au rattrapage d'une absence.
 */
export async function raconterLeRetour(client: PoolClient, territoireId: number, expeditionId: number, rentreeLe: Date): Promise<void> {
  const { rows } = await client.query<HorairesDUneExpedition & { caseId: number; biome: string; decouverte: boolean; destination: Coordonnees; foyer: Coordonnees }>(
    `select c.id as "caseId", coalesce(v.nom, b.nom) as biome, json_build_object('q', c.q, 'r', c.r) as destination, json_build_object('q', f.q, 'r', f.r) as foyer,
       exists (select 1 from case_decouverte d where d.territoire_id = x.territoire_id and d.case_id = c.id) as decouverte,
       x.part_le as "partLe", x.trajet_minutes as "trajetMinutes", x.sejour_minutes as "sejourMinutes", x.rappelee_le as "rappeleeLe"
     from expedition x join case_du_monde c on c.id = x.case_id join biome b on b.id = c.biome_id
       left join variante_biome v on v.id = c.variante_id
       join territoire t on t.id = x.territoire_id join case_du_monde f on f.id = t.foyer_case_id
     where x.id = $2 and x.territoire_id = $1`,
    [territoireId, expeditionId],
  );
  // Après la bascule d'un Monde (US-0414), une Expédition déjà partie garde sa destination dans l'ancien : sa distance au
  // nouveau Foyer n'y a pas de sens, comme son chemin (leverLeBrouillard) ; cas rare, accepté.
  const { caseId, biome, decouverte, destination, foyer, ...horaires } = rows[0];
  const rappel = rappelDUneExpedition(horaires);
  // Un retour n'est programmé qu'au trajet chiffré (programmerLeRetour, migration 0052) : jamais atteint.
  const durees = dureesReelles(horaires, rentreeLe);
  if (!durees) throw new Error(`Retour sans trajet chiffré pour l'Expédition ${expeditionId}.`);
  // L'une après l'autre : sur le client d'une transaction, deux requêtes ne partent pas à la fois.
  const casesLevees = await casesLeveesParLExpedition(client, expeditionId);
  const vues = await rencontresDUneExpedition(client, expeditionId);
  const rencontres = vues.length;
  // US-0940 : et chaque Bête vue, à son heure, avec ce qu'il en advint : le récit de Rencontre, joint au Récit.
  const detail = await rencontresARaconter(client, expeditionId, vues, sejourDUneExpedition(horaires), destination);
  // US-0935 : seules des Bêtes plus rares se sont montrées et aucune n'a suivi : le récit nomme leurs Espèces.
  const sansSuite = especesVuesSansSuite(vues);
  const vuesSansSuite = sansSuite ? await nomsDesEspeces(client, sansSuite) : undefined;
  // US-0942 : les Bêtes vues restées sur leur Case, trop fortes pour l'escorte : la force qui lui manquait.
  const tropFortes = await especesRestees(client, expeditionId, vues);
  const ramenees = await betesRameneesAuFoyer(client, expeditionId);
  const autresExpeditions = await dAutresJoueursSurLaCase(client, territoireId, caseId, sejourDUneExpedition(horaires));
  // US-0949 : les Bêtes que le joueur y avait repérées à son départ, parties avant son arrivée.
  const partiesAvant = await betesPartiesAvantLArrivee(client, territoireId, destination, horaires, vues);
  // US-0951 : les morts et les Blessés de son escorte au combat.
  const pertes = await pertesDeLEscorte(client, expeditionId);
  // US-0947 : ses combats ; et les Bêtes mortes aux combats, que le résumé compte, retenues sur la Rencontre de la dernière
  // Bête qui a attaqué ; rien sans mort.
  const combats = await combatsDUneExpedition(client, expeditionId);
  const mortes = pertes.reduce((n, p) => n + p.mortes, 0);
  const derniere = mortes > 0 ? combats.at(-1)?.rencontreId : undefined;
  await ecrireUnRecit(
    client,
    territoireId,
    recitDeRetour({
      // US-0920 : rappelée avant de l'atteindre, sa destination reste sous le brouillard : son Biome ne se dit pas (US-0438).
      destination: { biome: decouverte || !rappel ? biome : "Case inconnue", distance: distance(destination, foyer) },
      durees,
      casesLevees,
      rencontres,
      vuesSansSuite,
      tropFortes,
      rentreeLe,
      rappel,
      ramenees,
      autresExpeditions,
      partiesAvant,
      pertes,
      combats,
    }),
    detail.map((r, i) => (vues[i].id === derniere ? { ...r, perdues: mortes } : r)),
  );
}

/**
 * US-0951 : les pertes de l'escorte de l'Expédition `expeditionId` au combat (src/expeditions/pertes.ts), Espèce par
 * Espèce, de la plus commune à la plus rare puis par nom, comme l'escorte se lit ailleurs : ses Bêtes mortes et ses
 * Blessés ; aucune Espèce qui n'a rien perdu.
 */
async function pertesDeLEscorte(client: PoolClient, expeditionId: number): Promise<PerteRacontee[]> {
  const { rows } = await client.query<PerteRacontee>(
    `select es.nom, s.perdues - s.blessees as mortes, s.blessees
     from expedition_escorte s join espece es on es.id = s.espece_id join rarete r on r.id = es.rarete_id
     where s.expedition_id = $1 and s.perdues > 0
     order by r.rang, es.nom`,
    [expeditionId],
  );
  return rows;
}

/**
 * US-0949 : les Espèces des Bêtes que le joueur avait repérées sur la Case `laCase` au départ de l'Expédition
 * (betesReperees, à cet instant) et qu'elle n'a pas vues (`vues`, ses Rencontres) : toute Bête encore là à son arrivée,
 * elle la voit (US-0962), même à l'instant où une autre Expédition l'emmène ; ne pas l'avoir vue, c'est qu'elle était
 * partie, à la fin de sa durée ou avec une autre Expédition. Chacune une fois, dans l'ordre où le joueur les a vues.
 * Aucune sans séjour, pour une Expédition rappelée avant d'arriver. Une lecture du passé, fixé au départ : la même en
 * direct, au rattrapage ou par la tâche planifiée.
 */
async function betesPartiesAvantLArrivee(
  client: PoolClient,
  territoireId: number,
  laCase: Coordonnees,
  horaires: HorairesDUneExpedition,
  vues: readonly Rencontre[],
): Promise<string[]> {
  const sejour = sejourDUneExpedition(horaires);
  if (!sejour || sejour.fin <= sejour.debut) return [];
  const vuesIci = new Set(vues.flatMap((r) => (r.numero === null ? [] : [r.numero])));
  const parties = (await betesReperees(client, territoireId, horaires.partLe)).filter(
    (b) => b.laCase.q === laCase.q && b.laCase.r === laCase.r && !vuesIci.has(b.numero),
  );
  return [...new Set(parties.map((b) => b.espece))];
}

/**
 * US-0962 : si l'Expédition d'un autre Territoire que `territoireId` était sur la Case `caseId` à un instant du séjour
 * `sejour` (expeditionsPresentesSurLaCase) ; celles du même joueur, qu'il connaît, ne comptent pas. Lue au retour : les
 * horaires de chacune sont fixés au départ, ou au rappel, d'où la même réponse en direct, au rattrapage ou par la tâche
 * planifiée. Sans séjour, aucune.
 */
async function dAutresJoueursSurLaCase(client: PoolClient, territoireId: number, caseId: number, sejour: { debut: Date; fin: Date } | null): Promise<boolean> {
  if (!sejour || sejour.fin <= sejour.debut) return false;
  return (await expeditionsPresentesSurLaCase(client, caseId, sejour.debut, sejour.fin)).some((x) => x.territoireId !== territoireId);
}

/** US-0935 : le nom de chacune des Espèces `ids`, dans le même ordre. */
async function nomsDesEspeces(client: PoolClient, ids: string[]): Promise<string[]> {
  const { rows } = await client.query<{ nom: string }>(
    "select e.nom from unnest($1::text[]) with ordinality as v(id, rang) join espece e on e.id = v.id order by v.rang",
    [ids],
  );
  return rows.map((r) => r.nom);
}

/** US-0938 : les Bêtes qui ont suivi l'Expédition jusqu'au Foyer (betesQuiSuivent), avec le nom de leur Espèce. */
async function betesRameneesAuFoyer(client: PoolClient, expeditionId: number): Promise<BeteRamenee[]> {
  const betes = await betesQuiSuivent(client, expeditionId);
  if (betes.length === 0) return [];
  const noms = await nomsDesEspeces(client, betes.map((b) => b.especeId));
  return betes.map((b, i) => ({ nom: noms[i], sexe: b.sexe }));
}

/**
 * US-0942 : les Espèces trop fortes pour l'escorte de l'Expédition `expeditionId` parmi ses Rencontres `vues`
 * (especesTropFortes), dans le même ordre : leur nom, et la force qui manquait à l'escorte (forceQuiManque), nulle sans
 * escorte (US-0935). Une force qui ne manque plus au retour (les caractéristiques des Espèces rechargées entre-temps, ou
 * une Espèce sans arme face à une Expédition sans escorte) ne se dit pas : « il lui manquait 0 de force » n'a pas de sens.
 */
async function especesRestees(client: PoolClient, expeditionId: number, vues: Rencontre[]): Promise<TropForte[]> {
  const ids = especesTropFortes(vues);
  if (ids.length === 0) return [];
  // L'une après l'autre : sur le client d'une transaction, deux requêtes ne partent pas à la fois.
  const escorte = (await forcesDesEscortes(client, [expeditionId])).get(expeditionId) ?? null;
  const forces = await forcesDesEspeces(client, ids);
  const noms = await nomsDesEspeces(client, ids);
  return ids
    .map((id, i) => ({
      nom: noms[i],
      manque: forceQuiManque(escorte, { force: forces.get(id)!, rareteId: vues.find((r) => r.especeId === id)!.rareteId }),
    }))
    .filter((e) => e.manque > 0);
}
